"use client";

import { CardCornerArrow } from "@/components/catalog/card-corner-arrow";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SOURCE_PLATFORM_LABEL,
  SourcePlatformLogo,
  resolveSourcePlatform,
} from "@/components/catalog/source-platform-logo";
import {
  formatCardTime,
  formatCny,
  formatListedAgo,
  formatRelativeTime,
  isOfferStale,
  isOfferLive,
  resolveOfferStockLabel,
  statusBadge,
} from "@/lib/catalog/format";
import { offerPassedKyc } from "@/lib/catalog/kyc";
import { isSelfBuiltCardShop } from "@/lib/catalog/self-built";
import type { OfferWithSource } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";

type OfferCardProps = {
  offer: OfferWithSource;
  /** Kept for call-site compat; delivery type is not shown on the card. */
  deliveryType?: string;
};

/** Tags that are collector/internal — never show to end users. */
const HIDDEN_TAG_RE =
  /^(shopapi|shop[\s_-]?api|kami|dujiao|card|publicproductsapi|getgptapi|ikunloveapi|xiaoheiwan|collector|api|raw|fixture)$/i;

/** Warranty / delivery / KYC noise already shown elsewhere. */
const REDUNDANT_TAG_RE =
  /^(有质保|无质保|质保|过kyc|已过kyc|成品账号|周边辅助|周边服务|辅助服务|订阅\/会员|中转服务)$/i;

function visibleProductTags(tags: string[]): string[] {
  return tags
    .filter((t) => {
      const s = t.trim();
      return s && !HIDDEN_TAG_RE.test(s) && !REDUNDANT_TAG_RE.test(s);
    })
    .slice(0, 3);
}

/** Shared channel offer card — all platforms. */
export function OfferCard({ offer }: OfferCardProps) {
  const live = isOfferLive(offer);
  const badge = live ? statusBadge(offer.status) : { label: "待核验", className: "" };
  const inStock = live && offer.status !== "out_of_stock";
  const passedKyc = offerPassedKyc(offer);
  const selfBuilt = isSelfBuiltCardShop({
    platform: offer.source.platform,
    host: offer.source.host,
    collectorKind: offer.source.collectorKind,
  });
  const productTags = visibleProductTags(offer.tags);
  const platformId = resolveSourcePlatform(offer.source.platform, offer.source.host);
  const platformLabel = SOURCE_PLATFORM_LABEL[platformId];
  const listedAgo = formatListedAgo(offer.source.listedAt);
  const updatedAgo = formatListedAgo(offer.capturedAt);
  const priceColor = !inStock
    ? undefined
    : offer.warranty
      ? "var(--apr-price-warranty)"
      : "var(--apr-price)";

  return (
    <div className="group relative flex h-full w-full min-w-0 flex-1">
      <a
        href={offer.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "absolute inset-0 z-10 rounded-xl outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
        aria-label={`打开原站 ${offer.source.name}`}
      />
      <Card
        size="sm"
        className={cn(
          // 取消 Card 默认竖向 gap，避免色带与底栏之间被撑开；色带/底栏均为贴边兄弟块
          "relative flex w-full min-w-0 flex-1 flex-col gap-0 bg-card py-0 pb-0 shadow-sm ring-1 ring-foreground/10",
          "transition-[box-shadow,transform,ring-color] duration-200",
          "group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:ring-foreground/20"
        )}
      >
        {/* 顶行：店名 / 质保 / 自建；右上角外链图标（整卡可点） */}
        <CardHeader className="gap-0 rounded-none border-0 px-(--card-spacing) pt-(--card-spacing) pr-11 pb-2.5">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <SourcePlatformLogo
                platform={offer.source.platform}
                host={offer.source.host}
                size={36}
                framed={false}
                className="shrink-0"
              />
              <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                <CardTitle className="relative inline-block min-w-0 max-w-full truncate text-sm font-semibold tracking-tight text-foreground">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-[50%] rounded-md bg-violet-200/75 dark:bg-violet-400/25"
                  />
                  <span className="relative">{offer.source.name}</span>
                </CardTitle>
                {offer.warranty ? (
                  <Badge
                    variant="outline"
                    className="h-5 shrink-0 border-emerald-800/25 bg-emerald-800/10 px-1.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-400"
                  >
                    有质保
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="h-5 shrink-0 border-amber-700/25 bg-amber-500/12 px-1.5 text-[11px] font-medium text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/12 dark:text-amber-300"
                  >
                    无质保
                  </Badge>
                )}
                {passedKyc ? (
                  <Badge
                    variant="outline"
                    className="h-5 shrink-0 border-violet-700/30 bg-violet-600/12 px-1.5 text-[11px] font-medium text-violet-800 dark:border-violet-400/35 dark:bg-violet-400/15 dark:text-violet-300"
                  >
                    过Kyc
                  </Badge>
                ) : null}
                {!live || isOfferStale(offer) ? (
                  <Badge
                    variant="outline"
                    title={
                      offer.source.collectStatus === "failed"
                        ? "最近一次采集失败，显示的是上次成功采到的数据"
                        : offer.lifecycle === "pending" ? "商品待复核，旧报价不代表实时有货" : "超过 2 小时未确认，不参与实时最低价"
                    }
                    className="h-5 shrink-0 px-1.5 text-[11px] font-medium text-muted-foreground"
                  >
                    {offer.lifecycle === "pending" ? "待核验" : "待更新"}
                  </Badge>
                ) : null}
              </div>
            </div>
            {selfBuilt ? (
              <span
                title="商家自建卡网（非联动/云猫/QXVX 平台店）"
                className="relative inline-block shrink-0 text-[11px] font-medium tracking-tight text-foreground"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[50%] rounded-md bg-orange-400/70 dark:bg-orange-500/45"
                />
                <span className="relative">自建卡网</span>
              </span>
            ) : null}
          </div>
          <CardCornerArrow className="absolute right-3 top-3" />
        </CardHeader>

      {/* 标题区可伸缩：多余空白留在标题与标签之间，标签始终贴分割线上方 */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* padding 放在外层：避免与 -webkit-line-clamp 同元素时行高取整露出半行 */}
        <div className="bg-[#f0f5fb] px-(--card-spacing) py-2.5">
          <p
            className="min-w-0 overflow-hidden break-words text-[15px] leading-5 font-medium text-neutral-900"
            style={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 3,
            }}
            title={offer.sourceTitle}
          >
            {offer.sourceTitle}
          </p>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 border-b border-border/80 px-(--card-spacing) pt-1 pb-1.5">
          <span
            className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground"
            title="卡网平台"
          >
            <SourcePlatformLogo
              platform={offer.source.platform}
              host={offer.source.host}
              size={12}
              framed={false}
            />
            <span className="shrink-0">{platformLabel}</span>
          </span>
          {listedAgo ? (
            <>
              <span className="h-3 w-px shrink-0 bg-border" aria-hidden />
              <span
                className="relative inline-block shrink-0 tracking-tight text-neutral-900"
                title={
                  offer.source.listedAt
                    ? `收录于 ${formatRelativeTime(offer.source.listedAt)}`
                    : undefined
                }
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[50%] rounded-md bg-emerald-200/80 dark:bg-emerald-400/30"
                />
                <span className="relative">收录于{listedAgo}</span>
              </span>
            </>
          ) : null}
          {productTags.length > 0 ? (
            <span className="h-3 w-px shrink-0 bg-border" aria-hidden />
          ) : null}
          {productTags.map((tag) => (
            <span
              key={tag}
              title={`商品类型：${tag}`}
              className={cn(
                "inline-flex h-5 max-w-[10rem] items-center truncate rounded-md px-1.5",
                "bg-[var(--apr-ink-soft)] text-[11px] font-medium tracking-tight text-[var(--apr-ink)]",
                "ring-1 ring-[color-mix(in_oklab,var(--apr-ink)_18%,transparent)]"
              )}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* 底栏：价格 | 库存（全宽贴边） */}
      <CardContent className="mt-auto shrink-0 space-y-2 bg-[#f0f5fb] pt-2.5 pb-(--card-spacing)">
        <div className="flex items-baseline gap-3">
          <div className="min-w-0 flex-[1.25]">
            <div
              className={cn(
                "font-mono text-xl font-semibold tabular-nums tracking-tight",
                !inStock && "text-muted-foreground line-through"
              )}
              style={priceColor ? { color: priceColor } : undefined}
            >
              {formatCny(offer.price)}
            </div>
            {platformId !== "shop16688" &&
            offer.listedPrice != null &&
            offer.listedPrice !== offer.price ? (
              <div className="text-[11px] text-muted-foreground">
                标价 {formatCny(offer.listedPrice)}
              </div>
            ) : null}
          </div>
          <span
            className="h-7 w-px shrink-0 self-center bg-border"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            {(() => {
              const qual = resolveOfferStockLabel(offer);
              const isManual = qual === "人工发货";
              return (
            <div
              className={cn(
                "font-mono text-xl font-semibold tabular-nums tracking-tight",
                !inStock
                  ? "text-muted-foreground"
                  : isManual
                    ? "text-amber-700 dark:text-amber-400"
                  : offer.status === "low_stock"
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-emerald-800 dark:text-emerald-400"
              )}
            >
              {live && offer.stockCount !== null && offer.stockCount !== undefined ? (
                <>
                  <span>{offer.stockCount}</span>
                  <span className="ml-1.5 text-sm font-medium">{badge.label}</span>
                </>
              ) : live && qual ? (
                // 无计件：库存一般 / 库存非常多；16688 人工发货 → 琥珀色「人工发货」
                <span className="text-sm font-medium">{qual}</span>
              ) : (
                <>
                  {/* 有货未计件且无文案：只显示状态，避免像漏数 */}
                  <span className="text-sm font-medium">{badge.label}</span>
                </>
              )}
            </div>
              );
            })()}
          </div>
        </div>
        <div className="text-xs tabular-nums text-[var(--apr-amber)]">
          上次更新 · {formatCardTime(offer.capturedAt)}
          {updatedAgo ? ` · ${updatedAgo}` : null}
        </div>
      </CardContent>
      </Card>
    </div>
  );
}
