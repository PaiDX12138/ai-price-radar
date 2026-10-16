# 脚手架说明（shadcn base-nova）

本文说明开源仓库如何搭建，以及为什么这样选。产品规则见：

- `.cursor/rules/ui-components.mdc` — UI 只准 **shadcn（base-nova / Base UI）**
- `.cursor/rules/card-shop-collectors.mdc` — 采集按技术栈、禁止猜接口
- `docs/phase1-liandong-shopapi.md` — 第一部分先做链动 ShopApi

## 技术选型

| 层 | 选择 | 原因 |
|----|------|------|
| 框架 | Next.js App Router（Next 16） | 前后端同仓、路由/API 一体 |
| 样式 | Tailwind CSS 4 + **shadcn base-nova** | `@base-ui/react` + CVA + 主题 CSS 变量 |
| 图标 | `lucide-react` | 禁止 emoji 当图标 |
| 工具 | `clsx` + `tailwind-merge`（`cn`） | 与 site 一致 |
| 包管理 | **pnpm** | `packageManager` 已锁定 |

**明确不选：** daisyUI / antd / MUI / Mantine / HeroUI。**禁止 daisyUI 与 shadcn 混用**。

## shadcn 接入（已落地）

1. 依赖：`@base-ui/react`、`class-variance-authority`、`clsx`、`tailwind-merge`、`tw-animate-css`
2. `src/app/globals.css`：`@import "tailwindcss"` + `@theme inline` + `:root` / `.dark` CSS 变量（对齐 desktop/site）
3. 基础组件：`src/components/ui/`（从 desktop/site 适配，`cn` 路径为 `@/lib/utils`）
4. 业务组件：`src/components/catalog/`、`src/components/layout/`

主题增减只改 `globals.css` 里的 CSS 变量，不要平行再造一套 token。

## 推荐目录

```text
ai-price-radar/
├── .cursor/rules/
├── config/
├── docs/
├── scripts/
├── src/
│   ├── app/
│   ├── components/
│   │   ├── ui/          # shadcn primitives
│   │   ├── catalog/
│   │   └── layout/
│   ├── data/demo/
│   └── lib/
└── package.json
```

## 一键搭建

```bash
git clone https://github.com/PaiDX12138/ai-price-radar.git
cd ai-price-radar
pnpm bootstrap
pnpm shops:migrate   # 店铺档案 → data/shops.sqlite（含收录时间 listed_at）
pnpm dev:all         # 网站 + 内置采集 worker（一键）
```

店铺真相源为 SQLite，见 [shops-sqlite.md](./shops-sqlite.md)。旧 `config/sources.*.json` 仅作迁移输入；采集读库。报价仍在 `data/raw` + `data/catalog`。
