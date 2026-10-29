"use client";

import { Activity } from "lucide-react";
import { TonePanel } from "@/components/catalog/tone-panel";
import { TextBand } from "@/components/catalog/text-band";
import { ToneChip } from "@/components/catalog/tone-chip";
import { SampleBars } from "@/components/transit/sample-bars";
import { getTransitModelMonitor } from "@/lib/transit/view";
import type { TransitMonitorStats } from "@/lib/transit/snapshot";
import { formatTransitDuration, formatTransitThroughput, formatTransitBucketTime } from "@/lib/transit/format";
import { tooltipDetails } from "@/components/ui/tooltip-details";
import { availabilityHint, metricHint, compactMonitorTime } from "@/lib/transit/monitor-hints";

type ModelMonitorSite = { id: string; monitorsByModel?: Record<string, TransitMonitorStats> };

/** One selected model, one 360-hour window. No group/platform/statistical fallback. */
export function TransitModelMonitor({ site, model }: { site: ModelMonitorSite; model: string }) {
  const stats = getTransitModelMonitor(site, model);
  const latencyAvailable = stats?.capabilities?.latency !== false;
  const rate = stats?.availability ?? null;
  const tone = rate === null ? "muted" : rate >= 99 ? "emerald" : rate >= 95 ? "amber" : "rose";
  const hours = stats?.samples ?? 0;
  const latest = formatTransitBucketTime(stats?.latestBucketAt);
  return <TonePanel tone="ink" className="flex h-full min-h-0 flex-col gap-1 px-2.5 py-2">
    <div className="grid h-9 shrink-0 grid-cols-2 items-start gap-2">
      <div className="flex min-w-0 flex-col" {...tooltipDetails(availabilityHint(model,stats))}>
        <span className="flex h-3 items-center gap-1 text-[10px] leading-3 text-muted-foreground"><Activity className="size-3" aria-hidden />{stats?.kind === "probe_availability" ? "15日监测可用率" : "15日可用率"}</span>
        <TextBand tone={tone} className="mt-1 w-fit self-start font-mono text-base font-semibold leading-5 tabular-nums">{rate === null ? "—" : `${rate.toFixed(2)}%`}</TextBand>
      </div>
      <div className="flex min-w-0 flex-col border-l border-border/60 pl-3" {...tooltipDetails({title:"有效小时",rows:[{label:"已覆盖",value:`${hours} 小时`},{label:"目标窗口",value:"360 小时（15日）"}],note:"这是小时覆盖量，不是请求次数。"})}>
        <span className="flex h-3 items-center text-[10px] leading-3 text-muted-foreground">{stats?.kind === "probe_availability" ? "有记录小时" : "有效小时"}</span>
        <p className="mt-1 font-mono text-base font-semibold leading-5 tabular-nums">{hours}<span className="ml-0.5 text-[9px] font-normal text-muted-foreground">/360</span></p>
      </div>
    </div>
    <div className="mt-auto flex h-4 min-w-0 shrink-0 items-center justify-between gap-2 text-[10px] text-muted-foreground">
      <span className="min-w-0 truncate" {...tooltipDetails({title:"数据时间",subtitle:model,rows:[{label:"最新记录",value:compactMonitorTime(stats?.latestBucketAt)},{label:"采集时间",value:compactMonitorTime(stats?.collectedAt)}],note:"北京时间"})}>
        <TextBand tone={hours ? "violet" : "muted"} className="px-0.5 tabular-nums text-foreground">{hours ? latest.slice(5) : "暂无数据"}</TextBand>
      </span>
      <ToneChip tone={hours ? "sky" : "muted"} className="h-4 shrink-0 text-[9px]" tooltip={stats?.kind === "probe_availability" ? "站方公开心跳，本站持续保存；不是请求成功率。" : "站方公开统计，非本站实测。"}>{hours ? stats?.kind === "probe_availability" ? "公开监测" : "站点公开" : "暂无样本"}</ToneChip>
    </div>
    <div className="shrink-0">
      <SampleBars key={model} samples={stats?.bars ?? []} maxBars={60} placeholderBars={60} periodMode latencyAvailable={latencyAvailable} probeMode={stats?.kind === "probe_availability"} />
    </div>
    <div className="grid h-7 min-w-0 shrink-0 grid-cols-3 items-center gap-1 text-[9px] leading-3 text-muted-foreground">
      <div className="flex min-w-0 flex-col items-start" {...tooltipDetails(metricHint("latest",model,stats))}>
        <span className="block truncate">模型响应</span><TextBand tone="sky" className="mt-0.5 max-w-full truncate font-mono text-[10px] font-medium tabular-nums text-foreground">{formatTransitDuration(stats?.latestLatencyMs)}</TextBand>
      </div>
      <div className="flex min-w-0 flex-col items-center text-center" {...tooltipDetails(metricHint("average",model,stats))}>
        <span className="block truncate">15日均</span><TextBand tone="violet" className="mt-0.5 max-w-full truncate font-mono text-[10px] font-medium tabular-nums text-foreground">{formatTransitDuration(stats?.averageLatencyMs)}</TextBand>
      </div>
      <div className="flex min-w-0 flex-col items-end text-right" {...tooltipDetails(metricHint("throughput",model,stats))}>
        <span className="block truncate">吞吐</span><TextBand tone="emerald" className="mt-0.5 max-w-full truncate font-mono text-[10px] font-medium tabular-nums text-foreground">{formatTransitThroughput(stats?.averageThroughputTps)}</TextBand>
      </div>
    </div>
  </TonePanel>;
}
