# RightAPI 接入研究与实施方案

研究日期：2026-10-29（北京时间）。状态：独立适配器已完成首次本地实际采集及入库，公开快照现含两个站点；尚未提交部署，未进行测试、构建或浏览器验收。

## 结论

可以接入第二个中转站点，展示名采用站点当前品牌 **Right Code**，站点 ID 建议为 `rightapi`，首页保留用户给出的 `https://www.rightapi.ai/`。

这是自研系统，公开响应不是 New API / PackyAPI 的数据结构，必须使用独立适配器。现有 SQLite、快照、分组分页、模型排序、站点外链和 Tooltip 可以复用。

本次实际匿名读取的报价包含 **14 个渠道、55 个不同型号、78 条渠道×模型记录**；其中 **75 条标记可用，涉及 54 个不同型号**，包括 64 条文本记录和 11 条图片记录。目前这份清单没有视频渠道。数量是研究时刻的快照，不应硬编码。

三个关键限制：

1. 当前公开历史没有直接得到 15 日小时序列。`window=15d` 实际返回 `window:"24h"`；对照 `window=7d` 则返回 `window:"7d"`。不能只看 HTTP 200。
2. 公开可用率接口没有首 Token、平均响应耗时或 TPS 字段。这些位置暂时显示 `—`，不能借用 PackyAPI 或用 HTTP 下载耗时填充。
3. `effective_total_multiplier` 是基准价到站内价的计费倍率，不能直接当“相对官方美元价的折扣”。站内美元额度与美元现金不是同一单位，部分渠道的官方基准还是人民币。

## 实际核实的接口

所有成功请求均未携带账号、Cookie 或 API Key；只读取公开资料，没有请求推理、下单或账户接口。

| GET 路径 | 本次结果 | 用途 |
| --- | --- | --- |
| `/configs` | 200，JSON | 充值基础比例、公开文档入口、公告；仅对白名单字段建立业务映射 |
| `/upstreams/public` | 200，JSON，14 个渠道 | `id/name/prefix/type/supported_protocols/default_protocol/is_active/rate/remark` |
| `/models/public` | 200，JSON | 渠道下模型、可用标志、基础价、有效价、阶梯价、时段价、计费模式 |
| `/models/availability/all` | 200，JSON，约 1.09 MB 文本 | 一次取得全部渠道×模型的 2h/24h/7d/30d 序列 |
| `/models/availability?upstream_prefix=%2Fcodex` | 200，返回窗口 24h | 单渠道核对；正常采集优先使用批量接口 |
| `/models/availability?upstream_prefix=%2Fcodex&window=7d` | 200，返回窗口 7d | 确认窗口参数确实生效 |
| `/models/availability?upstream_prefix=%2Fcodex&window=15d` | 200，实际返回窗口 24h | 证明不能将请求参数当成实际覆盖时长 |
| `/models/effective` | 401，Missing userToken | 当前登录后页面调用的账号有效价格接口；不作为匿名采集源 |
| `/tiers/public` | 200 | 套餐等级和渠道限制，不是模型计费分组，不映射成站点分组卡片 |

报价入口返回 `upstreams` 与 `groups`，本次 `groups` 为空。我们的“站点分组”应由 14 个 upstream 渠道生成，不是从空的 `groups` 数组读取。

### 公共接口、页面接口与页面采集的区分

“匿名可读”和“页面调用”是两个维度，不是互斥分类。本次确认的报价/监测 JSON 主要来自官网前端接口配置及实际响应；不能因此声称它们是有稳定版本承诺的第三方开放 API。

| 数据 | 来源形式 | 匿名情况 | 是否需要浏览器渲染 |
| --- | --- | --- | --- |
| 全部渠道、协议、渠道倍率、说明 | 页面 JSON：`/upstreams/public` | 实测 200 | 不需要 |
| 模型、公开有效价格、阶梯及按次价格 | 页面 JSON：`/models/public` | 实测 200 | 不需要 |
| 模型×渠道可用率历史 | 页面 JSON：`/models/availability/all`、单渠道接口 | 实测 200 | 不需要 |
| 充值数值配置、公告、文档入口、介绍 | 页面 JSON：`/configs` | 实测 200 | 不需要；部分字段是嵌套 JSON、HTML 或 Markdown 字符串，需单独解析 |
| 套餐等级和渠道限制 | 页面 JSON：`/tiers/public` | 实测 200 | 不需要；不作为报价分组 |
| 当前登录账号的有效价格 | 登录后页面 JSON：`/models/effective` | 实测 401，Missing userToken | 不靠 DOM 抓取替代登录；不纳入匿名公共报价 |
| 充值语义、计价说明、使用限制 | 文档 HTML 正文 | 文档可读 | 不需要，提取正文即可 |
| 品牌名、简介、favicon/品牌资源 | 首页 HTML 元数据及实际资源 | 首页实测 200 | 不需要；当前首页品牌主要是前端文字组件，不能假定存在 `/logo.svg` |
| 首 Token、平均耗时、TPS、缓存命中率 | 本次公共响应未发现字段 | 未找到可核实来源 | 没有证据证明 DOM 有这批数据，不能把“暂未公开”说成“需要页面采集” |
| 准确的15日小时历史 | 本站持续累积24h小时窗口 | 源站没有直接返回所请求15d序列 | 不是页面抓取问题，需小时存储与去重 |

当前核心采集无需运行无头浏览器或逐行抓模型卡片。接口的可用标志 `is_available` 是当前目录状态，不能替代历史百分比；私有账号折扣也不能混入公开最低价。

## 字段与价格映射

### 渠道与模型身份

- 站点身份为 `rightapi`；渠道键采用原始 `prefix`，例如 `/codex`、`/codex-out`、`/claude`、`/draw`，展示名使用渠道 `name`。
- 保留公开上游 `id`。以 `prefix` 连接报价和性能数据，并核对上游 ID，不能按中文名称模糊匹配。
- 模型名保留原始 `name`，同名模型在不同渠道分别落库；整站模型目录可以去重展示。
- 渠道 `is_active` 与模型 `is_available` 分别处理。不可用记录保留原始历史，不进入可售最低价与首页推荐型号；标记可用也不等于历史成功率 100%。
- 模态以 upstream 的 `modality` 和协议为证据，再辅以模型名识别。绘图渠道不能因为协议是 `completions` 就被当成文本。
- `remark` 保存原文作审计，公开展示只使用处理过的文本，不直接渲染外站 HTML。

### 报价

| 源字段 | 接入用途 |
| --- | --- |
| `base_price_config` | 原站标注的官方/基础参考价，连同官方币种保存，不直接充当本站售价 |
| `effective_price_config` | 本站公开有效售价的优先来源，已包含有效倍率，不再次相乘 |
| `input_price / output_price` | 顶层基础报价；不得覆盖有效售价或在有效价缺失时静默回退 |
| `cache_read_input_price / cache_creation_input_price` | 缓存读/写价格；真实 0 与 null 分开处理，不把 0 丢成未披露 |
| `request_price` | 按次报价；图片列表复用现有按次模型展示，默认单位“次”，未证实每次恰为一张时不改写为“张” |
| `billing_mode / tiers / time_periods / param_rules` | 保留计费模式、上下文阶梯、时段、参数规则，连同条件展示，不把所有价格压成单个常量 |
| `effective_upstream_rate / effective_model_rate / effective_total_multiplier` | 计费倍率、对账验证与审计；不直接作为官方折扣 |
| `pricing_source / pricing_version` | 原站方案来源和版本，用于漂移检测；只使用匿名公开方案 |
| `official_currency` | 基础参考币种，当前存在 USD 和 CNY；不得统一当美元现金 |

实测例子：`/codex` 的 `gpt-5.6-sol` 基础输入/输出为 5/30，有效价格为 2/12，倍率 0.4；应保存并显示 2/12，不再乘一次 0.4。更长上下文的有效阶梯为输入 4、输出 18，需保留上下文条件。

`/draw` 的 `gpt-image-2` 有效报价为站内额度 0.04/次，`/draw-pro` 同型号为 0.1/次，两个渠道必须分别保存。当前 `/draw` 下 3 个图片型号标记不可用，不能用它们的旧基础价参与最低价。

`/deepseek`、`/flash` 等存在时段规则；优先采用源站返回的 `is_active`，保留采集时间，不能把一个时段的价格说成全天固定价格。当前接口未给出明确时区时，不自行用服务器本地时区重算。

### 充值与折扣

公开 `/configs` 返回 `public.balance.price:"1.0"`，充值文档明确说明 1 元兑换站内 1$，可以交叉核实后沿用 `¥1 = $1` 标签。文档还区分 Codex 与 Claude 号池的不同计费比例，这不是额外统一充值倍率。

本次额外发现同一 `/configs` 的 `public.readme` 旧介绍仍写“0.2元兑站内1$”，与结构化数值及当前独立充值文档不一致。该 Markdown 只存档，不用关键词正则覆盖充值比例。证据优先使用已确认语义的结构化字段加当前专门文档；二者将来出现冲突时应标未核实，而不是自动挑更便宜的数字。

`public.discount` 本次为空，不编造充值促销；个人邀请返利、开票手续费不混入默认模型价格。

真正的参考折扣必须将分子分母换成同一货币，再比较相同型号、计费单位和上下文档位。优先使用可核实官方价；只有站方基准时明确标记“站方参考”。USD 基准需要带来源及时间的汇率；CNY 基准直接对人民币实际成本。条件不匹配时不显示折扣。

## 15 日可用率如何做

### 源站实际粒度

每个窗口均有 24 个点：2h 每点约 5 分钟、24h 每点约 1 小时、7d 每点约 7 小时、30d 每点约 30 小时。最后一个点可能未结束。

每点包含 `start_at/end_at/availability/user_availability/first_attempt_availability/no_sample`。当前页面使用 `availability` 绘图，因此先对齐该字段；另两种成功率原样留存，但在语义未充分确认前不混用或重命名。

`no_sample:true` 的点可能同时写着 availability=100，必须视为缺样；`no_sample:false` 且 availability=0 才是明确失败。本次 75 条可用报价都能按渠道前缀和原始型号找到 24h 序列。

### 推荐方案：本地小时历史累积

1. 首次只导入源站 24h 窗口中的真实小时桶，后续每轮回扫 24h 并按身份去重。价格默认 6 小时采集一次；性能建议独立每小时抓一次批量接口，以更及时修正末桶和降低中断漏数风险，不影响 PackyAPI 的原有调度。
2. 每条保存站点、渠道、原始模型、桶开始/结束、实际源窗口、实际粒度、源生成时间、采集时间、三种成功率及 no_sample。小时桶和粗粒度桶不能共用一个缺乏分辨率的唯一键。
3. 未结束小时保留为 provisional，后续回扫更新；汇总优先使用已结束且源时间更新的小时。不得将 24h 的源窗口伪写成源站 360h 查询结果。现有 `window_hours` 过滤需要拆清“源查询窗口”和“本站聚合窗口”。
4. 仍使用本站滚动 360 小时网格，输出 60 根固定 6 小时细条。首日仅右侧已有历史显示颜色，左侧灰色；显示有效小时覆盖，缺失小时不补成功。
5. 接入初期明确提示“近15日 · 已覆盖 X/360 小时”，不要让尚未积累的历史看起来是完整 15 日。积累足够数据后自然形成完整滚动窗口。
6. 7d/30d 粗粒度历史只存档，不拆成假小时、不重复填进多个 6h 条。采集中断超过源站可回扫窗口时，缺失历史保持缺失。
7. 站点、渠道和单模型分别聚合，作用域带站点 ID、渠道键或模型名。继续沿用透明的模型/小时等权指数；源站未给请求计数，不能宣称请求量加权 SLA。

### 没有耗时数据时的界面

- 首 Token、平均耗时、吞吐保持 `—`，自定义悬浮说明“源站未公开”。模型真实性继续空态。
- 可用率有数据但耗时缺失时，细条保持统一中性高度，颜色仍表示可用率；灰色只表示无可用率样本。增加能力标记，移除这类卡片“柱高代表耗时”的错误说明，不改变 PackyAPI 的耗时柱高逻辑。
- 不从 99.5%/99.9% 等首页宣传文字生成统计，不用第三方监控的窗口代替本站 15 日口径。

## 实施改动顺序

1. 增加 `config/transit/rightapi.json` 与独立 `rightapi_v1` 适配器；以公开 JSON 为报价依据，不抓取登录后的个人价格。
2. 将现有硬编码单源加载改为受控配置目录加载及 collectorKind 分发；保留 PackyAPI 独立解析，不把共用数据库和展示层做成站点特例。
3. 扩展性能记录的源窗口/分辨率/桶结束时间/样本状态/指标类型与任务调度；为 RightAPI 的批量可用率和可空耗时建立准确映射。
4. 定价和性能分任务：报价6小时、可用率建议1小时；分别有租约、上次成功时间、限速/超时/响应大小上限。失败保留旧报价和小时历史，不重复刷新成功时间。
5. 原始响应本地存档，统一 SQLite 入库及原子导出快照，Next 不在页面请求期间访问外站。源站响应需要同时校验 HTTP、JSON schema、返回窗口与实际桶长度。
6. 复用已有首页模型优先级、图片独立列表、详情分组分页和模型切换；只补指标能力及覆盖说明，不重做 UI。
7. 先作为 candidate 完成一次真实采集及快照核对，再发布。部署必须在服务器执行采集，且网站与 Worker 读写同一个持久化目录；本机已采集不等于服务器有数据。

本次未运行测试、lint、类型检查、构建或浏览器验证，也未调用付费模型。

## 已加入的实现与部署

- 独立实现：`collectors/transit/rightapi.mjs`，配置：`config/transit/rightapi.json`。PackyAPI 保留自己的解析器及计算规则。
- 仅已验证的公开有效报价进入当前报价；不可用模型留在原始响应存档。基础价格、有效价格、阶梯及分时条件分别保存，不重复乘倍率。
- `transit_performance_schedule` 独立保存 RightAPI 可用率的小时调度、租约、补采状态，报价仍采用既有6小时节奏。
- 数据库新增桶结束时间、实际粒度、源生成时间、另两种可用率和末桶状态。RightAPI 以 `window_hours=24` 保存真实源窗口；本站360小时聚合接受已结束的真实小时桶，不改写成源站返回15日。
- Worker 按站点启动独立采集子进程，避免 PackyAPI 较慢的性能回扫拖住 RightAPI；SQLite 写入和迁移串行，快照保留原子导出。
- 未公开的耗时/TPS为空，附带指标能力标记；色条仍按可用率着色，无耗时数据采用统一高度并说明原因。已采集文档站真实 `logo.webp`，替换并移除文字占位图；文件类型、文件头和128KB上限通过后才原子更新，失败保留上次图标。
- `rightapi-discounts.mjs` 已按同型号、同档位的站方基准计算本站测算折扣，不直接使用计费倍率。站内额度先按充值比例换算CNY；USD参考价按带日期和来源的汇率换算，CNY参考价不换汇。缺少转换依据或参数条件不匹配时不生成标签。

在服务器项目根目录，更新代码和依赖后执行：

```bash
pnpm transit:migrate
pnpm collect:transit -- --station=packyapi --pricing-only
pnpm collect:transit -- --station=rightapi
pnpm transit:status
```

站点首次成功采集后才写入发布记录。若首次采集失败，不能凭配置文件宣称已经在线展示。

2026-10-29 已实际执行 `pnpm collect:transit -- --station=rightapi`，返回 success、54个可用型号、75条报价、1800条小时记录、无警告；`pnpm transit:status` 确认快照包含 PackyAPI 与 Right Code，后者14个分组且状态 published。快照生成时间为 `2026-10-29T08:58:34.876Z`。这是本地采集和快照证据，不代表服务器已部署或完成浏览器验收。首次迁移前备份在 `work/rightapi-first-collection-2026-10-29T08-58-31-293Z/`。

### Logo、缺失性能字段和折扣补充复查

2026-10-29重新读取官网首页、文档、首页公开JS、用户首页/日志页面公开JS和文档链接的监控入口：

- Logo来源为 `https://docs.rightapi.ai/logo.webp`，实测200、3040字节、WebP文件头，已保存 `public/brand/transit/rightapi.webp`，不是自行仿制图标。
- 首页所谓实时记录出自脚本常量数组 `A3`，含固定 `firstMs/totalMs` 并按定时器轮播；不能采作真实首Token、耗时或TPS。
- 账号日志UI真实字段为 `first_token_ms/duration_ms/output_tokens_per_second`；页面调用 `/use-log/recent-metrics`，本次匿名请求实测401、`Missing userToken`。即使取得某账号日志，也不能默认为整站统计。
- 文档链接 `https://check.linux.do/group/RightCode` 是第三方检测站。页面和其公开项目列出的分组API `/api/group/RightCode?trendPeriod=15d` 本次直接请求均403，未继续重试；尚未核实该入口当前可供采集的实际样本、型号和分组映射，不将源码接口定义当作当前线上返回证据。
- 当前匿名可用率接口的小时点仅有三种可用率与no_sample标记，确实没有上述性能字段，因此耗时/TPS继续留空，不把演示、私有账号或第三方其他分组的指标填入。

已执行一次 `pnpm collect:transit -- --station=rightapi --pricing-only` 更新实际Logo和折扣，返回success、54型号、75报价、无警告，没有重扫性能。75条报价保存折扣计算证据，其中73条低于参考原价；首页最低输入价所在组的示例显示口径为 Claude Opus 5.5 约0.9折、GPT 6 Astra 约0.4折、Gemini 4 Argon 约2.2折。DeepSeek V4 Pro 9元成本对9元CNY基准，比例1，不展示虚假优惠。折扣标签为本站测算、站方基准，不冒称独立核实的官方报价。

汇率来源 `https://open.er-api.com/v6/latest/USD`，本次返回 USD/CNY=6.680538，日期2026-10-29。缓存24小时刷新，超过7天不继续用；汇率缺失不影响报价和CNY基准的计算。界面悬浮保留基准价、基准币种、档位性质及汇率日期。原始研究文件在 `work/rightapi-followup/`，入库前备份在 `work/rightapi-logo-discount-before-2026-10-29T09-08-34-526Z/`。

## 资料与证据

### 监测空值与说明展示

- 灰色细条表示该时段没有可用率记录，不是停机。Right Code 源站仅给最近24小时的真实小时桶；本站逐小时积累近15日窗口，不能把一天复制成15天。
- 首Token、平均耗时、吞吐空值表示匿名公共接口未公开这些字段，不能用可用率推算，不能填0。
- 首页、详情分组、详情模型卡和细条说明统一为标题、对齐字段及简短备注；可用率展示百分比、覆盖小时与统计区间，缺失耗时单独解释。单条细条展示对应时段及该时段指标，不重复整站长段说明。
- 本次仅调整文案与浮层呈现，未改统计结果、未重采，未运行测试、构建或浏览器验收。

- [官网](https://www.rightapi.ai/)
- [渠道与模型](https://docs.rightapi.ai/docs/rc_quick_start/models)
- [充值规则](https://docs.rightapi.ai/docs/rc_quick_start/recharge)
- [渠道地址速查](https://docs.rightapi.ai/docs/rc_questions/endpoints)
- [画图接口](https://docs.rightapi.ai/docs/rc_draw/)
- [公开报价](https://www.rightapi.ai/models/public)
- [公开渠道](https://www.rightapi.ai/upstreams/public)
- [公开配置](https://www.rightapi.ai/configs)
- [批量可用率](https://www.rightapi.ai/models/availability/all)

本机原始资料保存在 `work/rightapi-research/`，不提交原站 JS、原始 JSON 或调研抓包。`summary.json` 记录研究时刻数量；`availability-codex-default.json`、`availability-codex-7d.json`、`availability-codex-15d.json` 记录返回窗口差分；`models-page.js` 记录官网报价展示与可用率字段选择，`zh.js` 记录价格口径文案。`evidence-index.json` 保存本次工件 SHA-256 及来源。
