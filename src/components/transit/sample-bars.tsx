"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { formatTransitDuration, formatTransitThroughput } from "@/lib/transit/format";
import { aggregateObservations, barTimeRange, latencyBarHeight, LATENCY_HEIGHT_CAP_MS, type DetectionObservation } from "@/lib/transit/bar-chart";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, createTooltipHandle } from "@/components/ui/tooltip";
import { TooltipDetails, type TooltipDetailsData } from "@/components/ui/tooltip-details";

export { aggregateObservations } from "@/lib/transit/bar-chart";
export type { DetectionObservation } from "@/lib/transit/bar-chart";
type Bar = ReturnType<typeof aggregateObservations>[number];

function BarDetails({ bar, latencyAvailable, probeMode }: { bar: Bar; latencyAvailable: boolean; probeMode: boolean }) {
  const rows: TooltipDetailsData["rows"] = [{label:probeMode?"监测可用率":"可用率",value:bar.availability === null ? "暂无记录" : `${bar.availability.toFixed(2)}%`}];
  if (bar.knownHours !== undefined && bar.expectedHours !== undefined)
    rows.push({label:probeMode?"有记录小时":"数据覆盖",value:`${bar.knownHours} / ${bar.expectedHours} 小时`});
  if (bar.availability !== null) {
    if (latencyAvailable) {
      rows.push({label:"首Token",value:formatTransitDuration(bar.ttftMs)},{label:"平均耗时",value:formatTransitDuration(bar.latencyMs)});
      if (bar.throughputTps !== undefined) rows.push({label:"吞吐",value:formatTransitThroughput(bar.throughputTps)});
    } else rows.push({label:"耗时数据",value:"站点未公开"});
  }
  return <TooltipDetails title={bar.startAt ? barTimeRange(bar) : "时段数据"} rows={rows}
    note={bar.availability === null ? "该时段没有记录，不参与计算。" : probeMode ? "按心跳样本统计，非请求成功率；柱高一致。北京时间。" : latencyAvailable ? "颜色看可用率，越高表示耗时越长。北京时间。" : "颜色表示可用率；未公开耗时，柱高一致。北京时间。"} />;
}

/** Shared narrow bars: colour = availability; period heights use one fixed log scale. */
export function SampleBars({ samples, maxBars = 50, fitHeight = false, placeholderBars = 0, periodMode = false, latencyAvailable = true, probeMode = false }: { samples: DetectionObservation[]; maxBars?: number; fitHeight?: boolean; placeholderBars?: number; periodMode?: boolean; latencyAvailable?: boolean; probeMode?: boolean }) {
  const [handle] = useState(() => createTooltipHandle<Bar>());
  const [focusIndex, setFocusIndex] = useState(0);
  const bars = useMemo(() => {
    const placeholders: DetectionObservation[] = samples.length ? [] : Array.from({ length: Math.min(maxBars, Math.max(0, placeholderBars)) }, () => ({ availability: null, latencyMs: null, label: "暂无数据" }));
    return aggregateObservations(samples.length ? samples : placeholders, maxBars);
  }, [samples, maxBars, placeholderBars]);
  const labels = useMemo(() => bars.map(barTimeRange), [bars]);
  const heightScale = fitHeight ? Math.max(1, ...bars.map(bar => bar.latencyMs ?? 0)) / 0.85 : 8000;
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === "ArrowLeft" ? Math.max(0, index - 1) : event.key === "ArrowRight" ? Math.min(bars.length - 1, index + 1) : event.key === "Home" ? 0 : event.key === "End" ? bars.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[data-slot='transit-bar-trigger']")[next]?.focus();
  };
  return <TooltipProvider delay={120} closeDelay={40}>
    <div className="relative z-20 flex h-7 items-end gap-[2px]" role="group" aria-label={samples.length ? `${samples.length} 个${periodMode ? "时间段" : "样本"}，从旧到新 ${bars.length} 条；颜色表示可用率，${latencyAvailable ? `柱高表示平均耗时${periodMode ? "（统一0–120s对数刻度，超过120s封顶）" : fitHeight ? "（自适应刻度）" : ""}` : "源站未公开耗时，柱高一致"}` : "暂无监测数据，灰色条仅为占位"} title="">
      {bars.map((bar, index) => <TooltipTrigger key={index} handle={handle} payload={bar} closeOnClick={false} type="button" data-slot="transit-bar-trigger" title="" tabIndex={index === Math.min(focusIndex, bars.length - 1) ? 0 : -1} onFocus={() => setFocusIndex(index)} onKeyDown={event => keyDown(event, index)} aria-label={`${labels[index]}，${bar.availability === null ? "暂无记录" : `可用率 ${bar.availability.toFixed(2)}%，${latencyAvailable ? `平均耗时 ${formatTransitDuration(bar.latencyMs)}` : "站点未公开耗时"}`}`} className="group/bar flex h-full min-w-0 flex-1 items-end rounded-[2px] bg-transparent p-0 outline-none focus-visible:ring-1 focus-visible:ring-ring">
        <span aria-hidden data-slot="transit-bar" data-height-capped={periodMode && bar.latencyMs !== null && bar.latencyMs >= LATENCY_HEIGHT_CAP_MS ? "true" : undefined} style={{ height: `${periodMode ? latencyBarHeight(bar.latencyMs) : bar.latencyMs === null ? 18 : Math.min(100, Math.max(20, bar.latencyMs / heightScale * 100))}%` }} className={cn("block w-full rounded-[2px] transition-opacity group-hover/bar:opacity-60", bar.availability === null ? "bg-muted-foreground/15" : bar.availability >= (periodMode ? 99 : 100) ? "bg-emerald-500/80" : bar.availability < (periodMode ? 95 : 0.000001) ? "bg-rose-500/80" : "bg-amber-500/80")} />
      </TooltipTrigger>)}
    </div>
    <Tooltip handle={handle} disableHoverablePopup>
      {({ payload }) => <TooltipContent className="w-[min(18rem,calc(100vw-1.5rem))]">{payload && <BarDetails bar={payload} latencyAvailable={latencyAvailable} probeMode={probeMode} />}</TooltipContent>}
    </Tooltip>
  </TooltipProvider>;
}
