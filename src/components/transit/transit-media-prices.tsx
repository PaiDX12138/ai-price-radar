"use client";

import type { TransitPrice } from "@/lib/transit/view";
import { TransitDiscountChip } from "@/components/transit/discount-chip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatTransitMediaPrice, MEDIA_BILLING_LABELS as billingLabels } from "@/lib/transit/media-price-format";

/** Same 128px model area and 25px rows; media never renders token/multiplier columns. */
export function TransitMediaPrices({ prices }: { prices: TransitPrice[] }) {
  return <TooltipProvider delay={120} closeDelay={40}>
    <section aria-label="图片视频站点报价" className="h-[128px] border-b border-border/70 pb-1">
      <table className="w-full table-fixed border-collapse text-[11px]" aria-label="模型及站点公布的额度报价，价格详情可悬浮查看">
        <colgroup><col className="w-[60%]" /><col className="w-[40%]" /></colgroup>
        <thead><tr className="h-5 border-b border-border/60 text-muted-foreground"><th scope="col" className="text-left font-normal">模型</th><th scope="col" className="text-right font-normal">站点报价</th></tr></thead>
        <tbody>{prices.map(price => {
          const name = price.modelName ?? price.family;
          const quote = formatTransitMediaPrice(price.mediaPricing, price.fixedPrice);
          const unit = price.category === "image" ? "张" : "次";
          const billing = price.mediaPricing?.billing ?? "variable";
          const token = billing === "token";
          return <tr key={price.id ?? JSON.stringify([name, price.category])} className="h-[25px] border-b border-border/40 last:border-0">
            <th scope="row" className="pr-2 text-left font-medium"><div className="flex min-w-0 items-center gap-1"><span className="min-w-0 line-clamp-2 break-words leading-[12px] [overflow-wrap:anywhere]" data-tooltip={name}>{name}</span><TransitDiscountChip discount={price.discount} /></div></th>
            <td className="text-right font-mono font-medium tracking-tighter tabular-nums text-[var(--apr-ink)]">
              <Tooltip>
                <TooltipTrigger type="button" closeOnClick={false} title="" aria-label={`${name}，站点报价 ${quote}${quote === "未披露" ? "" : `每${unit}`}，${billingLabels[billing]}`} onClick={event => { event.preventDefault(); event.stopPropagation(); }} className="relative z-20 inline-flex max-w-full cursor-help items-baseline justify-end gap-0.5 whitespace-nowrap rounded outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <span className="min-w-0 truncate">{quote}</span>{quote !== "未披露" && <span className="shrink-0 font-sans text-[10px] font-normal tracking-normal text-muted-foreground">/{unit}</span>}
                </TooltipTrigger>
                <TooltipContent className="max-w-72">
                  <p className="mb-1.5 break-all font-medium">{name}</p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11px]">
                    <dt className="text-muted-foreground">站点报价</dt><dd className="text-right font-mono tabular-nums">{quote}{quote === "未披露" ? "" : `/${unit}`}</dd>
                    <dt className="text-muted-foreground">计费</dt><dd className="text-right">{billingLabels[billing]}</dd>
                    <dt className="text-muted-foreground">分组</dt><dd className="break-all text-right">{price.mediaPricing?.groupKey ?? "未披露"}</dd>
                  </dl>
                  <p className="mt-1.5 border-t border-border/60 pt-1.5 text-[10px] text-muted-foreground">{token ? "图片输出参考，非固定调用价；输入另计。" : price.category === "video" ? "具体价格依时长、分辨率等规格。" : billing === "upstream_cost" ? "按上游账单结算，区间仅供参考。" : billing === "per_request" ? "按次计费。" : "具体价格依质量、尺寸等规格。"} $ 为站内额度，未含峰时变化。</p>
                </TooltipContent>
              </Tooltip>
            </td>
          </tr>;
        })}</tbody>
      </table>
    </section>
  </TooltipProvider>;
}
