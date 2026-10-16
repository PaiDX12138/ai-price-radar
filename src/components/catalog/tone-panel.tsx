import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 色卡底块：墨绿 / 琥珀 / 天蓝软底（价格区、摘要卡共用）。 */
export type TonePanelTone = "ink" | "amber" | "sky" | "violet" | "emerald";

const PANEL: Record<TonePanelTone, string> = {
  ink: "border-[color-mix(in_oklab,var(--apr-ink)_32%,var(--border))] bg-[var(--apr-ink-soft)]",
  amber:
    "border-[color-mix(in_oklab,var(--apr-amber)_32%,var(--border))] bg-[var(--apr-amber-soft)]",
  sky: "border-sky-200/90 bg-sky-50 dark:border-sky-400/25 dark:bg-sky-400/10",
  violet:
    "border-violet-200/90 bg-violet-50 dark:border-violet-400/25 dark:bg-violet-400/10",
  emerald:
    "border-emerald-200/90 bg-emerald-50 dark:border-emerald-400/25 dark:bg-emerald-400/10",
};

const PRICE: Record<TonePanelTone, string> = {
  ink: "text-[var(--apr-ink)]",
  amber: "text-[var(--apr-amber)]",
  sky: "text-sky-950 dark:text-sky-50",
  violet: "text-violet-950 dark:text-violet-50",
  emerald: "text-emerald-950 dark:text-emerald-50",
};

const LABEL: Record<TonePanelTone, string> = {
  ink: "text-[var(--apr-ink)]/70",
  amber: "text-[var(--apr-amber)]/75",
  sky: "text-sky-800 dark:text-sky-300",
  violet: "text-violet-800 dark:text-violet-300",
  emerald: "text-emerald-800 dark:text-emerald-300",
};

type TonePanelProps = {
  children: ReactNode;
  tone?: TonePanelTone;
  className?: string;
};

export function TonePanel({ children, tone = "ink", className }: TonePanelProps) {
  return (
    <div className={cn("relative min-w-0 rounded-lg border px-2.5 py-2", PANEL[tone], className)}>
      {children}
    </div>
  );
}

export function tonePanelPriceClass(tone: TonePanelTone = "ink"): string {
  return PRICE[tone];
}

export function tonePanelLabelClass(tone: TonePanelTone = "ink"): string {
  return LABEL[tone];
}
