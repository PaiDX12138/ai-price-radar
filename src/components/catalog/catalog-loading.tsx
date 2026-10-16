import { Radar } from "lucide-react";
import { BRAND_NAME_EN } from "@/lib/brand";
import { cn } from "@/lib/utils";

type CatalogLoadingProps = {
  className?: string;
  label?: string;
};

/**
 * 比价页 Suspense 加载态：居中排版，配色对齐 --apr-ink / muted。
 */
export function CatalogLoading({
  className,
  label = "加载中",
}: CatalogLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex min-h-[min(68vh,32rem)] w-full flex-col items-center justify-center px-4",
        className,
      )}
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="apr-load-mark relative flex size-[5.5rem] items-center justify-center">
          <span className="apr-load-mark__ring" aria-hidden />
          <span className="apr-load-mark__ring apr-load-mark__ring--delay" aria-hidden />
          <span className="relative z-10 flex size-12 items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--apr-ink)_28%,var(--border))] bg-[var(--apr-ink-soft)] text-[var(--apr-ink)] shadow-[0_1px_0_color-mix(in_oklab,var(--foreground)_5%,transparent)]">
            <Radar className="size-5" aria-hidden strokeWidth={1.75} />
          </span>
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-[15px] font-semibold tracking-[0.18em] text-foreground">
            {label}
          </p>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            {BRAND_NAME_EN}
          </p>
        </div>

        <div
          className="h-px w-24 overflow-hidden rounded-full bg-border"
          aria-hidden
        >
          <span className="apr-load-bar block h-full w-1/2 rounded-full bg-[var(--apr-ink)]/70" />
        </div>
      </div>
    </div>
  );
}
