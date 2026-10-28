# Packy 模型可用率与吞吐接入

## 本次研究证据（2026-10-28，北京时间）

- 文档入口：https://docs.packyapi.ai/docs/token/2-group.html （本次直接 HTTP 200）。文档和分组介绍不能代替性能接口字段证据。
- 官网模型广场：https://www.packyapi.ai/pricing
- 当前首页引用 `/assets/index-n3E3zgAy.js`，其定价页懒加载 `/assets/index-BduMC-03.js`。本次读取该公开资源，确认匿名 GET `/api/perf-metrics?model=...&hours=...` 以及 `/api/perf-metrics/summary?hours=...`。
- 官网资源默认 `hours=24`；成功率说明是“请求成功率，过去 24 小时采样”，TPS 的说明是“持续每秒 Token 数”。不照搬该 24 小时概览作为本站 15 日值。
- 本次实际匿名请求 `https://www.packyapi.ai/api/perf-metrics?model=gpt-6-astra&hours=360` 返回 HTTP 200；响应包含 3 个分组，小时序列分别 282 / 360 / 359 条。缺桶确实存在，不能把每组当作完整 360 小时。
- 响应的 `data.model_name` 与请求的原始型号一致，`data.series_schema` 为源站 schema 标识，`data.groups[].group` 为原始分组标识。

原始研究文件：`work/transit-model-performance-research/` 的 `gpt-6-astra.json`、`groups-doc.html`、`pricing-page.html`、`pricing-main.js`、`pricing-detail.js`。无账号、Cookie、API Key 或付费推理调用。

## 采集字段

| 源字段 | 含义 | 存储 / 用途 |
| --- | --- | --- |
| 请求 `model` / `data.model_name` | 原始模型名称 | 精确身份匹配，禁止不同别名混用 |
| `groups[].group` | 分组 | `group_key`，同模型不同组单独留存 |
| `series[].ts` | UTC 小时起始秒 | `bucket_at`，所有统计共用相同时间轴 |
| `series[].success_rate` | 小时请求成功率，0–100 | `success_rate`，15日百分比与细条颜色 |
| `series[].avg_latency_ms` | 平均响应耗时，毫秒 | `avg_latency_ms`，最新小时响应、15日均、柱高 |
| `series[].avg_ttft_ms` | 流式请求首 Token 延迟 | `avg_ttft_ms`，保留并在细条悬浮说明显示 |
| `series[].avg_tps` | 持续每秒 Token 数 | `avg_tps`，15日吞吐，显示 `t/s` |
| `data.series_schema` | 源 schema | `source_schema`，追溯解释差异 |
| 采集时间 / 实际 URL | 数据来源与新鲜度 | `observed_at` / `source_url`，小时回扫审计 |

`health.issues` 等附加信息保留在原始响应，不把短窗口告警当作 15 日可用率。接口没有请求总数、成功请求计数、输出 Token 总数 / 总生成时长，不能推导请求数、请求量加权 SLA 或 Token 量加权 TPS。

## 15 日口径

1. 与首页 / 分组完全共用 `buildPerformanceMonitor` 的滚动 360 个 UTC 小时；包含正在进行的小时，末桶可能尚未结束。
2. 模型视图只保留当前 `model_name`；在每个小时对该模型的各分组等权，再对有数据小时等权。源站未给请求量权重，不冒充官方请求加权结果。
3. 模型响应：最新有数据小时的平均响应耗时；不是首 Token，也不是最新单次调用。15日均：整个窗口有效小时的响应耗时均值。
4. 吞吐：直接使用源站 `avg_tps`，先分组、再小时等权。零值 / 非法值 / 缺失值不作为有效生成吞吐，不按响应耗时反推。记录独立 `throughputHours`；耗时同理保存 `latencyHours`。
5. 100% 成功但全部耗时与 TPS 为 0，按无已证实样本处理；0% 失败即使没有耗时仍保存为失败，不丢弃。缺失小时不补 100%，不复制相邻小时。
6. 60 根固定细条，每根 6 小时；颜色、耗时对数柱高与首页 / 分组一致。悬浮显示时间、成功率、首 Token、平均耗时、吞吐和有效小时。
7. 页面“有效小时 x/360”不是请求样本数；统计区间、采集时间、指标含义通过统一自定义浮层说明。

## 已落地的链路

- 原有采集器已经保存模型 × 分组 × 小时的全部上述数值，无需另建推理探测，不增加页面点击触发的远程请求。
- `transit_performance_observations` 唯一键仍为站点 / 模型 / 分组 / 小时 / 窗口，重复回扫更新同一条；新增站点 / 模型 / 窗口 / 小时索引。
- 新增公开快照 `performance[].models[raw_model]`：每模型只输出 60 根聚合条及汇总，不把逐小时原始行和源站原始配置发给浏览器。
- 每条模型结果带 `scope.stationId / modelName / groupKey:null / windowHours:360`，选数器严格校验；没有该模型数据时空态，禁止拿站点、分组或另一个型号兜底。
- 首页不传模型监测全集；详情页才附带当前站点的模型聚合。前台仍只读本地 JSON + 内存缓存，点击型号只切换已经加载的数据。
- 两块检测卡片仍联动于同一选中型号，真实性卡片保留暂无检测数据的空态，不用可用率证明模型身份。
- 底部为三列：模型响应 / 15日均 / 吞吐，保留现有 140px 面板高度与配色。只使用 ms、s 及吞吐单位 t/s。

## 更新与失败兜底

继续使用既有统一 6 小时调度和完整 15 日回扫；保留单模型请求超时、串行 100ms 间隔、120 秒性能阶段预算、连续失败停止、403/429 冷却与 Retry-After、租约、原始响应存档、小时去重更新、原子导出与 last-good 兜底。

接入本次先从已持久化的 80 个模型、36461 条性能记录重建公开快照。该批历史观测最新采集时间为 2026-10-28 11:54:46（北京时间），最后有记录小时为 11:00；重建快照不冒称所有模型已重新实时采集。后续 worker 到期运行同一采集器后，会自动输出新的模型监测聚合。

SQLite 变更前已备份至 `work/transit-model-performance-before/transit.sqlite.bak`；快照导出继续保留 `.last-good`。本次做了公开资料 / 接口研究、代码修改与存档快照导出，没有运行测试、lint、类型检查、构建或浏览器验证。
