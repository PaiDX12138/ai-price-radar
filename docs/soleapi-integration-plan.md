# SoleAPI：公开采集与数据保存方案

研究日期：2026-10-30（北京时间）。本文件保留研究阶段的方案与观测；**后续已实施独立采集及首次本地入库，实际实现、调度与部署见 [SoleAPI采集运行说明](soleapi-collection.md)**。下文“拟实施”表示原方案，不代表当前仍未开发。

## 结论与接入顺序

采用 SoleAPI 独立适配器，不能套用 PackyAPI 的 New API 字段或倍率公式。

1. 公开 JSON 获取完整目录、渠道关系、基础计费项、汇率和厂商品牌。
2. 公开模型详情 HTML 中的结构化数据补齐计费档位、探测历史及延迟统计；不需要运行浏览器。
3. 先写 SQLite，再导出已有前台只读快照；页面请求不访问外站。
4. 价格与性能分别调度。官方近 7 日摘要单独保存，本站十五日统计只从已去重的带时间戳探测记录计算。
5. 目前未找到公开的**分组级**性能、TTFT 或十五日全量历史接口。源分组实测仍保持未知；按后续需求，页面可展示由本组型号历史计算、明确标注“系统汇总”的综合指数，不复制整站均值。

## 1. 已取得的证据

### 1.1 公开请求结果

下列结果来自本机真实匿名 GET，不携带 API Key 或账号 Cookie。数字是当次快照，不是写死的目录规模。

| 项目 | 观察结果 |
| --- | --- |
| `/api/public/models` | HTTP 200；`code=200`；`data.total=51`，`data.list.length=51` |
| 型号与渠道 | 51 个型号、14 个渠道、83 个型号—渠道关系 |
| 平台 | Anthropic 14、OpenAI 10、Google 9、xAI 5、Qwen 5、DeepSeek 3、Zhipu 3、MiniMax 1、TypeSafe 1 |
| 基础价格币种 | 39 个型号为 USD 原价基准，12 个为 CNY 原价基准；有效结算价另为 Credits |
| 元数据 | 上下文、最大输出、能力、协议、厂商、基础价、默认倍率、分组倍率、更新日期 |
| 健康与吞吐 | 22 个型号有 `health`，49 个有 `throughputTps`；其余缺失不是 0 或 100% |
| 档位 | 目录只有 `activeTiers` 等当前标记；详情结构包含完整 `tiers` 条件 |
| 可见计费单位 | `per_M_tokens`、`per_k_calls`、`per_image`、`per_second` |
| `/api/public/fx` | HTTP 200；`rates.USD=0.1516341614`，来源 `stripe`，源更新时间 `2026-10-29T21:09:00Z` |
| `/api/public/vendors` | HTTP 200；10 个厂商档案，包括当前没有在售型号的 Kimi；不能据此新增 Kimi 报价 |
| `/icon.svg` | HTTP 200，官方站点 SVG，原始 2,611 字节 |

目录页面的客户端资源直接引用 `/api/public/models`、`/api/public/fx`；共享品牌组件引用 `/api/public/vendors`。接口完整返回目录，页面筛选不代表采集时应按平台分页。

### 1.2 页面结构与样本

核对了公开详情：Claude Opus 5.5、DeepSeek V4 Pro、GPT-Image-2.5 Sunburst、Grok Imagine Image 2.0、Grok Imagine Video 1.5。未抓取全部 51 个详情，因此不能声称所有详情的每一个档位已经逐项验证。

- 模型页 SSR HTML 包含 React Flight 的 JSON 数据片段，目标组件有 `model.canonicalName / charges / channels / tiers / health`。
- Claude 和 DeepSeek 样本的 `health.history` 均为最近 60 次记录，单条包含 `at / ok / latencyMs`。
- Claude 样本历史从 `2026-10-29T06:30:02.989032Z` 到 `2026-10-30T02:39:32.749366Z`，约 20 小时，不是 60 小时或十五日。
- 同一详情还有近 7 天成功/总探测数，以及最近 60 次延迟均值、P95。它们是不同窗口，不可混合。
- 目录 `health.bars` 只有布尔序列，没有每根时间；官方目录页部分条高也只是展示算法，不能作为本项目的真实耗时序列。
- 官网首页展示的 99.99%、642ms、地区节点延迟等，没有本次可复现的对应监测数据源，不写入历史性能表。

证据优先级：当前匿名响应与其实际页面计算 > 搜索引擎缓存 > 泛化文档。搜索引擎抓到的旧页面价格/日期不可覆盖本轮原始响应。

## 2. 接口分层

以下 URL 均由页面或官网文档确认；没有扫描后台或猜测隐藏路由。

| 请求 | 类型/鉴权 | 可采内容 | 采用方式 |
| --- | --- | --- | --- |
| `GET https://soleapi.com/api/public/models` | 页面公开 JSON，匿名 HTTP 200 | 目录、渠道、基础收费、默认倍率、近 7 日健康摘要、吞吐 | 报价主源 |
| `GET https://soleapi.com/api/public/fx` | 页面公开 JSON，匿名 HTTP 200 | 每 Credit 的多币种参考金额、来源和更新时间 | 独立汇率存档 |
| `GET https://soleapi.com/api/public/vendors` | 页面公开 JSON，匿名 HTTP 200 | 品牌、标签、Logo 版本 | 元数据补充，不当作在售清单 |
| `GET https://soleapi.com/zh/models/{canonicalName}` | 公开 HTML，匿名 HTTP 200 | 完整档位、原生/适配协议、最近探测点和统计 | 结构化页面采集 |
| `GET https://soleapi.com/zh/models` | 公开 HTML，匿名 HTTP 200 | 当前 SSR 初始完整目录与可见模型链接 | 与 JSON 交叉核对、独立格式备用 |
| `GET https://soleapi.com/icon.svg` | 公开资源，匿名 HTTP 200 | 站点 Logo | 下载并校验后本地保存 |
| `GET /api/public/vendors/{vendor}/logo.svg?v={version}` | 页面已引用的公开资源 | 各模型厂商 Logo，不是 SoleAPI 站点 Logo | 按需，不混用品牌 |
| `GET /v1/models`、`/v1/models/{model}`、`/v1beta/models` | 文档明确需要 API Key | 该 Key 实际可调用集合 | 不用来替代全站匿名报价，不请求用户密钥 |
| `GET /v1/usage` | 文档需要 API Key | 个人余额、累计消费 | 不纳入公共采集 |
| 控制台钱包/请求日志/账号单价 | 登录态 | 私人流水和实际账号权限 | 不纳入公共站点目录 |

公开 JSON 是页面接口，不是文档承诺的稳定开放 SDK；需要字段校验、原始快照和变更告警。目前没有独立、已核实的公开详情 JSON/监测 JSON URL，不猜 `/api/public/models/{id}` 或自行追加 `days=15`。

### 详情解析要求

使用结构化解析，不用 `eval`、`Function` 或执行网页脚本：

1. 定位页面中的 `self.__next_f.push(...)` 数据片段，JSON 解码并按顺序拼接 Flight 文本。
2. 解析 JSON 记录，按 `model.canonicalName` 与请求型号严格匹配目标对象，不把 `related` 里的其他型号当作主型号。
3. 检查必要字段；Flight 引用只针对需要的字段做有界解析，不把 `$Q...` 等引用字面量误作真实值。
4. `chargeOrder` 可以从完整目录取得；实际 `model.charges / tiers / health.history` 必须是已解析结构。
5. 若站方改变页面结构，保留旧补充字段，记录该型号详情失败，不清空报价目录或历史。

## 3. 价格和折扣：三个口径分开

### 3.1 原价、目录参考价、真实渠道价

观察到的页面算法为：

```text
charges[item].price                 = 站方当前原价基准数字，保留 priceCurrency
目录参考 Credits 价                = 原价基准 × model.priceMultiplier
具体渠道 Credits 价                = 原价基准 × channels[channel].multiplier
Credits 转 USD 参考价              = Credits 价 × fx.rates.USD
```

`charges` 当前数字已由页面直接乘一次所选倍率展示；不能先乘目录默认倍率，再乘渠道倍率，更不能再乘 USD/CNY 汇率后仍写为 Credits。

**发现明确的不一致：**11 个 Claude 型号的 `priceMultiplier=0.3`，但最便宜的已列渠道是 `Kiro-Claude分组 ×0.5`。例如 Claude Opus 5.5：

| 项目 | 输入/百万 tokens |
| --- | --- |
| 站方展示的 USD 原价基准 | USD 4 |
| 目录“全部”默认参考 | 1.2 Credits（4 × 0.3） |
| Kiro-Claude 具体渠道/详情表 | 2 Credits（4 × 0.5） |
| Claude 官方渠道 | 6 Credits（4 × 1.5） |
| AWS Bedrock 渠道 | 12 Credits（4 × 3） |

保存两者并记录 `catalog_channel_multiplier_mismatch`，不凭空制造 ×0.3 渠道、不把目录价当成每个分组价。建议首页聚合以可定位渠道的最低有效报价为准；独立保留官方目录参考价用于说明，详细列表不能产生价格自相矛盾。

### 3.2 充值基准与汇率冲突

模型详情明确写明 `1 Credit = ¥1`，并用当日 FX 把 Credits 转为美元参考。`/api/public/fx` 的 `rates.USD` 是 **USD / Credit**，不是 USD/CNY 的反方向汇率。

但通用计费文档同时出现余额以 USD 计、Credit 对应美元标价记账点数等表述；图像文档也泛称图片按张收费，与 GPT 图片实际 Token 价目不一致。

处理方案：

- 原始结算币种统一记 `CREDIT`；原价币种单独记 `USD` 或 `CNY`，不把 CREDIT 直接写成现金 USD。
- 保存模型详情的 `1 CNY/Credit` 证据、FX 源时间和文档冲突标记。该值标注为公开结算基准，不宣称个人充值实付、手续费、赠送额度都完全等价。
- 若详情基准与 FX/页面算法不再一致，仍保存原始 Credits 报价，停止推算实付换算和货币折扣，不猜新比例。

### 3.3 折扣字段不能直接照搬标签

目录 `discountPercent=70` 是原数字倍率折扣（省 70%，比率 0.3），不是已经完成跨币种换算后的实际折扣。

对于具体渠道，按站方详情公开算法：

```text
若原价币种 CNY：relativePriceRatio = channelMultiplier
若原价币种 USD：relativePriceRatio = channelMultiplier × fx.rates.USD
中文折数 = relativePriceRatio × 10
```

本轮 Claude Kiro 渠道示例：`0.5 × 0.1516341614 = 0.0758170807`，约 0.76 折；不是目录 70% off 对应的 3 折。原数字和计算细节都保存，页面只给一个对应**当前报价渠道**的标签。

保存来源分层：

- `reportedDiscountPercent`：站方原字段，只作为来源证据；
- `nominalRatio`：目录默认或渠道倍率，标明作用域；
- `discount_ratio`：本项目实际显示的同单位、同币种基准比率；
- `discount_details_json`：币种、原价、有效价、渠道、FX 值/来源/日期、公式、条件。

站方 `charges` 是“站方声称的原厂基准”，不是本项目独立查证的原厂官方价。来源标注 `station_reference` / `station_formula`；有独立官方来源才标 `official`。缺汇率则 USD 模型的跨币种折扣留空，CNY 同币种折扣可继续计算。

## 4. 不遗漏计费维度与图片/视频规格

### 4.1 已见字段

真实收费键有 13 种：`prompt`、`completion`、`cache_read`、`cache_write`、`cache_write_5m`、`cache_write_1h`、`web_search`、`image_input`、`image_output`、`image_cache_read`、`audio_input`、`video_input`、`video_output`。

`chargeOrder` 列有 40 个潜在维度，不等于 40 种当前都有在售单价。未知新增键原样保存并告警，不能只取输入/输出两列，也不能给未返回的收费项补 0。

### 4.2 当前样本的实际有效报价

| 型号/渠道 | 计费 | 基础档有效价 | 备注 |
| --- | --- | --- | --- |
| Grok Imagine Image 2.0 / Grok 官方 | 按张 | 0.4 Credits/张 | 当前基础原价 1 × 0.4；1K/Low 基础档 |
| Grok Imagine Video 1.5 / Grok 官方 | 按秒 | 0.08 Credits/秒 | 0.2 × 0.4；480p 基础档，不冒充每次价 |
| GPT-Image-2.5 Sunburst / Azure 图片 | 按 Token | 文本输入 17.5、图像输入 28、图像输出 105 Credits/M Token | 分项分别乘 3.5；不能推算一张必需多少钱 |

规格规则必须同时保存：

- Grok 图片：1K/Low、1K/Medium、2K/Low、2K/Medium；按已给 `chargeFactors` 对相应收费项修正。
- Grok 视频：480p、720p、1080p；720p 对应 1.75、1080p 对应 3.125 的 `video_output` 系数，故样本价为 0.14 / 0.25 Credits/秒。
- Claude Fast：`speed` 匹配 `^fast$`，相关收费项 ×2，可与渠道叠加。
- DeepSeek Peak：周一至周五 UTC 01:00–04:00、06:00–10:00，相关收费项 ×2；目录 `activeTiers=["Peak"]` 时，返回数字已是页面当前使用的价格，不再机械二次乘 2。

规则保留 `group / label / triggers / chargeFactors / factor / timezone`。同一 group 的档位与不同 group 的叠加不能混为一谈，不能未经证明把所有规则系数相乘。当前有效报价严格跟随源响应；枚举其他条件价时必须确认基准档位，否则仅展示条件说明。

### 4.3 模态识别

`capabilities.image=true` 通常也表示看图输入，不等于生图；`capabilities.video=true` 可能是视频理解，不等于视频生成。

- 生成任务优先看 `protocols.taskType=image/video`；同时看输出收费键。
- 本次 4 个模型明确有 image 任务，1 个有 video 任务。
- 另外 4 个 Gemini Image 型号通过 conversation/generateContent 出图，虽然源页面标签可能叫 Text，仍有 `image_output` 收费，图片 Tab 也要纳入。
- 因而按本次输出能力判断，是 8 个支持出图收费的型号、1 个视频生成型号；不按源页面单个 Text 标签机械排除。
- 首页默认文本推荐避免选纯图片/视频，保留既有四大平台优先及新型号自动排序；图片 Tab 区分按张与 Token，视频 Tab 显示按秒和已确认规格。

## 5. 性能：7 日摘要与十五日历史分别保存

### 5.1 能获得什么

| 数据 | 来源窗口/作用域 | 用途 |
| --- | --- | --- |
| `health.availability.success/total` | 官方近 7 天、型号级探测 | 单独保存 source summary，不能相邻采集相减制造日数据 |
| `health.history[].at/ok/latencyMs` | 最近 60 次、型号级、带 UTC 时间戳 | 去重积累，作为本站十五日探测统计原料 |
| `health.lastLatencyMs` | 最近一次端到端延迟 | 不是首 Token 时间 |
| `health.avgLatencyMs/p95LatencyMs` | 最近 60 次 | 原窗口摘要，不直接充当十五日均值/P95 |
| `throughputTps` | 近 7 日真实流量输出吞吐摘要 | 独立显示 `t/s`，标“近7日”，不写入每小时制造小时吞吐历史 |
| `health.bars` | 无单点时间，目录简化图 | 仅存原始证据，不用作本站时间轴 |
| TTFT、缓存命中率、分组实测 | 本次公开数据未返回 | null，不用总耗时或其他组数据代替 |

**分组原始观测不得伪造：**源探测描述是自动故障切换后的型号最终用户成功率，没有渠道 ID。同一批探测仍只保存一份型号观测。按后续需求，快照导出时依据每个分组真实成员，在统一小时网格计算“系统汇总”指数（同小时型号等权，再小时等权），不是渠道独立实测。缺失型号、小时不计入；组内没有任何有效历史则保留空态。若以后取得官方分组数据，优先展示官方分组数据。

### 5.2 十五日计算

- 采集详情历史，唯一键 `(station_id, canonical_model, source_timestamp)`，源时间保留微秒精度文本；不要截断为毫秒后覆盖不同点。
- 同一探测再次抓到只更新 `last_seen_at`，不重复增加分母；同时间状态/延迟冲突保留原快照并告警，不悄悄覆写。
- 每小时重建该小时的成功数、失败数、延迟计数/合计；由持久化去重探测重算，禁止从 7 日累计计数差分。
- 型号十五日可用率采用窗口内 `成功探测数 / 总探测数`。平均端到端耗时只用有效成功探测；失败耗时单独保存，不混成正常响应均值。
- 站点百分比可使用有数据型号十五日可用率等权均值，必须标明型号等权探测指数，不能叫真实全站请求 SLA；同时输出“22/51 型号有探测”等覆盖数。
- 六小时/根、60 根细条，保留固定 UTC 小时网格。颜色看探测成功率，高度看成功探测耗时，缺样本灰色，缺失段不补成功。
- 记录 `probeCount`、`coveredHours`、首末源时间、最大缺口和已积累天数，区分“这个小时有点”与“连续监测了一小时”。页面时间用北京时间，存储统一 UTC。
- 刚接入只取得约 20 小时原始历史时，显示“近15日 · 已积累约1日”，不是声称已有完整十五日。
- 当前小时标 partial；15 日均值按实际窗口内探测点计算，不以末次状态持续填充剩余时间。
- 不把 7 日吞吐摘要伪装成十五日每小时 TPS，也不把 `lastLatencyMs` 放进“首Token”。共用组件需要按该站能力隐藏/留空 TTFT，改为准确的“最近耗时”标签时必须注明口径。

这需要 Sole 专用聚合器，不能直接把本次 source summary 填进现有 `buildPerformanceMonitor` 的小时行；否则会把采集频次当权重、把 `samples` 的小时数误作探测数。

## 6. SQLite 保存规范（拟实施）

沿用一个 `data/transit.sqlite`，不新建平行业务库。迁移先备份，事务变更；源响应存忽略目录 `data/transit/raw/soleapi/`，不提交 Git。

### 6.1 复用现有表

| 表 | Sole 映射 |
| --- | --- |
| `transit_stations` | id=soleapi；site_url=https://soleapi.com/；collector_kind=soleapi_v1；公开结算/FX证据与冲突状态 |
| `transit_groups` | 14 个真实渠道；源未给 ID，group_key 使用原始渠道名、display_name 同名；不拿翻译文本生成 ID |
| `transit_offers` | 当前 83 个真实型号—渠道报价；主字段供已有 UI 使用，结算币种 CREDIT |
| `transit_offer_observations` | 成功报价的不可变快照，附完整收费分项及倍率/档位/FX版本引用，不只保存四个摘要价 |
| `transit_source_snapshots` | JSON/HTML/SVG、URL、抓取时间、内容哈希、解析状态及错误；不保存账号 Cookie/密钥 |
| `transit_collection_runs` | pricing/detail/performance 等阶段及各型号局部失败 |
| `transit_collect_schedule` | 目录六小时任务，持久化租约、退避 |
| `transit_performance_schedule` | 每小时探测详情回扫，独立于价格成功与否 |

当前 `transit_offers` 的输入、输出、cache read、5m/1h cache write 仅是摘要；字段缺失为 null，不等于免费。图片 Token 的 `image_output` 不覆盖普通 `completion` 造成单位混乱；每秒价也不标为每次价。

### 6.2 新增六类持久化数据

以下是拟定表，不是已经创建：

| 表 | 关键字段/唯一性 | 原因 |
| --- | --- | --- |
| `transit_model_catalog_versions` | station_id、canonical_model、content_hash 唯一；别名、平台、上下文、能力、协议、默认倍率、基础币种、charges、tiers、activeTiers、catalog/detail 来源及源更新时间 | 保留原始型号属性和目录参考价，不能塞进某一个分组的私有倍率 |
| `transit_offer_charge_items` | offer_id + charge_key 唯一；unit、base_currency、base_price_text、channel_multiplier_text、effective_credit_price_text、pricing_version_hash、source_url | 任意收费项均可保存，不丢媒体/工具费；完整十进制文本为权威值，UI数值只是投影 |
| `transit_model_probe_observations` | station_id + canonical_model + probe_at 唯一；ok、latency_ms、first/last_seen_at、source_url、raw_hash | 保存真实探测点，绝不冒充分组点 |
| `transit_model_probe_hourly` | station_id + canonical_model + bucket_at 唯一；成功/失败/延迟数量、延迟和、首末点、gap、partial | 增量索引和十五日快速聚合 |
| `transit_model_metric_summaries` | station_id + canonical_model + metric_kind + window_hours + observed_at 唯一；value/counts、source_url、last_probe_at、raw_hash | 把 probe 7 日、流量吞吐 7 日、最近60次延迟等不同窗口分开；没有精确窗口边界就不编造起止时间 |
| `transit_fx_observations` | station_id + currency + source_updated_at + content_hash 唯一；amount_per_credit_text、source、captured_at | 重现每次价格换算与折扣，不用今天汇率重算旧标签 |

价格使用十进制字符串解析和精确乘法，原始字符串保留；不在入库阶段截成两位小数。前台概要最多两位，极小正数 `<0.01`，详情按原始精度。缓存0价只有接口明确为0才保留为0，缺项不造0。

索引覆盖 `(station_id, probe_at)`、`(station_id, canonical_model, bucket_at)`、offer_id 和 source hash。探测原点保留至少35日；当前目录/报价及必要审计长期保存，原始页面文件按引用关系与保留期有界清理。

### 6.3 数据完整性与原子发布

1. HTTP成功且业务 `code=200`；`data.total` 与去重型号数相符，所有型号都有可解析收费、币种与渠道引用。
2. 报价数量按真正模型—渠道关系统计，不把厂商数、related 型号、协议条数当报价数。
3. 首次核对四大平台与当前官方公开目录；后续比较型号、分组、报价数量及模型集合。大幅缩减拒绝整批覆盖，原始响应照存。
4. 未知单位/价目语义不能静默落成 Token；原始字段存档并使相应型号待处理，不发布误导价。
5. 目录更新与“确认下架”在同一事务；详情可局部失败，保留旧详情并标 stale，不由某个详情404直接全站下架。
6. 拆分价目指纹与性能指纹：吞吐/探测变化不重复制造未变更价格版本。
7. 先写成功数据库事务，再原子替换 `latest.json`；保留 last-good。不搬运本地数据伪装服务器采集成功。

## 7. 调度、网络与请求量

建议初版：

| 任务 | 周期 | 策略 |
| --- | --- | --- |
| 全量目录 + FX + vendors | 6小时 | 目录完整性校验；FX/brands失败不删除报价，但相关换算标签停用 |
| 全量详情计费补全 | 首次、6小时增量/轮转 | 51个型号逐个有界抓取；新增型号与源版本变化优先；不能只依赖 updatedAt，因为时段档位会变 |
| 已有 health 型号详情 | 1小时 | 当前22个，回扫最近60点；每次去重，约20小时回看支持短时断网后的补采 |
| 吞吐摘要 | 性能轮次时顺带取一次目录 | 仍记来源近7日，不重标窗口 |
| Logo | 初次、版本/内容变更 | 校验SVG后本地保存，不每个请求重新下载 |

每小时大约一次目录 + 当前有探测型号的22个详情，并非每5分钟全站51页。串行、间隔300–500ms，单请求20秒、响应2MiB、整轮不超过3分钟；达到预算保存逐型号进度，下一轮轮转继续，避免每次永远从首型号开始。

429遵守Retry-After，403停止并记录，不高速重试；普通网络失败15/30/60分钟退避。保留现有站点专用固定代理配置能力，但没有服务器实测前不宣称 SoleAPI 在阿里云一定可直连，也不自动修改DNS或部署代理。

## 8. 拟改动与验收条件

实施时新增 `collectors/transit/soleapi.mjs`、`soleapi-storage.mjs`、`config/transit/soleapi.json`，在现有调度分派、数据库迁移和快照导出挂接。扩展现有价格详情的分项读取，不重做页面样式。

验收应按服务器当前实际源数据判断，不固定51/83：

- 完整目录的模型/渠道/报价计数与源 `total`、关系集合一致；四大平台齐全。
- Claude目录倍率差异有审计，Kiro等具体渠道价格与详情表一致。
- 图片分别按张/Token，视频按秒；1h cache、工具费和档位均可追溯。
- 汇率方向、Credit基准与折扣引用同一版本；没有有效换算证据时不猜标签。
- 同一历史点回扫不增样本数；7日摘要不灌入15日小时桶；TTFT为空，分组监测不伪造。
- 首次不足15日明确覆盖长度，细条缺失段保持灰色；官方吞吐标“近7日”。
- 采集后网站读取新快照；网络失败可定位到确切URL、错误码和阶段，旧数据不被清空。

此次仅公开数据研究与文档：没有创建实际站点配置、修改页面、执行迁移、业务采集入库、构建、测试、类型检查或浏览器验收；也未提交/推送。

## 9. 证据与复现入口

来源：

- [模型目录](https://soleapi.com/zh/models)
- [公开目录JSON](https://soleapi.com/api/public/models)
- [公开汇率JSON](https://soleapi.com/api/public/fx)
- [公开厂商JSON](https://soleapi.com/api/public/vendors)
- [Claude详情：分组完整价目、7日探测定义与60点延迟](https://soleapi.com/zh/models/claude-opus-5-5)
- [DeepSeek详情：时段条件](https://soleapi.com/zh/models/deepseek-v4-pro)
- [图片按张详情](https://soleapi.com/zh/models/grok-imagine-image-2.0)
- [图片Token详情](https://soleapi.com/zh/models/gpt-image-2.5-sunburst)
- [视频按秒详情](https://soleapi.com/zh/models/grok-imagine-video-1.5)
- [鉴权模型目录说明](https://soleapi.com/zh/docs/api/models)
- [计费文档（存在与模型页口径不一致）](https://soleapi.com/zh/docs/guides/billing)
- [媒体接口文档](https://soleapi.com/zh/docs/api/media)

本地原始证据、研究脚本输出和SHA256清单在忽略目录 `work/soleapi-research/`；范围见其中scope.md。JSON响应与本次5个详情对象均有原始文件，`evidence-manifest.json`列出取证文件哈希。

最小只读复现（不触发模型调用、不产生付费请求）：

```bash
curl --connect-timeout 8 --max-time 20 -sS https://soleapi.com/api/public/models
curl --connect-timeout 8 --max-time 20 -sS https://soleapi.com/api/public/fx
curl --connect-timeout 8 --max-time 20 -sS https://soleapi.com/api/public/vendors
```
