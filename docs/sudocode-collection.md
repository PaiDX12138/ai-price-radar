# SudoCode 采集运行说明

已完成独立 `sudocode_v1` 接入。没有修改卡片配色、尺寸、网格或悬浮窗样式；沿用已有型号排序、折扣和价格详情。仅补齐版本监测范围说明、音频按秒价格，以及混合图片单位的正确说明。

## 实际完成结果

首次真实CLI采集完成于北京时间2026-10-30 16:29：

- 77个原始型号、34个分组定义（28个有效）、279条报价，核心Claude/GPT/DeepSeek/Gemini齐全。
- 13个型号有动态Token档，30条分组报价适用阶梯；图片按次/Token、音频按秒、缓存读写及时长分别保存。
- 7次串行公开GET，价格和性能均成功，告警0。不是主动调用77个模型。
- 23,168条型号—版本—小时事实；71型号、8个有数据版本，15日网格360小时覆盖。无记录型号不填造数据。
- Logo已核实下载到 `public/brand/transit/sudocode.png`，不是字母占位图。
- 实际读侧包含8个站点，其他7个站点保留；`/api/transit` 已确认SudoCode有77型号、28分组、279报价。

这里是本次采集记录，不是固定库存。公开接口、计价公式和监测范围详见 [完整接入方案](sudocode-integration-plan.md)。

## 采集与持续更新

项目根目录执行：

```bash
pnpm transit:migrate
pnpm collect:transit --station=sudocode
pnpm transit:status
```

只处理到期任务：

```bash
pnpm collect:transit --station=sudocode --due
```

只刷新目录与价格：

```bash
pnpm collect:transit --station=sudocode --pricing-only
```

报价默认6小时、性能1小时、Logo每日复核，分别持久化调度与租约。**持续采集依赖原有 `pnpm worker` 常驻**；`pnpm start` 只读快照，不承担采集。已有Worker自动发现新JSON配置，不要重复添加cron。本轮没有擅自新增长期后台进程或修改服务器服务。

`pnpm transit:status` 的SudoCode诊断增加 `pricingCollection` 库存、`versionHourRows/models/versions/earliestHour/latestHour/lastObservedAt` 与 `monitoringScope`；源版本不是渠道这个边界不会丢失。

## 数据与恢复

- `data/transit.sqlite` 为写侧，`data/transit/latest.json` 为前台读侧；可分别由 `TRANSIT_DB_PATH/TRANSIT_SNAPSHOT_PATH` 覆盖，Worker和网站必须使用相同配置。
- 自动建3张SudoCode专表，不删旧表、不重建数据库、不触碰其他站点。
- 公式、目录、配置按内容版本保存；小时点按“站点/型号/版本/UTC小时”幂等更新，旧响应不覆盖新小时。
- 当前小时partial标志保存，后续完整快照可修订；有效事实35日，原文传输副本7日，已接受价格/政策/配置的原文引用保留。
- 采集失败保留last-good及发布状态，价格和性能分别记录错误、退避重试。

实际采集前备份位于本机忽略目录 `work/sudocode-before-collection-1793348963627/`，使用SQLite在线backup而非直接复制活动WAL数据库。需要回滚时先停止写侧Worker，再从这份已验证备份恢复SQLite和快照；不要清空生产数据。

## 验证记录

- SudoCode专属23项测试，加上既有站点/分组汇总/导航/价格倍率回归79项，合计102项。
- 覆盖完整库存、6.89与6.68区分、按次/Token图片、按秒音频、缓存缺失与0、阶梯适用分组、版本监测身份、旧快照防回滚、partial修订、调度独立、租约、403停请求、公式变更、分组缩水、原文保留与路径限制。
- 类型检查及相关文件ESLint通过；生产构建通过，当前有15条既有路径的动态文件追踪警告，非零告警构建未被描述为无告警。
- 实际采集成功；紧接的 `--due` 跳过且无SudoCode外站请求，证明到期判断生效。
- 生产构建纯HTTP检查首页、SudoCode详情、图片与Claude筛选、诊断API、Logo共6条路径，全部200；测试临时服务已停止。
- 未操作浏览器、未发收费推理请求、未提交或推送Git、未部署到服务器。临时测试、原始响应和运行数据均在Git忽略目录。
