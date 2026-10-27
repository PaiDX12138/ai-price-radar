"use client";
import { SampleBars } from "@/components/transit/sample-bars";
import { ModelAuthenticityPanel } from "@/components/transit/model-authenticity-panel";
import { SupportedModels } from "@/components/transit/supported-models";
import { Activity, Layers3 } from "lucide-react";
import { PlatformLogo } from "@/components/catalog/platform-logo";
import type { PlatformTabId } from "@/lib/catalog";
import { transitTabs, matchesTransitTab } from "@/components/transit/transit-tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ToneChip } from "@/components/catalog/tone-chip";
import { TextBand } from "@/components/catalog/text-band";
import { TonePanel } from "@/components/catalog/tone-panel";
import { DEMO_MODELS } from "@/data/demo/transit-models";
import type { TransitDemo } from "@/data/demo/transit";
/** Explicit preview samples, not inferred from group cache rates or collected results. */
export function TransitModelDetection({ site, family, query }: { site: TransitDemo; family: string; query: string }) {
  // Synthetic coverage for the preview, using the site's existing model names where available.
  const samples = transitTabs.filter((tab) => tab.id !== "all").map((tab, index) => {
    const existing = site.prices.filter((price) => matchesTransitTab(price, tab.id)).map((price) => price.modelName ?? price.family);
    const models = [...new Set([...existing, ...DEMO_MODELS[tab.id]])];
    // One hourly sample per bar over the short 24-hour preview window.
    const failures = index % 4 === 0 ? [] : index % 4 === 2 ? [2, 5, 8, 14] : [5];
    const observations = Array.from({ length: [24, 50, 120, 180][index % 4] }, (_, slot) => ({
      success: !failures.includes(slot),
      latencyMs: 1500 + index * 150 + (slot * 173 % 1800),
      timestamp: new Date(new Date(site.updatedAt).getTime() - ([24, 50, 120, 180][index % 4] - 1 - slot) * 3600000).toISOString(),
    }));
    return { ...tab, icon: "icon" in tab ? tab.icon : undefined, models,
      rate: observations.filter((item) => item.success).length / observations.length * 100,
      count: observations.length, observations,
      recentMs: observations.at(-1)!.latencyMs,
      averageMs: Math.round(observations.slice(-24).reduce((sum, item) => sum + item.latencyMs, 0) / Math.min(24, observations.length)),
      source: site.monitoringSource === "unknown" || index % 4 === 3 ? "来源未披露" : "站点公开",
      ago: `${8 + index * 3}分钟前`,
    };
  }).filter((sample) => (family === "all" || family === sample.id) && [sample.label, ...sample.models].join(" ").toLowerCase().includes(query));
  return (
    <section className="space-y-3" aria-label="模型检测">
      <h2 className="text-sm font-semibold"><TextBand tone="violet">模型检测</TextBand></h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {samples.map((sample) => <div key={sample.id} className="group h-full">
          <Card size="sm" className="relative h-[226px] min-h-[226px] max-h-[226px] overflow-visible gap-2 bg-card shadow-sm ring-1 ring-foreground/10 transition-[box-shadow,transform,ring-color] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:ring-foreground/20">
            <CardHeader className="shrink-0 gap-1.5 pb-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2"><span className="inline-flex size-7 shrink-0 items-center justify-center">{sample.icon ?? <PlatformLogo platform={sample.id as PlatformTabId} size={18} />}</span><CardTitle className="truncate text-[13px] font-semibold"><TextBand tone="ink">{sample.label}</TextBand></CardTitle></div>
                <ToneChip tone="sky" className="h-5 shrink-0 text-[10px]" title={`本平台支持 ${sample.models.length} 个模型`}><Layers3 className="size-3" aria-hidden /><span className="font-mono font-semibold tabular-nums">{sample.models.length}</span>模型</ToneChip>
              </div>
              <SupportedModels models={sample.models} showCount={false} overlayExpanded />
            </CardHeader>
            <CardContent className="flex shrink-0 flex-col gap-3">
              <div className="grid h-[140px] min-h-[140px] shrink-0 grid-cols-2 gap-3">
              <TonePanel tone="ink" className="flex h-full min-h-0 flex-col justify-between gap-2 px-2.5 pt-2 pb-3">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Activity className="size-3" aria-hidden />可用率</span><TextBand tone={sample.rate >= 95 ? "emerald" : "amber"} className="mt-1 font-mono text-base font-semibold tabular-nums">{sample.rate.toFixed(2)}%</TextBand></div>
                <div className="border-l border-border/60 pl-3"><span className="text-[10px] text-muted-foreground">样本数</span><p className="mt-1 font-mono text-base font-semibold tabular-nums">{sample.count}</p></div>
              </div>
              <div className="absolute inset-x-2.5 bottom-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <span title="最近一次检测时间（示例）"><TextBand tone="violet" className="px-0.5 tabular-nums text-foreground">{sample.ago}</TextBand></span>
                  <ToneChip tone={sample.source === "站点公开" ? "sky" : "muted"} className="h-[18px] text-[10px]">{sample.source}</ToneChip>
                </div>
                <SampleBars fitHeight maxBars={50} samples={sample.observations.map((item) => ({ availability: item.success ? 100 : 0, latencyMs: item.latencyMs, label: `${item.timestamp.slice(5, 16).replace("T", " ")} UTC（示例）` }))} />
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] leading-4 text-muted-foreground">
                  <span className="shrink-0">模型响应：</span>
                  <TextBand tone="sky" className="whitespace-nowrap font-mono font-medium tabular-nums text-foreground">{sample.recentMs}ms</TextBand>
                  <span className="ml-auto inline-flex items-center gap-1 whitespace-nowrap">日均<TextBand tone="violet" className="font-mono font-medium tabular-nums text-foreground">{sample.averageMs}ms</TextBand></span>
                </div>
              </div>
              </TonePanel>
              {/* Claude previews the empty identity-check state; availability remains independent. */}
              <ModelAuthenticityPanel platform={sample.id} models={sample.models} hasData={sample.id !== "claude"} />
              </div>
            </CardContent>
          </Card>
        </div>)}
      </div>
      {!samples.length && <p className="rounded-xl border border-dashed py-8 text-center text-xs text-muted-foreground">暂无对应检测样本</p>}
    </section>
  );
}
