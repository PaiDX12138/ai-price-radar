"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "@/lib/utils";

/** Segmented dial with Base UI progress semantics and a typographic numeric center. */
export function CircularProgress({
  value,
  label,
  className,
  indicatorClassName,
}: {
  value: number | null;
  label: string;
  className?: string;
  indicatorClassName?: string;
}) {
  const percent = value === null ? null : Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  const [integer, decimal] = percent === null ? [] : percent.toFixed(1).split(".");
  const segments = 24;
  const filled = (percent ?? 0) / 100 * segments;
  return (
    <ProgressPrimitive.Root
      value={percent}
      aria-label={label}
      getAriaValueText={() => percent === null ? "暂无检测结果" : `${percent.toFixed(1)}%`}
      className={cn("relative aspect-square size-20 shrink-0", className)}
    >
      <svg viewBox="0 0 80 80" className="size-full" fill="none" aria-hidden="true">
        {Array.from({ length: segments }, (_, index) => (
          <g key={index} transform={`rotate(${index * 360 / segments} 40 40)`}>
            <line x1="40" y1="3" x2="40" y2="9.5" stroke="currentColor" strokeWidth="5" strokeLinecap="round"
              className="text-sky-200/80 dark:text-sky-400/20" />
            <line x1="40" y1="3" x2="40" y2="9.5" stroke="currentColor" strokeWidth="5" strokeLinecap="round"
              style={{ opacity: percent === 100 ? 1 : Math.min(1, Math.max(0, (filled - index) / 2.5)) }}
              className={cn("text-sky-500 motion-safe:transition-opacity motion-safe:duration-300", indicatorClassName)} />
          </g>
        ))}
      </svg>
      <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
        <span className="inline-flex items-baseline whitespace-nowrap font-mono leading-none tabular-nums text-foreground">
          {percent === null ? <span className="text-lg">—</span> : <>
            <span className="text-[15px] font-semibold tracking-[-0.075em] @[240px]:text-[23px]">{integer}</span>
            <span className="ml-px text-[10px] font-medium tracking-[-0.06em] text-foreground/65 @[240px]:text-[14px]">.{decimal}</span>
            <span className="ml-0.5 self-start pt-px text-[7px] font-medium text-muted-foreground @[240px]:pt-0.5 @[240px]:text-[9px]">%</span>
          </>}
        </span>
      </div>
    </ProgressPrimitive.Root>
  );
}
