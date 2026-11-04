# 卡网“其他商品”兜底

## 规则

未命中已有分类的有效商品，统一放入 **其他 Tab → 其他类型 → 其他商品**（`other-product`）。不新增分类卡片，不添加前端标记或待归类状态。

原始标题、店铺、商品链接、报价、库存和采集时间保留，沿用现有搜索及详情页排查。以后规则能识别该标题时，采集或快照发布会自动将它移到正确分类。

`classifyTitle` 仍负责精确匹配，可以返回空：未知工具、未支持的套餐倍率、多档混售、补差价/定金等都不能因此猜成 Plus/Pro。公开商品使用 `classifyCatalogTitle` 兜底；六类采集入口、合并持久化、Worker 独立进程重分类共用该合同，不再把未命中商品丢弃。

已有专业分类不变：礼品卡、虚拟卡、各 AI 订阅、邮箱及接码仍在各自板块。“其他商品”只是最终兜底。

## 核对和修正已有分类

分类优先看**实际交付内容**，不是标题中任意出现的品牌或关键词：

- G Free、未开通的半成品、附带微软/iCloud 邮箱的 GPT 账号 → GPT 普号；独立邮箱商品才进邮箱。
- 已开通的 Plus 成品号与充到本人账号的官方 Plus 代充分开；账号的接码状态不等于单独售卖短信服务。
- Claude 订阅的“虚拟卡代付”、Cursor 订阅的“礼品卡渠道”只是付款方式，不是交付银行卡或礼品卡。
- CapCut/Runway/Firefly 支持 Seedance，不等于卖即梦账号；五大 AI 全家桶也不等于只卖 Perplexity。这些没有对应现有类型时留在其他。
- 不把显式 Pro 10x 凭 100/200 美元硬改成 5x/20x；Pro 500 只接收明确 500 美元或已核实详情的相应套餐。无兼容类型、多档混售、定金/差价仍保留其他。

原站分类只在标题缺少品牌时提供补充依据。综合分类、多品牌父类、冲突分类不用于猜套餐；已识别的标题不被店铺分类覆盖。原始标题、链接和标签不改写。

独角数卡采集读取公开 SKU 的 `spec_values`（兼容原有 `title/name/label/spec`），不能把实际套餐名称丢成“规格1”。明确的 GPT 多套餐父商品按末尾具体 SKU 分档；没有具体 SKU 时仍不猜。后续发布、Worker 重分类与采集使用同一规则。

个别只有详情才能确认的商品记录在 `config/catalog-classification-evidence.json`：必须同时匹配**商品链接和完整原始标题**，并记录核对日期和依据。同名的其他店铺、改名后的商品不会套用该例外。旧“规格N”的个别修正已核对公开 SKU 顺序及报价，不通过售价反推档位。该文件不保存账号密码、卡密或访问凭证。

2026-11-04 本次排查覆盖线上其他 Tab 的 11 类、5,476 条报价、2,398 个不同标题，并读取可访问的公开商品说明和 SKU。部分详情接口返回空、不可用或 HTTP 520，不能声称已核实它们的介绍；信息不足的商品仍保留其他，不添加前端标记。

更新现有快照时，先暂停 Worker，再在项目目录预览和应用重分类；这不会重新确认库存或修改采集时间：

```bash
node scripts/reclassify-catalog-snapshot.mjs
node scripts/reclassify-catalog-snapshot.mjs --apply
```

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

`pnpm assert:classify` 也运行本次排查的真实标题正反例及 URL 限定例外测试；集成测试验证原站分类上下文和 SKU 在采集、Worker 重分类后保持一致。
