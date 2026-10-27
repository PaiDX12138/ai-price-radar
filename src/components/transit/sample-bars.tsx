import { cn } from "@/lib/utils";

export type DetectionObservation = { availability: number | null; latencyMs: number | null; label: string };

/** Contiguous buckets cover every observation exactly once, preserving chronological order. */
export function aggregateObservations(samples: DetectionObservation[], maxBars = 50) {
  const count = Math.min(samples.length, Math.max(1, Math.floor(maxBars)));
  return Array.from({ length: count }, (_, i) => {
    const bucket = samples.slice(Math.floor(i * samples.length / count), Math.floor((i + 1) * samples.length / count));
    const known = bucket.filter((item) => item.availability !== null);
    const timed = bucket.filter((item) => item.latencyMs !== null);
    return {
      count: bucket.length,
      availability: known.length ? known.reduce((sum, item) => sum + item.availability!, 0) / known.length : null,
      latencyMs: timed.length ? timed.reduce((sum, item) => sum + item.latencyMs!, 0) / timed.length : null,
      label: bucket.length === 1 ? bucket[0].label : `${bucket[0].label} — ${bucket.at(-1)!.label}`,
    };
  });
}

/** Shared narrow status bars: color = availability, height = average response time. */
export function SampleBars({ samples, maxBars = 50, fitHeight = false }: { samples: DetectionObservation[]; maxBars?: number; fitHeight?: boolean }) {
  const bars = aggregateObservations(samples, maxBars);
  const heightScale = fitHeight ? Math.max(1, ...bars.map((bar) => bar.latencyMs ?? 0)) / 0.85 : 8000;
  return <div className="flex h-7 items-end gap-[2px]" role="img" aria-label={`${samples.length} 个样本，按时间从旧到新汇总为 ${bars.length} 条；颜色表示可用状态，柱高表示平均响应耗时`}>
    {bars.map((bar, index) => <span key={index} title={`${bar.label} · ${bar.count} 个样本 · 可用率 ${bar.availability === null ? "未知" : `${bar.availability.toFixed(2)}%`}${bar.latencyMs === null ? "" : ` · 平均 ${Math.round(bar.latencyMs)}ms`}`} style={{ height: bar.latencyMs === null ? "100%" : `${Math.min(100, Math.max(20, bar.latencyMs / heightScale * 100))}%` }} className={cn("min-w-0 flex-1 rounded-[2px] transition-opacity hover:opacity-60", bar.availability === null ? "bg-muted-foreground/15" : bar.availability === 100 ? "bg-emerald-500/80" : bar.availability === 0 ? "bg-rose-500/80" : "bg-amber-500/80")} />)}
  </div>;
}
