# Claude 卡网商品分类

分类入口：`collectors/classify.mjs`。采集器、存量重分类和 worker 发布快照使用同一套规则，不能在页面单独隐藏低价商品来修正统计。

## 判断原则

先识别**交付物**，再识别档位。`Pro` / `Max` / `Team` 可能是 API 的上游号池，`月卡` / `独享` / `卡密` / `质保订阅` 单独也不能证明卖的是官方订阅。

| 标题信号 | 分类 |
| --- | --- |
| Claude + 中转站/中转服务、API 卡密/KEY/额度/充值、反代服务 | Claude 镜像 / 中转服务 |
| Claude 与 GPT/Codex/Gemini 等并列 + 明确中转交付物 | ChatGPT 中转服务（沿用多模型合池分类） |
| Claude Pro 成品号、拼车、官方直充、自助充值卡密，无中转交付物 | Claude Pro |
| Claude Max 20x 号池专供账号/速刷成品号 | Claude Max 20x（卖的是账号，不是调用池） |
| 账号支持反代、支持 API 调用、可导入中转站；非 API/不含 API KEY | 不作为中转交付证据 |

截图中的 `耀耀中转站 0.2/1/5/10/20 USD … claude，codex plus/pro大模型API卡密` 属于多模型中转服务，不计入 Claude Pro 的报价、渠道数、有货数和最低价。

## 验证

在仓库根目录运行：

```powershell
pnpm assert:classify
node scripts/test-classification-claude-integration.mjs
```

集成测试使用隔离快照，覆盖截图的五种面额、纯 Claude API、Max/Pro 账号边界、实际前端查询的最低价/质保最低价/渠道数/有货数，以及旧 worker 发布时的独立进程重分类。

## 修复已有快照

仅修改规则不会自动刷新已发布的 JSON。先预览，再应用：

```powershell
node scripts/reclassify-catalog-snapshot.mjs --platform claude
node scripts/reclassify-catalog-snapshot.mjs --platform claude --apply
```

`--platform claude` 包含旧分类或新分类属于 Claude 的报价，因此可以修复 Claude Pro → 多模型中转、通用中转 → Claude 中转两个方向，不会顺手重标其他平台的历史问题。省略参数保留原有全量重分类行为。

应用时先备份，再替换 `data/catalog/public.json` 和 `latest.json`；保留价格、库存、上下架状态和采集时间，不伪装为新采集。回滚可用命令输出的 `backup` 路径覆盖原快照。

worker 发布快照时会从磁盘重新加载规则。线上还需部署更新后的文件并执行以上快照重分类；若页面存在缓存，沿用 `scripts/prewarm-catalog.mjs` 的刷新流程。
