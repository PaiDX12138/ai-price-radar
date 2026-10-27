# 中转模型检测调研与接入建议

调研日期：2026-10-23。当前仅完成公开资料及公开 GET 数据调研，未使用第三方 Key、未发起付费推理请求，未将示例数据替换为真实监测。

## 1. 参考站证据

- 页面：https://priceai.cc/api-transit/790053500-com
- 页面关联公开来源：https://790053500.com/public/transit?view=monitoring
- 来源页面 app.js 明确读取：GET https://790053500.com/api/public/transit/v1/snapshot
- 实际返回 schema_version=ai-transit.v1，含 groups、monitoring、cache、generated_at。
- monitoring 含 primary_model、models、timeline、availability_7d/15d/30d、latest_latency_ms、latest_ping_latency_ms、avg_latency_7d_ms、last_checked_at。这些指标来自站方，不能标作本站实测；字段名未证明 latency 是 TTFT 还是总耗时。
- PriceAI 页面序列化资料含 collectorKind=ai_transit_snapshot；细条说明为请求历史，允许合并多个样本。公开快照存在分钟级且同分钟多个样本，不能推断统一为每小时一次。
- 快照没有证实公开样本覆盖所有可选模型，更不能从一个 primary_model 的成功推导整个平台全部可用。

另有独立检测服务，不等同于详情页监测：
https://github.com/physics-dimension/priceai-detector-service
它接收 base_url/api_key/model/protocol，支持 Claude Messages、OpenAI Chat、Responses、Gemini compatible 等探针，输出报告。README 声明源于 veridrop、AGPL-3.0-or-later。若采纳第三方代码，应另行评估依赖及许可证，不直接复制进当前实现。

参考源码/文档：
- https://github.com/dimthink/PriceAI/blob/main/public-docs/api-transit-model-collection-flow.md
- https://github.com/dimthink/PriceAI/blob/main/scripts/probe-api-transit.mjs
公开资料将价格采集、Key 请求探测和公开状态分离；脚本含轻量 ping 请求、参数兼容处理及持久化。文档描述与当前部署不一致时，以当前公开数据为准。

## 2. 要区分的三个问题

| 层级 | 能回答 | 不能证明 |
|---|---|---|
| 目录与报价采集 | 站点宣称支持什么、分组和报价 | 模型实际可调用 |
| 主动可用性检测 | 某时刻某分组某模型完成有效推理、耗时、错误类型 | 确定就是所宣称的上游模型 |
| 深度能力/身份核验 | 协议能力、结构输出、工具调用、视觉/长上下文等证据 | 仅凭自报 model、headers 或问答确定模型身份 |

模型名字、模型自述、速度、少数题目正确率均可被转发或伪造，不能单独显示“真模型已认证”。建议真实性标签：未核验 / 能力已测 / 存在不一致 / 有独立可验证证据。保留报告与探针版本，不做绝对结论。

## 3. 建议适配当前项目的架构

继续使用 Node 独立 Worker + SQLite，页面仅读快照，不在页面访问时发起收费探测。

公开采集适配器 / 独立主动探测适配器 -> 原始样本表 -> 按站点+分组+模型+协议+来源+检测节点聚合 -> 前台平台卡片。

建议新增 targets、runs、observations 三类表，以及按小时聚合表。观测至少记录：target_id、scheduled_slot、attempt、checked_at、source_checked_at、fetched_at、probe_version、requested_model、reported_model、protocol、HTTP 状态、结果类别、TTFT、总耗时、input/output tokens、节点、脱敏请求ID。Key 仅存服务端密钥引用，不返回页面或写原始日志。

公开数据没有逐次样本时，只保留该来源原有汇总口径，不伪造细条。相同上游 sample_id 或稳定样本指纹唯一入库，重复拉取快照不新增样本。来源检查时间和本站采集时间分开。

### 探针建议（方案，不是行业标准）

| 类型 | 最小真实验证 | 建议频率 |
|---|---|---|
| 文本 | 少量随机挑战、短输出、解析有效内容及流结束 | 重点模型每小时；同平台其他模型轮巡 |
| Claude 原生 | Messages 请求；需要时补测流与工具事件 | 每小时/按预算 |
| Gemini 原生 | generateContent / streamGenerateContent | 每小时/按预算 |
| 生图 | 最低成本可用尺寸；实际获取并解码图片 | 每日或手动 |
| 视频 | 创建任务、轮询终态、确认可访问有效视频产物 | 手动或低频预算任务 |

模型清单 GET /v1/models 只能用于发现，不能代表可用；HTTP 200、任务创建成功、SSE ping/空 delta 都不足以确认完成。视频提交耗时与生成完成耗时分别存储。

每个有效计划任务只计一次；失败首次结果必须保留，重试单独记录，不靠重试成功洗掉失败。429、5xx、timeout、invalid_response、unsupported_protocol、credential_error、budget_exhausted、skipped 分开。由检测凭据/预算/配置引起的问题不能直接判为整个站点故障；同时公开其缺失覆盖，不把排除项隐藏。

### 统一统计

- 检测目标为明确的站点+分组+模型+协议，平台卡片汇总其已检测目标；支持模型数和已检测模型数分别展示/悬浮说明。
- 可用率=成功计划检测数/可判定计划检测数；无样本显示“暂无检测”，不是0%。监测器自身故障另记 unknown。
- 日均=同节点、同协议、同响应口径、过去24小时成功样本均值；失败/超时数量另记，不用0ms参与。建议另存p50/p95。
- 模型响应默认明确为首个有效输出耗时（TTFT）；另存完整耗时。外部 latency_ms 未明确语义时不与本站 TTFT 混合。
- 细条最多50条，先确定统计窗口，再连续分桶覆盖全部样本。每桶保留成功/失败/未知个数、延迟sum/count；总体按原始计数计算，不平均分桶百分比。
- 绿=全部成功，黄=部分失败，红=全部失败，灰=无有效样本；未知数量需在悬浮说明中保留。柱高若表示响应耗时，应固定可比较刻度并说明，不把每张图自身最大值归一化后用于速度比较。
- 来源使用“本站实测 / 站点公开 / 来源未披露”。三个来源不混合成无标记指标。

## 4. 凭据、成本与网络

定时检测需要专用、可撤销、有额度上限的服务端监测Key；临时Key只适用于用户主动单次检测。按分组Key实际可见范围绑定目标。设置每日站点/模型预算、全局并发、单站点串行/低并发、随机错峰、退避和硬超时。接口地址仅允许公网HTTPS白名单，校验DNS与重定向，阻止访问内网及元数据地址；远端媒体下载同样限制地址、大小、MIME和耗时。

成本先按token/次/秒单价估算：100站*3个目标*24次=7200次/日；若每站20个模型都逐小时检测则为48000次/日。轮巡策略需显示实际检测覆盖，不将未测目标算成功。媒体检测单独预算。

## 5. 分期落地

1. 公开快照适配器、源时间/采集时间、去重、SQLite真实样本，显示“站点公开”。
2. 站长提供专用Key，添加文本主动探测及真实TTFT/总耗时，增加“本站实测”。
3. 媒体端点适配器与显式预算。
4. 独立深度检测报告；右侧预留色卡可显示协议/能力核验摘要，但不使用无证据的真假评分。

官方协议资料：
- https://platform.openai.com/docs/api-reference/chat/create
- https://platform.claude.com/docs/en/build-with-claude/streaming
- https://ai.google.dev/api/generate-content

现场证据在 work/priceai-research.html、work/reference-transit-public.html、work/reference-public-app.js、work/reference-snapshot.json；它们是观察时间快照，不代表当前实时状态。
