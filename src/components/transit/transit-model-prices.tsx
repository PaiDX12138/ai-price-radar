
import type { TransitDemo } from "@/data/demo/transit";

/** Fictional representative model prices for layout preview, not live official prices. */
const MODELS: Record<string, { name: string; input: number; output: number }> = {
  GPT: { name: "GPT-4.1", input: 2, output: 8 },
  Claude: { name: "Sonnet 4", input: 3, output: 15 },
  Gemini: { name: "Gemini 2.5 Pro", input: 1.25, output: 10 },
  DeepSeek: { name: "DeepSeek V3", input: 0.27, output: 1.1 },
  Qwen: { name: "Qwen3", input: 0.3, output: 1.2 },
};

export function TransitModelPrices({ prices, media = false }: { prices: TransitDemo["prices"]; media?: boolean }) {
  const popularModels = prices.filter((price) => price.requestCount == null || price.requestCount > 0).slice().sort((a, b) => (b.requestCount ?? 0) - (a.requestCount ?? 0)).slice(0, 4);
  return (
    <section aria-label="模型计费示例" className="h-[128px] border-b border-border/70 pb-1">
      <table className="w-full table-fixed border-collapse text-[11px]" aria-label="模型、倍率范围及每百万Token输入输出示例价格">
        <colgroup><col className="w-[32%]" /><col className="w-[30%]" /><col className="w-[19%]" /><col className="w-[19%]" /></colgroup>
        <thead><tr className="h-5 border-b border-border/60 text-muted-foreground"><th scope="col" className="text-left font-normal">模型</th><th scope="col" className="text-right font-normal">倍率</th><th scope="col" className="text-right font-normal">{media ? "单价" : "输入"}</th><th scope="col" className="text-right font-normal">{media ? "单位" : "输出"}</th></tr></thead>
        <tbody>
          {popularModels.map((price) => {
            const model = { ...MODELS[price.family], name: price.modelName ?? MODELS[price.family].name };
            const lowest = Number.parseFloat(price.range);
            const money = (base: number) => Number((base * lowest).toFixed(4));
            return (
              <tr key={price.id ?? JSON.stringify([price.family, price.modelName, price.category ?? "token", price.range])} className="h-[25px] border-b border-border/40 last:border-0" title={price.category ? `示例：${model.name}，${price.fixedPrice} / ${price.priceUnit}，非Token计费` : `示例：${model.name}，示例调用 ${price.requestCount} 次；分组倍率 ${price.range}；输入 $${money(model.input)} / M Token，输出 $${money(model.output)} / M Token。价格按最低倍率换算，非实际采集报价`}>
                <th scope="row" className="truncate pr-1 text-left font-medium" title={model.name}>{model.name}</th>
                <td className="whitespace-nowrap text-right font-mono tracking-tighter tabular-nums text-muted-foreground">{price.range}</td>
                <td className="text-right font-mono font-medium tabular-nums text-[var(--apr-ink)]">{price.category ? `$${price.fixedPrice}` : `$${money(model.input)}`}</td>
                <td className="text-right font-mono font-medium tabular-nums text-[var(--apr-ink)]">{price.category ? `/${price.priceUnit}` : `$${money(model.output)}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
