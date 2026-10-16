# 第一部分落地方案：卡网比价 · 先做链动 / ShopApi 族

> 范围：只做「卡网订阅比价」前台 + 采集。UI 约束见 `.cursor/rules/ui-components.mdc`，采集约束见 `.cursor/rules/card-shop-collectors.mdc`。  
> 优先级按产品方决定：**先链动小铺及同协议货源站（ShopApi）**，Kami / 独角放第二波。

## 1. 为什么先做链动，而不是 Kami

| | 链动 / ShopApi | Kami / 独角 |
|--|----------------|-------------|
| 市场角色 | 多店货源广场，单店商品量大，AI 订阅报价集中 | 独立发卡站，站多但单站商品相对少 |
| 技术形态 | 统一 `shopApi/Shop/*`，一套适配器可覆盖链动、云猫、QXVX | 两套公开 JSON，实现简单 |
| 启动门槛 | **必须有有效 `/shop/<token>` 清单**；直连易 403，可能要代理 | 多数可匿名 `GET`，探针已通 |
| 产品价值 | 有货最低价、渠道数更「像 1688 货源比价」 | 覆盖长尾站 |

「1688 这些」在本项目里对齐为：**货源广场 / 多商家铺货** 形态，即 ShopApi 族，而不是去爬阿里 1688 本体。

本波覆盖 host（ShopApi 族）：

| 平台 | Host | 说明 |
|------|------|------|
| 链动小铺 | `pay.ldxp.cn` / `ldxp.cn` / `www.ldxp.cn` | 主战场 |
| 云猫寄售 | `catfk.com` | 同协议 |
| QXVX Pay | `pay.qxvx.cn` | 同协议；入口可能是根路径 + token |

不在本波：Kami、独角、HTML 专用站、官方订阅、中转 API。

## 2. 第一部分交付物（MVP）

### 2.1 能跑的采集

1. 店铺档案：`data/shops.sqlite`（`pnpm shops:migrate` 从 `config/sources.shopapi.json` 等导入）。每条含 `id`、`platform`（`liandong` / `yunmao` / `qxvx`）、`base_url`、`shop_token`、`enabled`、**`listed_at`（收录时间，不可变）**。详见 [shops-sqlite.md](./shops-sqlite.md)。
2. 采集器 `collectShopApi(source)`：
   - `POST /shopApi/Shop/info`
   - `POST /shopApi/Shop/categoryList`（`goods_type: "card"`）
   - `POST /shopApi/Shop/goodsList`（分页）
   - 抽样或按需 `getGoodsPrice`（实付 ≠ 列表价时写入 `price`，列表价进 `listedPrice`）
3. 写出统一 raw offer（见采集规范），记 `crawl_runs`。
4. CLI：`pnpm collect:shopapi -- --source <id>` / `--all`；失败记日志，不整批标缺货。缺库时先 `pnpm shops:migrate`。

### 2.2 数据层（最小表）

| 表 / 存储 | 用途 |
|-----------|------|
| `shops`（SQLite） | 店铺档案（token、host、平台、健康状态、**listed_at 收录时间**） |
| `data/raw` + catalog JSON | 原始报价与探索页快照（本期报价不进 SQLite） |
| `products` | 标准商品（slug、平台、交付类型）— 规则表 + seed |
| `crawl_runs` | 每次采集成功/失败摘要（jsonl） |

本地 / 开源自托管：SQLite 单文件即可。

### 2.3 前台（daisyUI）

| 路由 | 内容 |
|------|------|
| `/` | 一句话入口 → 进卡网比价 |
| `/channels` | 平台 Tab（先 ChatGPT / Claude / …）+ 标准商品表：有货最低价、质保价、有货/缺货、渠道数、更新时间 |
| `/products/[slug]` | 该标准商品下全部渠道明细（店名、原标题、价、库存、跳原站） |

数据源：先读库；库空时显示空态，不用假价格糊弄。

### 2.4 明确不做（第一部分）

- 收款、发卡、存 CDK/Token
- Kami / 独角 / HTML 采集
- 用户登录、复杂后台（可留 `sources` 的 JSON/CLI 维护）
- 价格历史曲线、信誉分（表可预留字段，不做 UI）

## 3. 实施顺序（建议工期按里程碑，不按空想天数）

### M0 — 工程骨架

- Next.js App Router + Tailwind + daisyUI
- 目录：`app/`、`components/`、`lib/`、`collectors/shopApi.ts`、`config/`
- 挂上 `.cursor/rules` 已有约束

### M1 — 店铺清单（卡点，先做）

链动示例店（如历史 `jinyao` / `pixelshop`）已返回「店铺链接不存在」，**没有 token 清单就采不到货**。

做法：

1. 手工收录 10～30 个有效 `https://pay.ldxp.cn/shop/<token>`（从常用群、已有书签、用户投稿）。
2. 探针脚本：`info` 成功才入库；失败标 `dead`。
3. 可选：云猫 / QXVX 各先收 3～5 店验证同适配器。

验收：`pnpm collect:shopapi -- --source <id>` 能打出 ≥1 页 `goodsList` 并落盘。

### M2 — ShopApi 采集器稳定

- 分类分页拉全；限流（建议起步：单店页间隔数秒、全局并发 1～2）
- 403 熔断冷却；可选代理环境变量（直连通了再上代理）
- `getGoodsPrice`：先对「热门关键词 / 低价 Top」抽样，避免每 SKU 打爆
- offer 去重键：优先 `goods_key` / 规范化 `/item/...` URL

验收：对 10 店跑一轮，`crawl_runs` 成功数可统计；抽查价格与原站一致。

### M3 — 归类 + `/channels` 页

- 规则表：标题关键词 → `product_slug`（先覆盖 ChatGPT Plus / Go / Team、Claude Pro、Gemini、Grok 等高频）
- 归不进去的进「其他」，人工可后续纠
- 有货最低价 / 质保价（标题含「质保」等）/ 渠道统计
- daisyUI `tabs` + `table` + `badge`

验收：打开 `/channels` 能看到真数据，点进详情能跳原站。

### M4 — 加固

- 定时任务（本机 cron / GitHub Action / 单机 worker 三选一）
- 店铺健康：连续失败降权或暂停
- 简单「提交店铺」表单（只收 URL，后台人工过探针）— 可放到 M4 末尾

## 4. ShopApi 请求流（实现对照）

```text
source.shopToken
    → POST /shopApi/Shop/info
         · custom_status≠1 → 打样：ok + offers=[] + withdrawDisplay（不拉 goods）
         · msg 含「封禁」→ fail + withdrawDisplay
    → POST /shopApi/Shop/categoryList  (goods_type=card)
    → for category_id:
          POST /shopApi/Shop/goodsList  (current, pageSize)
    → (可选) POST /shopApi/Shop/getGoodsPrice
    → normalize → raw_offers
```

**打样 / 封禁（展示与采集）**

| 信号 | 行为 |
|------|------|
| `info.custom_status === 1` | 正常营业，照常采商品 |
| `custom_status !== 1`（常见 0 + `custom_status_msg`） | 店铺已打样：清空该店目录报价，`status=resting`，**不删店、enabled 保持、继续调度采集** |
| Shop/info 报「封禁」 | 清空目录报价；店保留并继续采，观察是否解封 |
| 普通失败 / WAF | **不**清空上次成功报价（last-good） |

打样时 API 仍可能 `code===1` 且 `goodsList` 有货，不得把这些写入比价目录。

字段映射：

| 原字段 | 我们的字段 |
|--------|------------|
| `name` | `sourceTitle` |
| `price` / `real_price` 或 `getGoodsPrice` | `listedPrice` / `price` |
| 库存相关字段（以探针为准） | `stockCount` / `status` |
| `link` 或 `/item/{goods_key}` | `url` |
| `info.nickname` | 店名展示 |
| `info.custom_status` / `custom_status_msg` | 打样判定 / `withdrawReason` |

## 5. 风险与对策

| 风险 | 对策 |
|------|------|
| token 失效快 | 探针 + `dead` 状态；收录入口 |
| 直连 403 / 出口不稳定 | 限流熔断；环境变量挂代理；不绕 WAF |
| 列表价 ≠ 实付 | `getGoodsPrice` + `priceBasis` |
| 标题脏、难归类 | 先粗规则 +「其他」桶；不阻塞上线 |
| 与第三方协议冲突 | 自研实现与配置；不整仓搬受限代码 |

## 6. 第二波（第一部分验收后再开）

1. Kami（`/user/api/index/commodity`）— 长尾站快速铺量  
2. 独角（`/api/v1/public/products`）  
3. `publicProductsApi` / GetGPT / IkunLove 等专用站  
4. HTML 族  

## 7. 开工检查清单

- [ ] 仓库脚手架（Next + daisyUI）
- [ ] 至少 10 个有效链动 `shopToken`
- [ ] `collectShopApi` 单店跑通并落库
- [ ] `/channels` + `/products/[slug]` 读真数据
- [ ] 采集限流与失败不误标缺货

---

**结论：第一部分从链动 ShopApi 开工；「1688 这些」= 同协议货源广场（链动 → 云猫 → QXVX）。卡点是有效店铺 token，不是页面样式。**
