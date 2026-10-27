# 官网定价全板块审计记录（2026-10-27）

## 范围

本次只审计官网定价板块：**ChatGPT、Claude、Cursor、Grok、X Premium、Kiro、Gemini**。邮箱与接码平台价格文件未读取、未写入、未参与最低价或优惠百分比计算。

## 现场证据

- App Store 公开商品页：`work/official-full-audit/verified-evidence.json`，共 1,026 个成功/失败 storefront 记录；每条保留 app、ISO2、Storefront、原始 IAP identifier、价格文本、解析金额、原始币种和采集时间。
- ChatGPT 官网国别 JSON：同一证据文件中的 `web[]`，234 个地区请求，232 个成功返回。
- USD 汇率：同一证据文件中的 `fx`，来源 `open.er-api.com`，以 USD 为基准；审计日 CNY 参考汇率为 6.683751。
- 不纳入范围的邮箱/接码目录 SHA-256 清单：`work/official-full-audit/excluded-hashes.json`。

## 已确认的问题

1. **地区默认币种不等于 App Store 结算币种。** 澳门 storefront `143515` 的 Cursor、X、Gemini 页面实际返回 USD；旧逻辑将 `regions.json` 的 MOP 直接套到金额上，导致金额和相对美区百分比严重失真。
2. **月付/年付不能用外币面额猜。** 例如 BRL、CLP、COP 等地区的年付数值天然约为月付的 10–12 倍；旧逻辑把本地货币面额直接与 USD 基准比较，导致年付 SKU 串档。现在优先使用 IAP identifier / 明确的 Monthly/Annual 文本，周期未知不猜。
3. **USD 官网基准不应伪造成地区独立本地价。** Claude、Cursor、Grok、X、Kiro、Gemini 的公开页面没有统一的多国结账价 API。旧逻辑把 USD×FX 写成当地货币报价，制造了看似 20%–90% 的“地区优惠”。现在保留 `currencyCode=USD`、`priceBasis=usd_reference`，只用于 USD→CNY 参考；不计为已验证本地结账价。
4. **税口径不能统一硬标“不含税”。** ChatGPT 的含税/未税与税率按接口处理；没有税字段的 App Store 行显示“税况未知”，不擅自拆税。
5. **百分比必须有可靠美国基准。** USD 参考年付、估算行、历史价或缺失美国确认价时不显示优惠百分比；有当前实采且同周期的地区价则保留真实百分比，不人工封顶。

## 修复结果

- 已更新正式 `data/official-prices.sqlite` 与 `data/official-prices/latest.json`。
- 正式库最后一次只读审计：`rows=13862`，`issues=0`。
- 正式库已保存自动备份：`data/official-prices.sqlite.before-full-audit-*.sqlite`、`data/official-prices.sqlite.before-usd-reference-*.sqlite`。
- App Store 现场证据应用：`iosConfirmed=4776`；ChatGPT 官网现场证据应用：`webConfirmed=1392`；失败/不可用请求保留旧记录并标记历史状态，不盲删。
- 旧的 7,694 条无来源本地币官网派生价已改为 USD 参考语义；不再参与虚假本地币优惠。Cursor/Grok 未被当前官网明确确认的年付参考标记为 `estimated`，不显示优惠。
- 所有地区价格换算都校验 `priceValue × fxRateToCny = cnyPrice`；零小数与三位小数币种按 ISO 精度展示，汇率小额展示保留足够精度。

## 可复现命令

只读检查正式库：

```bash
node scripts/audit-official-prices.mjs --report work/official-prices-audit.json
```

使用已保存证据进行修复（命令会先备份 SQLite）：

```bash
node scripts/audit-official-prices.mjs \
  --apply \
  --evidence work/official-full-audit/verified-evidence.json \
  --report work/official-prices-audit.json
```

核心回归：

```bash
node scripts/test-official-pricing-integrity.mjs
node scripts/test-official-audit-integration.mjs
node scripts/test-official-ios-currency.mjs
node scripts/test-official-historical-lowest.mjs
node scripts/test-official-stale-retry.mjs
node scripts/test-official-stale-integration.mjs
node scripts/test-official-audit-integration.mjs
```

测试使用临时数据库和模拟响应，不访问邮箱/接码目录，不修改正式库。
