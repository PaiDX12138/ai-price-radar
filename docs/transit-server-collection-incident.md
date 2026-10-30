# 线上仅显示PackyAPI、目录不全：采集故障记录

日期：2026-10-30（北京时间）。证据来自用户提供的服务器CLI输出、匿名线上页面以及本机对公开源的窄范围请求。

## 已确认

- 服务器代码为 `23f5f3c`，不是没有拉到新增站点代码。
- 服务器快照确实只有PackyAPI：12组、37型号、49条报价；最近采集 `last_collect_ok=0`。没有Claude/GPT/Gemini，不是首页四行排序或前端筛选导致的假象。
- PackyAPI连续失败原因为 `incomplete_pricing_families:Claude,GPT,Gemini`。完整性保护保留旧数据；不能删除门槛把残缺目录当成功。
- Right Code为candidate，报价多次 `fetch failed`；ZetaAPI为candidate，报价和监测多次 `fetch failed`。候选站点不进入公开快照，所以线上看不到另外两个。
- 本机以采集器相同User-Agent请求Right Code时，`www.rightapi.ai/models/public` 返回302到 `https://rightapi.io/models/public`；旧实现 `redirect:error` 直接抛出笼统的fetch failed。迁移目标已实际核实200、14渠道、78条原始模型报价。
- 本机此时Packy公开入口返回78型号，含Claude/GPT/Gemini；服务器却返回缺失这些平台的清单。可以确定获取结果不同，尚不能仅凭这两份结果断言是地区、DNS、代理、缓存还是上游其他策略。
- 线上页面实际响应为no-store，且当前源码在 `connection()` 后读取快照。服务器快照也缺数据，故本次不是简单的构建静态化或浏览器缓存问题。

## 修复

1. 统一中转HTTP传输：允许至多3跳HTTPS重定向，同源跳转可接受；跨源仅允许该站配置中明确核实的origin。Right Code加入 `https://rightapi.io`，其他域不自动放行。
2. 网络失败保留目标hostname/path、DNS/连接/证书/超时/重定向等cause及错误码，记录前去掉URL用户信息、查询参数与令牌，不再只留下fetch failed。
3. 中转采集支持显式固定代理。优先级为站点专属 `TRANSIT_<ID>_HTTP_PROXY` > `TRANSIT_HTTP_PROXY` > `PROXY_URL` > `COLLECTOR_HTTP_PROXY`。值 `direct` 可关闭继承代理；没有配置保持直连。不调用卡网提取IP接口、不自动寻找或购买代理、不在日志输出代理值。
4. Right Code真实WebP Logo也走同一限时、限大小传输，避免报价走代理但Logo仍直连。保留WebP文件头校验。
5. CLI按站点隔离未捕获异常，其他站继续采集；成功数据照常导出，整体仍返回失败，不把局部失败伪装成功。
6. Packy错误附上实际返回数量和平台；Zeta报价首次失败也更新站点失败状态，避免仅有失败run而站点last_collect_ok仍为NULL。
7. `pnpm transit:status` 只读诊断现在覆盖配置中的所有启用站点，包括未发布candidate：代码版本、数据库/快照路径、快照指纹、DB与快照报价数、缺失平台、最近3次结果、报价和监测调度、代理配置名称（不含值）。不初始化或迁移数据库。
8. 新增只读 `GET /api/transit`，返回网站进程实际读取的快照时间、指纹和平台数量；no-store，不暴露文件路径、数据库、采集器配置或原始响应。可与CLI指纹对照定位PM2工作目录或环境变量不一致。

## 更新后的现场定位

沿用既有PM2管理方式，先更新、构建、迁移并重启新进程，再进行手工采集排错。之前的 `set -e` 流程中，采集返回非零就会中止，后续重启不会执行；排错时必须保留失败提示，并继续输出只读诊断，而不是吞掉错误或跳过所有剩余步骤。

```bash
set -e
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm build
pnpm transit:migrate
pm2 restart all --update-env
pm2 save

# 先恢复公开报价，避免耗时历史回扫妨碍定位。Worker随后继续独立补采监测。
if pnpm collect:transit -- --pricing-only; then
  echo '报价采集结束，下面核对入库情况'
else
  echo '仍有站点采集失败，保留现有数据；下面输出具体诊断'
fi
pnpm transit:status
```

PM2 restart all沿用用户明确的全部进程可重启约定，并非对其他部署环境的通用建议。保留data与.env.local；自定义路径需保证网站和worker一致。

如仍出现缺平台，需用服务器可获得完整清单的、用户已有且适用的出口配置后再采集；不能通过关闭校验、拷贝本机数据库、伪造官方数据或仅重复重启解决。Zeta服务器的底层连接失败尚待增强错误确认，修正重定向不等于证明全部服务器网络已恢复。

## 本地证据与边界

公开源响应和线上HTML保存在忽略目录 `work/transit-online-investigation/`。`right-redirect-fixed.json` 记录修复后从旧入口按白名单跳转至rightapi.io并取得200/14渠道/78条原始记录。

本次未执行测试、构建或浏览器验收；未登录服务器、未修改服务器文件，也尚未取得修复后服务器的采集成功证据。只有服务器的三站实际成功入库且网页读取对应快照后，才可称线上恢复。
