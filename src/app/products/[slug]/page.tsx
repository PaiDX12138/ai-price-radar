import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CatalogLoading } from "@/components/catalog/catalog-loading";
import { ProductBackLink } from "@/components/catalog/product-back-link";
import { ProductOffersPanel } from "@/components/catalog/product-offers-panel";
import { TextBand, type TextBandTone } from "@/components/catalog/text-band";
import { PLATFORM_LABEL } from "@/components/catalog/platform-logo";
import { ProductLogo } from "@/components/catalog/product-logo";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  formatCny,
  getOffersForProduct,
  getProduct,
  isDemoCatalog,
  listIntegratedSourcePlatforms,
  summarizeProduct,
} from "@/lib/catalog";
import { getOfficialCatalogQuote } from "@/lib/catalog/official-prices";
import { OfficialLowestStrip } from "@/components/official/official-lowest-strip";
import { OfficialUsPriceStrip } from "@/components/official/official-us-price-strip";
import { BRAND_NAME_ZH } from "@/lib/brand";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const product = getProduct(slug);
  return { title: product ? product.name : "商品详情" };
}

export default function ProductPage({ params, searchParams }: PageProps) {
  return (
    <div className="mx-auto w-full max-w-[var(--apr-content-max)] space-y-4 px-4 py-5 lg:px-6">
      <Suspense fallback={<CatalogLoading className="min-h-[min(50vh,22rem)]" />}>
        <ProductDetail params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ProductDetail({ params, searchParams }: PageProps) {
  await connection();
  const { slug } = await params;
  const { q: qParam } = await searchParams;
  const initialQ = qParam?.trim() || "";
  const product = getProduct(slug);
  if (!product) notFound();

  const offers = getOffersForProduct(slug);
  const needle = initialQ.toLowerCase();
  const scopedOffers = needle
    ? offers.filter((offer) =>
        [offer.sourceTitle, offer.source.name, ...offer.tags]
          .join("\n")
          .toLowerCase()
          .includes(needle),
      )
    : offers;
  // 带搜索词进入时，顶栏最低价与渠道数跟筛选后的报价一致
  const summary = summarizeProduct(
    product,
    undefined,
    needle ? scopedOffers : undefined,
  );
  const sourcePlatforms = listIntegratedSourcePlatforms();
  const demo = isDemoCatalog();
  const platformLabel = PLATFORM_LABEL[product.platform] ?? product.platform;
  const platformHref = `/channels?platform=${encodeURIComponent(product.platform)}`;
  /** Soft fallback when session has no leave path (direct open / refresh). */
  const catalogFallbackHref = platformHref;
  const officialQuote = getOfficialCatalogQuote(slug);

  return (
    <>
      <nav
        aria-label="面包屑"
        className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
      >
        <ProductBackLink
          fallbackHref={catalogFallbackHref}
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "mr-1 shrink-0 gap-1"
          )}
          aria-label="返回渠道列表"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          返回
        </ProductBackLink>
        <ProductBackLink
          fallbackHref={catalogFallbackHref}
          className="hover:text-foreground underline-offset-2 hover:underline"
        >
          {BRAND_NAME_ZH}
        </ProductBackLink>
        <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden />
        <Link
          href={platformHref}
          className="hover:text-foreground underline-offset-2 hover:underline"
        >
          {platformLabel}
        </Link>
        <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden />
        <span className="min-w-0 max-w-[min(100%,28rem)] truncate font-medium text-foreground">
          {product.name}
        </span>
        {demo ? (
          <Badge variant="warning" className="ml-auto shrink-0">
            示例数据，非真实报价
          </Badge>
        ) : null}
      </nav>


      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4 sm:px-3.5">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <ProductLogo
              slug={product.slug}
              name={product.name}
              size={32}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h1 className="truncate text-base font-semibold tracking-tight sm:text-[17px]">
                  {product.name}
                </h1>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  有货 {summary.inStockCount} / 渠道 {summary.channelCount}
                </span>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-normal">
                  {product.deliveryType}
                </Badge>
                <Badge variant="outline" className="h-5 px-1.5 text-[11px] font-normal">
                  {platformLabel}
                </Badge>
                {product.summary ? (
                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {product.summary}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div
            className="flex w-full shrink-0 flex-wrap items-stretch gap-1.5 sm:w-auto sm:flex-nowrap sm:gap-2"
            aria-label="价格对比"
          >
            {officialQuote ? (
              <Link
                href={`/official/${encodeURIComponent(officialQuote.planId)}`}
                className="flex shrink-0 flex-wrap items-stretch gap-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-2"
                title="查看官网各地区报价"
              >
                {officialQuote.usCny != null ? (
                  <OfficialUsPriceStrip
                    usListUsd={officialQuote.usListUsd}
                    usPriceText={officialQuote.usPriceText}
                    usCny={officialQuote.usCny}
                  />
                ) : null}
                <OfficialLowestStrip
                  row={officialQuote.row}
                  usCny={officialQuote.usCny}
                  className="ml-0"
                />
              </Link>
            ) : null}
            {summary.nonWarrantyLowestPrice != null ||
            summary.warrantyLowestPrice != null ? (
              <div
                className={cn(
                  // 默认格宽 ≈ 原 5.5rem；价格变长时整组按内容加宽，避免 ¥1,800 挤出
                  "inline-grid w-max max-w-full items-stretch gap-1.5 sm:gap-2",
                  summary.nonWarrantyLowestPrice != null &&
                    summary.warrantyLowestPrice != null
                    ? "grid-cols-[repeat(2,minmax(5.5rem,max-content))]"
                    : "grid-cols-[minmax(5.5rem,max-content)]",
                )}
              >
                {summary.nonWarrantyLowestPrice != null ? (
                  <CompareBlock
                    label="无质保最低"
                    labelTone="ink"
                    soft="border-[color-mix(in_oklab,var(--apr-ink)_28%,var(--border))] bg-[var(--apr-ink-soft)]"
                    valueClass="text-[var(--apr-price)]"
                    value={formatCny(summary.nonWarrantyLowestPrice)}
                  />
                ) : null}
                {summary.warrantyLowestPrice != null ? (
                  <CompareBlock
                    label="有质保最低"
                    labelTone="amber"
                    soft="border-[color-mix(in_oklab,var(--apr-amber)_28%,var(--border))] bg-[var(--apr-amber-soft)]"
                    valueClass="text-[var(--apr-price-warranty)]"
                    value={formatCny(summary.warrantyLowestPrice)}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <ProductOffersPanel
          offers={offers}
          deliveryType={product.deliveryType}
          platform={product.platform}
          sourcePlatforms={sourcePlatforms}
          initialQ={initialQ}
        />
      </div>
    </>
  );
}

function CompareBlock({
  label,
  labelTone = "violet",
  soft,
  valueClass,
  value,
}: {
  label: string;
  labelTone?: TextBandTone;
  soft: string;
  valueClass: string;
  value: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-[3.75rem] min-w-[5.5rem] flex-col rounded-md border px-2 py-1.5 text-center sm:text-left",
        soft,
      )}
    >
      <div className="shrink-0 text-[10px] font-medium leading-none text-foreground">
        <TextBand tone={labelTone}>{label}</TextBand>
      </div>
      <div
        className={cn(
          "flex flex-1 items-center justify-center sm:justify-start",
          "whitespace-nowrap font-mono text-sm font-semibold tabular-nums leading-none sm:text-[15px]",
          valueClass,
        )}
      >
        {value}
      </div>
    </div>
  );
}
