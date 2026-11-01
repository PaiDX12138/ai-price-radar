
import type { TransitPrice } from "@/lib/transit/view";
import { selectTransitCardModels, type TransitModelCatalog } from "@/lib/transit/model-order";
import { TransitDiscountChip } from "@/components/transit/discount-chip";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TransitMediaPrices } from "@/components/transit/transit-media-prices";
import { formatTransitCardAmount } from "@/lib/transit/media-price-format";
import { tooltipDetails } from "@/components/ui/tooltip-details";
import { TransitPricingDetails } from "./transit-pricing-details";

export function TransitModelPrices({ prices, media = false, query = "", platform = "all", catalog }: { prices: TransitPrice[]; media?: boolean; query?: string; platform?: string; catalog?: TransitModelCatalog }) {
  const representativeModels = selectTransitCardModels(prices, { query, platform, catalog });
  const mediaPrices = representativeModels.length ? Boolean(representativeModels[0].category) : media;
  const base=representativeModels.length>0&&representativeModels.every(price=>price.currencyKind==="usd_base");
  // Match the monospace value's intrinsic width, not a fixed percentage of a
  // narrow card. Keep one character of padding; the model column gets the rest.
  const rateColumnWidth = `${Math.max(4, ...representativeModels.map(price => price.range.length)) + 1}ch`;
  if (mediaPrices) return <TransitMediaPrices prices={representativeModels} />;
  return (
    <TooltipProvider delay={120} closeDelay={40}><section aria-label="模型计费" className="h-[128px] border-b border-border/70 pb-1">
      <table className="w-full table-fixed border-collapse text-[11px]" aria-label={base?"模型、公开基础计费及每百万Token输入输出价格":"模型、站内分组计费倍率及每百万Token输入输出额度"}>
        {/* Rates stay whole; only model names and prices may truncate when needed. */}
        <colgroup><col /><col className="font-mono" style={{ width: rateColumnWidth }} /><col className="w-[15%]" /><col className="w-[15%]" /></colgroup>
        <thead><tr className="h-5 border-b border-border/60 text-muted-foreground"><th scope="col" className="text-left font-normal">模型</th><th scope="col" className="text-right font-normal">{base?"计费":"倍率"}</th><th scope="col" className="text-right font-normal">{mediaPrices ? "单价" : "输入"}</th><th scope="col" className="text-right font-normal">{mediaPrices ? "单位" : "输出"}</th></tr></thead>
        <tbody>
          {representativeModels.map((price) => {
            const model = { name: price.modelName ?? price.family };
            const prefix=price.currencyKind==="cny_credit"?"¥":"$";
            const money = (value: number | null | undefined) => value == null ? "—" : `${prefix}${Number(value.toFixed(6))}`;
            const cardMoney = (value: number | null | undefined) => value == null ? "—" : `${prefix}${formatTransitCardAmount(value)}`;
            return (
              <tr key={price.id ?? JSON.stringify([price.family, price.modelName, price.category ?? "token", price.range])} className="h-[25px] border-b border-border/40 last:border-0" {...tooltipDetails({title:"模型报价",subtitle:model.name,rows:[{label:base?"价格档位":"计费倍率",value:price.range},{label:"输入 / 百万Token",value:money(price.inputPrice)},{label:"输出 / 百万Token",value:money(price.outputPrice)},...(price.currencyKind === "usd_base" ? [{label:"缓存读",value:money(price.cacheReadPrice)},{label:"缓存写",value:money(price.cacheWritePrice)}] : price.currencyKind === "usd_cash" ? [{label:"缓存读",value:money(price.cacheReadPrice)},{label:"缓存写 · 5分钟",value:money(price.cacheWritePrice)},{label:"缓存写 · 1小时",value:money(price.cacheWrite1hPrice)}] : [])],note:base ? "USD公开基础价，不含分组及峰谷倍率；阶梯型号展示首档。" : price.currencyKind === "cny_credit" ? "Credits / 百万Token，¥按1 Credit=¥1展示；已含本组倍率。" : price.currencyKind === "usd_cash" ? "USD / 百万Token，已含折扣，不再叠乘倍率。" : "$ 为站内额度。输入、输出取同一分组，不含其他档位。"})}>
                <th scope="row" className="min-w-0 py-0 pr-1.5 text-left font-medium"><div className="flex w-full min-w-0 items-center gap-0.75"><span className="min-w-0 truncate" data-tooltip={model.name}>{model.name}</span><span className="inline-flex shrink-0 items-center gap-0.75 empty:hidden"><TransitDiscountChip discount={price.discount} /><TransitPricingDetails rows={[price]} /></span></div></th>
                <td className="whitespace-nowrap py-0 pl-0.5 text-right font-mono tabular-nums text-muted-foreground"><span className="inline-block whitespace-nowrap">{price.range}</span></td>
                <td className="py-0 pl-1 text-right font-mono font-medium tabular-nums text-[var(--apr-ink)]"><span className="block truncate">{price.category ? cardMoney(price.fixedPrice) : cardMoney(price.inputPrice)}</span></td>
                <td className="py-0 pl-1 text-right font-mono font-medium tabular-nums text-[var(--apr-ink)]"><span className="block truncate">{price.category ? price.priceUnit ? `/${price.priceUnit}` : "按规格" : cardMoney(price.outputPrice)}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section></TooltipProvider>
  );
}
