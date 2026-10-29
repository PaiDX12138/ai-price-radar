import type { TooltipDetailsData } from "@/components/ui/tooltip-details";
import type { TransitMonitorStats } from "./snapshot";
import { formatTransitBucketTime, formatTransitDuration, formatTransitThroughput } from "./format";

export function compactMonitorTime(value: string | null | undefined): string {
  const text = formatTransitBucketTime(value);
  return /^\d{4}\//.test(text) ? text.slice(5) : text;
}
const windowLabel = (stats?: TransitMonitorStats) => stats
  ? `${compactMonitorTime(stats.windowStart)} →\n${compactMonitorTime(stats.windowEnd)}` : "暂无记录";

export function availabilityHint(name: string, stats?: TransitMonitorStats): TooltipDetailsData {
  const hours = stats?.samples ?? 0;
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
    ],
    note: hours < 360 ? "历史积累中，无记录时段不计入。北京时间。" : "无记录时段不计入。北京时间。",
  };
}

export function rechargeHint(site: { name: string; rechargeMultiplier: number | null; rechargeInfo: { observedAt: string } | null }): TooltipDetailsData {
  const multiplier = site.rechargeMultiplier;
  return { title: "基础充值比例", subtitle: site.name,
    rows: site.rechargeInfo && multiplier !== null && multiplier > 0 ? [
      { label: "兑换", value: `¥1 = $${Number((1 / multiplier).toFixed(4))}` },
      { label: "额度单位", value: "站内记账额度，非美元现金" },
      { label: "核实时间", value: compactMonitorTime(site.rechargeInfo.observedAt) },
    ] : [{ label: "状态", value: "尚未核实" }],
    note: "不含个人充值优惠。",
  };
}

export function metricHint(kind: "ttft" | "latest" | "average" | "throughput", name: string, stats?: TransitMonitorStats): TooltipDetailsData {
  const title = { ttft: "首Token延迟", latest: "最新响应耗时", average: "15日平均耗时", throughput: "15日平均吞吐" }[kind];
  const available = kind === "ttft" ? stats?.capabilities?.ttft : kind === "throughput" ? stats?.capabilities?.throughput : stats?.capabilities?.latency;
  if (available === false) return { title, subtitle: name, rows: [{ label: "状态", value: "站点未公开" }], note: "— 表示没有数据，不是 0。" };
  const raw = kind === "ttft" ? stats?.latestTtftMs : kind === "latest" ? stats?.latestLatencyMs
    : kind === "average" ? stats?.averageLatencyMs : stats?.averageThroughputTps;
  if (raw == null) return { title, subtitle: name, rows: [{ label: "状态", value: "暂无有效记录" }], note: "有数据后自动更新。" };
  const latest = kind === "ttft" || kind === "latest";
  const rows = [
    { label: "数值", value: kind === "throughput" ? formatTransitThroughput(raw) : formatTransitDuration(raw) },
    { label: latest ? "对应小时" : "统计区间", value: latest ? compactMonitorTime(stats?.latestBucketAt) : windowLabel(stats) },
  ];
  if (!latest) rows.push({ label: "有效记录", value: `${kind === "throughput" ? stats?.throughputHours ?? 0 : stats?.latencyHours ?? 0} / 360 小时` });
  return { title, subtitle: name, rows, note: latest ? "最新有记录小时的均值，并非单次请求。" : "按有记录的分组/模型、小时等权计算。" };
}
