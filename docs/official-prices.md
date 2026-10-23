# 官网定价（官方地区价）

标准套餐 × 地区 × 渠道报价矩阵，写入 SQLite；前台只读 JSON 快照。当前开放 **ChatGPT** / **Claude** / **Cursor** / **Grok（含 X Premium）** / **Kiro** / **Gemini**。

地区码（ISO2）与 App Store `storefrontId` 均为公开参数，配置在 `config/official-prices/regions.json`；各板块按此全量刷新，不另造黑名单国家表（Claude 官网除外，见下）。

## 渠道与支付

| channel | 谁收款 | 支付方式 | 地区价来源 |
|---------|--------|----------|------------|
| `web_direct` 官网直购 | 厂商（OpenAI / Anthropic·Stripe / X Subscription） | 信用卡/借记卡（官网结账） | ChatGPT：公开国别 JSON **标价原样**（含税/不含税见 `taxMode`）；Claude / Cursor：美区 USD × FX 本地币（`tax=exclusive`） |
| `ios_store` App Store | Apple | 由 Apple ID 地区决定 | `apps.apple.com` `pageData.addOns`（`x-apple-store-front`） |

**已移除** `google_play` 渠道（不再采集、不展示）。

采集失败只标 `stale`，不清空旧价；连续 403/429 立即停手，不绕过。

## ChatGPT

| channel | 说明 |
|---------|------|
| `web_direct` | `GET chatgpt.com/backend-api/checkout_pricing_config/configs/{ISO2}`；404 = 该国未开放 |
| `ios_store` | App `6448311069`；`offerPattern` 匹配 `oai_chatgpt_*` |

套餐：`go-monthly` / `plus-monthly|annual` / `pro-5x` / `pro-20x` / `pro-500`。

## Claude

| 项 | 值 |
|----|-----|
| App Store | `id6473753684` / `claude-by-anthropic` |
| 官网 | 无公开国别 API；Anthropic 支持国 = USD × FX（`claude-web-countries.json`） |

## Cursor

| 项 | 值 |
|----|-----|
| App Store | `id6767085653` / `cursor`（除中国大陆外各 storefront 可售） |
| 官网 | [cursor.com/pricing](https://cursor.com/pricing) 仅美区 USD；**全部** `regions.json` enabled 地区 = USD × FX（税前） |

现行 X Subscription（证据： [cursor.com/pricing](https://cursor.com/pricing)）：

| family | 月付官网 | 年付官网 | 卡网 catalogSlug |
|--------|----------|----------|------------------|
| Plus | $8 | $80 | `cursor-plus`（勿挂到 Pro） |
| Premium | $30 | $300 | `cursor-pro`（卡网「Pro」对照档） |
| Super | $100 | $1,000 | `cursor-pro-plus`（卡网「Pro+」对照档） |
| Ultra | $200 | $2,000 | `cursor-ultra`（年付只走官网，月付 iOS/官网） |

同名月/年 SKU 按 `usListUsd` 就近匹配，并校验计费周期，避免把月付价写成年付。旧 Pro / Pro+ 价目不入库；卡网页仍用旧 slug，靠上表对照官网档位。

## Grok（The X Subscription）

| 项 | 值 |
|----|-----|
| App Store | `id6670324846` / `grok-ai`（公开名仍见 SuperGrok / Lite / Plus / Heavy） |
| 官网 | [x.ai/pricing](https://x.ai/pricing) = Cursor 同款 X Subscription 美区 USD × FX |

| family | 月付 | 年付 | iOS 公开名（美区） |
|--------|------|------|-------------------|
| Plus | $8 | $80 | SuperGrok Lite ≈ $10 |
| Premium | $30 | $300 | SuperGrok $30 / $300 |
| Super | $100 | $1,000 | SuperGrok Plus ≈ $100 |
| Ultra | $200 | $2,000 | SuperGrok Heavy ≈ $300（月） |

前台 Tab：`platform=grok`。

## X Premium（独立推特会员）

仍对存量/纯 X 用户出售；与 X Subscription 并存。前台挂在 **Grok** Tab（`catalogPlatform=grok`）。

| 项 | 值 |
|----|-----|
| App Store | `id333903271` / `x` |
| 官网美区 | Basic $3/$32 · Premium $8/$84 · Premium+ $40/$395（帮助中心公开表） |
| iOS 美区 | Basic $4/$42 · Premium $11/$114.99 · Premium+ $50/$490 |

**不做**：Teams / Enterprise 席位价、Usage Credits、无证据的多国独立爬取。

## Kiro

| 项 | 值 |
|----|-----|
| App Store | **无**（IDE 订阅仅官网 / Stripe） |
| 官网 | [kiro.dev/pricing](https://kiro.dev/pricing/) 美区 USD 月付；支持国名单见定价 FAQ → `kiro-web-countries.json` |
| 年付 | 官网未公布年付档 |

| slug | 展示 | 官网美区 | 积分 |
|------|------|----------|------|
| `pro-monthly` | Kiro Pro | $20 | 1,000 |
| `pro-plus-monthly` | Kiro Pro+ | $40 | 2,000 |
| `pro-max-monthly` | Kiro Pro Max | $100 | 5,000 |
| `power-monthly` | Kiro Power | $200 | 10,000 |

税前；GovCloud 约贵 20%（不单独入库）。加油包 / Enterprise 不做地区价矩阵。

## Gemini（Google AI plans）

| 项 | 值 |
|----|-----|
| App Store | `id6477489729` / `google-gemini` |
| 官网 | [Google AI plans](https://one.google.com/about/google-ai-plans/) 美区 USD × FX（税前） |

| slug | 展示 | 官网美区 | 卡网 catalogSlug |
|------|------|----------|------------------|
| `plus-monthly` | Google AI Plus | $4.99 | `gemini-plus`（勿挂到 Pro） |
| `pro-monthly` | Google AI Pro | $19.99 | `gemini-pro` |
| `pro-annual` | Google AI Pro | $199.99 | `gemini-pro` |
| `ultra-5x-monthly` | Google AI Ultra 5x | $99.99 | `gemini-ultra` |
| `ultra-20x-monthly` | Google AI Ultra 20x | $199.99 | `gemini-ultra` |

卡网别名：`gemini-recharge` / `gemini-year` → `gemini-pro`（详情顶栏美区+最低地区两卡）。

纯存储 SKU（如 100 GB）不入库。Ultra 年付官网未稳定公布则不做。

## 价格口径（统一不含税）

- 列表主价只认 `available`；`estimated` 不抢最低价。
- **全站展示价与税标统一为「不含税」**：ChatGPT 官网 `inclusive` 按税率拆回税前；`exclusive` 用 list、不再加税。
- iOS 无税率字段时按原展示价入库，税标仍显示「不含税」。
- Claude / Cursor / Grok / X / Kiro / Gemini 官网为 USD×FX（税前）；商店价常高于官网（Apple 抽成）。

## 库与配置

| 路径 | 说明 |
|------|------|
| `data/official-prices.sqlite` | 真相源（gitignore） |
| `data/official-prices/latest.json` | 前台读的快照 |
| `config/official-prices/apps.json` | chatgpt + claude + cursor + grok + x + kiro + gemini |
| `config/official-prices/kiro-web-countries.json` | Kiro 官网可付费账单国 |
| `config/official-prices/plans.json` | 套餐 + App Store 匹配式 |
| `config/official-prices/regions.json` | 公开地区参数（有 `storefrontId` = iOS 可采） |
| `collectors/official-chatgpt-web.mjs` | ChatGPT 官网 |
| `collectors/official-claude-web.mjs` | Claude 官网 FX |
| `collectors/official-cursor-web.mjs` | Cursor 官网 FX |

## CLI

```bash
pnpm official:migrate                       # schema + 地区 + 缺价 app 的 seed，并重写快照
pnpm official:migrate -- --force-seed       # 按 seed 文件强制重写各 app 价（慎用）
pnpm collect:official -- --mode=fx_only     # 只刷汇率 → 重算 CNY
pnpm collect:official -- --mode=full        # 官网 + App Store 全量
pnpm collect:official -- --mode=full --channels=ios   # ios | web
pnpm official:regions                       # 重新发现 App Store 地区
pnpm official:regions:web                   # 重新发现 ChatGPT 官网支持国家
```

## 调度

| 模式 | 间隔 | 动作 |
|------|------|------|
| `fx_only` | **每天 06:00（Asia/Shanghai）**；若已过 06:00 且今日未更则立即补跑 | 拉汇率，重算 `cny_price` |
| `full` | 每周 | ChatGPT 官网 + 全部 enabled app 的 iOS / 官网 FX |

环境变量（可选）：`OFFICIAL_SCHEDULE_TZ`（默认 `Asia/Shanghai`）、`OFFICIAL_FX_HOUR`（默认 `6`）。

## 前台

- 列表：`/official`（`platform=chatgpt|claude|cursor|grok|kiro|gemini|email|sms|all`）
- 详情：`/official/{app}__{plan}` — 渠道筛 `web_direct|ios_store`
- 邮箱详情：`/official/email__{type}` — 比邮箱接码平台价（非国家）
- 接码详情：`/official/sms__{type}` — 比短信接码平台价（非国家）
- 缓存：进程 TTL，默认 300s（`OFFICIAL_CACHE_TTL_SECONDS`）
- 优惠角标（自动）：美区实采价（优先 `web_direct`，其次 `ios_store`）相对基准 USD 低 **≥5%** 时，卡片标题旁显示「优惠 -N%」。基准优先 `plans.json` 的 `regularUsd`（无折扣 MSRP），否则用 `usListUsd`。价格数字始终用实采，不靠人工开关。邀请码/回流首月等非公开价目降价不亮角标。
  - ChatGPT 等有国别 API：实采跌破配置基准即自动亮标；永久调价后请同步下调 `usListUsd`。
  - Cursor 等 USD×FX：采集价来自 `usListUsd`；促销时把 `usListUsd` 改成现价，并设 `regularUsd` 为原价，角标自动出现。
  - App Store 首周/Offer Code 等个性化价：公开商品页 `addOns` 通常只有常规 IAP，当前**不能**识别 intro 优惠。

## 邮箱 / 接码平台价（比平台）

与订阅地区价分开：Tab「邮箱」「接码」均保留在官网定价；卡片是类型（Gmail… / OpenAI 接码…），详情是各平台公开起价。

| 路径 | 说明 |
|------|------|
| `config/email-platforms/*` | 类型 + 种子；平台：邮件码 / SMSBulk / AnyMessage / OTPGmail |
| `config/sms-platforms/*` | 类型 + 种子；平台：5SIM / Grizzly / HeroSMS / SMSBulk / SMS-Man / OnlineSim |
| `pnpm collect:otp` | **自动采集** → `data/{email\|sms}-platforms/latest.json` |
| `pnpm email:snapshot` / `pnpm sms:snapshot` | 仅从种子重建（无网络） |

### 自动采集

```bash
pnpm collect:otp              # 邮箱 + 接码
pnpm collect:otp:sms
pnpm collect:otp:email
```

| 平台 | 无需 Key | 说明 |
|------|----------|------|
| 5SIM | ✅ | `GET /v1/guest/prices` 全球最低起价 |
| GrizzlySMS | ✅（部分） | 匿名 `getPrices`（如 Google=`go`） |
| SMSBulk 邮箱 | ✅ | 公开价目页探针 |
| 邮件码 | ✅ | 公开页 FAQ 探针（SPA 失败则保留种子） |
| HeroSMS | 需 `HERO_SMS_API_KEY` | SMS-Activate 兼容 getPrices |
| SMS-Man | 需 `SMS_MAN_TOKEN` | control/get-prices |
| OnlineSim | 需 `ONLINE_SIM_APIKEY` | getTariffs |

Worker（`pnpm worker`）默认约每 **6 小时**跑一次 `collect:otp`（`OTP_COLLECT_INTERVAL_MS` 可调）。前台优先读 `data/*/latest.json`，无快照则回退 config 种子。汇率对齐官网日更（`getOfficialUsdToCny`）。

前台：`OfficialOtpTypeCard` — 淡蓝最低价卡（平台 logo + USD ≈ CNY）。


## 历史价国家每小时补录

`pnpm worker` 会自动检查 `stale` 记录，距上次补录完成一小时后，在下一个 Worker 轮询触发定向补录；无需另设 cron。仅查询历史价对应的国家、套餐和渠道，当前支持 ChatGPT 官网国别价及已有 App Store 适配器，成功恢复 available 后自动退出重试集合。

- 使用已有汇率，不重置每日06:00汇率和每周全量计划。
- 相同 app+国家+渠道的多个套餐合并成一次请求，沿用现有低并发、间隔与限流熔断。
- 失败保留旧金额及最后成功确认时间，单独更新 `last_attempt_at`。熔断后尚未请求的国家不更新尝试时间。
- 没匹配到套餐/缺汇率时，补录不会贸然删旧价格；来源明确地区不可售则沿用不可售处理。
- SQLite `official_stale_retry_schedule` 记录下一轮时间和执行租约；任务运行期间续租，Worker重启不会重置每小时节奏。
- 历史价卡片的更新时间优先显示 `lastSuccessAt`，不再把新一轮失败或汇率更新时间当作价格确认时间。

手动触发（仍遵守一小时防重复限制）：

```bash
pnpm collect:official -- --mode=stale
# 仅官网渠道：
pnpm collect:official -- --mode=stale --channels=web
```

验证：

```bash
node scripts/test-official-stale-retry.mjs
node scripts/test-official-stale-integration.mjs
```

集成测试使用临时SQLite、独立快照和模拟fetch，不写线上库、不访问真实报价接口。
