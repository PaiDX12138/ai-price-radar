import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { TextBand } from "@/components/catalog/text-band";
import { PLATFORM_LABEL } from "@/components/catalog/platform-logo";
import { ProductLogo } from "@/components/catalog/product-logo";
import { OfficialLowestStrip } from "@/components/official/official-lowest-strip";
import { OfficialRegionQuotesSection } from "@/components/official/official-region-quotes-section";
import { OfficialUsPriceStrip } from "@/components/official/official-us-price-strip";
import { buttonVariants } from "@/components/ui/button-variants";
import type { PlatformTabId } from "@/lib/catalog/types";
import type {
  OfficialPlanSummary,
  OfficialRegionPrice,
} from "@/lib/official/types";
import { cn } from "@/lib/utils";

type OfficialPlanDetailProps = {
  plan: OfficialPlanSummary;
  everyRow: OfficialRegionPrice[];
  channel: string | null;
  channelOptions: string[];
  channelCounts: Record<string, number>;
  /** URL 初始搜索词（客户端筛选 hydration） */
  q?: string;
  monthlyPlanId?: string | null;
  annualPlanId?: string | null;
};

/** 顶栏色卡统一高度（对齐右侧「最低地区」块）。 */
const HEADER_META_H = "h-[3.75rem]";

function resolveLowestRow(
  everyRow: OfficialRegionPrice[],
  plan: OfficialPlanSummary,
): OfficialRegionPrice | null {
  const lowest = plan.lowest;
  const hit = everyRow.find(
    (r) =>
      r.countryCode === lowest.countryCode &&
      r.channel === lowest.channel &&
      Math.abs(r.cnyPrice - lowest.cnyPrice) < 0.02,
  );
  return hit ?? everyRow[0] ?? null;
}

/**
 * AI 套餐官方地区价详情：顶栏对齐商品详情（紧凑矮横条），下方地区卡网格。
 */
export function OfficialPlanDetailView({
  plan,
  everyRow,
  channel,
  channelOptions,
  channelCounts,
  q = "",
  monthlyPlanId = null,
  annualPlanId = null,
}: OfficialPlanDetailProps) {
  const lowestRow = resolveLowestRow(everyRow, plan);
  /** 全局最低（全渠道/未筛选）；筛选或翻页后只有该行仍在视野里才亮标 */
  const globalLowestId =
    lowestRow?.id ??
    everyRow.find((r) => r.status === "available")?.id ??
    everyRow[0]?.id ??
    null;
  const quoteCount = plan.quoteCount ?? everyRow.length;

  const billingLabel =
    plan.billingPeriod === "annual" ? "年付" : "月付";

  return (
    <div
      key={plan.id}
      className="mx-auto w-full max-w-[var(--apr-content-max)] space-y-4 px-4 pb-10 pt-4 lg:px-6"
    >
      <nav
        aria-label="面包屑"
        className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Link
          href="/official"
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "mr-1 shrink-0 gap-1",
          )}
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          返回
        </Link>
        <Link
          href="/official"
          className="hover:text-foreground underline-offset-2 hover:underline"
        >
          官网定价
        </Link>
        <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden />
        <Link
          href={`/official?platform=${encodeURIComponent(plan.catalogPlatform || plan.appSlug)}`}
          className="hover:text-foreground underline-offset-2 hover:underline"
        >
          {PLATFORM_LABEL[(plan.catalogPlatform || plan.appSlug) as PlatformTabId] ??
            plan.appName}
        </Link>
        <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden />
        <span className="min-w-0 max-w-[min(100%,28rem)] truncate font-medium text-foreground">
          {plan.label}
        </span>
      </nav>

      {/* 顶栏：左侧仅标题排版对齐卡网；右侧色卡保持原布局 */}
      <header className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-card px-3 py-2.5 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4 sm:px-3.5">
        <div className="flex min-w-0 flex-wrap items-stretch gap-2 sm:gap-2.5">
          {/* 标题：字号/间距对齐卡网商品详情，不改右侧色卡 */}
          <div className="flex min-w-0 items-start gap-2.5">
            <ProductLogo
              slug={plan.catalogSlug || plan.appSlug}
              name={plan.label}
              size={32}
              className="mt-0.5"
            />
            <div className="min-w-0 space-y-1">
              <h1 className="truncate text-base font-semibold tracking-tight sm:text-[17px]">
                {plan.label}
                <span className="ml-1.5 text-[13px] font-medium text-muted-foreground">
                  · {billingLabel}
                </span>
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                各地区实时定价
              </p>
            </div>
          </div>

          {/* 覆盖：淡墨绿；两行中间小横线；上行地区靠左，下行数据琥珀靠右 */}
          <div
            className={cn(
              HEADER_META_H,
              "flex w-[7.5rem] shrink-0 flex-col justify-center rounded-md px-2",
              "border-[color-mix(in_oklab,var(--apr-ink)_32%,var(--border))] bg-[var(--apr-ink-soft)]",
            )}
          >
            <p className="text-left font-mono text-[15px] font-semibold tabular-nums leading-none text-[var(--apr-ink)]">
              {plan.sampleCount}
              <span className="ml-0.5 text-[12px] font-semibold">地区</span>
            </p>
            <span
              aria-hidden
              className="my-1.5 h-px w-full bg-[color-mix(in_oklab,var(--apr-ink)_22%,transparent)]"
            />
            <p className="text-right font-mono text-[12px] font-semibold tabular-nums leading-none text-[var(--apr-amber)]">
              {quoteCount} 数据
            </p>
          </div>

          {plan.usCny != null ? (
            <OfficialUsPriceStrip
              usListUsd={plan.usListUsd}
              usPriceText={plan.usPriceText}
              usCny={plan.usCny}
            />
          ) : null}
        </div>

        {lowestRow ? (
          <OfficialLowestStrip row={lowestRow} usCny={plan.usCny} />
        ) : null}
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          <TextBand tone="ink">全部地区报价</TextBand>
        </h2>

        <OfficialRegionQuotesSection
          planId={plan.id}
          everyRow={everyRow}
          channel={channel}
          channelOptions={channelOptions}
          channelCounts={channelCounts}
          initialQ={q}
          billingPeriod={plan.billingPeriod}
          monthlyPlanId={
            monthlyPlanId ?? (plan.billingPeriod === "monthly" ? plan.id : null)
          }
          annualPlanId={
            annualPlanId ?? (plan.billingPeriod === "annual" ? plan.id : null)
          }
          lowestRowId={globalLowestId}
          usCny={plan.usCny}
        />
      </section>
    </div>
  );
}
