# PackyAPI 目录完整性与官方全球入口

日期：2026-10-30。范围仅为 PackyAPI 采集，不调整页面样式或另外两个站点。

## 根因定位

- 服务器旧目录为 37 型号、12 分组、49 条报价，缺 Claude / GPT / Gemini。
- 服务器此前已报 `incomplete_pricing_families:Claude,GPT,Gemini`：响应缺平台，不是页面四行预览、型号排序或入库去重把模型删掉。
- 官网模型广场资源 `index-DitiybZ7.js` 对价格只发一次匿名 `GET /api/pricing`，没有分页请求；现有解析器也遍历全部 `data[].enable_groups`，没有只取国内平台或只采前几条的限制。
- 原采集器只使用 `www.packyapi.ai`。一旦该入口在服务器返回残缺清单或连接失败，就只能保留旧目录，没有核实过的官方备用入口。
- 同一主站在本机仍能返回完整目录，所以不能声称主站对所有地区都只提供国内模型，也尚未确认服务器残缺响应的具体地区/缓存/出口成因。

## 已核实的官方入口（真实公开请求）

证据入口为 `https://www.packyapi.ai/api/status` 的公开公告：

- 标题：`【Endpoint 架构升级】全球接入节点调整通知`。
- 发布时间：2026-07-29T06:25:47.731Z。
- 官方公布 `https://cf.api.fan` 与 `https://slb-v1.api.fan` 为全球请求节点。

本机匿名请求的观察结果：

| 入口 | 结果 |
| --- | --- |
| `https://slb-v1.api.fan/api/pricing` | HTTP 200，78 型号、25 个实际引用分组、143 个模型/分组报价对；包含 Claude/GPT/Gemini |
| `https://slb-v1.api.fan/api/status` | HTTP 200；system_name=PackyAPI，server_address=https://www.packyapi.ai；额度单位、基础价格与主站相同 |
| `https://slb-v1.api.fan/api/perf-metrics/summary?hours=360` | HTTP 200，84 个监测型号；只作为监测存档，不据此伪造新增报价 |
| `https://slb-v1.api.fan/api/perf-metrics?model=gpt-6-astra&hours=360` | HTTP 200；返回 azure-officially、codex、codex-sale 三组真实小时序列 |
| `https://cf.api.fan/api/pricing`、`/api/status` | HTTP 404；不纳入价格采集配置，不反复探测 |

主站和全球节点的价格响应经原始数据对照：字段、型号集合、分组关系、计费参数一致，原始顺序不同。以上数量是此次观测，不写死为模型列表或永久完整性标准。

25 个实际分组包含未提供倍率的公开测试组；根 `group_ratio` 是 24 项。该差异不是漏采：测试组的原始配置照存，无依据的价格仍为 null，不默认乘 1。

## 修改后的采集逻辑

1. Packy 独立配置优先 `https://slb-v1.api.fan`；`https://www.packyapi.ai` 仅作备用。
2. 只请求配置白名单中的官方 origin，串行、最多 3 个；当前只有 2 个。不自动信任响应里出现的新域名，不修改 DNS / hosts，不关闭 TLS 校验，也不注入伪造身份头。
3. 每个候选价目先原样存档，再完整解析和校验。必须在一个响应内取得有效目录；不把两个入口的价格、倍率或旧报价拼成新快照。
4. 选定入口后，状态接口和 15 日性能接口也使用同一入口；官网跳转、Logo、文档和折扣规则资源仍使用原本对应的官方地址。
5. 保留四大平台完整性检查。再将实际有效型号、分组、报价数与上一份已接受目录比较；任一项不足此前的 80% 时拒绝该响应并尝试备用。避免“每个平台仅剩一两个型号”仍误判为完整。
6. 该比例是异常缩减熔断，不等于严格证明每个型号都齐全。站方真实大规模下架也会触发，需核实原站再调整 `minimumRetainedCatalogFraction`，不得为消除报错随意放宽。
7. 403 / 429 立即停止本轮，不轮换入口规避限制；沿用冷却与 Retry-After。全部失败只记失败审计，不更新报价观测时间、不下架旧记录。
8. 成功目录沿用原有 SQLite 事务入库、不可变报价观测和原子快照导出，现有模型/分组 ID 不变，无需清库或新增表。
9. 每次入口尝试记录实际 URL、HTTP 状态、响应哈希、平台分布及型号/分组/报价数量，保存在站点内部 `raw_meta_json.pricingCollection`；原始响应仍由源快照表存档，前台不公开内部元信息。
10. `pnpm transit:status` 显示配置入口、实际选用入口及各次响应数量/错误，不输出代理值或原始大段 JSON。

## 更新代码后的服务器采集

在 `/www/wwwroot/radar.ftuashcahs.xyz`，完成正常代码更新后，仅重采 Packy 报价：

```bash
pnpm collect:transit -- --station=packyapi --pricing-only
pnpm transit:status
```

关注 `status=success`、`pricingSource`、四大平台和 `pricingCollection.inventory`。数量随原站变化，不以固定 78/143 判断成功。常驻 worker 后续继续回扫 15 日监测；如需立即回扫，可在报价采集结束后执行不带 `--pricing-only` 的同站采集。

此次只修改采集代码、配置、只读诊断和文档；没有运行测试、构建、类型检查、浏览器验收或向本地业务库执行采集写入。公开源响应与修改前备份位于忽略目录 `work/packy-completeness/`。没有服务器执行证据，尚不能声称线上已补齐；若服务器无法连接新官方入口，仍需解决其实际网络连接问题。
