"use client";

import type { TransitPrice } from "@/lib/transit/view";
import { TransitDiscountChip } from "@/components/transit/discount-chip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TooltipDetails } from "@/components/ui/tooltip-details";
import { formatTransitMediaPrice, MEDIA_BILLING_LABELS as billingLabels } from "@/lib/transit/media-price-format";

/** Same 128px model area and 25px rows; media never renders token/multiplier columns. */
export function TransitMediaPrices({ prices }: { prices: TransitPrice[] }) {
  return <TooltipProvider delay={120} closeDelay={40}>
    <section aria-label="图片视频站点报价" className="h-[128px] border-b border-border/70 pb-1">
      <table className="w-full table-fixed border-collapse text-[11px]" aria-label="模型及站点公布的额度报价，价格详情可悬浮查看">
        <colgroup><col className="w-[60%]" /><col className="w-[40%]" /></colgroup>
        <thead><tr className="h-5 border-b border-border/60 text-muted-foreground"><th scope="col" className="text-left font-normal">模型</th><th scope="col" className="text-right font-normal" data-tooltip={prices.every(p=>p.mediaPricing?.tokenCurrencyKind === "usd_cash") ? "USD / 百万Token，输入与输出分别计费" : undefined}>{prices.length>0 && prices.every(p=>p.mediaPricing?.tokenCurrencyKind === "usd_cash") ? "输入 / 输出" : "站点报价"}</th></tr></thead>
        <tbody>{prices.map(price => {
          const name = price.modelName ?? price.family;
          const quote = formatTransitMediaPrice(price.mediaPricing, price.fixedPrice, true);
          const exactToken = price.mediaPricing?.tokenCurrencyKind === "usd_cash";
          const unit = exactToken ? "百万Token" : price.mediaPricing?.billing === "per_request" ? "次" : price.category === "image" ? "张" : "次";
          const billing = price.mediaPricing?.billing ?? "variable";
          const token = billing === "token";
          return <tr key={price.id ?? JSON.stringify([name, price.category])} className="h-[25px] border-b border-border/40 last:border-0">
            <th scope="row" className="pr-2 text-left font-medium"><div className="flex min-w-0 items-center gap-1"><span className="min-w-0 line-clamp-2 break-words leading-[12px] [overflow-wrap:anywhere]" data-tooltip={name}>{name}</span><TransitDiscountChip discount={price.discount} /></div></th>
            <td className="text-right font-mono font-medium tracking-tighter tabular-nums text-[var(--apr-ink)]">
              <Tooltip>
                <TooltipTrigger type="button" closeOnClick={false} title="" aria-label={`${name}，站点报价 ${quote}${quote === "未披露" ? "" : `每${unit}`}，${billingLabels[billing]}`} onClick={event => { event.preventDefault(); event.stopPropagation(); }} className="relative z-20 inline-flex max-w-full cursor-help items-baseline justify-end gap-0.5 whitespace-nowrap rounded outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <span className="min-w-0 truncate">{quote}</span>{quote !== "未披露" && !exactToken && <span className="shrink-0 font-sans text-[10px] font-normal tracking-normal text-muted-foreground">/{unit}</span>}
                </TooltipTrigger>
                <TooltipContent className="w-[min(19rem,calc(100vw-1.5rem))]">
                  <TooltipDetails title="站点报价" subtitle={name} rows={[
                    { label: "单价", value: `${formatTransitMediaPrice(price.mediaPricing, price.fixedPrice)}${quote === "未披露" || exactToken ? "" : `/${unit}`}` },
                    { label: "计费", value: billingLabels[billing] },
                    { label: "分组", value: price.mediaPricing?.groupKey ?? "未披露" },
                  ]} note={exactToken ? "USD / 百万Token，已含折扣；站点未提供固定单张价。" : `${token ? "输出参考价，输入另计。" : price.category === "video" ? "依时长、分辨率计费。" : billing === "upstream_cost" ? "按上游账单结算。" : billing === "per_request" ? "按次计费。" : "依质量、尺寸计费。"}$ 为站内额度，不含峰时变化。`} />
                </TooltipContent>
              </Tooltip>
            </td>
          </tr>;
        })}</tbody>
      </table>
    </section>
  </TooltipProvider>;
}
