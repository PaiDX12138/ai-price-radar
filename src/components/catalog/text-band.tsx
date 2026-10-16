import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 半高度色带：标题 / 关键文案下半截映衬（列表卡、详情卡共用）。 */
export type TextBandTone = "violet" | "emerald" | "amber" | "sky" | "ink" | "rose";

const BAND: Record<TextBandTone, string> = {
  violet: "bg-violet-200/75 dark:bg-violet-400/25",
  emerald: "bg-emerald-200/80 dark:bg-emerald-400/30",
  amber: "bg-amber-200/80 dark:bg-amber-400/30",
  sky: "bg-sky-200/80 dark:bg-sky-400/30",
  ink: "bg-[color-mix(in_oklab,var(--apr-ink)_28%,transparent)]",
  rose: "bg-rose-200/80 dark:bg-rose-400/30",
};

type TextBandProps = {
  children: ReactNode;
  tone?: TextBandTone;
  className?: string;
  bandClassName?: string;
  title?: string;
};

export function TextBand({
  children,
  tone = "violet",
  className,
  bandClassName,
  title,
}: TextBandProps) {
  return (
    <span className={cn("relative inline-block max-w-full", className)} title={title}>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-[50%] rounded-[2px]",
          BAND[tone],
          bandClassName,
        )}
      />
      <span className="relative">{children}</span>
    </span>
  );
}
