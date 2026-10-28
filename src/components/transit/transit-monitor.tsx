import { Database, Timer, History } from "lucide-react";
import { TextBand } from "@/components/catalog/text-band";
import { ToneChip } from "@/components/catalog/tone-chip";
import type { TransitMonitorStats } from "@/lib/transit/snapshot";
import { SampleBars } from "@/components/transit/sample-bars";
import { formatTransitDuration as duration } from "@/lib/transit/format";

export function TransitMonitorSource({ stats }: { stats?: TransitMonitorStats }) {
  return <ToneChip className="h-5 shrink-0 gap-1.5 px-2 text-xs" tone={stats?.samples?"sky":"muted"} tooltip={`站点公开统计 · 模型等权均值 · 有数据 ${stats?.samples??0}/360 小时`}>{stats?.samples?"站点公开":"暂无样本"}</ToneChip>;
}

export function TransitMonitor({ name, stats, showSource = true }: { name: string; stats?: TransitMonitorStats; showSource?: boolean }) {
  const rate=stats?.availability??null;
  const cacheTone=rate===null?"muted":rate>=99?"emerald":rate>=95?"amber":"rose";
  const coverage=`有数据 ${stats?.samples??0}/360 小时`;
  const formatTime=(value:string|null|undefined)=>value?new Date(value).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",hour12:false}):"暂无";
  const cacheHint=`近15日可用率（请求成功率），${name}；${coverage}。统计区间 ${formatTime(stats?.windowStart)} 至 ${formatTime(stats?.windowEnd)}（北京时间，末桶可能尚未结束）。按模型等权、再按小时等权，源站未返回请求量，不是按请求量加权的 SLA；缺失小时不计入百分比。`;
  const firstTokenHint=`最新有数据小时 ${formatTime(stats?.latestBucketAt)} 的平均首 Token 延迟，不是最近单次请求。采集于 ${formatTime(stats?.collectedAt)}。`;
  return (
    <section aria-label={`${name} 近15日可用率监测`} className="grid h-[88px] grid-rows-[20px_28px_20px] content-start gap-2" data-tooltip={`${cacheHint} 每根6小时；柱高为统一0–120s对数耗时刻度，越高越慢，超过120s封顶；灰色表示缺数据。`}>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5" data-tooltip={cacheHint} aria-label={cacheHint}><Database className="size-3.5 text-muted-foreground/70" aria-hidden /><TextBand tone={cacheTone} bandClassName={cacheTone === "amber" ? "bg-[var(--apr-amber)]/40 dark:bg-[var(--apr-amber)]/40" : cacheTone === "rose" ? "bg-rose-400/65 dark:bg-rose-400/45" : undefined} className="px-0.5 font-mono text-[13px] font-semibold leading-5 tabular-nums">{rate===null?"暂无数据":`${rate.toFixed(2)}%`}</TextBand></span>
        {showSource && <TransitMonitorSource stats={stats} />}
      </div>
      <SampleBars maxBars={60} periodMode placeholderBars={60} samples={stats?.bars??[]} />
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1.5" data-tooltip={firstTokenHint}><Timer className="size-3" aria-hidden />首Token <TextBand tone="sky" className="px-0.5 font-mono font-medium tabular-nums text-foreground/85">{duration(stats?.latestTtftMs)}</TextBand></span><span className="inline-flex items-center gap-1.5" data-tooltip={`近15日平均响应耗时；${coverage}；按模型、小时等权，与可用率采用相同时间范围，不是首Token延迟。`}><History className="size-3" aria-hidden />15日均 <TextBand tone="violet" className="px-0.5 font-mono font-medium tabular-nums text-foreground">{duration(stats?.averageLatencyMs)}</TextBand></span></div>
    </section>
  );
}
