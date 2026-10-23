import { CardCornerArrow } from "@/components/catalog/card-corner-arrow";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CardMeta,
  CardMetaRow,
  CardUpdatedRow,
} from "@/components/catalog/card-meta";
import { PlatformLogo, PLATFORM_LABEL } from "@/components/catalog/platform-logo";
import { ProductLogo } from "@/components/catalog/product-logo";
import {
  SOURCE_PLATFORM_LABEL,
  SourcePlatformLogo,
  resolveSourcePlatform,
} from "@/components/catalog/source-platform-logo";
import { formatCny } from "@/lib/catalog/format";
import type { ProductSummary } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";

type ProductCardProps = {
  product: ProductSummary;
  /** 列表页搜索词，带入详情「搜索渠道 / 标题」 */
  q?: string;
};

/** Summary card — title links to detail; shop name is a sibling external link (no nested anchors). */
export function ProductCard({ product, q }: ProductCardProps) {
  const qTrim = q?.trim() || "";
  const href = qTrim
    ? `/products/${product.slug}?q=${encodeURIComponent(qTrim)}`
    : `/products/${product.slug}`;
  const sourcePlatformId = product.lowestSourcePlatform
    ? resolveSourcePlatform(product.lowestSourcePlatform, product.lowestSourceHost ?? undefined)
    : null;
  const sourcePlatformLabel = sourcePlatformId
    ? SOURCE_PLATFORM_LABEL[sourcePlatformId]
    : null;

  return (
    <div className="group h-full rounded-xl outline-none">
      <Card
        size="sm"
        className={cn(
          "relative h-full bg-card shadow-sm ring-1 ring-foreground/10",
          "transition-[box-shadow,transform,ring-color] duration-200",
          "group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:ring-foreground/20"
        )}
      >
        <CardHeader className="gap-2 border-b border-border/80 pb-(--card-spacing)">
          <Link
            href={href}
            aria-label={`查看详情：${product.name}`}
            className={cn(
              "flex min-w-0 items-start gap-2.5 pr-7 rounded-md outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          >
            <ProductLogo slug={product.slug} name={product.name} size={22} />
            <div className="min-w-0 flex-1">
              {/* 名称：下半高淡紫映衬，宽度随文字（勿拉满一行） */}
              <CardTitle className="relative inline-block max-w-full truncate text-[15px] font-semibold leading-snug tracking-tight text-neutral-900">
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[50%] rounded-md bg-violet-200/75 dark:bg-violet-400/25"
                />
                <span className="relative">{product.name}</span>
              </CardTitle>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {/* 类型：淡蓝标签 */}
                <span
                  className={cn(
                    "inline-flex h-5 max-w-[10rem] items-center truncate rounded-md px-1.5",
                    "bg-sky-100 text-[11px] font-medium tracking-tight text-sky-800",
                    "ring-1 ring-sky-200/80 dark:bg-sky-400/15 dark:text-sky-300 dark:ring-sky-400/25"
                  )}
                >
                  {product.deliveryType}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  {product.slug.startsWith("x-twitter-") ? (
                    <>
                      {/* X 订阅档挂 Grok 页，角标用 X logo */}
                      <img
                        src="/brands/x.svg"
                        alt=""
                        width={12}
                        height={12}
                        className="size-3 shrink-0 object-contain"
                        aria-hidden
                      />
                      X
                    </>
                  ) : (
                    <>
                      <PlatformLogo platform={product.platform} size={12} />
                      {PLATFORM_LABEL[product.platform]}
                    </>
                  )}
                </span>
              </div>
            </div>
          </Link>
          <CardCornerArrow className="absolute right-3 top-3" />
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <PriceBlock
              label="无质保最低"
              value={product.nonWarrantyLowestPrice}
              tone="ink"
              inStock={product.nonWarrantyLowestPrice !== null && product.inStockCount > 0}
            />
            <PriceBlock
              label="有质保最低"
              value={product.warrantyLowestPrice}
              tone="amber"
              inStock={product.warrantyLowestPrice !== null && product.inStockCount > 0}
            />
          </div>

          <CardMeta>
            <CardMetaRow label="渠道">
              <span className="block truncate tabular-nums" title={`有货 ${product.inStockCount} / 缺货 ${product.outStockCount} · 共 ${product.channelCount}`}>
                <span className="font-semibold text-[var(--apr-ink)]">
                  有货 {product.inStockCount}
                </span>
                <span className="text-muted-foreground"> / </span>
                <span className="font-semibold text-destructive/80">
                  缺货 {product.outStockCount}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · 共 {product.channelCount}
                </span>
              </span>
            </CardMetaRow>
            <CardMetaRow label="店铺">
              {product.lowestSourceName ? (
                <span
                  className="flex w-full min-w-0 items-center justify-end gap-1.5"
                  title={
                    product.lowestSourceTitle
                      ? `${product.lowestSourceTitle}${product.lowestPrice != null ? ` · ${formatCny(product.lowestPrice)}` : ""}`
                      : undefined
                  }
                >
                  {product.lowestSourceUrl ? (
                    <a
                      href={product.lowestSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 truncate font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      {product.lowestSourceName}
                    </a>
                  ) : (
                    <span className="min-w-0 truncate">{product.lowestSourceName}</span>
                  )}
                  {sourcePlatformLabel && product.lowestSourcePlatform ? (
                    <>
                      <span className="h-3 w-px shrink-0 bg-border" aria-hidden />
                      <span
                        className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground"
                        title="卡网平台"
                      >
                        <SourcePlatformLogo
                          platform={product.lowestSourcePlatform}
                          host={product.lowestSourceHost ?? undefined}
                          size={12}
                          framed={false}
                        />
                        {sourcePlatformLabel}
                      </span>
                    </>
                  ) : null}
                  {product.lowestPrice != null ? (
                    <>
                      <span className="h-3 w-px shrink-0 bg-border" aria-hidden />
                      <span className="shrink-0 font-mono font-semibold tabular-nums text-[var(--apr-ink)]">
                        {formatCny(product.lowestPrice)}
                      </span>
                    </>
                  ) : null}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </CardMetaRow>
            <CardUpdatedRow updatedAt={product.updatedAt} />
          </CardMeta>
        </CardContent>
      </Card>
    </div>
  );
}

function PriceBlock({
  label,
  value,
  tone,
  inStock,
}: {
  label: string;
  value: number | null;
  tone: "ink" | "amber";
  inStock: boolean;
}) {
  const soft =
    tone === "amber"
      ? "border-[color-mix(in_oklab,var(--apr-amber)_28%,var(--border))] bg-[var(--apr-amber-soft)]"
      : "border-[color-mix(in_oklab,var(--apr-ink)_28%,var(--border))] bg-[var(--apr-ink-soft)]";
  const priceClass =
    tone === "amber" ? "text-[var(--apr-amber)]" : "text-[var(--apr-ink)]";
  const hasPrice = value !== null && Number.isFinite(value);
  const showInStock = Boolean(inStock && hasPrice);

  return (
    <div className={cn("relative rounded-lg border px-2.5 py-2 pr-12", soft)}>
      <Badge
        variant={showInStock ? "success" : "secondary"}
        className={cn(
          "absolute right-1.5 top-1.5 h-5 px-1.5 text-[10px] font-medium",
          !showInStock && "text-muted-foreground"
        )}
      >
        {showInStock ? "有货" : "无货"}
      </Badge>
      <div className="text-[10px] font-medium tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 font-mono text-base font-semibold tabular-nums",
          hasPrice ? priceClass : "text-muted-foreground"
        )}
      >
        {hasPrice ? formatCny(value) : "—"}
      </div>
    </div>
  );
}
