import Link from "next/link";
import type { OfficialBillingPeriod } from "@/lib/official/types";
import { cn } from "@/lib/utils";

type OfficialBillingPeriodSwitchProps = {
  active: OfficialBillingPeriod;
  monthlyPlanId: string | null;
  annualPlanId: string | null;
  /** 切换套餐时保留渠道 / 搜索 */
  channel?: string | null;
  q?: string;
  className?: string;
};

function planHref(
  planId: string,
  channel?: string | null,
  q?: string,
): string {
  const base = `/official/${encodeURIComponent(planId)}`;
  const params = new URLSearchParams();
  if (channel) params.set("channel", channel);
  if (q?.trim()) params.set("q", q.trim());
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * 月付 / 年付分段切换（默认月付选中态由当前套餐决定）。
 */
export function OfficialBillingPeriodSwitch({
  active,
  monthlyPlanId,
  annualPlanId,
  channel = null,
  q = "",
  className,
}: OfficialBillingPeriodSwitchProps) {
  const items: Array<{
    period: OfficialBillingPeriod;
    label: string;
    planId: string | null;
  }> = [
    { period: "monthly", label: "月付", planId: monthlyPlanId },
    { period: "annual", label: "年付", planId: annualPlanId },
  ];

  return (
    <div
      role="tablist"
      aria-label="计费周期"
      className={cn(
        "inline-flex h-8 shrink-0 items-center rounded-lg bg-muted/80 p-[3px] text-muted-foreground",
        className,
      )}
    >
      {items.map((item) => {
        const selected = active === item.period;
        const disabled = !item.planId;
        const classNameBtn = cn(
          "inline-flex h-full items-center justify-center rounded-md px-2.5 text-xs font-medium transition-all",
          selected
            ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/10"
            : "hover:text-foreground",
          disabled && "pointer-events-none opacity-40",
        );
        if (disabled || !item.planId) {
          return (
            <span
              key={item.period}
              role="tab"
              aria-selected={selected}
              aria-disabled
              className={classNameBtn}
            >
              {item.label}
            </span>
          );
        }
        return (
          <Link
            key={item.period}
            href={planHref(item.planId, channel, q)}
            scroll={false}
            role="tab"
            aria-selected={selected}
            className={classNameBtn}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
