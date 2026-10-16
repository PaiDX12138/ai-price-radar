# 使用与部署教程

## 环境要求

| 依赖 | 版本 |
|------|------|
| Node.js | ≥ 20（建议 LTS） |
| pnpm | 10.x（仓库已写 `packageManager`，可用 Corepack） |

启用 Corepack（推荐）：

```bash
corepack enable
corepack prepare pnpm@10.28.1 --activate
```

## 一键本地启动

```bash
git clone https://github.com/PaiDX12138/ai-price-radar.git
cd ai-price-radar
pnpm bootstrap
pnpm shops:migrate
pnpm dev:all
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。`dev:all` 会同时启动网站和采集 worker。

### setup 做了什么

- 生成 `.env.local`（来自 `.env.example`）
- 生成 `config/sources.shopapi.json`（来自 example）
- `pnpm install`

### 配置店铺与采集

1. `pnpm shops:migrate`（从 `config/sources.*.json` / `collectors.json` 导入店铺）
2. （可选）在 `.env.local` 配置链动代理：`PROXY_API_URL` 或 `PROXY_URL`（不配也能跑）
3. 日常自动刷新：

```bash
pnpm worker
```

手工全量仍可用：`pnpm collect:shopapi` / `collect:16688` / `collect:prices`。详见 [定时采集](./collect-schedule.md)。

## 生产构建（双进程）

```bash
pnpm build
pnpm start:all    # 一键：网站 + worker（同进程树，Ctrl+C 全停）
# 或拆成两个 unit / pm2 app：
# pnpm start
# pnpm worker
```

默认网站监听 `3000`。生产也可用 systemd / pm2 各挂一个进程；本地开源用户优先 `dev:all` / `start:all`。

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_SITE_URL` | 站点公开 URL |
| `PREWARM_BASE_URL` | 采集后刷前台缓存（通常同站点 URL） |
| `PROXY_URL` / `PROXY_API_URL` | 可选，主要加速链动 |
| `COLLECTOR_HTTP_PROXY` | `PROXY_URL` 兼容旧名 |
| `PORT` | Next `start` 端口（若平台支持） |

## 部署平台建议

| 平台 | 适合 | 注意 |
|------|------|------|
| Vercel / Cloudflare Pages | 仅前台展示 | 长时采集不适合 Serverless；另开 VPS 跑 `pnpm worker` |
| VPS + Node | 前台 + 内置 worker | 推荐：`pnpm start` + `pnpm worker`（两进程） |
| Docker | 一键镜像（后续提供） | 当前优先文档化 Node 路径，Compose 随 DB 方案补齐 |

### 反向代理示例（Nginx）

```nginx
server {
  listen 80;
  server_name price.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 升级

```bash
git pull
pnpm install
pnpm build
# 重启你的 process manager
```

## 常见问题

**`pnpm bootstrap` 后 dev 起不来？**  
检查 Node ≥ 20、Corepack/pnpm 版本，删除 `node_modules` 后重跑 `pnpm install`。

**采集报没有 shopToken？**  
必须用**现在还能打开的**店铺页；历史 demo token 常已失效。

**样式异常 / 主题错乱？**  
确认 `package.json` 含 `"browserslist": "> 1%"`，且 `globals.css` 含 `@plugin "daisyui"`。

**能否只看页面不采集？**  
可以。`pnpm bootstrap && pnpm dev` 即可浏览骨架；比价表在无数据时显示空态。

## 相关文档

- [脚手架说明](./scaffold.md)
- [定时采集 / Worker](./collect-schedule.md)
- [店铺 SQLite](./shops-sqlite.md)
- [第一部分落地方案](./phase1-liandong-shopapi.md)
- [免责声明](./disclaimer.md)
