# ChatGPT 半成品与 Free 账号分类

## 分类依据

分类入口为 `collectors/classify.mjs`，采集、快照重分类和 Worker 发布共用，不在页面单独过滤或靠售价猜档位。

用户提供的商品截图标题为 `G Plus 半成品 质保首登`，详情明确说明 Free 老号、可自行开通 Plus。标题中的 Plus 是用途/营销文字，不代表交付时已有 Plus 订阅，应归 `chatgpt-free-account`（ChatGPT 普号）。当前采集分类只使用商品标题及报价，不采集或拼接完整商品详情；这次不新增逐商品详情请求。

| 标题证据 | 处理 |
| --- | --- |
| GPT / Plus / Codex 半成品，只有首登、已/未接码、账密、RT/2FA、渠道等状态 | 普号；上述状态不能证明订阅已开通 |
| 非半成品、不是半成品的 Plus 成品号 | 保持 Plus 分类 |
| 半成品但明确写已开通/已激活 Plus | 保留订阅分类，不覆盖正向开通证据 |
| 官方充值、自备半成品账号、须账号为 Free 状态 | 正价代充；Free 是充值前置条件，不是出售普号 |
| 半成品专用手机号接码、开通教程、API KEY/中转额度 | 仍按实际交付物分为接码、辅助或中转，不归普号 |
| Claude、Cursor、Gemini 等其他品牌 | 不套用 GPT 半成品规则 |

“质保首登”仍不算长期质保，分类修复不改价格、库存、上架状态、原站链接或采集时间。

## 验证

```bash
pnpm assert:classify
node scripts/test-classification-chatgpt-free-integration.mjs
node scripts/test-classification-claude-integration.mjs
```

集成测试覆盖截图标题、旧报价迁移、幂等、Worker 独立进程重分类、所有非分类字段保留，以及实际前端查询的 Plus/普号最低价、质保最低价、渠道数、有货数。不把缺货、已下架商品恢复为在售。

## 修复已发布快照

先预览，再限定本次标题范围应用，避免同时修复其他历史分类差异：

```bash
node scripts/reclassify-catalog-snapshot.mjs --platform chatgpt --title-contains 半成品
node scripts/reclassify-catalog-snapshot.mjs --platform chatgpt --title-contains 半成品 --apply
```

`--title-contains` 是原始标题的字面子串筛选，不是正则；与 `--platform` 同时传入时须同时满足。省略时保持原有平台范围/全量重分类行为。缺参数会失败，不会静默退回全量写入。

操作原子替换 `data/catalog/public.json` 和 `latest.json`，保留原始 `generatedAt` 与报价事实，仅更新分类、产品说明及 `reclassifiedAt`；不额外生成备份。已有并发修改检查保持不变。部署后仍需在服务器执行，不能将本地快照覆盖服务器。

本地旧快照共 11,307 条报价，新旧规则对比仅改变 9 条半成品（8 条原 Plus、1 条原辅助）；它们在本地均为历史缺货报价。用户截图中的 1.50 元实时商品不在这份本地快照内，以截图标题加入测试；不能据此声称线上数据已修复。
