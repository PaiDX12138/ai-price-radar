import { Database, Timer, History } from "lucide-react";
import { TextBand } from "@/components/catalog/text-band";
import { ToneChip } from "@/components/catalog/tone-chip";
import type { TransitMonitorStats } from "@/lib/transit/snapshot";
import { SampleBars } from "@/components/transit/sample-bars";
import { formatTransitDuration as duration } from "@/lib/transit/format";
import { tooltipDetails } from "@/components/ui/tooltip-details";
import { availabilityHint, metricHint } from "@/lib/transit/monitor-hints";
import { transitAvailabilityTone } from "@/lib/transit/availability-tone";

export function TransitMonitorSource({ stats, unavailableReason }: { stats?: TransitMonitorStats; unavailableReason?:string }) {
  if(stats?.aggregation?.kind==="group_models")return <ToneChip className="h-5 shrink-0 gap-1.5 px-2 text-xs" tone="sky" tooltip="按本分组有记录的模型、小时等权汇总；不是渠道独立实测。">系统汇总</ToneChip>;
  if(unavailableReason)return <ToneChip className="h-5 shrink-0 gap-1.5 px-2 text-xs" tone="muted" tooltip={unavailableReason}>未公开</ToneChip>;
  if(stats?.kind==="model_probe_availability")return <ToneChip className="h-5 shrink-0 gap-1.5 px-2 text-xs" tone={stats.samples?"sky":"muted"} tooltip={stats.availabilityBasis==="normal_probe"?"站方对话探测，正常率含延迟达标判断；非全量请求SLA。":"站方模型探测，本站持续保存；不是分组或全站请求SLA。"}>{stats.samples?"公开探测":"暂无样本"}</ToneChip>;
  return <ToneChip className="h-5 shrink-0 gap-1.5 px-2 text-xs" tone={stats?.samples?"sky":"muted"} tooltip={stats?.kind === "probe_availability" ? "站方公开心跳，本站持续保存；不是请求成功率。" : `站方公开数据 · 已覆盖 ${stats?.samples??0}/360 小时`}>{stats?.samples?stats.kind === "probe_availability"?"公开监测":"站点公开":"暂无样本"}</ToneChip>;
}

export function TransitMonitor({ name, stats, showSource = true, unavailableReason }: { name: string; stats?: TransitMonitorStats; showSource?: boolean; unavailableReason?:string }) {
  const rate=stats?.availability??null;
  const latencyAvailable = stats?.capabilities?.latency !== false;
  const cacheTone=transitAvailabilityTone(rate);
  return (
    <section aria-label={`${name} 近15日可用率监测`} className="grid h-[88px] grid-rows-[20px_28px_20px] content-start gap-2">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5" {...tooltipDetails(availabilityHint(name,stats))} aria-label={`${name} 近15日可用率`}><Database className="size-3.5 text-muted-foreground/70" aria-hidden /><TextBand tone={cacheTone} className="px-0.5 font-mono text-[13px] font-semibold leading-5 tabular-nums">{rate===null?"暂无数据":`${rate.toFixed(2)}%`}</TextBand></span>
        {showSource && <TransitMonitorSource stats={stats} unavailableReason={unavailableReason} />}
      </div>
      <SampleBars maxBars={60} periodMode placeholderBars={60} samples={stats?.bars??[]} latencyAvailable={latencyAvailable} probeMode={stats?.kind === "probe_availability"} modelProbeMode={stats?.kind==="model_probe_availability"} derivedFromModels={stats?.aggregation?.kind==="group_models"} />
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1.5" {...tooltipDetails(metricHint(stats?.kind==="model_probe_availability"?"latest":"ttft",name,stats))}><Timer className="size-3" aria-hidden />{stats?.kind==="model_probe_availability"?"最近耗时":"首Token"} <TextBand tone="sky" className="px-0.5 font-mono font-medium tabular-nums text-foreground/85">{duration(stats?.kind==="model_probe_availability"?stats.latestLatencyMs:stats?.latestTtftMs)}</TextBand></span><span className="inline-flex items-center gap-1.5" {...tooltipDetails(metricHint("average",name,stats))}><History className="size-3" aria-hidden />15日均 <TextBand tone="violet" className="px-0.5 font-mono font-medium tabular-nums text-foreground">{duration(stats?.averageLatencyMs)}</TextBand></span></div>
    </section>
  );
}
