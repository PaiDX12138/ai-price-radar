"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight, Layers3, ShieldCheck, Clock3 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { TonePanel, type TonePanelTone } from "@/components/catalog/tone-panel";
import { ToneChip } from "@/components/catalog/tone-chip";
import { TextBand } from "@/components/catalog/text-band";
import { transitTabs, matchesTransitTab } from "@/components/transit/transit-tabs";
import { SupportedModels } from "@/components/transit/supported-models";
import { TransitModelDetection } from "@/components/transit/transit-model-detection";
import { TransitMonitor } from "@/components/transit/transit-monitor";
import { TransitHomepageLink } from "@/components/transit/transit-homepage-link";
import { TransitGroupMediaPrices } from "@/components/transit/transit-group-media-prices";
import { CardMeta, CardUpdatedRow } from "@/components/catalog/card-meta";
import { formatCardTime, formatListedAgo } from "@/lib/catalog/format";
import { CatalogFilterChrome } from "@/components/catalog/catalog-filter-chrome";
import { ListPagination } from "@/components/catalog/catalog-pagination";
import { paginateTransitGroups, transitGroupPageHref } from "@/lib/transit/pagination";
import { navigateTransitGroupPage, useTransitPageSearch } from "@/lib/transit/use-page-search";
import type { TransitQuote as TransitDetailQuote, TransitSiteView as TransitDemo } from "@/lib/transit/view";
import { getTransitMonitor } from "@/lib/transit/view";
import { orderTransitModels } from "@/lib/transit/model-order";
import { formatTransitPriceAmount } from "@/lib/transit/media-price-format";
import { cn } from "@/lib/utils";

const priceText = (value: number | null) => value === null ? "—" : `$${formatTransitPriceAmount(value)}`;
const MemoTransitModelDetection = memo(TransitModelDetection);
const MemoQuoteCard = memo(QuoteCard);
function RateBand({ value }: { value: number | null }) {
  return <TextBand tone={value === null || value === 0 ? "muted" : value >= 80 ? "emerald" : value >= 50 ? "amber" : "rose"} className="px-0.5 font-mono font-medium tabular-nums">{value === null ? "未披露" : `${value.toFixed(2)}%`}</TextBand>;
}

export function TransitDetail({ site }: { site: TransitDemo }) {
  const params = useSearchParams();
  const pageSearch = useTransitPageSearch(params.toString());
  const liveParams = useMemo(() => new URLSearchParams(pageSearch), [pageSearch]);
  const groupsGridRef = useRef<HTMLDivElement>(null);
  const scrollSnapshot = useRef<{ x: number; y: number } | null>(null);
  const { quotes, listedAt } = site.detail;
  const availableTabs = useMemo(() => transitTabs.filter((tab) => tab.id === "all" || quotes.some((q) => matchesTransitTab({ family: q.family, modelName: q.model, category: q.category }, tab.id))), [quotes]);
  const listedDuration = formatListedAgo(listedAt, site.renderedAt)?.replace(/前$/, "");
  const active = availableTabs.some((tab) => tab.id === liveParams.get("platform")) ? liveParams.get("platform")! : "all";
  const group = liveParams.get("type");
  const groupNames = useMemo(() => [...new Set(quotes.map((quote) => quote.group))], [quotes]);
  const query = (liveParams.get("q") ?? "").trim().toLowerCase();
  const rows = useMemo(() => quotes.filter((q) => matchesTransitTab({ family: q.family, modelName: q.model, category: q.category }, active) && (!group || !groupNames.includes(group) || q.group === group) && [q.model, q.family, q.group].join(" ").toLowerCase().includes(query)), [quotes, active, group, groupNames, query]);

  const modelGroups = useMemo(() => {
    const grouped = new Map<string, { name: string; quotes: TransitDetailQuote[] }>();
    for (const row of rows) {
      const key = `${row.group}:${row.category}`;
      let entry = grouped.get(key);
      if (!entry) { entry = { name: key, quotes: [] }; grouped.set(key, entry); }
      entry.quotes.push(row);
    }
    return [...grouped.values()];
  }, [rows]);
  const pagination = paginateTransitGroups(modelGroups, liveParams.get("page"));
  const hrefForPage = (page: number) => transitGroupPageHref(`/api-transit/${site.id}`, pageSearch, page);

  // A different filter/data set has its own natural height. Never grow the cards themselves.
  useLayoutEffect(() => {
    groupsGridRef.current?.style.removeProperty("min-height");
    scrollSnapshot.current = null;
  }, [modelGroups]);
  useEffect(() => {
    const resetHeight = () => groupsGridRef.current?.style.removeProperty("min-height");
    window.addEventListener("resize", resetHeight);
    return () => window.removeEventListener("resize", resetHeight);
  }, []);
  useLayoutEffect(() => {
    const saved = scrollSnapshot.current;
    if (!saved) return;
    scrollSnapshot.current = null;
    // Cancel browser scroll anchoring before paint; no heading focus, jump or animation.
    if (window.scrollX !== saved.x || window.scrollY !== saved.y) {
      window.scrollTo({ left: saved.x, top: saved.y, behavior: "instant" });
    }
  }, [pagination.page, pageSearch]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[var(--apr-content-max)] space-y-4 px-4 pb-10 pt-4 lg:px-6">
      <nav aria-label="面包屑" className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"><Link href="/api-transit" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mr-1 gap-1")}><ArrowLeft className="size-3.5" />返回</Link><Link href="/api-transit" className="shrink-0 hover:text-foreground">中转站点</Link><ChevronRight className="size-3 shrink-0" /><span className="min-w-0 truncate font-medium text-foreground">{site.name}</span></nav>
      <header className="flex flex-wrap items-center gap-3 rounded-xl border border-border/80 bg-card px-3 py-2.5 sm:gap-4 sm:px-3.5">
        <Image src={site.logoPath} alt="" width={32} height={32} className="size-8 rounded-lg" />
        <div className="min-w-0 flex-1"><h1 className="text-base font-semibold tracking-tight sm:text-[17px]"><TextBand tone="ink">{site.name}</TextBand></h1><div className="mt-1 flex flex-wrap items-center gap-2"><ToneChip tone="sky">{site.system}</ToneChip>{listedDuration ? <TextBand tone="emerald" className="shrink-0 text-xs tracking-tight text-neutral-900" tooltip={`收录于 ${formatCardTime(listedAt).slice(0, 10)}`}>已收录 {listedDuration}</TextBand> : null}{site.channels.map((channel) => <ToneChip key={channel} tone="muted">{channel}</ToneChip>)}</div></div>
        <div className="flex max-w-full flex-wrap items-stretch gap-2 sm:ml-auto">
          <TransitHomepageLink site={site} variant="card" />
          <HeaderMetric title="可用率 / 缓存命中" icon={<ShieldCheck className="size-3" />} tone="sky"><span className="flex items-center gap-2 whitespace-nowrap text-xs"><RateBand value={site.availability && Number.isFinite(Number.parseFloat(site.availability)) ? Number.parseFloat(site.availability) : null} /><span className="text-muted-foreground">/</span><RateBand value={site.cacheHitRate} /></span></HeaderMetric>
          <HeaderMetric title="最近更新" icon={<Clock3 className="size-3" />} tone="amber"><time dateTime={site.updatedAt} className="whitespace-nowrap font-mono text-[11px] font-medium tabular-nums text-[var(--apr-amber)]">{formatCardTime(site.updatedAt)}</time></HeaderMetric>
        </div>
      </header>
      <CatalogFilterChrome tabs={availableTabs} active={active} basePath={`/api-transit/${site.id}`} deliveryTypes={groupNames} searchPlaceholder="搜索模型 / 分组" searchLabel="搜索站内模型" clientNavigation />
      <section className="min-w-0 space-y-3 [overflow-anchor:none]" aria-label="站点分组">
        <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold"><TextBand tone="violet">站点分组</TextBand></h2></div>
        <div ref={groupsGridRef} className="grid grid-cols-1 content-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{pagination.items.map((item) => <MemoQuoteCard key={`${site.id}:${item.name}`} rows={item.quotes} site={site} query={query} />)}</div>
        {!rows.length && <p className="rounded-xl border border-dashed py-10 text-center text-xs text-muted-foreground">没有匹配的模型</p>}
        <ListPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          itemLabel="个分组"
          hrefForPage={hrefForPage}
          onPageClick={(page) => {
            if (page === pagination.page) return;
            const grid = groupsGridRef.current;
            if (grid) grid.style.minHeight = `${Math.ceil(grid.getBoundingClientRect().height)}px`;
            scrollSnapshot.current = { x: window.scrollX, y: window.scrollY };
            // Local slice only: no fetch, RSC navigation or wait for useSearchParams.
            navigateTransitGroupPage(hrefForPage(page));
          }}
        />
      </section>
      <MemoTransitModelDetection site={site} family={active} query={query} catalog={site.modelCatalog} />
    </div>
  );
}

/** Same-height intrinsic-width summary strips, shared with this detail header. */
function HeaderMetric({ title, icon, tone, children }: { title: string; icon: ReactNode; tone: TonePanelTone; children: ReactNode }) {
  return <TonePanel tone={tone} className="flex h-[54px] w-max min-w-[7rem] max-w-full shrink-0 flex-col justify-center gap-1 px-2.5 py-1.5"><span className="flex items-center gap-1 whitespace-nowrap text-[10px] leading-3 text-muted-foreground">{icon}{title}</span><div className="leading-4">{children}</div></TonePanel>;
}

function QuoteCard({ rows, site, query }: { rows: TransitDetailQuote[]; site: TransitDemo; query: string }) {
  const first = rows[0];
  const models = useMemo(() => orderTransitModels([...new Map(rows.map(row => [row.model, { modelName: row.model, family: row.family }])).values()], { query, catalog: site.modelCatalog }).map(model => model.modelName), [rows, query, site.modelCatalog]);
  const media = first.category === "image" || first.category === "video";
  const range = (values: (number | null)[]) => {
    const valid = values.filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0);
    if (!valid.length) return "—";
    const min = Math.min(...valid), max = Math.max(...valid);
    return min === max ? priceText(min) : `$${formatTransitPriceAmount(min)}–${formatTransitPriceAmount(max)}`;
  };
  const prices = [
    { label: "输入", value: range(rows.map((row) => row.input)) }, { label: "输出", value: range(rows.map((row) => row.output)) },
    { label: "缓存写", value: range(rows.map((row) => row.cacheWrite)) }, { label: "缓存读", value: range(rows.map((row) => row.cacheRead)) },
  ];
  // Group metrics never borrow station data or change with a model/platform filter.
  const groupMonitor = getTransitMonitor(site, first.groupKey);
  return (
    <div className="group h-full min-w-0">
      <Card size="sm" className="relative h-full min-w-0 gap-2 bg-card shadow-sm ring-1 ring-foreground/10 transition-[box-shadow,transform,ring-color] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:ring-foreground/20">
        <CardHeader className="min-w-0 gap-1.5 pb-0">
          <div className="flex min-w-0 items-center justify-between gap-2"><CardTitle className="min-w-0 truncate text-[13px] font-semibold"><TextBand tone="ink">{first.group}{media ? first.category === "image" ? " · 图片" : " · 视频" : ""}</TextBand></CardTitle><ToneChip tone="sky" className="h-5 shrink-0 text-[10px]" tooltip={`本组支持 ${new Set(rows.map((row) => row.model)).size} 个模型`}><Layers3 className="size-3" aria-hidden /><span className="font-mono font-semibold tabular-nums">{new Set(rows.map((row) => row.model)).size}</span><span>模型</span></ToneChip></div>
          <SupportedModels models={models} showCount={false} />
        </CardHeader>
        <CardContent className="flex min-w-0 flex-1 flex-col gap-2">
          {media ? <TransitGroupMediaPrices rows={rows} models={models} /> : <TonePanel tone="ink" className="flex h-14 min-w-0 shrink-0 flex-col justify-center px-2 py-2">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1">{prices.map((price) => <div key={price.label} className="flex min-w-0 items-baseline justify-between gap-1"><dt className="shrink-0 text-[10px] text-muted-foreground">{price.label}</dt><dd data-tooltip={price.value} className="truncate text-right font-mono text-[10px] font-semibold tabular-nums">{price.value}</dd></div>)}</dl>
          </TonePanel>}

          <div className="mt-auto shrink-0 border-t border-border/60 pt-2"><TransitMonitor name={`${site.name} · ${first.group}整组`} stats={groupMonitor} /></div>
          <CardMeta className="shrink-0 gap-0 px-2 py-1.5 text-[10px]"><CardUpdatedRow updatedAt={site.updatedAt} nowMs={site.renderedAt} /></CardMeta>
        </CardContent>
      </Card>
    </div>
  );
}
