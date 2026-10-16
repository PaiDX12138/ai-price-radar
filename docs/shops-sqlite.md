# 店铺档案（SQLite）

店铺真相源：`data/shops.sqlite`（在 `/data/` 下，已 gitignore）。报价仍在 `data/raw/` + `data/catalog/`，本期不迁库。

## 一键迁移

```bash
pnpm shops:migrate
# 已存在行时只跳过；要刷新 name/enabled 等元数据（不改 listed_at）：
pnpm shops:migrate -- --force-refresh-meta
```

会从以下来源导入：

- `config/sources.shopapi.json`
- `config/sources.16688.json`
- `config/collectors.json` 中非 shopApi/16688 的 hosts

## `listed_at`（收录时间）

- 首次成功入库写入，之后 **永不覆盖**
- 迁移回填优先级：`importedAt` → `data/raw/{id}.json` 最早 `capturedAt`/mtime → 源文件 `updatedAt` → 迁移时刻（并在 `meta_json.listed_at_fallback` 标记）

## CLI

| 命令 | 作用 |
|------|------|
| `pnpm shops:migrate` | JSON → SQLite |
| `pnpm shops:probe -- --url <首页>` | 只探针，不写库 |
| `pnpm shops:upsert -- --url <首页>` | 探针成功则入库（模拟日后提交 API） |

采集（`pnpm worker` / `collect:shopapi` / `collect:16688` / `collect:prices`）只读 DB；缺库时提示先跑 migrate。

调度字段（worker 使用，打开 DB 时自动迁移）：`next_collect_at`、`fail_count`、`lease_owner` / `lease_until`、`last_collect_at` / `last_collect_ok`、`channel_index`。

## 用户向：哪些能贴首页

可只填店铺首页：链动系小铺、云猫、QXVX、16688、异次元/卡密发卡站、独角数卡、已登记独立站。

其余走「其他」：选商品线 + 类型后贴详情链接；`POST /api/shops/submit` 拉标题并用 `classifyTitle` 核对是否匹配所选类型。

## Schema 摘要

见 `collectors/shops-db.mjs`：`shops` + `shop_probe_runs`。环境变量 `SHOPS_DB_PATH` 可改库路径。
