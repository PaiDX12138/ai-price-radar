# SoleAPI 采集、自动更新与部署

实施日期：2026-10-30（北京时间）。公开数据研究见 `soleapi-integration-plan.md`。

## 已接入的链路

`pnpm worker` 每分钟按配置发现站点 → Sole 独立报价/性能调度 → 公开 JSON 与模型详情 → SQLite → 原子导出 `data/transit/latest.json` → 中转首页及详情页。

没有新增外部 cron、后台浏览器或另一个数据库；前台不访问源站。新增 Sole 配置会被既有 Worker 自动发现。

| 任务 | 正常周期 | 内容 |
| --- | --- | --- |
| 报价 | 6小时，沿用全站6/12/24小时环境配置 | 全量模型、真实渠道、分项费用、FX、厂商品牌、官方Logo |
| 模型性能 | 1小时 | 公开目录摘要；有探测型号的详情、最近60个原始点；全量规则到期补采 |
| 非监测型号详情 | 6小时 | 全量计费规则、规格、协议补充 |
| 失败补采 | 15/30/60/120/240/360分钟 | 每个型号单独保存失败次数、错误、下次尝试；403/429停止本轮并尊重Retry-After |
| 历史清理 | 每次成功或失败轮次结束有界执行 | 探测点/小时/摘要至少35日，详情原始HTML7日；保留当前引用证据 |

报价和性能分别有持久化任务表。跨阶段认领在同一事务检查两张表的活动租约，同站同一时刻仅一个执行者发详情请求；手工命令遇到活动租约返回 skipped，不强抢。进程崩溃后五分钟租约到期可回收。

单轮预算180秒、单请求最多20秒、响应最多2MiB、串行间隔350ms。预算不足保存逐型号进度，下轮按到期顺序续采；既有Worker四分钟子进程上限不变。

## 独立实现

- `config/transit/soleapi.json`：源URL、周期、超时、完整性门槛和Logo地址。
- `collectors/transit/soleapi-parser.mjs`：十进制精确乘法、公开目录/FX校验、无执行的Flight数据提取、计费分项及折扣。
- `collectors/transit/soleapi.mjs`：阶段认领、采集、局部补采、原始证据、事务入库和退避。
- `collectors/transit/soleapi-storage.mjs`：七张新增表、原点去重、小时重建、十五日聚合、七日吞吐摘要和有界清理。
- `collectors/transit/collect.mjs`：按 `soleapi_v1` 分派，其他站点保持自己的适配器。

新增数据表为六类业务数据加一张逐型号任务状态表：

1. `transit_model_catalog_versions`：价格目录版本，排除health/TPS造成的版本噪声。
2. `transit_offer_charge_items`：每个真实报价的所有收费项；原价、渠道倍率、有效Credits价以十进制文本保存。
3. `transit_model_detail_state`：逐型号缓存、是否核实Credit基准、原文哈希、下次采集与错误。
4. `transit_model_probe_observations`：带UTC微秒时间的型号探测；同点不重复计数，冲突拒绝覆写。
5. `transit_model_probe_hourly`：按已保存原点重建成功/失败数、成功延迟合计、覆盖与partial。
6. `transit_model_metric_summaries`：7日探测计数、7日真实流量TPS、最近60次延迟摘要分开记录。
7. `transit_fx_observations`：每Credit参考币值的来源、源更新时间与版本。

现有station/group/offer、报价观测、源快照、运行审计和两张调度表继续复用。迁移是新增 `CREATE TABLE IF NOT EXISTS`，不清库。首次本地入库前已用SQLite在线备份保留原库和快照到忽略目录 `work/soleapi-research/before-integration/`。

## 价格与页面

- 目录默认倍率与真实渠道倍率分开，83条真实渠道报价采用各自倍率；源目录的11个Claude默认倍率差异记录到审计，不伪造渠道。
- 原价基准与结算价分开，实际报价币种 `CREDIT`；核实公开1 Credit=¥1后才使用¥简写。网站不是美元现金报价，详情完整收费项直接用Credits。
- 根据当前FX和渠道倍率计算对应折扣；FX失败不猜美元换算，保留可确认的Credits价格，安排补采。
- 所有收费项、5分钟/1小时缓存、Fast/Peak/规格规则都保存，并通过共享自定义浮层查看。未确认的详情标待补采，不用空列表冒充“无额外收费”。
- 图片按真实模型区分Token或按张；Gemini generateContent出图模型依据image_output收费纳入图片Tab。视频按秒，不写成每次。
- 首页从真实渠道中选最低同单位价；输入/输出始终取同一分组。既有四大平台优先、型号排序、分页、筛选和布局继续复用。
- 新的报价信息按钮只在有分项记录时出现，不改其他站点卡片的主视觉。

### Logo填充修复

Sole官方SVG根节点为fill=none，路径实际依赖style中的path fill黑/白规则。保存时将已核实的CSS路径填充转为显式 `fill="#000"` 后再移除style，不能直接删CSS导致透明。现有本地资产同步修正；首页和详情只对Sole图标使用应用暗色模式反相，尺寸和路径不变。后续若官方换成未知绘制规则则保留上份Logo并记录错误，不保存透明图。

## 性能口径

- 主值和60根细条：本站累积的近十五日型号探测；型号按成功点/总点，整站按有记录型号等权。
- 首次只有约20小时回看，缺失时段灰色，覆盖小时在浮层及模型卡显示，绝不补成功。
- 平均耗时仅统计成功探测。首页Sole时间行显示“最近耗时”，不是把总耗时叫首Token。
- 模型吞吐读取官方近7日真实流量摘要，显示“吞吐 · 7日”；不会伪造十五日TPS历史。
- 没有公开分组探测时，按该组真实报价成员计算“系统汇总”：每型号每小时先统计成功点/总点，再对同小时有记录型号等权，最后对有记录小时等权。不是复制整站均值，也不是渠道独立实测；将来有有效官方分组数据时优先使用官方数据。
- 分组耗时与可用率共用滚动360小时网格、60根固定6小时细条；耗时只统计成功探测。覆盖小时取模型小时的并集，不按型号累加，缺型号/缺小时不补成功。相同成员集合可能得到相同综合结果。
- 分组汇总在快照导出时由已保存的原始型号历史重建，不额外请求外站，不伪造分组原始观测；报价成员变更后自动重算。无有效型号历史的组仍为空态。
- 原始点保留至少35日。小时桶、源7日成功数和60次均值都不能互相替代。

## 首次本地实际采集

本轮执行的是正式单站初始化，而非测试/构建：

```bash
pnpm collect:transit -- --station=soleapi
```

实际结果：

```json
{"status":"success","pricingStatus":"success","performanceStatus":"success","models":51,"groups":14,"offers":83,"detailModels":51,"performanceRows":1320,"warnings":[]}
```

随后只读调度结果：

- `lastCollectOk=1`，公开快照包含SoleAPI，51型号、14组、83报价。
- 51个详情全部保存，待补0、失败0；22个型号共1320个去重探测点。
- 初次报价完成：北京时间2026-10-30 11:11:23；下次报价17:11:23。
- 下次性能：北京时间2026-10-30 12:11:23。

这些时间会在后续采集成功或失败退避后更新。证据在忽略目录 `work/soleapi-research/initial-collection-status.json`。这是本机数据，不等于服务器已部署或常驻Worker已启动。

没有执行测试、类型检查、构建或浏览器验收。

## 服务器更新后使用

完成代码提交/推送及原有服务器更新流程后，在 `/www/wwwroot/radar.ftuashcahs.xyz`：

```bash
pnpm transit:migrate
pm2 restart all --update-env
pm2 save

if pnpm collect:transit -- --station=soleapi; then
  echo 'SoleAPI采集命令完成'
else
  echo 'SoleAPI存在失败或待补采，下面查看具体状态'
fi
pnpm transit:status
```

若是skipped，先等现有Worker采集结束，不删除租约。`transit:status`包含Sole的目录数量、默认倍率差异、详情成功/失败数、探测覆盖、报价/性能下次时间和最近错误。

只更新价格但不写探测历史可用 `pnpm collect:transit -- --station=soleapi --pricing-only`；该模式仍补齐价格所需详情规则。日常只需要保持既有 `quote-worker` 在线，不需再建第二套定时任务。

可选固定出口沿用 `TRANSIT_SOLEAPI_HTTP_PROXY` > `TRANSIT_HTTP_PROXY` > `PROXY_URL` > `COLLECTOR_HTTP_PROXY`。不配置即直连；不会修改服务器DNS、hosts、证书校验或自动寻找代理。必须以服务器实际采集成功、快照已包含该站为部署完成证据。
