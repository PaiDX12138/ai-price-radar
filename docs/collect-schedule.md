# 定时采集 — 内置 Worker（与前台进程分离）

架构：**`pnpm worker` 采集 → 落盘快照 → 前台只读**。  
不要把采集塞进 `next dev` / `next start`；页请求禁止直打发卡网。

中转站点同样由本Worker独立调度，无需额外cron。SoleAPI报价6小时、模型探测1小时、逐型号详情失败补采与十五日保存见 [SoleAPI采集运行说明](soleapi-collection.md)。

RunAPI报价6小时、公开对话探测5分钟，沿用同一独立任务调度；表达式时段价格本地重算，详见 [RunAPI采集运行说明](runapi-collection.md)。

Cubence公开基础报价与设置6小时，Logo每日检查，接入同一Worker；登录分组与监测未取得数据，不创建空转轮询或虚构15日历史，详见 [Cubence采集运行说明](cubence-collection.md)。

CrazyRouter报价/媒体矩阵6小时，活跃型号性能1小时、无流量型号6小时，源7日小时原点持续积累15日；独立队列、租约、时段重算和限流退避见 [CrazyRouter采集运行说明](crazyrouter-collection.md)。

## 开箱用法（一键）

```bash
pnpm bootstrap
pnpm shops:migrate          # 首次
pnpm dev:all                # 开发：网站 + worker 同开
# 生产：
# pnpm build && pnpm start:all
```

浏览器打开 http://localhost:3000。Ctrl+C 会同时停掉两个进程。

仍可分开跑：`pnpm dev` / `pnpm start` + 另一个终端 `pnpm worker`。  
单次排障：`pnpm worker -- --once`（或 `WORKER_CLAIM_LIMIT=2 pnpm worker -- --once`）。

Worker 每 **10 分钟** 从 `data/shops.sqlite` 认领到期店铺（`next_collect_at`），按平台并发采集；成功后约 **30 分钟** 再采；失败按退避加长间隔。同店租约互斥，进程崩溃后租约过期可被重新认领。

顺带低频任务：官网订阅价按 `dueOfficialMode`（**每天 06:00 Asia/Shanghai 日更汇率**；已过点且今日未更则兜底补跑 / 周更全量）；邮箱/接码平台价约每 **6 小时** `collect:otp`（`OTP_COLLECT_INTERVAL_MS`）。

## 并发（内置默认）

| 分组 | 并发 | 代理 |
|------|------|------|
| 链动 liandong | 有 `PROXY_API_URL`：4 通道；否则 1 通道慢采 | 可选，见下 |
| 云猫 / QXVX 等 shopApi | 3 | 否（直连） |
| 16688 | 3 | 否 |
| kami / dujiao / 独立站 | 12 | 否 |

## 代理（可选，主要服务链动）

在 `.env.local` 任选其一：

```bash
PROXY_API_URL=你的按量提取IP接口
# 或固定代理
PROXY_URL=http://用户名:密码@IP:端口
# 兼容旧名
# COLLECTOR_HTTP_PROXY=http://用户名:密码@IP:端口
```

不配代理也能跑：其它平台照常并发；链动单出口 + host 间隔慢采。

内置节约策略：全局 IP 池、standby 复用、每 **10 分钟最多提取 2 次**；通道冷却只推迟该通道上的链动店。

采完后若设置了 `PREWARM_BASE_URL`（或 `NEXT_PUBLIC_SITE_URL`），会 `POST /api/catalog/revalidate` 并预热公开读路径。

## 手工全量（排障）

```bash
pnpm collect:shopapi -- --all
pnpm collect:16688 -- --all
pnpm collect:prices -- --all
pnpm collect:otp                 # 邮箱/接码平台公开价（约 6h 由 worker 自动跑）
# 或
pnpm collect:all
```

可选 `.env.local`（有 Key 才采对应站，无 Key 不影响公开站）：

```bash
SMS_MAN_TOKEN=
ONLINE_SIM_APIKEY=
HERO_SMS_API_KEY=
# OTP_COLLECT_INTERVAL_MS=21600000   # worker 默认 6h
```

## 写出路径

- `data/catalog/public.json` / `latest.json`
- `data/crawl_runs.jsonl` / `data/raw/*`

## 前台缓存

### 修改分类规则后离线刷新存量报价

```bash
node scripts/reclassify-catalog-snapshot.mjs          # 只预览分类迁移数量，不写文件
node scripts/reclassify-catalog-snapshot.mjs --apply  # 不额外备份，原子替换 public/latest
```

此命令只重分类当前快照，保留报价数量、商品 ID、价格、库存、原始采价时间、最后看到时间及下架状态；不请求店铺，也不从旧 raw 复活下架商品。无法确定分类的报价保留为 `other-unclassified`，不参与订阅卡统计。默认处理 `data/catalog/public.json` 和 `latest.json`；可用 `--snapshot <路径>` 处理单份快照。应用时不额外生成备份文件，仍保留并发修改检查和原子替换。

接码分类按交付内容判断：`Plus / Pro / 渠道 / 20–30天 / 卡密` 本身不是账号证据。实卡、长效/长期接码、多账号绑定容量属于接码服务；`成品号 / 账密 / JSON交付 / 首登` 等才是账号交付证据。账号的已/未接码、附带接码链接、不保接码等说明不独立拆成接码商品。

回归：`pnpm assert:classify` + `node scripts/test-classification-sms-integration.mjs`。

进程 TTL：`CATALOG_CACHE_TTL_SECONDS`（默认 60，夹紧 30–300）。  
公开 API：`Cache-Control: public, max-age=0, s-maxage=<60-300>, stale-while-revalidate=60`。

## 生产建议

### 中转站点独立调度

2026-11-02：鸡哥AI通过独立`chickener_v1`正式接入，价格6小时、性能1小时、持久化逐型号续采。ZetaAPI按维护者要求暂停展示并移除全部定时任务，不再每日探测停服站；旧说明中的Zeta频率只描述历史。详见[鸡哥AI运行说明](chickener-collection.md)。

SudoCode已接入同一调度：报价/公式/目录每6小时，版本性能每1小时，Logo每日复核；独立持久化next-due、租约、失败退避，不需要新增cron。接口可直接回填15日，小时事实持续保存35日。版本性能不会伪装成渠道独立观测，详见 [SudoCode运行说明](sudocode-collection.md)。

`pnpm worker` 每分钟发现并检查 `config/transit/*.json` 的到期任务，按站点启动独立采集子进程，不需要为每个站点单独新增cron。报价默认6小时，Right Code可用率每小时，ZetaAPI公开心跳每5分钟；详细的分表保存、35日保留和监控范围见 `docs/zetaapi-integration-plan.md`。`start`只读快照，不负责持续采集。

### 停采诊断与自动恢复

- 调度器默认同时运行2个站点子进程（`TRANSIT_WORKER_CONCURRENCY=1..4`），只启动已到期且没有活跃租约的任务。不再每分钟同时启动8个无事可做的Node进程。单个站点配置损坏、启动失败、网络失败不阻断其他站点；4分钟超时后终止，5秒后强制清理，过期租约可接管。
- 运行心跳写入 `transit_worker_heartbeats`，记录进程、主机、最后轮询、活跃子进程及错误；不进入公开数据基线。`pnpm transit:status`现在必须区分心跳缺失/超过3分钟、任务缺失、逾期、失败退避和正在采集。不能仅凭旧的`last_collect_ok=1`判定任务正常。
- PackyAPI报价仍默认6小时，但监测改为独立小时任务，不再依赖报价到期或报价成功。逐型号游标写入 `transit_packy_metric_subjects`，时间预算中止后下次先采尚未完成的型号，失败型号按退避重试，避免永远只采前几个型号。可用率、首Token、总耗时与吞吐仍取同一模型/分组/小时接口事实，最多保留35日，不补造缺失小时。
- RightCode报价失败不再跳过可用率；监测成功和失败均记录独立`performance`运行。RightCode公共源的逐小时点只有约24小时；另有7日/30日各24个粗粒度区间，完整响应仍归档，但不能把7小时/30小时平均值复制成逐小时事实。所以离线超过逐小时源窗口的缺口无法据此精确回填；公共源不含TTFT/耗时/吞吐，界面保留未知，不能冒充网络故障或填0。Cubence公共基础价无公开监测，不创建虚构监测轮询。
- 启动立即检查全部到期任务；常驻每分钟持续检查。原`pnpm worker`已集成，无需新增cron。只想运行中转采集可选择`pnpm worker:transit`（30秒轮询）；已有`quote-worker`时不必另起重复服务。一次性排障可运行`pnpm worker:transit -- --once`，会等待所有到期站点而不是只启动子进程就退出；它不是常驻替代品。
- 可选目录/模型元数据刷新移到真实采集之后，不再阻塞站点网络请求。采集完成原子导出快照，页面仍仅只读快照，不能依赖用户访问页面来触发采集。
- 低于64MiB可用磁盘空间时暂停启动新的采集子进程并明确告警，保留last-good，释放空间后自动恢复。排障时不要删除正式`data/transit.sqlite`、采集原始历史或备份来“修复”缺口。
- 官网明确停服时，不把停服公告的HTTP200当作价格页。ZetaAPI于2026-10-31停服的公告已实测：保留历史报价/监测、记录来源与日期，沿用原有状态标签显示停服，任务每日自动复核，不继续高频轮询已返回410的监控。诊断明确显示`source_closed`，不是调度器漏跑。

沿用本站现有PM2名称的检查/恢复（不是新增未知进程，也不会重启其他业务）：

```bash
cd /www/wwwroot/radar.ftuashcahs.xyz
pm2 describe quote-worker
pm2 restart quote-worker --update-env
pm2 save
pnpm transit:status
pm2 logs quote-worker --lines 50 --nostream
```

若`describe`显示worker并不是本项目`scripts/worker.mjs` / `pnpm worker`或工作目录不同，先修正其原始启动配置；`restart`不会把另一套脚本自动变成本项目Worker。只有`pnpm start`没有采集进程时，数据不会自行更新。系统重启后的拉起仍由已有PM2/systemd启动服务负责；应用无法替代操作系统守护。`transit:status -- --strict`在发现异常时退出2，便于外部监控，不会暴露代理密钥。

用 systemd / Docker / pm2 各起两个进程：`start` 与 `worker`。  
外挂 cron / Windows 计划任务**不是**主路径；仅在无法常驻 worker 时作兜底触发 `pnpm worker` 单次（worker 本身是长循环，一般不需要 cron）。

示例脚本（非推荐主路径）：`scripts/windows-schtasks-collect.example.ps1`。
