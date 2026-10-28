"use client";

import { BadgePercent } from "lucide-react";
import { ToneChip } from "@/components/catalog/tone-chip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TransitDiscount } from "@/lib/transit/view";

export function discountLabel(ratio: number): string {
  if (ratio === 0) return "免费";
  if (ratio * 10 < 0.1) return "<0.1折";
  const rounded = Number((ratio * 10).toFixed(1));
  return rounded >= 10 ? "<10折" : `${rounded}折`;
}

/** Same compact ToneChip as the cards. Never replace rate with discount or enlarge a row. */
export function TransitDiscountChip({ discount }: { discount?: TransitDiscount | null }) {
  if (!discount || !Number.isFinite(discount.ratio) || discount.ratio < 0 || discount.ratio >= 1) return null;
  const label = discountLabel(discount.ratio);
  const source = discount.source === "calculated" ? "本站测算" : "站方参考";
  const basis = discount.basis === "station_reference" ? "站内模型基准价" : discount.basis === "official_input_price" ? "官方输入价" : "公开参考输入价";
  return <Tooltip>
    <TooltipTrigger type="button" closeOnClick={false} title="" aria-label={`${label}，${source}，${discount.groupKey}`} onClick={event => { event.preventDefault(); event.stopPropagation(); }} className="relative z-20 inline-flex shrink-0 cursor-help rounded outline-none focus-visible:ring-1 focus-visible:ring-ring">
      <ToneChip tone={discount.source === "calculated" ? "sky" : "emerald"} className="h-4 gap-0.5 rounded px-1 text-[9px] leading-none">
        <BadgePercent className="size-2.5 shrink-0" aria-hidden /><span className="tabular-nums">{label}</span>
      </ToneChip>
    </TooltipTrigger>
    <TooltipContent className="max-w-64">
      <div className="mb-1.5 flex items-center justify-between gap-5 font-medium"><span>{source}折扣</span><span className="font-mono tabular-nums">{label}</span></div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11px]"><dt className="text-muted-foreground">分组</dt><dd className="break-all text-right">{discount.groupKey}</dd><dt className="text-muted-foreground">对比基准</dt><dd className="text-right">{basis}</dd></dl>
      <p className="mt-1.5 border-t border-border/60 pt-1.5 text-[10px] text-muted-foreground">{discount.source === "calculated" ? "按基础输入价测算" : "基础计费参考，非官方核价"}；不含峰时及阶梯变化</p>
    </TooltipContent>
  </Tooltip>;
}
