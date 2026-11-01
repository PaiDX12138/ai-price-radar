# 已采集公开数据的发布与服务器更新

本次2026-11-01发布把8个已接入站点的公开数据一起纳入Git，避免只更新代码而服务器仍只有旧Packy目录。

## 数据包是什么

- `config/transit-baseline/latest.json.gz`：约2.3 MB的结构化公开事实，8站当前有效报价1217条、105个含历史定义的分组、1221条含inactive的报价记录。
- `config/transit-baseline/manifest.json`：压缩包SHA-256、打包时间、逐站有效库存及逐表行数。
- 包括52,502条普通型号/分组小时事实、23,168条SudoCode型号/版本小时事实、Sole/Zeta/RunAPI探测原点及小时聚合、计费版本、型号排序参考目录。
- 包内数据保留原采集时间，主要为2026-10-30的数据；2026-11-01是打包日期，**不是伪装成刚刚采集的数据**。页面以原时间显示，Worker持续获取后续数据。
- 不含`.env.local`、代理/鉴权配置、整库文件、卡网私有数据、SQLite自增行ID、源站大响应原文、本机绝对路径、租约、进程状态、采集调度、运行错误日志或测试数据。
- 只有公开Logo、生产代码、文档、白名单数据包进入Git；`work/`、运行数据库、备份和测试输出仍忽略。

## 导入行为

```bash
pnpm transit:import --check      # 只验证SHA-256、格式和库存，不打开数据库
pnpm transit:import --dry-run    # 预览按站点是否合入目录，不写业务数据
pnpm transit:import              # 自动备份、事务合并、重新导出前台快照
```

正式导入先执行SQLite在线backup，并备份现有快照及型号参考目录。备份位于实际数据库目录旁 `transit-backups/before-baseline-<时间>/`；不直接复制活动数据库主文件而遗漏WAL。

合并规则：

1. 新站补入；已存在且更新时间更近的正常服务器目录保留，不用旧包覆盖。像此前采集失败且缺Claude/GPT/Gemini的残缺Packy目录允许用完整基线修复。
2. 当前报价/分组不物理删除；目录采纳后，基线之外的旧行仅标inactive。暂停/停用站点的发布状态保留。
3. 历史点按真实自然键合并，忽略本机自增ID；更新的源快照/小时优先，完整小时不被partial倒退覆盖，重复导入不重复累加。
4. 监测身份冲突直接报错，不重标历史对象。业务合入在同一个SQLite写事务内，失败不留半套目录。
5. 不改服务器调度、租约、代理或环境变量，不创建新cron。型号排序参考目录也仅在本地缺失或较旧时写入。
6. 重新从服务器合并后的SQLite导出**全部站点**快照，保留服务器其他站点，不简单把仓库快照覆盖线上。

## 服务器完整更新命令

以下沿用此前确认的目录和PM2全部进程可重启约定。先构建，短暂停止进程后导入；出错时EXIT trap会尝试恢复原有PM2进程。括号为子shell，避免把`set -e`或trap留在当前登录Shell。

```bash
cd /www/wwwroot/radar.ftuashcahs.xyz
(
  set -e
  git pull --ff-only origin main
  pnpm install --frozen-lockfile
  pnpm build

  pm2 stop all
  trap 'pm2 restart all --update-env' EXIT
  pnpm transit:migrate
  pnpm transit:import

  pm2 restart all --update-env
  pm2 save
  trap - EXIT
  pnpm transit:status
)
```

不删除`data`或`.env.local`，不执行`git reset --hard`，不覆盖整库。导入不访问外站，即使采集出口仍有问题也能先恢复现有已采数据。结束后查看`transit:status`的8站库存；线上已有更多新数据时，数量可以高于清单。

已有Worker由PM2恢复后按原有到期任务继续采集。导入不会新增一个此前不存在的Worker；若原PM2列表根本没有采集Worker，需要另行核对原进程配置，不猜测进程名或重复创建服务。

## 本机发布准备

```bash
pnpm transit:export
pnpm transit:import --check
```

导出只读本机中转数据库，不重新请求源站。需要更新基线时人工执行并审阅manifest；Worker只写运行目录，不自动改Git数据包。正式本轮已验证空服务器导入、重复导入、较新目录保护、残缺目录修复、较新小时保护、租约不变、敏感字段排除、校验失败及真实CLI备份/快照输出。
