# 定时采集 — 内置 Worker（与前台进程分离）

架构：**`pnpm worker` 采集 → 落盘快照 → 前台只读**。  
不要把采集塞进 `next dev` / `next start`；页请求禁止直打发卡网。

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

进程 TTL：`CATALOG_CACHE_TTL_SECONDS`（默认 60，夹紧 30–300）。  
公开 API：`Cache-Control: public, max-age=0, s-maxage=<60-300>, stale-while-revalidate=60`。

## 生产建议

用 systemd / Docker / pm2 各起两个进程：`start` 与 `worker`。  
外挂 cron / Windows 计划任务**不是**主路径；仅在无法常驻 worker 时作兜底触发 `pnpm worker` 单次（worker 本身是长循环，一般不需要 cron）。

示例脚本（非推荐主路径）：`scripts/windows-schtasks-collect.example.ps1`。
