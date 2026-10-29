
import type { TransitPrice } from "@/lib/transit/view";
import { selectTransitCardModels, type TransitModelCatalog } from "@/lib/transit/model-order";
import { TransitDiscountChip } from "@/components/transit/discount-chip";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TransitMediaPrices } from "@/components/transit/transit-media-prices";
import { formatTransitCardAmount } from "@/lib/transit/media-price-format";
import { tooltipDetails } from "@/components/ui/tooltip-details";

export function TransitModelPrices({ prices, media = false, query = "", platform = "all", catalog }: { prices: TransitPrice[]; media?: boolean; query?: string; platform?: string; catalog?: TransitModelCatalog }) {
  const representativeModels = selectTransitCardModels(prices, { query, platform, catalog });
  const mediaPrices = representativeModels.length ? Boolean(representativeModels[0].category) : media;
  if (mediaPrices) return <TransitMediaPrices prices={representativeModels} />;
  return (
    <TooltipProvider delay={120} closeDelay={40}><section aria-label="模型计费" className="h-[128px] border-b border-border/70 pb-1">
      <table className="w-full table-fixed border-collapse text-[11px]" aria-label="模型、站内分组计费倍率及每百万Token输入输出额度">
        <colgroup><col className="w-[44%]" /><col className="w-[22%]" /><col className="w-[17%]" /><col className="w-[17%]" /></colgroup>
        <thead><tr className="h-5 border-b border-border/60 text-muted-foreground"><th scope="col" className="text-left font-normal">模型</th><th scope="col" className="text-right font-normal">倍率</th><th scope="col" className="text-right font-normal">{mediaPrices ? "单价" : "输入"}</th><th scope="col" className="text-right font-normal">{mediaPrices ? "单位" : "输出"}</th></tr></thead>
        <tbody>
          {representativeModels.map((price) => {
            const model = { name: price.modelName ?? price.family };
            const money = (value: number | null | undefined) => value == null ? "—" : `$${Number(value.toFixed(6))}`;
            const cardMoney = (value: number | null | undefined) => value == null ? "—" : `$${formatTransitCardAmount(value)}`;
            return (
              <tr key={price.id ?? JSON.stringify([price.family, price.modelName, price.category ?? "token", price.range])} className="h-[25px] border-b border-border/40 last:border-0" {...tooltipDetails({title:"模型报价",subtitle:model.name,rows:[{label:"计费倍率",value:price.range},{label:"输入 / 百万Token",value:money(price.inputPrice)},{label:"输出 / 百万Token",value:money(price.outputPrice)},...(price.currencyKind === "usd_cash" ? [{label:"缓存读",value:money(price.cacheReadPrice)},{label:"缓存写 · 5分钟",value:money(price.cacheWritePrice)},{label:"缓存写 · 1小时",value:money(price.cacheWrite1hPrice)}] : [])],note:price.currencyKind === "usd_cash" ? "USD / 百万Token，已含折扣，不再叠乘倍率。" : "$ 为站内额度。输入、输出取同一分组，不含其他档位。"})}>
                <th scope="row" className="pr-1 text-left font-medium" data-tooltip={model.name}><div className="flex min-w-0 items-center gap-1"><span className="min-w-0 truncate">{model.name}</span><TransitDiscountChip discount={price.discount} /></div></th>
                <td className="whitespace-nowrap text-right font-mono tracking-tighter tabular-nums text-muted-foreground">{price.range}</td>
                <td className="whitespace-nowrap text-right font-mono font-medium tabular-nums text-[var(--apr-ink)]">{price.category ? cardMoney(price.fixedPrice) : cardMoney(price.inputPrice)}</td>
                <td className="whitespace-nowrap text-right font-mono font-medium tabular-nums text-[var(--apr-ink)]">{price.category ? price.priceUnit ? `/${price.priceUnit}` : "按规格" : cardMoney(price.outputPrice)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section></TooltipProvider>
  );
}
