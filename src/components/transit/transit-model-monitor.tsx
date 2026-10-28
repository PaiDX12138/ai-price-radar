"use client";

import { Activity } from "lucide-react";
import { TonePanel } from "@/components/catalog/tone-panel";
import { TextBand } from "@/components/catalog/text-band";
import { ToneChip } from "@/components/catalog/tone-chip";
import { SampleBars } from "@/components/transit/sample-bars";
import { getTransitModelMonitor } from "@/lib/transit/view";
import type { TransitMonitorStats } from "@/lib/transit/snapshot";
import { formatTransitDuration, formatTransitThroughput, formatTransitBucketTime } from "@/lib/transit/format";

type ModelMonitorSite = { id: string; monitorsByModel?: Record<string, TransitMonitorStats> };

/** One selected model, one 360-hour window. No group/platform/statistical fallback. */
export function TransitModelMonitor({ site, model }: { site: ModelMonitorSite; model: string }) {
  const stats = getTransitModelMonitor(site, model);
  const rate = stats?.availability ?? null;
  const tone = rate === null ? "muted" : rate >= 99 ? "emerald" : rate >= 95 ? "amber" : "rose";
  const hours = stats?.samples ?? 0;
  const coverage = `${hours}/360 小时有数据`;
  const range = stats ? `${formatTransitBucketTime(stats.windowStart)} 至 ${formatTransitBucketTime(stats.windowEnd)}（北京时间）` : "暂无15日数据";
  const latest = formatTransitBucketTime(stats?.latestBucketAt);
  const captured = formatTransitBucketTime(stats?.collectedAt);
  const availabilityHint = `${model} · 近15日可用率\n${range}\n${coverage}；每小时先按该模型各分组等权，再按小时等权。缺失小时不算成功；非请求量加权 SLA。`;
  return <TonePanel tone="ink" className="flex h-full min-h-0 flex-col gap-1 px-2.5 py-2">
    <div className="grid h-9 shrink-0 grid-cols-2 items-start gap-2">
      <div className="flex min-w-0 flex-col" data-tooltip={availabilityHint}>
        <span className="flex h-3 items-center gap-1 text-[10px] leading-3 text-muted-foreground"><Activity className="size-3" aria-hidden />15日可用率</span>
        <TextBand tone={tone} className="mt-1 w-fit self-start font-mono text-base font-semibold leading-5 tabular-nums">{rate === null ? "—" : `${rate.toFixed(2)}%`}</TextBand>
      </div>
      <div className="flex min-w-0 flex-col border-l border-border/60 pl-3" data-tooltip={`${coverage}；表示有效小时数，不是请求样本数。官方接口没有返回请求总数。`}>
        <span className="flex h-3 items-center text-[10px] leading-3 text-muted-foreground">有效小时</span>
        <p className="mt-1 font-mono text-base font-semibold leading-5 tabular-nums">{hours}<span className="ml-0.5 text-[9px] font-normal text-muted-foreground">/360</span></p>
      </div>
    </div>
    <div className="mt-auto flex h-4 min-w-0 shrink-0 items-center justify-between gap-2 text-[10px] text-muted-foreground">
      <span className="min-w-0 truncate" data-tooltip={`当前模型：${model}\n最新有数据小时：${latest}\n采集时间：${captured}`}>
        <TextBand tone={hours ? "violet" : "muted"} className="px-0.5 tabular-nums text-foreground">{hours ? latest.slice(5) : "暂无数据"}</TextBand>
      </span>
      <ToneChip tone={hours ? "sky" : "muted"} className="h-4 shrink-0 text-[9px]" tooltip="源站公开性能统计，不是本站独立压测或模型身份认证。">{hours ? "站点公开" : "暂无样本"}</ToneChip>
    </div>
    <div className="shrink-0" data-tooltip={`${model} · 近15日，每条6小时；颜色表示可用率，高度表示平均耗时，灰色表示缺数据。`}>
      <SampleBars key={model} samples={stats?.bars ?? []} maxBars={60} placeholderBars={60} periodMode />
    </div>
    <div className="grid h-7 min-w-0 shrink-0 grid-cols-3 items-center gap-1 text-[9px] leading-3 text-muted-foreground">
      <div className="flex min-w-0 flex-col items-start" data-tooltip={`${model} · 最新有数据小时（${latest}）的平均响应耗时，不是单次请求，不是首Token延迟。`}>
        <span className="block truncate">模型响应</span><TextBand tone="sky" className="mt-0.5 max-w-full truncate font-mono text-[10px] font-medium tabular-nums text-foreground">{formatTransitDuration(stats?.latestLatencyMs)}</TextBand>
      </div>
      <div className="flex min-w-0 flex-col items-center text-center" data-tooltip={`${model} · ${range}\n15日平均响应耗时；有效耗时 ${stats?.latencyHours ?? 0}/360 小时，先分组、再小时等权；缺失和零耗时不计入。`}>
        <span className="block truncate">15日均</span><TextBand tone="violet" className="mt-0.5 max-w-full truncate font-mono text-[10px] font-medium tabular-nums text-foreground">{formatTransitDuration(stats?.averageLatencyMs)}</TextBand>
      </div>
      <div className="flex min-w-0 flex-col items-end text-right" data-tooltip={`${model} · 15日平均吞吐（持续每秒Token数）\n${range}\n有效吞吐 ${stats?.throughputHours ?? 0}/360 小时，直接取源站 avg_tps，先分组、再小时等权；无效和零值不计入，不按耗时反推。`}>
        <span className="block truncate">吞吐</span><TextBand tone="emerald" className="mt-0.5 max-w-full truncate font-mono text-[10px] font-medium tabular-nums text-foreground">{formatTransitThroughput(stats?.averageThroughputTps)}</TextBand>
      </div>
    </div>
  </TonePanel>;
}
