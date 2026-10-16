import { Store } from "lucide-react";
import { cn } from "@/lib/utils";

type ShopIndexedCardProps = {
  count: number;
  className?: string;
};

/** 首页标题行：已收录店铺数量，样式对齐收录申请入口卡片。 */
export function ShopIndexedCard({ count, className }: ShopIndexedCardProps) {
  const label = Number.isFinite(count)
    ? Math.max(0, Math.trunc(count)).toLocaleString("zh-CN")
    : "0";

  return (
    <div
      className={cn(
        "relative flex max-w-[18rem] items-center gap-2 rounded-lg border border-border/80",
        "bg-card px-2.5 py-1.5 text-left shadow-[0_1px_0_color-mix(in_oklab,var(--foreground)_4%,transparent)]",
        className,
      )}
    >
      <span
        className="absolute left-0 top-1/2 h-[52%] w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--apr-ink)]/80"
        aria-hidden
      />
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--apr-ink-soft)] text-[var(--apr-ink)]">
        <Store className="size-3.5" aria-hidden strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1 leading-none">
        <span className="block text-[11px] leading-none text-muted-foreground">
          店铺收录
        </span>
        <span className="mt-1 block text-[13px] font-semibold leading-snug tracking-[-0.02em] text-foreground sm:text-sm">
          本站已经收录{" "}
          <span className="relative inline-block">
            <span
              className="absolute inset-x-[-2px] bottom-[0.08em] z-0 h-[0.42em] rounded-[1px] bg-[color-mix(in_oklab,var(--apr-ink)_22%,transparent)]"
              aria-hidden
            />
            <span className="relative z-10 tabular-nums">{label}</span>
          </span>{" "}
          个店铺了
        </span>
      </span>
    </div>
  );
}
