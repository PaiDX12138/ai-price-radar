import type { TooltipDetailsData } from "@/components/ui/tooltip-details";
import type { TransitMonitorStats } from "./snapshot";
import { formatTransitBucketTime, formatTransitDuration, formatTransitThroughput, formatTransitMultiplierAmount } from "./format";

export function compactMonitorTime(value: string | null | undefined): string {
  const text = formatTransitBucketTime(value);
  return /^\d{4}\//.test(text) ? text.slice(5) : text;
}
const windowLabel = (stats?: TransitMonitorStats) => stats
  ? `${compactMonitorTime(stats.windowStart)} →\n${compactMonitorTime(stats.windowEnd)}` : "暂无记录";

export function availabilityHint(name: string, stats?: TransitMonitorStats): TooltipDetailsData {
  const hours = stats?.samples ?? 0;
  if(stats?.aggregation?.kind==="group_models")return {title:"近15日分组综合可用率",subtitle:name,rows:[
    {label:"可用率",value:stats.availability==null?"暂无记录":`${stats.availability.toFixed(2)}%`},
    {label:"参与模型",value:`${stats.aggregation.monitoredModels} / ${stats.aggregation.totalModels}`},
    ...(stats.sourceVersion?[{label:"数据范围",value:`${stats.sourceVersion} · 组内型号`}]:[]),
    {label:"有记录小时",value:`${hours} / 360 小时`},
    {label:"计算方式",value:"同小时模型等权，再按小时平均"},
    {label:"统计区间",value:windowLabel(stats)},
  ],note:stats.sourceVersion?"版本内组员综合，非本渠道独立实测；缺记录不计入。":"系统按分组成员汇总，非渠道独立实测；缺记录不计入。"};
  if(stats?.kind==="model_probe_availability")return {title:"近15日探测可用率",subtitle:name,rows:[
    {label:"可用率",value:stats.availability==null?"暂无记录":`${stats.availability.toFixed(2)}%`},
    {label:"有记录小时",value:`${hours} / 360 小时`},{label:"探测样本",value:String(stats.probeCount??0)},
    ...(!stats.scope.modelName?[{label:"监测型号",value:`${stats.monitoredModels??0} / ${stats.totalModels??0}`}]:[]),
    {label:"计算方式",value:stats.availabilityBasis==="normal_probe"?"正常探测 → 型号、小时等权":stats.scope.modelName?"成功探测 / 总探测":"型号等权探测指数"},
    ...(stats.sourceSummary?[{label:"站方15日摘要",value:`${stats.sourceSummary.availability.toFixed(2)}%`}]:[]),
    {label:"统计区间",value:windowLabel(stats)},
  ],note:stats.availabilityBasis==="normal_probe"?"延迟升高不算正常；主值与细条用本站历史，站方摘要独立保存。":hours<360?"历史积累中，缺记录不补成功；非全站请求SLA。":"仅统计公开模型探测，非全站请求SLA。"};
  if (stats?.kind === "probe_availability") {
    const group=stats.scope.groupKey!==null;
    const rows=[
      {label:"监测可用率",value:stats.availability==null?"暂无记录":`${stats.availability.toFixed(2)}%`},
      {label:"有记录小时",value:`${hours} / 360 小时`},
      {label:"统计区间",value:windowLabel(stats)},
      {label:"计算方式",value:"有效心跳 → 小时等权"},
    ];
    if(!stats.scope.modelName && stats.coverageScope !== "infrastructure") rows.push({label:"监测型号",value:`${stats.monitoredModels??0} / ${stats.totalModels??0}`});
    if(stats.sourceSummary)rows.push({label:"站方15日摘要",value:`${stats.sourceSummary.availability.toFixed(2)}%`},
      {label:"摘要更新",value:compactMonitorTime(stats.sourceSummary.observedAt)});
    return {title:"近15日监测可用率",subtitle:name,rows,
      note:group?"未公开分组监测，不套用整站数据。":stats.sourceSummary
        ?"主值与细条由本站积累；站方摘要独立统计。非请求成功率。"
        :"仅统计已监测对象，不代表全部请求。缺样不计入；北京时间。"};
  }
  return {
    title: "近15日可用率", subtitle: name,
    rows: [
      { label: "可用率", value: stats?.availability == null ? "暂无记录" : `${stats.availability.toFixed(2)}%` },
      { label: "数据覆盖", value: `${hours} / 360 小时` },
      { label: "统计区间", value: windowLabel(stats) },
      { label: "计算方式", value: stats?.scope.modelName ? "分组、小时等权" : "模型、小时等权" },
      ...(stats?.sourceVersion?[{label:"数据范围",value:stats.sourceVersion}]:[]),
    ],
    note: stats?.sourceVersion?"站方版本、型号、小时等权；非请求量加权SLA。缺记录不计入。":hours < 360 ? "历史积累中，无记录时段不计入。北京时间。" : "无记录时段不计入。北京时间。",
  };
}

export function rechargeHint(site: { name: string; rechargeMultiplier: number | null; rechargeInfo: { observedAt: string } | null }): TooltipDetailsData {
  const multiplier = site.rechargeMultiplier;
  return { title: "基础充值比例", subtitle: site.name,
    rows: site.rechargeInfo && multiplier !== null && multiplier > 0 ? [
      { label: "兑换", value: `¥1 = $${formatTransitMultiplierAmount(1 / multiplier)}` },
      { label: "额度单位", value: "站内记账额度，非美元现金" },
      { label: "核实时间", value: compactMonitorTime(site.rechargeInfo.observedAt) },
    ] : [{ label: "状态", value: "尚未核实" }],
    note: "不含个人充值优惠。",
  };
}

export function metricHint(kind: "ttft" | "latest" | "average" | "throughput", name: string, stats?: TransitMonitorStats): TooltipDetailsData {
  if(kind==="throughput"&&stats?.throughputSummary)return {title:"近7日输出吞吐",subtitle:name,rows:[
    {label:"吞吐",value:formatTransitThroughput(stats.throughputSummary.value)},{label:"窗口",value:"站方近7日真实流量"},
    ...(stats.aggregation?.kind==="group_models"?[{label:"参与模型",value:String(stats.throughputSummary.modelCount??0)}]:[]),
    {label:"采集时间",value:compactMonitorTime(stats.throughputSummary.observedAt)},
  ],note:stats.aggregation?.kind==="group_models"?"组内模型吞吐摘要等权，非分组总吞吐；不混入十五日序列。":"独立摘要，不混入十五日小时序列。"};
  const title = { ttft: "首Token延迟", latest: "最新响应耗时", average: "15日平均耗时", throughput: "15日平均吞吐" }[kind];
  const available = kind === "ttft" ? stats?.capabilities?.ttft : kind === "throughput" ? stats?.capabilities?.throughput : stats?.capabilities?.latency;
  if (available === false) return { title, subtitle: name, rows: [{ label: "状态", value: "站点未公开" }], note: "— 表示没有数据，不是 0。" };
  const raw = kind === "ttft" ? stats?.latestTtftMs : kind === "latest" ? stats?.latestLatencyMs
    : kind === "average" ? stats?.averageLatencyMs : stats?.averageThroughputTps;
  if (raw == null) return { title, subtitle: name, rows: [{ label: "状态", value: "暂无有效记录" }], note: "有数据后自动更新。" };
  const latest = kind === "ttft" || kind === "latest";
  const rows = [
    { label: "数值", value: kind === "throughput" ? formatTransitThroughput(raw) : formatTransitDuration(raw) },
    { label: latest ? stats?.kind==="model_probe_availability"&&!stats.aggregation&&stats.availabilityBasis!=="normal_probe"?"探测时间":"对应小时" : "统计区间", value: latest ? compactMonitorTime(stats?.latestBucketAt) : windowLabel(stats) },
  ];
  if (!latest) rows.push({ label: "有效记录", value: `${kind === "throughput" ? stats?.throughputHours ?? 0 : stats?.latencyHours ?? 0} / 360 小时` });
  if(stats?.aggregation?.kind==="group_models")return {title,subtitle:name,rows,
    note:latest?"组内模型最新有记录小时的均值，非单次请求。":"按组内模型、小时等权汇总；缺失值不计入。"};
  if(stats?.availabilityBasis==="normal_probe")return {title,subtitle:name,rows,
    note:latest?"最新有记录小时的平均响应耗时，不是首Token。":"正常及延迟升高的成功响应，按型号、小时等权；失败耗时不混入。"};
  return { title, subtitle: name, rows, note: stats?.kind==="model_probe_availability" ? latest ? stats.scope.modelName?"最新公开探测耗时，不是首Token。":"各型号最近探测耗时等权，不是单次请求。" : stats.scope.modelName?"按窗口内成功探测平均；失败耗时不混入。":"有记录型号的探测均值等权。" : latest ? "最新有记录小时的均值，并非单次请求。" : "按有记录的分组/模型、小时等权计算。" };
}
