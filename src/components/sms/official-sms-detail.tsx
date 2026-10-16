import Link from "next/link";
import { ArrowLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { EmailPlatformTable } from "@/components/email/email-platform-table";
import { ProductLogo } from "@/components/catalog/product-logo";
import { OtpPlatformLogo } from "@/components/otp/otp-platform-logo";
import { formatCny } from "@/lib/catalog/format";
import { formatUsdPrice } from "@/lib/otp/format";
import type { SmsPlatformQuote, SmsTypeCard } from "@/lib/sms-platforms/types";
import { cn } from "@/lib/utils";

type OfficialSmsDetailProps = {
  card: SmsTypeCard;
  quotes: SmsPlatformQuote[];
  fxUsdToCny: number;
  fxNote: string;
};

export function OfficialSmsDetail({
  card,
  quotes,
  fxUsdToCny,
  fxNote,
}: OfficialSmsDetailProps) {
  const lowest = card.lowest;

  return (
    <div className="mx-auto w-full max-w-[var(--apr-content-max)] space-y-6 px-4 pb-10 pt-4 lg:px-6">
      <nav
        aria-label="面包屑"
        className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Link
          href="/official?platform=sms"
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
          href="/official?platform=sms"
          className="hover:text-foreground underline-offset-2 hover:underline"
        >
          接码
        </Link>
        <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden />
        <span className="min-w-0 max-w-[min(100%,28rem)] truncate font-medium text-foreground">
          {card.label}
        </span>
      </nav>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <ProductLogo slug={card.catalogSlug} name={card.label} size={28} />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-[1.75rem]">
                {card.label}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{card.summary}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">短信按次</Badge>
            {card.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <div className="w-full max-w-sm rounded-lg border border-sky-200/90 bg-sky-50 px-3 py-2.5 dark:border-sky-400/25 dark:bg-sky-400/10 sm:shrink-0">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-sky-800 dark:text-sky-300">
              {lowest ? (
                <>
                  <OtpPlatformLogo
                    platformId={lowest.platformId}
                    name={lowest.platformName}
                    size={14}
                  />
                  <span className="truncate">{lowest.platformName}</span>
                </>
              ) : (
                "暂无报价"
              )}
            </span>
            <span className="text-[10px] font-semibold text-sky-800/70">最低</span>
          </div>
          <div className="mt-1.5 font-mono text-sky-950 dark:text-sky-50">
            {lowest?.usdPrice != null ? (
              <>
                <span className="text-xl font-semibold tabular-nums">
                  {lowest.priceText ?? formatUsdPrice(lowest.usdPrice)}
                </span>
                <span className="mx-1 text-sm text-sky-800/75">≈</span>
                <span className="text-base font-semibold tabular-nums">
                  {lowest.cnyPrice != null ? formatCny(lowest.cnyPrice) : "—"}
                </span>
              </>
            ) : (
              "—"
            )}
          </div>
          <div className="mt-1 text-[10px] text-sky-800/65">
            {card.platformCount} 平台 · 1 USD = {fxUsdToCny} CNY
          </div>
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold tracking-tight">平台报价</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              比接码平台公开起价，非国家订阅价。美元价按官网日更汇率折算：1 USD ={" "}
              {fxUsdToCny} CNY
              {fxNote ? `（${fxNote}）` : ""}。各国库存价浮动大，表内为公开最低/from。
            </p>
          </div>
          {lowest?.sourceUrl ? (
            <a
              href={lowest.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-1.5",
              )}
            >
              打开最低价平台
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
        <EmailPlatformTable
          rows={quotes}
          lowestPlatformId={lowest?.platformId ?? null}
        />
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground">
        价格来自各接码平台公开价目或 guest API，随国家/运营商浮动；本站不代售、不担保到码率。卡密店成品接码请回行情页对照。
      </p>
    </div>
  );
}
