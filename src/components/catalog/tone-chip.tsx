import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { tooltipDetails, type TooltipDetailsData } from "@/components/ui/tooltip-details";

/** 轻量色标 / 色卡 pill（非圆角大胶囊）。 */
export type ToneChipTone =
  | "sky"
  | "emerald"
  | "amber"
  | "violet"
  | "ink"
  | "rose"
  | "muted";

const CHIP: Record<ToneChipTone, string> = {
  sky: "bg-sky-100 text-sky-800 ring-sky-200/80 dark:bg-sky-400/15 dark:text-sky-300 dark:ring-sky-400/25",
  emerald:
    "bg-emerald-100 text-emerald-800 ring-emerald-200/80 dark:bg-emerald-400/15 dark:text-emerald-300 dark:ring-emerald-400/25",
  amber:
    "bg-amber-100 text-amber-900 ring-amber-200/80 dark:bg-amber-400/15 dark:text-amber-300 dark:ring-amber-400/25",
  violet:
    "bg-violet-100 text-violet-900 ring-violet-200/80 dark:bg-violet-400/15 dark:text-violet-300 dark:ring-violet-400/25",
  ink: "bg-[var(--apr-ink-soft)] text-[var(--apr-ink)] ring-[color-mix(in_oklab,var(--apr-ink)_18%,transparent)]",
  rose: "bg-rose-100 text-rose-800 ring-rose-200/80 dark:bg-rose-400/15 dark:text-rose-300 dark:ring-rose-400/25",
  muted:
    "bg-muted text-muted-foreground ring-border/80 dark:bg-muted/60 dark:ring-border/60",
};

type ToneChipProps = {
  children: ReactNode;
  tone?: ToneChipTone;
  className?: string;
  tooltip?: string | TooltipDetailsData;
  "aria-label"?: string;
};

export function ToneChip({
  children,
  tone = "muted",
  className,
  tooltip,
  "aria-label": ariaLabel,
}: ToneChipProps) {
  return (
    <span
      {...(typeof tooltip === "string" ? {"data-tooltip":tooltip} : tooltip ? tooltipDetails(tooltip) : {})}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-5 max-w-full items-center gap-1 truncate rounded-md px-1.5",
        "text-[11px] font-medium tracking-tight ring-1",
        CHIP[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
