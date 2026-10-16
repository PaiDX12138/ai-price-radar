# 卡网平台全量接入排期

> **范围**：只做卡网比价采集与展示。  
> **不做（另期）**：官方订阅 / 官网代充专页 / 非卡网货源。  
> **原则**：先把各平台接正确、接全面，再谈单商品（如 Claude）渠道是否好看。

本仓自研采集器，先探针再写解析，禁止猜接口。店铺拓展：自采调度 + 用户提交。

## 总原则

1. 每种 `collectorKind`：探针 → 解析器 → 落盘 → 归类 → 筛选项 + **正确平台 logo**。
2. 卡网平台筛选项全站共用（ChatGPT / Claude / Gemini … 同一套）。
3. Logo：平台品牌标（联动/云猫/QXVX/Kami/独角）固定；其余自建站采集时自动拉 favicon。
4. 采集失败 ≠ 缺货；限流 / 连续 403 冷却；链动直连易 403，可选 `PROXY_URL` / `PROXY_API_URL`（或兼容名 `COLLECTOR_HTTP_PROXY`）；日常用 `pnpm worker`。

## 平台对照（卡网 only · 以 catalog 实数为准）

| 平台 | kind | 配置/可达 | catalog 实收 | 状态 | 阻塞 |
|------|------|-----------|--------------|------|------|
| 联动小铺 | shopApi | 277 店 | 直采为主 | ✅ 主路径可用 | 直连易 403，可配代理 |
| 云猫发卡 | shopApi | 78 店 | ~70+ 店 | ✅ 基本齐全 | — |
| QXVX | shopApi | 0 token | 0 | ❌ 未接入 | 缺有效 shopToken |
| Kami | kami | 30 hosts | ~19 | ✅ 可达站入库 | 部分 host 超时/522 |
| 独角数卡 | dujiao | 16 hosts | ~9 | ✅ 可达站入库 | 部分 403/404 |
| GetGPT | getgptApi | 1 | 1 | ✅ | — |
| iKunLove | ikunloveApi | 1 | 1 | ✅ | — |
| 公开商品 API | publicProductsApi | 2 | 1（catcard） | ✅ 部分 | academicgate 404 |
| 小黑丸 | xiaoheiwan | 1 | 1 | ✅ | — |
| Shop User API | shopUserProductsApi | 1 | 0 | ⚙️ 代码有 | 探针 521 |
| HTML / Mooncake / BlackCat | *Html 等 | 登记有 | 0～少 | ⚙️ 代码有 | 死链/改版 |
| 16688 | shop16688 | 394 店 | **383** 采通 / catalog ~360 | ✅ 已接入 | `shop_no`；打烊店记失败不覆盖 |

## 执行顺序（全站平台优先）

```
1. 链动：collect:shopapi / worker 直采；阻塞时配代理
2. collect:16688 -- --all
3. 补 QXVX shopToken → 采通
4. collect:prices --all（kami/dujiao/API/HTML）+ sync:favicons
5. 再核对各 AI 板块渠道是否多平台齐全
```

> **禁止**：只为某个商品页（如 Claude）改归类硬凑渠道；平台覆盖不足时先修采集。

## Logo

| 类型 | 策略 |
|------|------|
| 联动 / 云猫 / QXVX / 16688 / Kami / 独角 | 固定品牌标 |
| 其它自建站 | `pnpm collect:prices` 后自动 `syncHostFavicons` → `shop-host-logos.json` |

## 验收

- [ ] 联动 catalog 店数接近配置量级（目标 ≫ 14）
- [ ] 云猫保持高成功率
- [ ] 16688 catalog 店数接近 394 量级
- [ ] QXVX 至少有可验证 token 店入目录
- [ ] 详情页平台筛选含已接入平台；各板块报价不单压在一家
- [ ] `assert:classify` 通过
