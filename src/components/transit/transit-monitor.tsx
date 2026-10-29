import { Database, Timer, History } from "lucide-react";
import { TextBand } from "@/components/catalog/text-band";
import { ToneChip } from "@/components/catalog/tone-chip";
import type { TransitMonitorStats } from "@/lib/transit/snapshot";
import { SampleBars } from "@/components/transit/sample-bars";
import { formatTransitDuration as duration } from "@/lib/transit/format";
import { tooltipDetails } from "@/components/ui/tooltip-details";
import { availabilityHint, metricHint } from "@/lib/transit/monitor-hints";

export function TransitMonitorSource({ stats }: { stats?: TransitMonitorStats }) {
  return <ToneChip className="h-5 shrink-0 gap-1.5 px-2 text-xs" tone={stats?.samples?"sky":"muted"} tooltip={stats?.kind === "probe_availability" ? "站方公开心跳，本站持续保存；不是请求成功率。" : `站方公开数据 · 已覆盖 ${stats?.samples??0}/360 小时`}>{stats?.samples?stats.kind === "probe_availability"?"公开监测":"站点公开":"暂无样本"}</ToneChip>;
}

export function TransitMonitor({ name, stats, showSource = true }: { name: string; stats?: TransitMonitorStats; showSource?: boolean }) {
  const rate=stats?.availability??null;
  const latencyAvailable = stats?.capabilities?.latency !== false;
  const cacheTone=rate===null?"muted":rate>=99?"emerald":rate>=95?"amber":"rose";
  return (
    <section aria-label={`${name} 近15日可用率监测`} className="grid h-[88px] grid-rows-[20px_28px_20px] content-start gap-2">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5" {...tooltipDetails(availabilityHint(name,stats))} aria-label={`${name} 近15日可用率`}><Database className="size-3.5 text-muted-foreground/70" aria-hidden /><TextBand tone={cacheTone} bandClassName={cacheTone === "amber" ? "bg-[var(--apr-amber)]/40 dark:bg-[var(--apr-amber)]/40" : cacheTone === "rose" ? "bg-rose-400/65 dark:bg-rose-400/45" : undefined} className="px-0.5 font-mono text-[13px] font-semibold leading-5 tabular-nums">{rate===null?"暂无数据":`${rate.toFixed(2)}%`}</TextBand></span>
        {stats?.kind === "probe_availability" && !stats.scope.modelName && stats.scope.groupKey === null && stats.coverageScope !== "infrastructure" && <span className="mr-auto text-[9px] text-muted-foreground">监测 {stats.monitoredModels??0}/{stats.totalModels??0} 型号</span>}
        {showSource && <TransitMonitorSource stats={stats} />}
      </div>
      <SampleBars maxBars={60} periodMode placeholderBars={60} samples={stats?.bars??[]} latencyAvailable={latencyAvailable} probeMode={stats?.kind === "probe_availability"} />
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1.5" {...tooltipDetails(metricHint("ttft",name,stats))}><Timer className="size-3" aria-hidden />首Token <TextBand tone="sky" className="px-0.5 font-mono font-medium tabular-nums text-foreground/85">{duration(stats?.latestTtftMs)}</TextBand></span><span className="inline-flex items-center gap-1.5" {...tooltipDetails(metricHint("average",name,stats))}><History className="size-3" aria-hidden />15日均 <TextBand tone="violet" className="px-0.5 font-mono font-medium tabular-nums text-foreground">{duration(stats?.averageLatencyMs)}</TextBand></span></div>
    </section>
  );
}
