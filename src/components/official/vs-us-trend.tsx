import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type VsUsTrendProps = {
  cnyPrice: number;
  usCny?: number | null;
  className?: string;
};

/** 相对美区折算价的涨跌百分比（绿跌红涨）。 */
export function VsUsTrend({ cnyPrice, usCny = null, className }: VsUsTrendProps) {
  if (usCny == null || !Number.isFinite(usCny) || usCny <= 0) {
    return <span className={cn("block h-[12px]", className)} aria-hidden />;
  }
  const pct = ((cnyPrice - usCny) / usCny) * 100;
  const Icon = pct < 0 ? TrendingDown : pct > 0 ? TrendingUp : Minus;
  return (
    <span
      title="相对美区"
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-semibold leading-none tabular-nums",
        pct < 0
          ? "text-emerald-600 dark:text-emerald-400"
          : pct > 0
            ? "text-rose-600 dark:text-rose-400"
            : "text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3" strokeWidth={2.5} aria-hidden />
      {Math.abs(pct).toFixed(2)}%
    </span>
  );
}
