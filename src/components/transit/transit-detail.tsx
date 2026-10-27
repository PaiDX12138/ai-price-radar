"use client";

import { type ReactNode } from "react";
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
import { CardMeta, CardUpdatedRow } from "@/components/catalog/card-meta";
import { formatCardTime, formatListedAgo } from "@/lib/catalog/format";
import { CatalogFilterChrome } from "@/components/catalog/catalog-filter-chrome";
import { buildTransitDetail, getDemoGroupLabels, type TransitDetailQuote } from "@/data/demo/transit-detail";
import type { TransitDemo } from "@/data/demo/transit";
import { cn } from "@/lib/utils";

const priceText = (value: number | null) => value === null ? "—" : `$${value}`;
function RateBand({ value }: { value: number | null }) {
  return <TextBand tone={value === null || value === 0 ? "muted" : value >= 80 ? "emerald" : value >= 50 ? "amber" : "rose"} className="px-0.5 font-mono font-medium tabular-nums">{value === null ? "未披露" : `${value.toFixed(2)}%`}</TextBand>;
}

export function TransitDetail({ site }: { site: TransitDemo }) {
  const params = useSearchParams();
  const { quotes, listedAt } = buildTransitDetail(site);
  const listedDuration = formatListedAgo(listedAt)?.replace(/前$/, "");
  const active = transitTabs.some((tab) => tab.id === params.get("platform")) ? params.get("platform")! : "all";
  const group = params.get("type");
  const groupNames = [...new Set(quotes.map((quote) => quote.group))];
  const query = (params.get("q") ?? "").trim().toLowerCase();
  const rows = quotes.filter((q) => matchesTransitTab({ family: q.family, modelName: q.model, category: q.category }, active) && (!group || !groupNames.includes(group) || q.group === group) && [q.model, q.family, q.group].join(" ").toLowerCase().includes(query));

  const modelGroups = [...new Set(rows.map((row) => `${row.group}:${row.category}`))].map((key) => ({ name: key, quotes: rows.filter((row) => `${row.group}:${row.category}` === key) }));

  return (
    <div className="mx-auto w-full max-w-[var(--apr-content-max)] space-y-4 px-4 pb-10 pt-4 lg:px-6">
      <nav aria-label="面包屑" className="flex items-center gap-1.5 text-xs text-muted-foreground"><Link href="/api-transit" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mr-1 gap-1")}><ArrowLeft className="size-3.5" />返回</Link><Link href="/api-transit" className="hover:text-foreground">中转站点</Link><ChevronRight className="size-3" /><span className="font-medium text-foreground">{site.name}</span></nav>
      <header className="flex flex-wrap items-center gap-3 rounded-xl border border-border/80 bg-card px-3 py-2.5 sm:gap-4 sm:px-3.5">
        <Image src={`/brand/transit/${site.id}.svg`} alt="" width={32} height={32} className="size-8 rounded-lg" />
        <div className="min-w-0 flex-1"><h1 className="text-base font-semibold tracking-tight sm:text-[17px]"><TextBand tone="ink">{site.name}</TextBand></h1><div className="mt-1 flex flex-wrap items-center gap-2"><ToneChip tone="sky">{site.system}</ToneChip>{listedDuration ? <TextBand tone="emerald" className="shrink-0 text-xs tracking-tight text-neutral-900" title={`收录于 ${formatCardTime(listedAt).slice(0, 10)}`}>已收录 {listedDuration}</TextBand> : null}{site.channels.map((channel) => <ToneChip key={channel} tone="muted">{channel}</ToneChip>)}</div></div>
        <div className="flex max-w-full flex-wrap items-stretch gap-2 sm:ml-auto">

          <HeaderMetric title="可用率 / 缓存命中" icon={<ShieldCheck className="size-3" />} tone="sky"><span className="flex items-center gap-2 whitespace-nowrap text-xs"><RateBand value={site.availability && Number.isFinite(Number.parseFloat(site.availability)) ? Number.parseFloat(site.availability) : null} /><span className="text-muted-foreground">/</span><RateBand value={site.cacheHitRate} /></span></HeaderMetric>
          <HeaderMetric title="最近更新" icon={<Clock3 className="size-3" />} tone="amber"><time dateTime={site.updatedAt} className="whitespace-nowrap font-mono text-[11px] font-medium tabular-nums text-[var(--apr-amber)]">{formatCardTime(site.updatedAt)}</time></HeaderMetric>
        </div>
      </header>
      <CatalogFilterChrome tabs={transitTabs} active={active} basePath={`/api-transit/${site.id}`} deliveryTypes={groupNames} searchPlaceholder="搜索模型 / 分组" searchLabel="搜索站内模型" />
      <section className="space-y-3" aria-label="站点分组">
        <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold"><TextBand tone="violet">站点分组</TextBand></h2></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{modelGroups.map((item) => <QuoteCard key={`${site.id}:${item.name}`} rows={item.quotes} site={site} />)}</div>
        {!rows.length && <p className="rounded-xl border border-dashed py-10 text-center text-xs text-muted-foreground">没有匹配的模型</p>}
      </section>
      <TransitModelDetection site={site} family={active} query={query} />
    </div>
  );
}

/** Same-height intrinsic-width summary strips, shared with this detail header. */
function HeaderMetric({ title, icon, tone, children }: { title: string; icon: ReactNode; tone: TonePanelTone; children: ReactNode }) {
  return <TonePanel tone={tone} className="flex h-[54px] w-max min-w-[7rem] max-w-full shrink-0 flex-col justify-center gap-1 px-2.5 py-1.5"><span className="flex items-center gap-1 whitespace-nowrap text-[10px] leading-3 text-muted-foreground">{icon}{title}</span><div className="leading-4">{children}</div></TonePanel>;
}

function QuoteCard({ rows, site }: { rows: TransitDetailQuote[]; site: TransitDemo }) {
  const first = rows[0];
  const labels = getDemoGroupLabels(site.id, first.group);
  const groupTags = [
    { label: labels.pool, tone: "emerald" as const, category: "号池来源" },
    { label: labels.subscription, tone: "sky" as const, category: "订阅级别" },
    { label: labels.disclosure, tone: "sky" as const, category: "披露状态" },
  ];
  const undisclosed = groupTags.filter((tag) => !tag.label).map((tag) => tag.category);
  const media = first.category !== "text";
  const range = (values: (number | null)[]) => {
    const valid = values.filter((n): n is number => n !== null);
    if (!valid.length) return "—";
    const min = Math.min(...valid), max = Math.max(...valid);
    return min === max ? priceText(min) : `$${min}–${max}`;
  };
  const prices = media ? [{ label: "单价", value: range(rows.map((row) => row.fixedPrice)) }] : [
    { label: "输入", value: range(rows.map((row) => row.input)) }, { label: "输出", value: range(rows.map((row) => row.output)) },
    { label: "缓存写", value: range(rows.map((row) => row.cacheWrite)) }, { label: "缓存读", value: range(rows.map((row) => row.cacheRead)) },
  ];
  // Explicit group-level preview fixture, not borrowed from a selected model.
  const groupCache = first.cacheHitRate;
  return (
    <div className="group h-full">
      <Card size="sm" className="relative min-h-[300px] h-full gap-2 bg-card shadow-sm ring-1 ring-foreground/10 transition-[box-shadow,transform,ring-color] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:ring-foreground/20">
        <CardHeader className="gap-1.5 pb-0">
          <div className="flex items-center justify-between gap-2"><CardTitle className="text-[13px] font-semibold"><TextBand tone="ink">{first.group}{media ? first.category === "image" ? " · 图片" : " · 视频" : ""}</TextBand></CardTitle><ToneChip tone="sky" className="h-5 text-[10px]" title={`本组支持 ${new Set(rows.map((row) => row.model)).size} 个模型`}><Layers3 className="size-3" aria-hidden /><span className="font-mono font-semibold tabular-nums">{new Set(rows.map((row) => row.model)).size}</span><span>模型</span></ToneChip></div>
          <SupportedModels models={[...new Set(rows.map((row) => row.model))]} showCount={false} />
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex min-h-5 flex-wrap items-center gap-1.5" aria-label="分组标签">
            {undisclosed.length > 0 && <ToneChip tone="muted" className="h-5 text-[10px]" title={`${undisclosed.join("、")}未披露`}>来源未披露</ToneChip>}
            {groupTags.filter((tag) => tag.label).map((tag) => <ToneChip key={tag.category} tone={tag.tone} className="h-5 text-[10px]" title={`${tag.category} · 示例声明`}>{tag.label}</ToneChip>)}
          </div>
          <TonePanel tone="ink" className="space-y-1.5 px-2 py-2">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1">{prices.map((price) => <div key={price.label} className="flex min-w-0 items-baseline justify-between gap-1"><dt className="shrink-0 text-[10px] text-muted-foreground">{price.label}</dt><dd title={price.value} className="truncate text-right font-mono text-[10px] font-semibold tabular-nums">{price.value}</dd></div>)}</dl>
          </TonePanel>

          <div className="border-t border-border/60 pt-2"><TransitMonitor site={{ ...site, name: `${site.name} · ${first.group}整组`, cacheHitRate: groupCache }} observationSeed={`${first.group}:${first.category}`} /></div>
          <CardMeta className="gap-0 px-2 py-1.5 text-[10px]"><CardUpdatedRow updatedAt={site.updatedAt} /></CardMeta>
        </CardContent>
      </Card>
    </div>
  );
}
