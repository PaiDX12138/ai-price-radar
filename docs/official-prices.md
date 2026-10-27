# 官网定价（官方地区价）

标准套餐 × 地区 × 渠道报价矩阵，写入 SQLite；前台只读 JSON 快照。当前开放 **ChatGPT** / **Claude** / **Cursor** / **Grok（含 X Premium）** / **Kiro** / **Gemini**。

### 最低价与历史价口径

- `available`（当前实采价）与 `stale`（历史实采价）共同参与最低价比较，不因重新采价失败排除历史报价，也不设置历史价过期淘汰时间。
- 按既有不含税展示口径和最新已采集汇率折算人民币后升序比较；同价时优先当前实采价。`estimated` 仍仅在无实采当前价/历史价时兜底。
- 地区覆盖数、报价数、渠道计数均包含可展示的历史报价。列表最低价、详情最低价与国家卡片保持相同的比价规则。
- 历史最低价保留「历史价」标识；国家卡片时间仍是最后成功采价时间。汇率更新只更新折算值，不会将历史价伪装成重新确认的价格。

地区码（ISO2）与 App Store `storefrontId` 均为公开参数，配置在 `config/official-prices/regions.json`；各板块按此全量刷新，不另造黑名单国家表（Claude 官网除外，见下）。

## 渠道与支付

| channel | 谁收款 | 支付方式 | 地区价来源 |
|---------|--------|----------|------------|
| `web_direct` 官网直购 | 厂商（OpenAI / Anthropic·Stripe / X Subscription） | 信用卡/借记卡（官网结账） | ChatGPT：公开国别 JSON **标价原样**；其余无国别实采适配器时保留 USD 基准，标 `priceBasis=usd_reference`，不伪造本地币报价 |
| `ios_store` App Store | Apple | 由 Apple ID 地区决定 | `apps.apple.com` `pageData.addOns`（`x-apple-store-front`） |

**已移除** `google_play` 渠道（不再采集、不展示）。

采集失败只标 `stale`，不清空旧价；连续 403/429 立即停手，不绕过。

### App Store 结算币种（澳门修复）

- `regions.json.currencyCode` 是地区默认币种，**不等于 App Store 结算币种**，不能直接用于 iOS 金额换算。澳门 `MO / 143515` 的 Cursor 公开 IAP 是 `USD 259.99`，不是 `MOP 259.99`。
- iOS 优先识别 Apple 原始价格文本中的明确 ISO 币种；只有 `$` / `¥` 等歧义符号时，查询 Apple iTunes lookup 的该商店 `currency`。币种未知/冲突时不以地区法币猜价。
- `pnpm official:migrate`（采集启动也会执行迁移）自动修复已有 iOS 报价中「原始文本 ISO 币种与入库币种不一致」的记录，按已有汇率重算人民币、重建最低价快照；不修改官网渠道或地区法币配置。
- 修复前自动生成一致性 SQLite 备份：`<数据库路径>.before-ios-currency-<时间戳>.sqlite`。修复不改变原金额、状态、`updated_at` / `last_success_at`，也不将旧价标成新采价。无明确 ISO 文本或缺汇率的记录不盲改。
- 离线回归：`node scripts/test-official-ios-currency.mjs`（临时数据库、模拟 Apple 响应；覆盖采集 → SQLite → 快照最低价和备份恢复证据）。

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
| 官网 | 无公开国别采价适配器；支持国使用原始 USD 参考价（`claude-web-countries.json`），仅 USD→CNY，不声称本地币结账价 |

## Cursor

| 项 | 值 |
|----|-----|
| App Store | `id6767085653` / `cursor`（除中国大陆外各 storefront 可售） |
| 官网 | [cursor.com/pricing](https://cursor.com/pricing) 公开 USD 基准；地区卡统一展示 USD 参考，不再把 USD×FX 本地币当实采 |

现行 X Subscription（证据： [cursor.com/pricing](https://cursor.com/pricing)）：

| family | 月付官网 | 年付配置参考（当前官网未确认） | 卡网 catalogSlug |
|--------|----------|----------|------------------|
| Plus | $8 | $80 | `cursor-plus`（勿挂到 Pro） |
| Premium | $30 | $300 | `cursor-pro`（卡网「Pro」对照档） |
| Super | $100 | $1,000 | `cursor-pro-plus`（卡网「Pro+」对照档） |
| Ultra | $200 | $2,000 | `cursor-ultra`（年付只走官网，月付 iOS/官网） |

同名月/年 SKU 必须以 product identifier 或明确的 Monthly/Annual 展示名证明周期。只在周期已确认的同名候选间按 USD 等值排序，绝不拿外币面额猜周期。Cursor/Grok 未经官网确认的年付配置降为 `estimated`；真实 App Store 年付按独立 SKU 实采，不与月付混用。旧 Pro / Pro+ 价目不入库；卡网页仍用旧 slug，靠上表对照官网档位。

## Grok（The X Subscription）

| 项 | 值 |
|----|-----|
| App Store | `id6670324846` / `grok-ai`（公开名仍见 SuperGrok / Lite / Plus / Heavy） |
| 官网 | [x.ai/pricing](https://x.ai/pricing) 发布 USD 月付基准；没有地区实采证据时仅作 USD 参考；配置年付未确认则标参考 |

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
| 官网 | [Google AI plans](https://one.google.com/about/google-ai-plans/) USD 基准参考（税前），非各国本地币结账实采 |

| slug | 展示 | 官网美区 | 卡网 catalogSlug |
|------|------|----------|------------------|
| `plus-monthly` | Google AI Plus | $4.99 | `gemini-plus`（勿挂到 Pro） |
| `pro-monthly` | Google AI Pro | $19.99 | `gemini-pro` |
| `pro-annual` | Google AI Pro | $199.99 | `gemini-pro` |
| `ultra-5x-monthly` | Google AI Ultra 5x | $99.99 | `gemini-ultra` |
| `ultra-20x-monthly` | Google AI Ultra 20x | $199.99 | `gemini-ultra` |

卡网别名：`gemini-recharge` / `gemini-year` → `gemini-pro`（详情顶栏美区+最低地区两卡）。

纯存储 SKU（如 100 GB）不入库。Ultra 年付官网未稳定公布则不做。

## 价格口径（保留可证明的税口径）

- 列表主价比较 `available` + `stale`；`estimated` 仅在无已确认当前/历史报价时兜底。
- ChatGPT 官网 `inclusive` 且有可信税率时拆回税前；`exclusive` 原样，不再加税。拆税只做一次。
- iOS 无税口径字段时保留原标价并显示「税况未知」，不再强行标「不含税」；缺税率的含税价不擅自拆税。跨税口径涨跌只作标价参考，不保证最终结账优惠。
- Claude / Cursor / Grok / X / Kiro / Gemini 尚未接入国别实采的官网行保留 USD 基准，标「USD 参考」。X 帮助页确有区域定价表，但未实采入库的地区不能用 FX 冒充该表的实际标价。
- KWD/BHD 等三位小数币种按 ISO 精度展示；大额价格不再隐去原本有效的小数。顶栏汇率使用小额高精度格式，避免 VND 等显示 `¥0.00`。

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
  - USD 参考、估算价、历史价不触发自动促销角标。仅修改配置基准不是实采促销证据。
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

## 全板块金额审计

范围固定为 ChatGPT、Claude、Cursor、Grok、X、Kiro、Gemini，不读取/写入邮箱和接码价格文件。

```bash
node scripts/audit-official-prices.mjs --report work/official-audit.json
# 校验保存的原始采价证据并修复；写前自动保存完整 SQLite 备份：
node scripts/audit-official-prices.mjs --apply --evidence work/verified-evidence.json --report work/official-audit.json
```

- 默认只读数据库；检查原价币种、FX 正反方向、人民币金额、套餐周期、USD 参考来源。`--db` / `--snapshot` 可指定隔离测试库与快照。
- 原始证据格式：`ios[]` 为带 app/country/capturedAt/storefront/currencyCode/items 的 Apple 页面结果；`web[]` 为带 country/capturedAt/config 的 ChatGPT 国别结果；`fx` 为带 date/rates/source/sourceUrl 的 USD 基准汇率。
- `sourceOfferId` 保存实际 IAP identifier。Google `.m/.y`、OpenAI `_1m/_1y`、Claude/Grok/Cursor `.monthly/.yearly` 和明确的 Monthly/Annual 标题均用于证明周期；周期未知不猜价。
- 对原始响应已证明为另一周期的旧记录标 `invalid`，保留审计记录但不参与任何最低价/百分比；请求失败或公开页未列 SKU 不凭空删价，保留历史状态和最后成功采价时间。
- USD 基准不会先换成本地币再按新汇率反算；新增 seed 不得覆盖已有新汇率；同价优先美国基准，避免舍入噪声制造虚假“最低国家”。
- 百分比不人为封顶：有当前、同产品同周期证据的大地区价差仍保留；无可靠美区基准时不显示百分比。列表/详情共用涨跌组件。

回归：

```bash
node scripts/test-official-pricing-integrity.mjs
node scripts/test-official-audit-integration.mjs
node scripts/test-official-ios-currency.mjs
node scripts/test-official-historical-lowest.mjs
node scripts/test-official-stale-integration.mjs
```

2026-10-27 全量现场审计与边界见 `docs/official-pricing-audit-2026-10-27.md`。
