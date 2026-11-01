"use client";

import { BadgePercent } from "lucide-react";
import { ToneChip } from "@/components/catalog/tone-chip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TooltipDetails, type TooltipDetailsData } from "@/components/ui/tooltip-details";
import type { TransitDiscount } from "@/lib/transit/view";
import { formatTransitPriceAmount } from "@/lib/transit/media-price-format";

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
  const baseQuote=discount.currencyBasis==="public_usd_base_not_final_charge";
  const source = discount.source === "calculated" ? "本站测算" : "站方参考";
  const basis = discount.basis === "station_reference" ? "站方模型基准价" : discount.basis === "official_input_price" ? "官方输入价" : "公开参考输入价";
  const rows: TooltipDetailsData["rows"] = [
    { label: "折扣", value: label },
    { label: baseQuote?"报价范围":"分组", value: baseQuote?"公开基础价":discount.groupKey },
    { label: "对比基准", value: basis },
  ];
  if (discount.reference) rows.push({ label: "基准价", value: `${discount.reference.currency === "CNY" ? "¥" : "$"}${formatTransitPriceAmount(discount.reference.price)}/${discount.reference.unit}` });
  if(discount.currencyBasis==="station_usd_credit_nominal_not_cash_payment")rows.push({label:"计算口径",value:"美元额度面值，不含充值差价"});
  if (discount.fxDate && discount.usdToCny) rows.push(
    { label: "美元汇率", value: `1 USD = ¥${discount.usdToCny}` },
    { label: "汇率日期", value: discount.fxDate },
  );
  return <Tooltip>
    <TooltipTrigger type="button" closeOnClick={false} title="" aria-label={`${label}，${source}，${discount.groupKey}`} onClick={event => { event.preventDefault(); event.stopPropagation(); }} className="relative z-20 inline-flex shrink-0 cursor-help rounded outline-none focus-visible:ring-1 focus-visible:ring-ring">
      <ToneChip tone={discount.source === "calculated" ? "sky" : "emerald"} className="h-4 gap-0.5 rounded px-1 text-[9px] leading-none">
        <BadgePercent className="size-2.5 shrink-0" aria-hidden /><span className="tabular-nums">{label}</span>
      </ToneChip>
    </TooltipTrigger>
    <TooltipContent className="w-[min(18rem,calc(100vw-1.5rem))]">
      <TooltipDetails title={baseQuote?"基础价对比":`${source}折扣`} rows={rows}
        note={baseQuote?"仅对比同型号公开基础输入价，不是实际分组或现金实付折扣。":`${discount.source === "calculated" ? discount.metric === "request" ? "按同型号基础按次价测算。" : "按同型号基础输入档测算。" : "站方提供，未经独立核价。"}不含其他档位及个人优惠。`} />
    </TooltipContent>
  </Tooltip>;
}
