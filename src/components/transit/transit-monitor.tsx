import { Database, Timer, History } from "lucide-react";
import { TextBand } from "@/components/catalog/text-band";
import { ToneChip } from "@/components/catalog/tone-chip";
import type { TransitDemo } from "@/data/demo/transit";
import { SampleBars } from "@/components/transit/sample-bars";

type SampleStatus = "success" | "partial" | "failure" | "unknown";
const STATUS: Record<SampleStatus, { label: string; color: string }> = {
  success: { label: "成功", color: "bg-emerald-500/80" },
  partial: { label: "部分失败", color: "bg-amber-500/80" },
  failure: { label: "失败", color: "bg-rose-500/80" },
  unknown: { label: "无样本", color: "bg-muted-foreground/15" },
};

/** Fifteen daily fictional availability values; null means no samples. */
const DEMO_DAYS: Record<string, number[]> = {
  north: [100, 100, 98, 100, 100, 99, 100, 100, 100, 97, 100, 100, 100, 100, 99],
  orbit: [100, 98, 100, 100, 95, 100, 100, 0, 100, 100, 98, 100, 100, 100, 100],
  pixel: [100, 100, 100, 97, 100, 100, 100, 100, 98, 100, 100, 100, 100, 100, 100],
  cedar: [100, 100, 100, 100, 100, 100, 99, 100, 100, 100, 100, 100, 100, 100, 100],
  echo: [100, 95, 100, 0, 100, 100, 97, 100, 100, 0, 100, 98, 100, 100, 100],
};

export function TransitMonitor({ site, observationSeed = "" }: { site: TransitDemo; observationSeed?: string }) {
  const days: (number | null)[] = DEMO_DAYS[site.id] ?? Array.from({ length: 15 }, () => null);
  const statusOf = (day: number | null): SampleStatus => day === null ? "unknown" : day === 100 ? "success" : day === 0 ? "failure" : "partial";
  // Four fictional observations per day: 60 columns over the 15-day window.
  const observations = days.flatMap((day, dayIndex) => Array.from({ length: 4 }, (_, slot) => ({
    dayIndex,
    slot,
    status: statusOf(day),
    latencyMs: day === null ? null : 1200 + ((dayIndex * 7 + slot * 11 + site.id.length + observationSeed.length) % 19) * 300,
  })));
  const latencies = observations.flatMap((sample) => sample.latencyMs === null ? [] : [sample.latencyMs]);
  const latest = latencies.at(-1);
  const average = latencies.length ? latencies.reduce((sum, ms) => sum + ms, 0) / latencies.length : null;
  const cacheTone = site.cacheHitRate === null || site.cacheHitRate === 0 ? "muted" : site.cacheHitRate >= 80 ? "emerald" : site.cacheHitRate >= 50 ? "amber" : "rose";
  const cacheLevel = site.cacheHitRate === null ? "未披露" : site.cacheHitRate >= 80 ? "健康" : site.cacheHitRate >= 50 ? "一般" : "较差";
  const cacheHint = `缓存命中率：${site.cacheHitRate === null ? "未披露" : `${site.cacheHitRate.toFixed(2)}% · ${cacheLevel}`}。展示分档：≥80% 健康、50%–80% 一般、＜50% 较差；非行业标准或站点可靠性评级（示例）。`;
  const duration = (ms: number | null | undefined) => ms == null ? "—" : `${(ms / 1000).toFixed(1)}s`;
  return (
    <section aria-label={`${site.name} 监测示例`} className="grid h-[88px] grid-rows-[20px_28px_20px] content-start gap-2" title="近15日示例，每天4次采样，共60条；颜色表示状态，柱高表示响应耗时（统一0–8秒刻度）。百分比为示例日可用率等权平均">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5" title={cacheHint} aria-label={cacheHint}><Database className="size-3.5 text-muted-foreground/70" aria-hidden /><TextBand tone={cacheTone} bandClassName={cacheTone === "amber" ? "bg-[var(--apr-amber)]/40 dark:bg-[var(--apr-amber)]/40" : cacheTone === "rose" ? "bg-rose-400/65 dark:bg-rose-400/45" : undefined} className="px-0.5 font-mono text-[13px] font-semibold leading-5 tabular-nums">{site.cacheHitRate === null ? "0.00%" : `${site.cacheHitRate.toFixed(2)}%`}</TextBand></span>
        <ToneChip className="h-[18px] px-1.5 text-[10px]" tone={site.monitoringSource === "station_public" ? "sky" : "muted"} title="监测来源类型，当前为示例数据">{site.monitoringSource === "station_public" ? "站点公开" : "来源未披露"}</ToneChip>
      </div>
      <SampleBars maxBars={60} samples={observations.map((sample) => ({ availability: days[sample.dayIndex], latencyMs: sample.latencyMs, label: `示例 · ${sample.dayIndex === 14 ? "今天" : `${14 - sample.dayIndex} 天前`} · 第${sample.slot + 1}次：${STATUS[sample.status].label}` }))} />
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1.5" title="最近一条监测样本的响应耗时；并非更新时间或首Token时间（示例）"><Timer className="size-3" aria-hidden />最近 <TextBand tone="sky" className="px-0.5 font-mono font-medium tabular-nums text-foreground/85">{duration(latest)}</TextBand></span><span className="inline-flex items-center gap-1.5" title="近15日同口径示例采样的平均响应耗时"><History className="size-3" aria-hidden />15日均 <TextBand tone="violet" className="px-0.5 font-mono font-medium tabular-nums text-foreground">{duration(average)}</TextBand></span></div>
    </section>
  );
}
