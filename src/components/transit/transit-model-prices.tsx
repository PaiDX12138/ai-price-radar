
import type { TransitPrice } from "@/lib/transit/view";
import { selectTransitCardModels, type TransitModelCatalog } from "@/lib/transit/model-order";
import { TransitDiscountChip } from "@/components/transit/discount-chip";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TransitMediaPrices } from "@/components/transit/transit-media-prices";

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
            return (
              <tr key={price.id ?? JSON.stringify([price.family, price.modelName, price.category ?? "token", price.range])} className="h-[25px] border-b border-border/40 last:border-0" data-tooltip={price.category ? `${model.name}：${money(price.fixedPrice)} / ${price.priceUnit ?? "按规格计费"}；站内额度，非充值兑换汇率` : `${model.name}：分组计费倍率 ${price.range}；最低输入报价所在组输入 ${money(price.inputPrice)} / M Token，输出 ${money(price.outputPrice)} / M Token。$ 表示站内额度，未含动态峰时规则，不代表人民币或官方折扣`}>
                <th scope="row" className="pr-1 text-left font-medium" data-tooltip={model.name}><div className="flex min-w-0 items-center gap-1"><span className="min-w-0 truncate">{model.name}</span><TransitDiscountChip discount={price.discount} /></div></th>
                <td className="whitespace-nowrap text-right font-mono tracking-tighter tabular-nums text-muted-foreground">{price.range}</td>
                <td className="text-right font-mono font-medium tabular-nums text-[var(--apr-ink)]">{price.category ? money(price.fixedPrice) : money(price.inputPrice)}</td>
                <td className="text-right font-mono font-medium tabular-nums text-[var(--apr-ink)]">{price.category ? price.priceUnit ? `/${price.priceUnit}` : "按规格" : money(price.outputPrice)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section></TooltipProvider>
  );
}
