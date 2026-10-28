"use client";

import Link from "next/link";
import { CircleDollarSign, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useRouter, useSearchParams } from "next/navigation";
import { CatalogFilterChrome } from "@/components/catalog/catalog-filter-chrome";
import type { TransitSiteView as TransitDemo } from "@/lib/transit/view";
import { getTransitMonitor } from "@/lib/transit/view";
import Image from "next/image";
import { CardMeta, CardUpdatedRow } from "@/components/catalog/card-meta";
import { ToneChip } from "@/components/catalog/tone-chip";
import { TransitHomepageLink } from "@/components/transit/transit-homepage-link";
import { TransitModelPrices } from "@/components/transit/transit-model-prices";
import { transitTabs, platformNames, matchesTransitTab } from "@/components/transit/transit-tabs";
import { CardCornerArrow } from "@/components/catalog/card-corner-arrow";
import { TransitMonitor, TransitMonitorSource } from "@/components/transit/transit-monitor";
import { transitModelModality } from "@/lib/transit/model-order";


function supports(site: TransitDemo, id: string) {
  return site.prices.some((price) => matchesTransitTab(price, id) && (id === "image" || id === "video" || transitModelModality(price, site.modelCatalog) === "text"));
}

const systemTypes = ["New API", "Sub2API", "自研"];

export function TransitBoard({ sites: transitDemos }: { sites: TransitDemo[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const active = transitTabs.find((tab) => tab.id === params.get("platform"))?.id ?? "all";
  const system = params.get("type");
  const filtered = transitDemos.filter((site) =>
    (!system || !systemTypes.includes(system) || site.system === system) &&
    supports(site, active) &&
    [site.name, site.system, ...site.prices.filter(price => matchesTransitTab(price, active) && (active === "image" || active === "video" || transitModelModality(price, site.modelCatalog) === "text")).map(price => price.modelName), ...site.channels, ...Object.entries(platformNames).filter(([id]) => supports(site, id)).flatMap(([, names]) => names)].join(" ").toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div>
      <div className="mb-3">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-2xl font-bold leading-none tracking-[-0.03em] text-foreground sm:text-[1.75rem]">中转站点</h1>
          <span className="hidden h-4 w-px shrink-0 bg-border sm:block" aria-hidden />
          <p className="hidden shrink-0 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground sm:block">API Transit</p>
        </div>
      </div>

      <CatalogFilterChrome tabs={transitTabs} active={active} basePath="/api-transit" deliveryTypes={systemTypes} searchPlaceholder="搜索 AI 平台 / 站点名称 / 模型" searchLabel="搜索中转站点" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((site) => <div key={site.id} className="group h-full rounded-xl outline-none"><Card size="sm" className="relative h-full gap-2 bg-card shadow-sm ring-1 ring-foreground/10 transition-[box-shadow,transform,ring-color] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:ring-foreground/20">
          <Link href={`/api-transit/${site.id}`} data-tooltip-surface aria-label={`查看 ${site.name} 详情`} className="absolute inset-0 z-10 cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" />
          <CardHeader className="h-12 shrink-0 pb-1">
            <div className="flex items-start gap-3">
              <Image src={site.logoPath} alt={`${site.name} Logo`} width={32} height={32} className="size-8 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1"><h2 className="truncate text-[15px] font-semibold"><TransitHomepageLink site={site} /></h2><div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><ToneChip tone="sky" className="h-5 gap-1.5 px-2 text-xs" tooltip={site.rechargeInfo?`官网文档与公开接口核实的基础充值比例；$为站内记账额度，不是美元现金。核实于 ${site.rechargeInfo.observedAt}；来源 ${site.rechargeInfo.sourceUrl}`:"尚无核实的站点基础充值比例"}><CircleDollarSign className="size-3.5 shrink-0" aria-hidden /><span>倍率</span><span className="font-mono font-medium tabular-nums">{site.rechargeMultiplier === null ? "未披露" : `¥1 = $${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 }).format(1 / site.rechargeMultiplier)}`}</span></ToneChip><TransitMonitorSource stats={getTransitMonitor(site)} /></div></div>
              <CardCornerArrow />
            </div>
          </CardHeader>
          <CardContent className="grid grid-rows-[128px_88px_auto] gap-2">
            <TransitModelPrices prices={site.prices.filter((price) => matchesTransitTab(price, active))} media={active === "image" || active === "video"} query={query} platform={active} catalog={site.modelCatalog} />
            <TransitMonitor name={site.name} stats={getTransitMonitor(site)} showSource={false} />
            <CardMeta className="gap-0 py-2">
              <CardUpdatedRow updatedAt={site.updatedAt} nowMs={site.renderedAt} />
            </CardMeta>
          </CardContent>
        </Card></div>)}
      </div>
      {filtered.length === 0 && <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-14"><SearchX className="size-7 text-muted-foreground" /><h2 className="text-sm font-medium">没有匹配的平台</h2><p className="text-xs text-muted-foreground">试试其他名称、模型或来源渠道。</p><Button variant="outline" size="sm" onClick={() => router.replace("/api-transit", { scroll: false })}>重置筛选</Button></div>}

    </div>
  );
}
