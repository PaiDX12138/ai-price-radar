# 已采集公开数据的发布与服务器更新

2026-11-02公开数据包包含8个当前发布站点：原有7站及新增鸡哥AI；ZetaAPI已按维护者要求停用，历史仍保留在原数据库，不再随当前发布目录展示。避免只更新代码而服务器缺少新站与已补采历史。

## 数据包是什么

- `config/transit-baseline/latest.json.gz`：约3.25 MB的结构化公开事实，8站当前有效报价1198条、118个含历史定义的分组、1268条含inactive的报价记录。
- `config/transit-baseline/manifest.json`：压缩包SHA-256、打包时间、逐站有效库存及逐表行数。
- 包括69,505条普通型号/分组小时事实、27,624条SudoCode型号/版本小时事实、Sole/RunAPI探测原点及小时聚合、计费版本、鸡哥AI公开目录/元信息版本、型号排序参考目录。
- 包内事实保留各自原始时间；鸡哥AI首次采集于2026-11-02，性能按源站真实小时回填，不伪造连续覆盖。其它站点沿用各自已采历史，打包日期不冒充采价日期。ZetaAPI本地停用配置优先于旧包导入，不能被旧包重新发布。
- 不含`.env.local`、代理/鉴权配置、整库文件、卡网私有数据、SQLite自增行ID、源站大响应原文、本机绝对路径、租约、进程状态、采集调度、运行错误日志或测试数据。
- 只有公开Logo、生产代码、文档、白名单数据包进入Git；`work/`、运行数据库、备份和测试输出仍忽略。

## 导入行为

```bash
pnpm transit:import --check      # 只验证SHA-256、格式和库存，不打开数据库
pnpm transit:import --dry-run    # 预览按站点是否合入目录，不写业务数据
pnpm transit:import              # 不额外备份、事务合并、重新导出前台快照
```

正式导入不额外复制数据库、快照或型号参考目录；继续使用事务合并及原子快照写入，保留已有历史记录和单份 last-good 回退。需要刷新当前源站数据时运行 `pnpm collect:transit`；源站已过期的历史小时不保证能够重采补回。已有备份文件不会自动删除。

合并规则：

1. 新站补入；已存在且更新时间更近的正常服务器目录保留，不用旧包覆盖。像此前采集失败且缺Claude/GPT/Gemini的残缺Packy目录允许用完整基线修复。
2. 当前报价/分组不物理删除；目录采纳后，基线之外的旧行仅标inactive。暂停/停用站点的发布状态保留。
3. 历史点按真实自然键合并，忽略本机自增ID；更新的源快照/小时优先，完整小时不被partial倒退覆盖，重复导入不重复累加。
4. 监测身份冲突直接报错，不重标历史对象。业务合入在同一个SQLite写事务内，失败不留半套目录。
5. 不改服务器调度、租约、代理或环境变量，不创建新cron。型号排序参考目录也仅在本地缺失或较旧时写入。
6. 重新从服务器合并后的SQLite导出**全部站点**快照，保留服务器其他站点，不简单把仓库快照覆盖线上。

## 服务器完整更新命令

服务器已确认PM2进程为`quote-web`和`quote-worker`。停止进程后仍出现Turbopack构建137时，改用已验证的`build:server`低内存模式；不要重复相同构建、盲目扩大Node堆或拿不完整产物重启。括号为子shell，失败会停止后续步骤。

```bash
(
  set -e
  cd /www/wwwroot/radar.ftuashcahs.xyz
  git pull --ff-only origin main
  pnpm install --frozen-lockfile
  pnpm transit:import --check

  pm2 stop quote-web quote-worker
  pnpm build:server
  pnpm transit:migrate
  pnpm transit:import
  node scripts/reclassify-catalog-snapshot.mjs --platform claude --apply

  pm2 restart quote-web quote-worker --update-env
  pm2 save
  pnpm transit:status
  pm2 status
)
```

不删除`data`或`.env.local`，不执行`git reset --hard`，不覆盖整库。导入不访问外站，即使采集出口仍有问题也能先恢复现有已采数据。结束后查看`transit:status`的8站库存；线上已有更多新数据时，数量可以高于清单。

本次同时部署卡网Claude分类修复，需执行上述限定平台的存量重分类；脚本不额外备份，保留价格、库存、上下架状态与源采集时间，不重新抓店铺。正式部署保持既有`quote-web`与`quote-worker`名称，不对其他PM2业务执行stop/restart all。

已有Worker由PM2恢复后按原有到期任务继续采集。导入不会新增一个此前不存在的Worker；若原PM2列表根本没有采集Worker，需要另行核对原进程配置，不猜测进程名或重复创建服务。

## 构建137的处理边界

退出137通常对应SIGKILL，可能是宿主机或cgroup的OOM，也可能是外部强制终止；仅凭构建日志不能确认是哪一种。线上报告发生在`Creating an optimized production build`，停止PM2后仍复现，不能只靠停止采集进程解释。

新增`pnpm build:server`：

- 使用当前Next 16.4.2的Webpack编译器，不升级Next、不改变页面样式、路由或数据读取逻辑。
- 单页面生成Worker、静态生成并发1、Webpack build worker及其内存优化；不是给Turbopack添加无效的Webpack参数。
- 默认单Node进程堆上限1024MiB，限制Rust编译线程为1；堆上限**不是整棵构建进程的RSS上限**。不自动扩成4096、不修改系统swap或cgroup。
- 沿用同一个Tailwind 4.3.3编译器：Webpack使用官方PostCSS入口；普通`pnpm build`仍用现有Turbopack loader。配置及lockfile同时更新，保留类型检查。
- 文件追踪排除临时研究、原始传输归档、备份、Git和导入包；不排除运行中的最新快照、Logo或原生模块。仍有既有动态文件追踪警告，不声称已消除所有构建扫描。

本机验证：低内存Webpack完整构建成功，正常Turbopack完整构建也通过；6项配置/诊断测试、类型检查及相关ESLint通过。Webpack产物的首页、SudoCode详情/图片筛选、8站诊断API、Logo及两份CSS均通过纯HTTP检查，Tailwind样式已生成；没有浏览器操作。这个结果不等于已证明未知配置的服务器不会OOM。

若新模式仍137，暂停继续构建，采集以下只读证据；需要据此确认物理内存、swap或cgroup配额，不盲目创建swap文件或修改限制：

```bash
free -h
swapon --show
journalctl -k --since '30 minutes ago' --no-pager | grep -Ei 'out of memory|oom-kill|killed process|memory cgroup' | tail -n 25
```

`pnpm build:server --diagnose`只输出可见内存/cgroup和计划参数，不启动编译。调整堆上限可显式设置`RADAR_BUILD_HEAP_MB`（512–2048整数），但未知服务器容量时不要随意加大。构建失败后不会自动重启`quote-web`；需成功构建或恢复完整旧产物后才启动。

参考：[Next内存优化](https://nextjs.org/docs/app/guides/memory-usage)、[阿里云OOM排查](https://help.aliyun.com/en/alinux/support/causes-of-and-solutions-to-the-issue-of-oom-killer-being-triggered)。

## 本机发布准备

```bash
pnpm transit:export
pnpm transit:import --check
```

导出只读本机中转数据库，不重新请求源站。需要更新基线时人工执行并审阅manifest；Worker只写运行目录，不自动改Git数据包。正式本轮已验证空服务器导入、重复导入、较新目录保护、残缺目录修复、较新小时保护、租约不变、敏感字段排除、校验失败及真实CLI快照输出。
