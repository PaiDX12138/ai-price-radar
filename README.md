# Pax · AI Price Radar

[![License: PolyForm-NC](https://img.shields.io/badge/License-PolyForm%20Noncommercial-orange.svg)](./LICENSE)
[![Node.js ≥ 20](https://img.shields.io/badge/Node.js-%E2%89%A520-339933.svg)](https://nodejs.org/)
[![UI: shadcn](https://img.shields.io/badge/UI-shadcn%20base--nova-111111.svg)](https://ui.shadcn.com/)

**AI 卡网 / 订阅 / API 公开比价雷达** — 开源、可自托管的购买前信息聚合工具。

> 本项目**不卖货、不收款、不担保交易**。展示信息仅供参考，下单前请回原站核验。  
> 完整边界见 [免责声明](./docs/disclaimer.md)。

---

## 项目目的

AI 订阅、卡网货源与接码邮箱价格分散在大量公开站点上：标题杂乱、库存跳变、低价常过期。手工打开十几个站比对成本高，也容易被异常低价误导。

**Pax** 把你能核验的公开报价收到同一套界面里，帮助自托管用户：

- 少开站点、快速对比**有货最低价 / 质保价 / 渠道数**
- 对照**官网各地区正价**（含税口径、汇率折算）
- 保留原站标题与跳转链接，方便自行核验后再决策

它是**工具**，不是商城，也不是交易中介。

---

## 核心功能

| 模块 | 说明 |
|------|------|
| **卡网比价** | 聚合公开货源的商品标题、价格、库存状态与购买链接；标准商品卡片网格 + 平台筛选 |
| **店铺收录** | 前台提交店铺 URL，探针识别采集器类型后入库；由 worker 持续刷新报价 |
| **官网定价** | ChatGPT / Claude / Cursor / Grok / Gemini / Kiro 等地区价矩阵；美区对照 + 最低地区条 |
| **接码 / 邮箱** | 公开 OTP / 邮箱平台价目快照（可选采集） |
| **采集调度** | 独立 `worker` 进程：限流、熔断、失败保留 last-good，不因单店失败整批标缺货 |

---

## 系统架构

```text
┌─────────────────────────────────────────────────────────────┐
│                     Next.js（App Router）                    │
│  /channels 卡网比价 · /products/[slug] · /official 官网定价   │
└───────────────┬─────────────────────────────┬───────────────┘
                │ 只读快照                     │
                ▼                             ▼
     data/catalog/public.json      data/official-prices/latest.json
                ▲                             ▲
                │ merge / reclassify          │ export snapshot
┌───────────────┴──────────────┐   ┌─────────┴──────────────────┐
│  Collect Worker（pnpm worker）│   │  Official collectors         │
│  ShopApi / 16688 / kami …    │   │  web + App Store + FX        │
└───────────────┬──────────────┘   └─────────┬──────────────────┘
                │                            │
                ▼                            ▼
        data/shops.sqlite            data/official-prices.sqlite
        data/raw/*.json
```

**数据原则**

- 店铺档案在 SQLite；报价 raw + 公共 catalog 为 JSON 快照（前台不直接绑采集进程）
- 采集失败 ≠ 缺货：失败只记运行日志，不抹掉上次成功报价
- 不绕过验证码 / 登录墙 / WAF；拿不到就标健康失败或跳过

---

## 快速开始

**环境：** Node.js ≥ 20，pnpm 10（推荐 Corepack）

```bash
git clone https://github.com/PaiDX12138/ai-price-radar.git
cd ai-price-radar
pnpm bootstrap
pnpm shops:migrate
pnpm official:migrate
pnpm collect:official    # 官网地区价（建议）
pnpm dev:all             # 网站 + 采集 worker
```

打开 [http://localhost:3000](http://localhost:3000)。

| 步骤 | 作用 |
|------|------|
| `pnpm bootstrap` | 安装依赖、生成 `.env.local` 与示例店铺配置 |
| `pnpm shops:migrate` | 初始化店铺库（示例店默认关闭） |
| `pnpm official:migrate` | 初始化官网价库并写出快照 |
| `pnpm collect:official` | 拉取真实官网 / 商店地区价 |
| `pnpm dev:all` | 前台 + worker；卡网店铺可通过「收录申请」逐步添加 |

更细的部署与排错：[docs/deploy.md](./docs/deploy.md)  
采集调度：[docs/collect-schedule.md](./docs/collect-schedule.md)  
官网定价：[docs/official-prices.md](./docs/official-prices.md)

---

## 技术栈

| 层 | 选型 |
|----|------|
| 应用 | Next.js（App Router） |
| UI | Tailwind CSS 4 + shadcn base-nova（`@base-ui/react`）+ lucide |
| 店铺 / 官网库 | better-sqlite3 |
| 包管理 | pnpm |

协作者请遵守：

- [UI 约束](./.cursor/rules/ui-components.mdc)
- [采集约束](./.cursor/rules/card-shop-collectors.mdc)

---

## 交流群 · 派大星研究所

扫码加入 QQ 群，反馈坏链、讨论自托管与采集问题：

<p align="center">
  <img src="./public/qq-group.png" alt="派大星研究所 QQ 群二维码" width="220" />
</p>

<p align="center">
  <strong>派大星研究所</strong><br />
  群号 <code>907736152</code>
</p>

也欢迎在 GitHub [Issues](https://github.com/PaiDX12138/ai-price-radar/issues) / PR 提交问题与改进。

如果这个项目帮你少踩了坑、少比了半小时价，欢迎点一颗 **Star** —— 这是对开源维护最直接的鼓励。

---

## 许可协议（开源 · 禁止商用）

本仓库源代码按 **[PolyForm Noncommercial License 1.0.0](./LICENSE)** 发布。

| 允许 | 禁止 |
|------|------|
| 个人学习、研究、自用 | 收费托管 / SaaS 运营 |
| 非营利教学与评估 | 售卖本软件或其发行物 |
| 非商业目的的自托管与修改分发（须保留许可声明） | 嵌入商业产品或对外收费服务 |
| 在许可范围内二次开发并分享（非商业） | 未经授权的任何商业利用 |

**商业使用须另行取得授权。** 可通过上方交流群联系维护者。

软件按「现状」提供，不附带任何明示或暗示担保；作者与贡献者不对使用后果承担责任。详见 [LICENSE](./LICENSE) 与 [免责声明](./docs/disclaimer.md)。

---

## 文档索引

| 文档 | 内容 |
|------|------|
| [使用与部署](./docs/deploy.md) | 本地 / 生产搭建 |
| [脚手架说明](./docs/scaffold.md) | 目录与选型 |
| [店铺 SQLite](./docs/shops-sqlite.md) | 店铺档案与收录 |
| [采集调度](./docs/collect-schedule.md) | worker 与限流 |
| [官网定价](./docs/official-prices.md) | 官方地区价采集 |
| [免责声明](./docs/disclaimer.md) | 风险与边界 |
| [贡献指南](./CONTRIBUTING.md) | Issue / PR |

---

## 免责摘要

- 不销售账号 / 卡密 / 订阅，不参与交易与售后  
- 报价可能延迟或失败；以原站为准  
- 第三方渠道有风险，请自行判断并小额试单  
- 勿用于未授权访问或违法用途  

全文：[docs/disclaimer.md](./docs/disclaimer.md)

仓库：https://github.com/PaiDX12138/ai-price-radar
