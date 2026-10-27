import { CardCornerArrow } from "@/components/catalog/card-corner-arrow";
import Link from "next/link";
import { Tags } from "lucide-react";
import { VsUsTrend } from "@/components/official/vs-us-trend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CardMeta,
  CardMetaRow,
  CardUpdatedRow,
} from "@/components/catalog/card-meta";
import { TextBand } from "@/components/catalog/text-band";
import { ToneChip } from "@/components/catalog/tone-chip";
import {
  TonePanel,
  tonePanelPriceClass,
} from "@/components/catalog/tone-panel";
import { CountryFlag } from "@/components/official/country-flag";
import { PayChannel } from "@/components/official/pay-channel";
import { PlatformLogo, PLATFORM_LABEL } from "@/components/catalog/platform-logo";
import { ProductLogo } from "@/components/catalog/product-logo";
import { formatCny } from "@/lib/catalog/format";
import { displayCountryLabel } from "@/lib/official/country-display";
import { taxBandLabel, taxNote } from "@/lib/official/currency";
import type { OfficialPlanSummary, OfficialProductCard } from "@/lib/official/types";
import type { PlatformTabId } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";

type OfficialPlanCardProps = {
  product: OfficialProductCard;
};

export function OfficialPlanCard({ product }: OfficialPlanCardProps) {
  const href = `/official/${product.detailId}`;
  const platform = (product.catalogPlatform || product.appSlug) as PlatformTabId;

  return (
    <div className="group h-full rounded-xl outline-none">
      <Card
        size="sm"
        className={cn(
          "relative h-full bg-card shadow-sm ring-1 ring-foreground/10",
          "transition-[box-shadow,transform,ring-color] duration-200",
          "group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:ring-foreground/20",
        )}
      >
        <CardHeader className="gap-2 border-b border-border/80 pb-(--card-spacing)">
          <Link
            href={href}
            aria-label={`查看地区价：${product.label}`}
            className={cn(
              "flex min-w-0 items-start gap-2.5 pr-7 rounded-md outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            <ProductLogo
              slug={product.catalogSlug || product.appSlug}
              name={product.label}
              size={22}
            />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5 pr-1">
                <CardTitle className="min-w-0 truncate text-[15px] font-semibold leading-snug tracking-tight text-neutral-900">
                  <TextBand>{product.label}</TextBand>
                </CardTitle>
                {product.promo ? (
                  <ToneChip tone="emerald" title={product.promo.label} className="shrink-0 font-semibold tabular-nums">
                    <Tags className="size-3" strokeWidth={2.25} aria-hidden />
                    {formatPromoPercent(product.promo.percent)}
                  </ToneChip>
                ) : null}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <ToneChip tone="sky">月付/年付</ToneChip>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <PlatformLogo platform={platform} size={12} />
                  {PLATFORM_LABEL[platform] ?? product.appName}
                </span>
              </div>
            </div>
          </Link>
          <CardCornerArrow className="absolute right-3 top-3" />
        </CardHeader>

        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <BillingBlock label="Month" plan={product.monthly} tone="ink" />
            <BillingBlock label="Year" plan={product.annual} tone="amber" />
          </div>
          <UsReference monthly={product.monthly} annual={product.annual} />
          <CardMeta>
            <CardMetaRow label="覆盖">
              <span
                className="block truncate tabular-nums"
                title={`${product.sampleCount} 个地区 · ${product.quoteCount} 条数据`}
              >
                <span className="font-semibold text-[var(--apr-ink)]">
                  {product.sampleCount} 地区
                </span>
                <span className="text-muted-foreground"> · {product.quoteCount} 数据</span>
              </span>
            </CardMetaRow>
            <CardUpdatedRow updatedAt={product.updatedAt} />
          </CardMeta>
        </CardContent>
      </Card>
    </div>
  );
}

function BillingBlock({
  label,
  plan,
  tone,
}: {
  label: string;
  plan: OfficialPlanSummary | null;
  tone: "ink" | "amber";
}) {
  return (
    <TonePanel tone={tone}>
      <div className="flex min-w-0 flex-nowrap items-center justify-between gap-0.5">
        <span className="inline-flex min-w-0 flex-nowrap items-center gap-1">
          <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold tracking-[0.04em] text-muted-foreground">
            {label}
          </span>
          {plan ? <TaxBand plan={plan} /> : null}
        </span>
        {plan ? <TrendChip plan={plan} /> : null}
      </div>
      <div
        className={cn(
          "mt-1 truncate font-mono text-[17px] font-semibold leading-none tabular-nums",
          plan ? tonePanelPriceClass(tone) : "text-muted-foreground/50",
        )}
      >
        {plan ? formatCny(plan.lowest.cnyPrice) : "—"}
      </div>
      <div className="mt-1.5 flex h-4 min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
        {plan ? (
          <>
            <CountryFlag
              countryCode={plan.lowest.countryCode}
              countryLabel={displayCountryLabel(
                plan.lowest.countryCode,
                plan.lowest.countryLabel,
              )}
              size={12}
            />
            <span className="min-w-0 truncate">
              {displayCountryLabel(
                plan.lowest.countryCode,
                plan.lowest.countryLabel,
              )}
            </span>
            <PayChannel channel={plan.lowest.channel} divider />
          </>
        ) : (
          <span>—</span>
        )}
      </div>
    </TonePanel>
  );
}

/** 官网定价统一标「不含税」。 */
function TaxBand({ plan }: { plan: OfficialPlanSummary }) {
  return (
    <TextBand
      tone="amber"
      className="shrink-0 whitespace-nowrap text-[10px] font-semibold tracking-[0.04em] text-foreground"
      title={taxNote(plan.lowest)}
    >
      {taxBandLabel(plan.lowest)}
    </TextBand>
  );
}

/** Lowest regional price vs US list: stock-style arrow + percent. */
function TrendChip({ plan }: { plan: OfficialPlanSummary }) {
  if (plan.usCny == null || !Number.isFinite(plan.usCny) || plan.usCny <= 0) return null;
  return (
    <VsUsTrend
      cnyPrice={plan.lowest.cnyPrice}
      usCny={plan.usCny}
      className="shrink-0 whitespace-nowrap"
    />
  );
}

/**
 * 美区参考：永远固定两行（月付 / 年付），缺的那行显示 —，
 * 这样有无年付的卡片高度一致，下方信息框也对齐。
 */
function UsReference({
  monthly,
  annual,
}: {
  monthly: OfficialPlanSummary | null;
  annual: OfficialPlanSummary | null;
}) {
  const lines = [
    { key: "m", unit: "/month", plan: monthly },
    { key: "y", unit: "/year", plan: annual },
  ];

  return (
    <TonePanel tone="sky" className="flex items-center justify-between gap-2">
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-sky-800 dark:text-sky-300">
        <CountryFlag countryCode="US" countryLabel="美国" size={12} />
        美区参考
      </span>
      <div className="min-w-0 text-right">
        {lines.map(({ key, unit, plan }) => (
          <div
            key={key}
            className="h-[18px] truncate text-[12px] leading-[18px] tabular-nums text-sky-950 dark:text-sky-50"
          >
            {plan && plan.usCny != null ? (
              <>
                <span className="font-mono font-semibold">
                  {plan.usPriceText ?? formatUsd(plan.usListUsd)}
                </span>
                <span className="text-sky-800/75 dark:text-sky-200/80">{unit} ≈ </span>
                <span className="font-mono font-semibold">{formatCny(plan.usCny)}</span>
              </>
            ) : (
              <span className="text-sky-800/40 dark:text-sky-200/40">—</span>
            )}
          </div>
        ))}
      </div>
    </TonePanel>
  );
}

function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value % 1 === 0 ? value : value.toFixed(2)}`;
}

function formatPromoPercent(percent: number): string {
  const n = Number.isInteger(percent) ? String(percent) : percent.toFixed(1);
  return `-${n}%`;
}
