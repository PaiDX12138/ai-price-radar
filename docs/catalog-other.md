# 卡网“其他商品”兜底

## 规则

未命中已有分类的有效商品，统一放入 **其他 Tab → 其他类型 → 其他商品**（`other-product`）。不新增分类卡片，不添加前端标记或待归类状态。

原始标题、店铺、商品链接、报价、库存和采集时间保留，沿用现有搜索及详情页排查。以后规则能识别该标题时，采集或快照发布会自动将它移到正确分类。

`classifyTitle` 仍负责精确匹配，可以返回空：未知工具、未支持的套餐倍率、多档混售、补差价/定金等都不能因此猜成 Plus/Pro。公开商品使用 `classifyCatalogTitle` 兜底；六类采集入口、合并持久化、Worker 独立进程重分类共用该合同，不再把未命中商品丢弃。

已有专业分类不变：礼品卡、虚拟卡、各 AI 订阅、邮箱及接码仍在各自板块。“其他商品”只是最终兜底。

前台兼容旧 `other-unclassified` 和无法识别的旧分类 ID，统一展示到现有“其他商品”；不为兜底放宽正常的上下架和新鲜度判断。已下架仍不展示，历史过期报价仍不作为实时有货最低价。

## 回补以前被过滤的商品

旧发布链路会把 `other-unclassified` 过滤掉，只重分类公开快照无法找回已经丢失的条目。服务器保留 `data/raw/` 时，可离线预览并回补：

```bash
node scripts/recover-catalog-other.mjs
node scripts/recover-catalog-other.mjs --apply
```

执行前暂停采集 Worker，避免读写快照冲突。默认分别处理 `data/catalog/public.json`、`latest.json`；可指定 `--snapshot 路径` 和 `--raw-dir 路径`。默认仅预览，加 `--apply` 才写入。

- 从成功、非 fixture、非撤展的原始记录补回仍未命中精确分类的商品。
- 同 ID 已存在时不覆盖：价格、库存、状态、已下架记录及更新的采集事实保持不变。
- 不恢复原始记录中已下架的商品；失败、封禁、打烊/撤展记录不用于回补。
- 不发外网请求，不伪造采集时间。旧记录仍按原始时间显示或作为历史保留。
- 只输出公开店铺元数据，去除 `goodsKey` 等内部字段；不把店铺 Token 带进前台。
- 原子写入、写前校验快照是否被并发更新；保留 `generatedAt`，记录 `reclassifiedAt`，重复执行不重复添加商品，不额外生成备份。

没有原始记录时，等待正常成功采集即可；不能从不存在的数据推断店铺商品或库存，也不能据此保证采集接口未返回的商品已收录。

## 验证

```bash
pnpm assert:classify
node scripts/test-catalog-other-integration.mjs
node scripts/test-offer-lifecycle.mjs
node scripts/test-classification-chatgpt-free-integration.mjs
node scripts/test-classification-claude-integration.mjs
node scripts/test-classification-sms-integration.mjs
```

新增集成测试覆盖六类采集器的模拟响应、只有未命中商品的店铺、Worker 发布不丢条目、原始记录回补、幂等、撤展/失败/下架边界、旧分类兼容，以及真实前端查询的“其他”汇总、标题/店铺搜索；不增加标记或改变已识别商品分类。
