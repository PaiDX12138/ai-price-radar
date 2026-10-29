import { Activity } from "lucide-react";
import { TonePanel } from "@/components/catalog/tone-panel";
import { TextBand } from "@/components/catalog/text-band";
import { SampleBars } from "@/components/transit/sample-bars";
import { tooltipDetails } from "@/components/ui/tooltip-details";
import { availabilityHint, compactMonitorTime } from "@/lib/transit/monitor-hints";
import type { TransitSiteView } from "@/lib/transit/view";

/** Infrastructure checks are deliberately separate from model/request availability. */
export function TransitInfrastructure({ items }: { items: TransitSiteView["infrastructure"] }) {
  if(!items?.length)return null;
  return <section className="space-y-3" aria-label="服务监测"><h2 className="text-sm font-semibold"><TextBand tone="violet">服务监测</TextBand></h2>
    <div className="grid min-w-0 gap-3 sm:grid-cols-3">{items.map(({id,name,monitor})=><TonePanel key={id} tone="sky" className="min-w-0 space-y-2 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2" {...tooltipDetails(availabilityHint(name,monitor))}><span className="inline-flex min-w-0 items-center gap-1.5 text-xs"><Activity className="size-3 shrink-0 text-muted-foreground" aria-hidden /><span className="truncate">{name}</span></span><TextBand tone={monitor.availability==null?"muted":monitor.availability>=99?"emerald":"amber"} className="font-mono text-xs font-semibold tabular-nums">{monitor.availability==null?"暂无记录":`${monitor.availability.toFixed(2)}%`}</TextBand></div>
      <SampleBars samples={monitor.bars} maxBars={60} placeholderBars={60} periodMode latencyAvailable={false} probeMode />
      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground"><span>HTTP探测 · 非模型请求</span><span className="truncate tabular-nums">{compactMonitorTime(monitor.latestBucketAt)}</span></div>
    </TonePanel>)}</div>
  </section>;
}
