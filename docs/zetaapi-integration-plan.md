# ZetaAPI 独立采集接入方案

研究与接入日期：2026-10-29（北京时间）。状态：独立采集器、存储与页面映射已实现，已完成首次本地实际采集入库，公开快照现含3个站点；未提交或部署服务器，未运行测试、构建或浏览器验收。

## 一、结论

可采集公开模型报价与部分模型监控，但不能直接套用 PackyAPI 或 Right Code 的响应解析器。

- 建议站点 ID `zetaapi`，采集器 `zetaapi_v1`；首页 `https://www.zetaapi.ai/`，价格入口 `https://www.zetaapi.ai/pricing/`。
- 本次定价页含 **44 个唯一模型键**：Anthropic 15、OpenAI 17、Google 10、未标供应商 2；5 个键属于明确的图片型号。不能把首页提及的 DeepSeek、Qwen、Kimi 自动补成报价。
- 报价来自服务器生成的 HTML 及其内嵌 JSON，不必运行浏览器、截屏或逐行模拟点击。
- 实时状态站有匿名 JSON，覆盖 **5 个 Claude 型号 + 官网、控制台、API 三项基础服务**，不是全部44个型号的请求成功率。
- 官网公开配置当前明确 `allow_signup:false`、`allow_topup:false`。接入时须保留“暂停注册 / 充值”的站点状态，不能因为价格页仍可访问就展示为正常开放的新用户服务。

## 二、已经实际请求的入口

以下均未携带登录 Cookie、账号令牌或 API Key；未发送推理、生成、充值或其他写请求。

| 来源 | 实际结果 | 数据性质及处理 |
| --- | --- | --- |
| `www.zetaapi.ai/pricing/` | 200，HTML | 公开价格表及 `pricingJson`，报价主源 |
| `www.zetaapi.ai/api/v1/site-context` | 200，JSON | 品牌域名、API与控制台地址、注册和充值开关；不是价格接口 |
| `api.zetaapi.ai/api/v1/pricing/catalog` | 401，`missing_token` | 控制台页面调用的目录接口，匿名不可读，不纳入公共采集 |
| `api.zetaapi.ai/api/v1/topup/info` | 401，`missing_token` | 充值配置，匿名不可读，不凭最低起充额猜充值倍率 |
| `api.zetaapi.ai/v1/models` | 401，`missing_api_key` | API 文档中的当前账户可用模型列表；不等于公共完整报价 |
| `status.zetaapi.ai/api/status-page/hermes` | 200，JSON | 公开监控分组、monitor ID、型号、类型 |
| `status.zetaapi.ai/api/status-page/heartbeat/hermes` | 200，JSON | 每项最近50个心跳、24小时可用率摘要 |
| `status.zetaapi.ai/api/badge/3/uptime/360` | 200，SVG，标签 `Uptime (360h)` | API 网关360小时摘要，本次99.98%；不是全部模型可用率 |
| `status.zetaapi.ai/api/badge/4/uptime/360` | 200，SVG，标签 `Uptime (360h)` | Claude Sonnet 4.6 的360小时摘要，本次95.45%；不能生成缺失的小时序列 |
| `www.zetaapi.ai/status/` | 200，HTML | 内嵌快照标注2026/10/23，已明显落后于本次实时接口，不用于当前监测 |
| `www.zetaapi.ai/favicon.svg` | 200，SVG | 32×32官方品牌图标，适合站点卡片 |
| `www.zetaapi.ai/logo_white.svg` | 200，SVG | 540×110横向白色字标，不适合直接塞进浅底正方形图标框 |

接口路径来自实际页面脚本、页面链接或公开脚本的 badge URL 拼装，不做猜路径扫描。目录和充值接口返回401后未继续尝试账号接口。

### 数据来源分类

1. **文档化 API**：`/v1/models` 等是需要 Key 的业务接口，不能作为匿名采集源。
2. **匿名页面 JSON**：site-context、状态配置及心跳接口，可以直接 HTTP 读取，但没有第三方版本稳定性承诺，需结构校验。
3. **HTML 内嵌结构化数据**：价格页 `pricingJson`，采用字符串定位和双重 `JSON.parse`，绝不执行远端 JavaScript。
4. **页面正文 / 静态资源**：收费单位、缓存时效、图片说明、真实Logo、业务暂停提示；无需浏览器渲染。
5. **缺失或未证实**：公开渠道分组、完整模型监测、首Token、模型平均耗时、TPS。不能把缺失信息归咎于没抓页面，也不能用其他站点数据补齐。

## 三、报价与折扣

内嵌数据字段为 `key / label / provider / input / output / cacheRead / cacheWrite / cacheWrite1h / multiplier / savingsPct / officialInput / officialOutput`。

- 以 `key` 作为原始型号身份，`label` 只是显示名。存在把描述句放入 label 的记录，须清洗显示名但保留原文，不拿长描述作模型身份。
- 内嵌价格是 **USD / 单Token**；存入现有百万Token口径时乘 `1,000,000`。
- `input / output` 已是实际折后价格，**不能再乘 multiplier**。页面计算器实际用 Token 数直接乘这些单价。
- `multiplier` 是模型相对参考价的计价比例，不是人民币充值比例。本次0.3或0.35；不能写成 `¥1 = $1`。
- 官网标注价格单位为美元，需保存 `currency=USD` 与明确单位，UI 不应沿用其他站点“$ 为站内记账额度”的通用断言。
- `cacheWrite` 与 `cacheWrite1h` 分别保存缓存5分钟与1小时的价格。不可将1小时价格覆盖5分钟价格。
- 页面把多项0显示为 `—`。这些0不可直接解释成免费：保留原始0及页面缺省语义，标准展示为未提供；未来明确标注免费时再处理为真实0。
- 折扣优先保存站点 `savingsPct`，支付比例为 `1 - savingsPct`；节省70%应显示 **3折**，不是7折。缺失时才使用同型号、同单位、同档位的售价 / 参考价计算。
- `officialInput / officialOutput` 是站方提供的“官方参考”，未在本次逐一独立核对供应商，因此证据注明 `station_reference`，不能标独立核实官方价。
- 本次44项输入、输出与对应参考价的比值均与 multiplier 一致，后续每轮继续校验；不一致保存冲突，不擅自挑更低的数。

例：`claude-opus-5-5` 实际输入/输出 **$1.40 / $7.00 每百万Token**，站方参考 $4 / $20，支付比例0.35，即3.5折。`gpt-6-astra` 实际 $3 / $15，参考 $10 / $50，即3折。

## 四、图片与分组的特殊处理

### 图片报价不能强制按张换算

价格页把 GPT Image 等也放在百万Token表中；生图指南同时存在“按次”概述，Gemini部分又明确按Token。

- `gpt-image-2` 页内结构化输入/输出为 $1.50 / $9.00 每百万Token，没有固定每张价格。
- 首版保留 **图片型号 + 原站Token计费单位**，显示输入/输出价或计费说明，不把 $9 显示成 $9/张。
- 未拿到固定调用价、图片Token与质量/规格的对应关系前，不推算虚假的单张价格。
- 保存文档冲突与型号范围，今后出现明确固定按次价再启用按次展示。当前44项未发现可核实的视频报价，不创建视频卡。
- 默认全部/文本平台卡继续排除图片型号，仅图片Tab展示图片型号；排序复用现有动态型号目录规则，不硬编码这44项。

### 不伪造站点分组

公开价格表没有渠道/令牌分组信息。状态站的“模型监控”和“服务”是监控分类，不能映射为计费分组。

建议内部只用一个 `public` 报价容器，标记 `group_origin=synthetic_public_catalog`。详情页展示为“公开报价”，不要冒称官方有一个叫public的上游渠道，也不要按照Anthropic/OpenAI拆出虚假渠道分组。

## 五、监测与15日历史

### 公开数据的实际范围

| monitor ID | 对象 | 类型 |
| --- | --- | --- |
| 4 | `claude-sonnet-4-6` | push心跳 |
| 5 | `claude-opus-4-6` | push心跳 |
| 6 | `claude-opus-4-7` | push心跳 |
| 7 | `claude-opus-4-8` | push心跳 |
| 9 | `claude-opus-5` | push心跳 |
| 1 / 2 / 3 | 官网 / 控制台 / API | HTTP探测 |

心跳字段为 `status / time / msg / ping`，24小时汇总键形如 `4_24`，值范围0–1，显示百分数时乘100。当前各序列均为50点，但覆盖时长不同：基础服务约50分钟，模型有的约4小时、有的约12小时；不能假定统一一分钟粒度。

**ping不能直接当首Token、生成总耗时或TPS。** HTTP探测只是网络/端点探测，push心跳的业务耗时语义本次没有证实；上述模型指标先为空。

### 15日摘要与细条分别处理

- `/api/badge/{id}/uptime/360` 本次确实返回带360小时标签的摘要，但没有起止时间、完整历史点或样本覆盖。仅能标记“站方近15日监测摘要”，不能声称核实满360小时。
- 摘要独立保存 `metric_kind / monitor_id / window_hours / value / observed_at / source_url`，**不把一个百分比展开成360个小时**。
- 不能把滚动24小时 uptime 按天或小时平均冒充15日；重叠窗口会重复计算。
- 细条来自本地持续保存的原始心跳；原始点以 `station_id + monitor_id + source_time` 去重，保留源时间、采集时间和来源，不覆盖其他历史。
- 心跳接口建议 **每5分钟**抓一次，配置每天或发生未识别ID时刷新。基础服务只有约50分钟缓存，按现有报价6小时节奏会漏样；采用独立性能调度。
- 将原始心跳归入UTC小时，记录有效点数、up/down点数、首末样本时间与采集缺口；status含pending/maintenance时单独保留，不默认为失败。时间按Uptime Kuma源时间语义确认后显式处理UTC，无时区字符串不能按服务器本地时区直接解析。
- 首版使用可说明的“已观测有效心跳中up比例”，明确这是监测样本可用率，不是请求量加权成功率；若没有完整时间序列，不能声称与Kuma时长加权百分比完全一致。
- 只有采集任务连续工作且源时间有效、样本足够的小时才能计入有效覆盖；每小时只拿到一个点不能宣称完整覆盖1小时。中断或缺样保持空白，禁止用状态前向填满数小时。
- 聚合本站滚动360小时，展示60根六小时细条，保存有效覆盖。每次读取历史窗口，不因源站最近50点滚动淘汰而删除本站旧点。
- 原始点建议保留至少35天，清理只能删除超出保留期的数据；数据库和快照放持久卷，重启不丢历史。

### 首页、分组、模型的展示口径

1. 模型卡只按原始型号匹配监控ID；当前最多5个Claude型号可以有实测监控数据，GPT/Gemini及新Claude型号没有对应监控时保持空白。
2. 首页若汇总5个型号，应明确 **“已监测模型可用率（5/44）”**，不能叫全部44个型号的整站请求成功率；网关监控另存并标为网关可用率。
3. 没有真实计费分组与监测组映射时，不在“公开报价”容器里复制同一条整站曲线。
4. 若采用站方360小时摘要，悬浮显示“站方摘要”；细条显示“本站积累”，明确两个数据来源及差异，不能让用户误以为百分比一定由当前细条算出。更统一的首版方案是所有主百分比与细条都采用本站积累口径，站方摘要仅作详情补充。
5. 现有监测数据层需要新增 `metricKind / scope / aggregation / coverage`，不能直接把基础设施ping塞进 `avg_ttft_ms`，或沿用“请求成功率”提示解释所有来源。

## 六、实施拆分与发布条件

### 阶段A：独立报价采集

- 新增 `collectors/transit/zetaapi.mjs` 与 `config/transit/zetaapi.json`，复用现有HTTP、SQLite事务、采集租约、快照框架，不复用他站字段解析。
- 6小时采集定价HTML、site-context；官方favicon低频更新，校验类型、大小与SVG可渲染安全性后使用，不编造Logo。
- JSON只解析不执行；校验唯一模型键、完整字段、非负数、表格行数与内嵌JSON数量、币种单位、报价/折扣关系。页面改版或数量骤减只记失败，保留旧有效报价，不批量清空。
- 页面会按地区重定向语言路径；使用已经确认的语言偏好机制固定语言或采用不依赖文案的key字段，保留最终响应URL。不得把不同语言当多个站点。
- 缺失充值汇率不显示虚假的基础兑换值。关闭注册/充值状态与报价存活是两项独立信息，单独保存。

### 阶段B：监测独立适配

- 新增原始心跳表、监控身份表、小时聚合及摘要表，保留身份、时间、metric_kind和来源；不直接重用Right Code的24h成功率解析器。
- 每5分钟采集心跳，小时聚合，15日快照；租约防重、失败退避、连续同形失败冷却。报价与性能互不阻塞。
- 映射变更、时间异常、过期心跳和覆盖不足明确告警；采集失败不写成停机，不用最新24h摘要填补缺口。

### 阶段C：统一页面

- 首页仍用现有四平台优先、动态型号排序、两位价格、折扣标签、外链与共享悬浮窗。
- USD价格与站内额度说明分开；图片Token计费不得显示按张单价；详情不显示未披露渠道或缓存命中率占位。
- 没有真实分组时显示“公开报价”，不生成一堆无来源分组卡。
- 先完成本地实际采集及入库，再加入公开快照。本地已加入第三个站点，**不代表服务器已部署或完成页面验收**。

## 七、已实现与首次入库记录

代码：`collectors/transit/zetaapi.mjs`（独立解析、采集）与 `zetaapi-storage.mjs`（心跳存储、聚合、保留策略）；配置 `config/transit/zetaapi.json`，现有Worker自动发现配置并按站点启动独立子进程。

首次实际执行 `pnpm collect:transit -- --station=zetaapi` 返回success、44个型号、44条报价、400条新心跳、warnings为空。数据库记录：

- 文本39项、图片5项；折扣44项，缓存读取35项、缓存5分钟写入17项、缓存1小时写入15项；缺失项保留null，源0保存在原始证据中，不解释为免费。
- 监控身份8项（模型5、基础服务3），原始心跳400项，小时汇总52项，其中47项符合最低样本条件；24小时摘要8项、360小时摘要8项。
- 首页监测主值仅来自5个已公开监测型号；当前可统计12个有记录小时。站方15日摘要另存并只在说明中补充，不拿摘要填充细条。100%只表示本地所观测时段，不代表15日完整覆盖。
- `transit_monitor_identities` 保存监控主体；`transit_monitor_probes` 按站点/monitor ID/UTC源时间去重；`transit_monitor_polls` 保存采集成功或失败；`transit_monitor_hourly` 保存up/down/pending/maintenance计数与源时间跨度；`transit_monitor_summaries` 独立保存窗口摘要；`transit_service_states` 留存注册/充值开关历史。
- 当前官方配置暂停注册与充值，首页/详情显示轻量状态标签。报价美元单位显示“USD计价”，不虚构人民币充值比例。
- `cache_write_1h_price` 是报价新增规范列；原始单位、显示名、币种、计费矛盾与折扣证据另存在报价JSON与不可变报价观测中。原始HTML/JSON进入来源快照，并存SHA-256和原始文件。
- 时间按Uptime Kuma 1.23.16的UTC语义明确解析，校验日历时间、未来时间、重复点、同时间冲突与身份变化；每小时需至少2个有效点、跨度≥30分钟、相邻样本间隔≤25分钟，并且已结束，才进入小时聚合。这个门槛不等于连续覆盖60分钟，UI写“有记录小时”。维护/待定不冒充失败，ping不冒充推理耗时。
- 心跳、小时、轮询与窗口摘要保留至少35天；过期监测原始载荷按站点目录边界及引用检查单文件清理。报价证据、服务状态历史不被该清理删除。
- 报价和监控任务各有独立租约、重试和调度；摘要每6小时刷新，心跳每5分钟。价格解析失败保留旧报价；可选文档/Logo/状态采集失败保留上次成功信息并告警，不抹掉历史。
- 详情独立展示3项服务监测，与模型监测隔离；公开报价不是官方渠道分组，不复制整站监测到其中。图片按原始Token输入/输出报价，不显示虚假的每张价格。

入库前已用SQLite在线备份API备份数据库及JSON快照到 `work/zetaapi-before-first-collection-2026-10-29T10-10-28-647Z/`；采集和入库数量记录在 `work/zetaapi-research/first-collection-result.json`。不要在其他站点继续写入后直接恢复整库；需要回滚代码时保留新增的兼容表和历史数据。

服务器更新代码与依赖后，在项目根目录执行：

```bash
pnpm transit:migrate
pnpm collect:transit -- --station=zetaapi
# 使用既有进程管理器重启 worker；没有进程管理器时保持下列进程常驻：
pnpm worker
```

数据库使用 `TRANSIT_DB_PATH`（默认`data/transit.sqlite`），快照使用 `TRANSIT_SNAPSHOT_PATH`（默认`data/transit/latest.json`）；两者须持久保存，不提交git，也不因部署清空。

## 八、证据与后续核对

原始页面、匿名响应、前端公开脚本、提取JSON及哈希清单保存在忽略目录 `work/zetaapi-research/`，不提交外站脚本和原始抓取文件。生产代码只提交独立解析器、配置、必要品牌资源、数据库迁移及本方案。

尚待来源补充：push ping是否对应模型响应；完整小时历史导出；图片实际收费单位冲突；基础充值兑换。未解决的字段保持空白或按原始Token单位显示，不阻塞可核实报价。UTC时间语义已对照部署前端标识的Uptime Kuma 1.23.16与对应官方源码确认（`server/model/monitor.js`采用`dayjs.utc()`）。

主要来源：

- [定价页](https://www.zetaapi.ai/pricing/)
- [API文档](https://www.zetaapi.ai/docs/api-reference/)
- [生图文档](https://www.zetaapi.ai/docs/image-generation/)
- [官网状态说明](https://www.zetaapi.ai/status/)
- [实时状态页](https://status.zetaapi.ai/status/hermes)
- [公开监控配置](https://status.zetaapi.ai/api/status-page/hermes)
- [公开心跳](https://status.zetaapi.ai/api/status-page/heartbeat/hermes)
- [站点开放状态](https://www.zetaapi.ai/api/v1/site-context)
