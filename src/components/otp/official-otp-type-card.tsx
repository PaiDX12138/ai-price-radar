import { CardCornerArrow } from "@/components/catalog/card-corner-arrow";
import Link from "next/link";
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
  tonePanelLabelClass,
  tonePanelPriceClass,
} from "@/components/catalog/tone-panel";
import { PlatformLogo } from "@/components/catalog/platform-logo";
import { ProductLogo } from "@/components/catalog/product-logo";
import { OtpPlatformLogo } from "@/components/otp/otp-platform-logo";
import { formatCny } from "@/lib/catalog/format";
import type { PlatformTabId } from "@/lib/catalog/types";
import { formatUsdPrice } from "@/lib/otp/format";
import { cn } from "@/lib/utils";

export type OtpQuoteView = {
  platformId: string;
  platformName: string;
  priceText: string | null;
  usdPrice: number | null;
  cnyPrice: number | null;
  fxUsdToCny: number | null;
  fxDate: string | null;
};

export type OtpTypeCardView = {
  detailId: string;
  label: string;
  catalogSlug: string;
  tags: string[];
  lowest: OtpQuoteView | null;
  platformCount: number;
  quoteCount: number;
  updatedAt: string | null;
  fxUsdToCny: number;
  fxDate: string | null;
};

type OfficialOtpTypeCardProps = {
  product: OtpTypeCardView;
  tab: Extract<PlatformTabId, "email" | "sms">;
  badge: string;
  tabLabel: string;
};

export function OfficialOtpTypeCard({
  product,
  tab,
  badge,
  tabLabel,
}: OfficialOtpTypeCardProps) {
  const href = `/official/${product.detailId}`;

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
            aria-label={`查看平台价：${product.label}`}
            className={cn(
              "flex min-w-0 items-start gap-2.5 pr-7 rounded-md outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            <ProductLogo slug={product.catalogSlug} name={product.label} size={22} />
            <div className="min-w-0 flex-1">
              <CardTitle className="max-w-full truncate text-[15px] font-semibold leading-snug tracking-tight text-neutral-900">
                <TextBand>{product.label}</TextBand>
              </CardTitle>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <ToneChip tone="emerald">{badge}</ToneChip>
                {product.tags.slice(0, 2).map((tag) => (
                  <ToneChip key={tag} tone="sky">
                    {tag}
                  </ToneChip>
                ))}
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <PlatformLogo platform={tab} size={12} />
                  {tabLabel}
                </span>
              </div>
            </div>
          </Link>
          <CardCornerArrow className="absolute right-3 top-3" />
        </CardHeader>

        <CardContent className="space-y-2">
          <LowestPlatformBlock quote={product.lowest} />
          <CardMeta>
            <CardMetaRow label="平台">
              <span
                className="block truncate tabular-nums"
                data-tooltip={`${product.platformCount} 个平台 · ${product.quoteCount} 条报价`}
              >
                <span className="font-semibold text-[var(--apr-ink)]">
                  {product.platformCount} 平台
                </span>
                <span className="text-muted-foreground"> · {product.quoteCount} 报价</span>
              </span>
            </CardMetaRow>
            <CardUpdatedRow updatedAt={product.updatedAt} />
          </CardMeta>
        </CardContent>
      </Card>
    </div>
  );
}

function LowestPlatformBlock({ quote }: { quote: OtpQuoteView | null }) {
  return (
    <TonePanel tone="sky" className="py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex min-w-0 items-center gap-1.5 text-[11px] font-medium",
            tonePanelLabelClass("sky"),
          )}
        >
          {quote ? (
            <>
              <OtpPlatformLogo
                platformId={quote.platformId}
                name={quote.platformName}
                size={14}
              />
              <span className="truncate">{quote.platformName}</span>
            </>
          ) : (
            <span>暂无报价</span>
          )}
        </span>
        <span className="shrink-0 text-[10px] font-semibold tracking-[0.04em] text-sky-800/70 dark:text-sky-300/70">
          最低
        </span>
      </div>

      <div className={cn("mt-1.5 min-w-0", tonePanelPriceClass("sky"))}>
        {quote?.usdPrice != null && quote.cnyPrice != null ? (
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span className="font-mono text-[17px] font-semibold leading-none tabular-nums">
              {quote.priceText ?? formatUsdPrice(quote.usdPrice)}
            </span>
            <span className="text-[12px] text-sky-800/75 dark:text-sky-200/80">≈</span>
            <span className="font-mono text-[15px] font-semibold tabular-nums">
              {formatCny(quote.cnyPrice)}
            </span>
          </div>
        ) : (
          <span className="font-mono text-[17px] font-semibold text-sky-800/40 dark:text-sky-200/40">
            —
          </span>
        )}
      </div>
    </TonePanel>
  );
}
