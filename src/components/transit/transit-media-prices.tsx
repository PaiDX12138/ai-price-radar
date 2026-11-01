"use client";

import type { TransitPrice } from "@/lib/transit/view";
import { TransitDiscountChip } from "@/components/transit/discount-chip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TooltipDetails } from "@/components/ui/tooltip-details";
import { formatTransitMediaPrice, MEDIA_BILLING_LABELS as billingLabels } from "@/lib/transit/media-price-format";
import { TransitPricingDetails } from "./transit-pricing-details";

/** Same 128px model area and 25px rows; media never renders token/multiplier columns. */
export function TransitMediaPrices({ prices }: { prices: TransitPrice[] }) {
  return <TooltipProvider delay={120} closeDelay={40}>
    <section aria-label="图片视频站点报价" className="h-[128px] border-b border-border/70 pb-1">
      <table className="w-full table-fixed border-collapse text-[11px]" aria-label="模型及站点公布的额度报价，价格详情可悬浮查看">
        <colgroup><col className="w-[60%]" /><col className="w-[40%]" /></colgroup>
        <thead><tr className="h-5 border-b border-border/60 text-muted-foreground"><th scope="col" className="text-left font-normal">模型</th><th scope="col" className="text-right font-normal" data-tooltip={prices.every(p=>Boolean(p.mediaPricing?.tokenCurrencyKind)) ? "每百万Token，输入与图片输出分别计费" : undefined}>{prices.length>0 && prices.every(p=>Boolean(p.mediaPricing?.tokenCurrencyKind)) ? "输入 / 图出" : "站点报价"}</th></tr></thead>
        <tbody>{prices.map(price => {
          const name = price.modelName ?? price.family;
          const quote = formatTransitMediaPrice(price.mediaPricing, price.fixedPrice, true);
          const exactToken = Boolean(price.mediaPricing?.tokenCurrencyKind);
          const unit = exactToken ? "百万Token" : price.mediaPricing?.unit??(price.mediaPricing?.billing === "per_request" ? "次" : price.category === "image" ? "张" : "次");
          const billing = price.mediaPricing?.billing ?? "variable";
          const billingLabel=price.currencyKind==="usd_base"&&billing==="per_image"?"按返回图片":billingLabels[billing];
          const token = billing === "token";
          return <tr key={price.id ?? JSON.stringify([name, price.category])} className="h-[25px] border-b border-border/40 last:border-0">
            <th scope="row" className="min-w-0 py-0 pr-1.5 text-left font-medium"><div className="flex w-full min-w-0 items-center gap-0.75"><span className="min-w-0 line-clamp-2 break-words leading-[12px] [overflow-wrap:anywhere]" data-tooltip={name}>{name}</span><span className="inline-flex shrink-0 items-center gap-0.75 empty:hidden"><TransitDiscountChip discount={price.discount} /><TransitPricingDetails rows={[price]} /></span></div></th>
            <td className="text-right font-mono font-medium tracking-tighter tabular-nums text-[var(--apr-ink)]">
              <Tooltip>
                <TooltipTrigger type="button" closeOnClick={false} title="" aria-label={`${name}，站点报价 ${quote}${quote === "未披露" ? "" : `每${unit}`}，${billingLabel}`} onClick={event => { event.preventDefault(); event.stopPropagation(); }} className="relative z-20 inline-flex max-w-full cursor-help items-baseline justify-end gap-0.5 whitespace-nowrap rounded outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <span className="min-w-0 truncate">{quote}</span>{quote !== "未披露" && !exactToken && <span className="shrink-0 font-sans text-[10px] font-normal tracking-normal text-muted-foreground">/{unit}</span>}
                </TooltipTrigger>
                <TooltipContent className="w-[min(19rem,calc(100vw-1.5rem))]">
                  <TooltipDetails title="站点报价" subtitle={name} rows={[
                    { label: "单价", value: `${formatTransitMediaPrice(price.mediaPricing, price.fixedPrice)}${quote === "未披露" || exactToken ? "" : `/${unit}`}` },
                    { label: "计费", value: billingLabel },
                    { label: price.currencyKind==="usd_base"?"报价范围":"分组", value: price.currencyKind==="usd_base"?"公开基础价":price.mediaPricing?.groupKey ?? "未披露" },
                  ]} note={price.currencyKind==="usd_base" ? exactToken ? "USD基础价 / 百万Token，输入输出分开计费，不是固定单张价；不含分组及峰谷倍率。" : "USD基础价，按返回图片数量计费；不含分组及峰谷倍率。" : price.currencyKind==="cny_credit" ? `Credits，公开基准1 Credit=¥1。${exactToken?"图片输出按Token，输入另计。":"按所示单位计费，规格见完整报价。"}` : price.currencyKind==="usd_credit" ? exactToken ? "美元额度 / 百万Token，输入与图片输出分开计费。" : `美元额度报价，按${unit}计费；不跨单位换算。` : exactToken ? "USD / 百万Token，已含折扣；站点未提供固定单张价。" : `${token ? "输出参考价，输入另计。" : price.category === "video" ? "依时长、分辨率计费。" : billing === "upstream_cost" ? "按上游账单结算。" : billing === "per_request" ? "按次计费。" : "依质量、尺寸计费。"}$ 为站内额度，不含峰时变化。`} />
                </TooltipContent>
              </Tooltip>
            </td>
          </tr>;
        })}</tbody>
      </table>
    </section>
  </TooltipProvider>;
}
