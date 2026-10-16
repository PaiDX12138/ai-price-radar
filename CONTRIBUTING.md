# 贡献指南

感谢你愿意改进 AI Price Radar。请先阅读 [免责声明](./docs/disclaimer.md) 与 UI / 采集约束（`.cursor/rules/`）。

## 开发流程

1. Fork 本仓库并从 `main` 拉分支。
2. `pnpm bootstrap && pnpm dev`
3. 一个 PR 尽量只解决一个问题。
4. 提交前跑通：`pnpm lint`；有界面改动请附截图。

## UI

- **只允许 shadcn (base-nova) + lucide + Tailwind**，禁止引入其它 UI 组件库。
- 比价相关页优先 `table` / `tabs` / `badge` / `alert`。
- 图标用 `lucide-react`。

详见 `.cursor/rules/ui-components.mdc`。

## 采集器

- 新增 / 修复采集器前，必须对真实 host 做探针，并在 PR 中写明：
  - 测试 URL
  - 命令（如 `pnpm collect:shopapi -- …`）
  - 输出字段摘要
- 输出至少包含：`sourceTitle`、`price`、`status`、`url`；能拿到则含 `stockCount`。
- 不绕过验证码、登录墙、WAF；失败不得批量标缺货。

详见 `.cursor/rules/card-shop-collectors.mdc` 与 `docs/phase1-liandong-shopapi.md`。

## 文档

- 用户可见流程改动时，同步更新 `README.md` 与 `docs/deploy.md`。
- 免责与风险边界变更需单独说明。

## 行为准则

保持友善、就事论事。不接受利用本项目讨论或协助违法用途的贡献。
