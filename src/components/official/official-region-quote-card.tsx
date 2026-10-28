import { Medal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardMeta, CardUpdatedRow } from "@/components/catalog/card-meta";
import { TextBand } from "@/components/catalog/text-band";
import { ToneChip } from "@/components/catalog/tone-chip";
import {
  TonePanel,
  tonePanelPriceClass,
} from "@/components/catalog/tone-panel";
import { CountryFlag } from "@/components/official/country-flag";
import { PayChannel } from "@/components/official/pay-channel";
import { AutoFitPrice } from "@/components/official/auto-fit-price";
import { VsUsTrend } from "@/components/official/vs-us-trend";
import { formatCny, formatCnyRate } from "@/lib/catalog/format";
import { displayCountryLabel } from "@/lib/official/country-display";
import { taxBandLabel, taxNote } from "@/lib/official/currency";
import { formatLocalPrice } from "@/lib/official/exclusive-price";
import { storefrontIdForCountry } from "@/lib/official/storefront-id";
import type {
  OfficialBillingPeriod,
  OfficialRegionPrice,
} from "@/lib/official/types";
import { cn } from "@/lib/utils";

export type OfficialRegionQuoteCardProps = {
  row: OfficialRegionPrice;
  highlight?: "lowest" | null;
  /** 美区折算 CNY，用于相对涨跌% */
  usCny?: number | null;
  /** 月付 / 年付 */
  billingPeriod?: OfficialBillingPeriod | null;
  className?: string;
};

function StatusChip({ status }: { status: string }) {
  if (status === "estimated") {
    return (
      <ToneChip tone="amber" tooltip="仅有参考基准，未确认该地区/周期的实际结账报价">
        参考
      </ToneChip>
    );
  }
  if (status === "stale") {
    return <ToneChip tone="rose">历史价</ToneChip>;
  }
  return null;
}

/**
 * 地区报价卡 — 左国旗、右地区名+标签；价卡居中、≈色卡高度居中。
 */
export function OfficialRegionQuoteCard({
  row,
  highlight = null,
  usCny = null,
  billingPeriod = null,
  className,
}: OfficialRegionQuoteCardProps) {
  const isLowest = highlight === "lowest";
  const storefrontId =
    row.storefrontId?.trim() || storefrontIdForCountry(row.countryCode);
  const taxKind = taxBandLabel(row);
  const billingLabel =
    billingPeriod === "annual"
      ? "年付"
      : billingPeriod === "monthly"
        ? "月付"
        : null;
  const localPriceText =
    row.priceValue != null && Number.isFinite(row.priceValue)
      ? formatLocalPrice(row.priceValue, row.currencyCode)
      : row.priceText || "—";
  const regionLabel = displayCountryLabel(row.countryCode, row.countryLabel);

  return (
    <div className={cn("group h-full", className)}>
      <Card
        size="sm"
        className={cn(
          "relative h-full bg-card shadow-sm ring-1 ring-foreground/10",
          "transition-[box-shadow,transform,ring-color] duration-200",
          "group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:ring-foreground/20",
        )}
      >
        <CardHeader className="gap-2 border-b border-border/80 pb-(--card-spacing)">
          <div
            className={cn(
              "flex min-w-0 items-start gap-2",
              isLowest ? "pr-8" : "pr-1",
            )}
          >
            <CountryFlag
              countryCode={row.countryCode}
              countryLabel={regionLabel}
              size={28}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <CardTitle className="min-w-0 truncate text-[15px] font-semibold leading-snug tracking-tight text-neutral-900">
                  <TextBand>{regionLabel}</TextBand>
                </CardTitle>
                {taxKind ? (
                  <TextBand
                    tone="amber"
                    className="shrink-0 text-[10px] font-semibold tracking-[0.04em] text-foreground"
                    tooltip={taxNote(row)}
                  >
                    {taxKind}
                  </TextBand>
                ) : null}
              </div>
              <div className="mt-1.5 flex w-full min-w-0 flex-wrap items-center gap-x-1 gap-y-1.5">
                <ToneChip tone="violet" className="shrink-0">
                  {row.countryCode}
                </ToneChip>
                {storefrontId ? (
                  <ToneChip tone="muted" tooltip="Storefront ID" className="shrink-0">
                    {storefrontId}
                  </ToneChip>
                ) : null}
                <ToneChip
                  tone={row.channel === "web_direct" ? "sky" : "muted"}
                  className="shrink-0"
                >
                  <PayChannel
                    channel={row.channel}
                    className="gap-1 text-[11px] text-inherit [&_svg]:opacity-80 [&_span]:font-medium [&_span]:text-inherit"
                  />
                </ToneChip>
                {billingLabel ? (
                  <ToneChip
                    tone={billingPeriod === "annual" ? "ink" : "emerald"}
                    tooltip={billingLabel}
                    className="shrink-0"
                  >
                    {billingLabel}
                  </ToneChip>
                ) : null}
                <StatusChip status={row.status} />
                {row.priceBasis === "usd_reference" ? (
                  <ToneChip tone="muted" tooltip="官网仅发布 USD 基准，非该地区独立结账报价；未按地区法币伪造价格">
                    USD 参考
                  </ToneChip>
                ) : null}
              </div>
            </div>
          </div>

          {isLowest ? (
            <ToneChip
              tone="emerald"
              tooltip="当前最低"
              aria-label="当前最低"
              className="absolute right-3 top-3 size-7 shrink-0 justify-center px-0"
            >
              <Medal className="size-3.5" strokeWidth={2.25} aria-hidden />
            </ToneChip>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-2">
          <TonePanel tone="sky" className="px-3 py-2.5">
            {/* 左当地价（定宽+自适应字号）/ 汇率 · 中≈ · 右涨跌%/人民币 */}
            <div className="flex items-center justify-center gap-2">
              <div className="flex w-[7.25rem] shrink-0 flex-col justify-center gap-1 overflow-hidden">
                <AutoFitPrice
                  text={localPriceText}
                  maxPx={15}
                  minPx={9}
                  className={cn(
                    "font-mono font-semibold tabular-nums",
                    tonePanelPriceClass("sky"),
                  )}
                />
                <AutoFitPrice
                  text={
                    row.fxRateToCny != null
                      ? `1 ${row.currencyCode} ≈ ${formatCnyRate(row.fxRateToCny)}`
                      : row.currencyCode
                  }
                  maxPx={11}
                  minPx={8}
                  className="font-mono font-medium tabular-nums tracking-wide text-sky-700/85 dark:text-sky-300/80"
                />
              </div>

              <span
                aria-hidden
                className="shrink-0 self-center font-mono text-[15px] font-semibold leading-none text-sky-800/80 dark:text-sky-200/80"
              >
                ≈
              </span>

              <div className="flex w-[5.75rem] shrink-0 flex-col items-end justify-center gap-1 overflow-hidden">
                <div className="flex h-[12px] w-full items-center justify-end">
                  <VsUsTrend cnyPrice={row.cnyPrice} usCny={usCny} />
                </div>
                <AutoFitPrice
                  text={formatCny(row.cnyPrice)}
                  maxPx={15}
                  minPx={10}
                  className={cn(
                    "text-right font-mono font-semibold tabular-nums",
                    tonePanelPriceClass("sky"),
                  )}
                />
              </div>
            </div>
          </TonePanel>

          <CardMeta>
            <CardUpdatedRow updatedAt={row.status === "stale" ? row.lastSuccessAt ?? row.updatedAt : row.updatedAt} />
          </CardMeta>
        </CardContent>
      </Card>
    </div>
  );
}
