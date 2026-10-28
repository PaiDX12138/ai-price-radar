"use client";
import { useMemo, useState } from "react";
import { ModelAuthenticityPanel } from "@/components/transit/model-authenticity-panel";
import { SupportedModels } from "@/components/transit/supported-models";
import { Layers3 } from "lucide-react";
import { PlatformLogo } from "@/components/catalog/platform-logo";
import type { PlatformTabId } from "@/lib/catalog";
import { transitTabs, matchesTransitTab } from "@/components/transit/transit-tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ToneChip } from "@/components/catalog/tone-chip";
import { TextBand } from "@/components/catalog/text-band";
import { orderTransitModels, type TransitModelCatalog } from "@/lib/transit/model-order";
import { TransitModelMonitor } from "@/components/transit/transit-model-monitor";
import type { TransitSiteView } from "@/lib/transit/view";

/** Model availability is public source telemetry; identity checks remain unconnected. */
export function TransitModelDetection({ site, family, query, catalog = site.modelCatalog }: { site: TransitSiteView; family: string; query: string; catalog?: TransitModelCatalog }) {
  const [selectedByPlatform, setSelectedByPlatform] = useState<Record<string, string>>({});
  const samples = useMemo(() => transitTabs.filter((tab) => tab.id !== "all" && site.prices.some((price) => matchesTransitTab(price, tab.id))).map((tab) => {
    const existing = site.prices.filter((price) => matchesTransitTab(price, tab.id)).map((price) => price.modelName ?? price.family);
    // The shared catalog supplies release dates/series; names without metadata use the stable version fallback.
    const models = orderTransitModels([...new Set(existing)].map(modelName => ({ modelName })), { catalog }).map(model => model.modelName!);
    return { ...tab, icon: "icon" in tab ? tab.icon : undefined, models };
  }).filter((sample) => (family === "all" || family === sample.id) && [sample.label, ...sample.models].join(" ").toLowerCase().includes(query)), [site.prices, family, query, catalog]);
  return (
    <section className="min-w-0 space-y-3" aria-label="模型检测">
      <h2 className="text-sm font-semibold"><TextBand tone="violet">模型检测</TextBand></h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {samples.map((sample) => {
          const remembered = selectedByPlatform[`${site.id}:${sample.id}`];
          const selectedModel = sample.models.includes(remembered) ? remembered : sample.models[0] ?? "";
          return <div key={sample.id} className="group h-full min-w-0">
          <Card size="sm" className="relative min-w-0 overflow-visible gap-2 bg-card shadow-sm ring-1 ring-foreground/10 transition-[box-shadow,transform,ring-color] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:ring-foreground/20">
            <CardHeader className="min-w-0 shrink-0 grid-rows-[28px_24px] gap-2 pb-0">
              <div className="flex h-7 min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2"><span className="inline-flex size-7 shrink-0 items-center justify-center">{sample.icon ?? <PlatformLogo platform={sample.id as PlatformTabId} size={18} />}</span><CardTitle className="truncate text-[13px] font-semibold"><TextBand tone="ink">{sample.label}</TextBand></CardTitle></div>
                <ToneChip tone="sky" className="h-5 shrink-0 text-[10px]" tooltip={`本平台支持 ${sample.models.length} 个模型`}><Layers3 className="size-3" aria-hidden /><span className="font-mono font-semibold tabular-nums">{sample.models.length}</span>模型</ToneChip>
              </div>
              <SupportedModels models={sample.models} showCount={false} overlayExpanded selectedModel={selectedModel} onModelSelect={(model) => setSelectedByPlatform(previous => ({ ...previous, [`${site.id}:${sample.id}`]: model }))} />
            </CardHeader>
            <CardContent className="flex min-w-0 shrink-0 flex-col">
              <div className="grid h-[140px] min-h-[140px] min-w-0 shrink-0 grid-cols-2 items-stretch gap-3">
              <TransitModelMonitor site={site} model={selectedModel} />
              <ModelAuthenticityPanel platform={sample.id} models={sample.models} selectedModel={selectedModel} hasData={false} isLive />
              </div>
            </CardContent>
          </Card>
        </div>;
        })}
      </div>
      {!samples.length && <p className="rounded-xl border border-dashed py-8 text-center text-xs text-muted-foreground">暂无对应检测样本</p>}
    </section>
  );
}
