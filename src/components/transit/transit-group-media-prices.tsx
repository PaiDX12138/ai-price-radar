"use client";

import { Info } from "lucide-react";
import { TonePanel } from "@/components/catalog/tone-panel";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { tooltipDetails } from "@/components/ui/tooltip-details";
import type { TransitQuote } from "@/lib/transit/view";
import { formatMediaPriceBounds, formatTransitMediaPrice, formatTransitCardAmount, mediaPriceBounds, summarizeMediaPrices, MEDIA_BILLING_LABELS } from "@/lib/transit/media-price-format";

/** Same two-line price region as token groups. All values belong to this group. */
export function TransitGroupMediaPrices({ rows, models }: { rows: TransitQuote[]; models: string[] }) {
  const first = rows[0];
  const byModel = new Map(rows.map(row => [row.model, row]));
  const ordered = models.map(model => byModel.get(model)).filter((row): row is TransitQuote => row !== undefined);
  if (ordered.length && ordered.every(row=>row.mediaPricing?.tokenCurrencyKind === "usd_cash")) return <TokenGroupMediaPrices rows={ordered} />;
  const bounds = ordered.map(row => mediaPriceBounds(row.mediaPricing, row.fixedPrice));
  const known = bounds.filter(value => value !== null).length;
  const quote = formatMediaPriceBounds(summarizeMediaPrices(bounds), true);
  const unit = ordered.every(row => row.mediaPricing?.billing === "per_request") ? "次" : first.category === "image" ? "张" : "次";
  const modes = [...new Set(ordered.filter((_, index) => bounds[index] !== null).map(row => row.mediaPricing ? MEDIA_BILLING_LABELS[row.mediaPricing.billing] : "未披露"))];
  const billing = !modes.length ? "未披露" : modes.length > 2 ? "混合计费" : modes.join(" / ");
  return <TooltipProvider delay={120} closeDelay={80}>
    <TonePanel tone="ink" className="flex h-14 min-w-0 shrink-0 flex-col justify-center gap-1 px-2 py-2">
      <div className="flex min-w-0 items-baseline justify-between gap-2 text-[10px]">
        <span className="shrink-0 text-muted-foreground">{first.category === "image" ? "图片报价" : "视频报价"}</span>
        <span className="min-w-0 truncate text-right font-mono font-semibold tabular-nums" {...tooltipDetails({title:"分组报价",subtitle:first.groupKey,rows:[{label:"价格区间",value:`${quote}${quote === "未披露" ? "" : `/${unit}`}`},{label:"已披露模型",value:`${known} / ${ordered.length}`}],note:"仅统计本组已披露价格；$ 为站内额度。"})}>
          {quote}{quote !== "未披露" && <span className="ml-0.5 font-sans font-normal text-muted-foreground">/{unit}</span>}
        </span>
      </div>
      <div className="flex min-w-0 items-center justify-between gap-2 text-[10px]">
        <span className="shrink-0 text-muted-foreground">计费</span>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-right text-muted-foreground">{billing}</span>
          <Tooltip>
            <TooltipTrigger type="button" closeOnClick={false} aria-label={`查看 ${first.group} 各模型报价`} className="inline-flex size-3.5 shrink-0 cursor-help items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"><Info className="size-3" aria-hidden /></TooltipTrigger>
            <TooltipContent className="max-w-[min(30rem,calc(100vw-1.5rem))]">
              <div className="mb-2 border-b border-border/60 pb-2"><p className="text-xs font-semibold">{first.category === "image" ? "图片报价" : "视频报价"}</p><p className="mt-1 break-words text-[11px] text-muted-foreground [overflow-wrap:anywhere]">{first.group} · 已披露 {known}/{ordered.length} 个模型</p></div>
              <dl className="space-y-2">{ordered.map(row => {
                const price = formatTransitMediaPrice(row.mediaPricing, row.fixedPrice);
                const exactToken = row.mediaPricing?.tokenCurrencyKind === "usd_cash";
                return <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-0.5 text-[11px]">
                  <dt className="min-w-0 break-words [overflow-wrap:anywhere]">{row.model}</dt>
                  <dd className="whitespace-nowrap text-right font-mono tabular-nums">{price}{price === "未披露" || exactToken ? "" : `/${unit}`}</dd>
                  <dd className="col-span-2 text-[10px] text-muted-foreground">{row.mediaPricing ? MEDIA_BILLING_LABELS[row.mediaPricing.billing] : "计费未披露"}</dd>
                </div>;
              })}</dl>
              <p className="mt-2 border-t border-border/60 pt-1.5 text-[10px] text-muted-foreground">
                {first.category === "video" ? "依时长、分辨率计费。" : modes.includes(MEDIA_BILLING_LABELS.token) ? "Token 为输出参考价，输入另计。" : "依质量、尺寸计费。"}$ 为站内额度，已含本组倍率，不含峰时变化。
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TonePanel>
  </TooltipProvider>;
}

function TokenGroupMediaPrices({ rows }: { rows: TransitQuote[] }) {
  const range=(values:(number|null|undefined)[])=>{
    const known=values.filter((v):v is number=>typeof v === "number"&&Number.isFinite(v)&&v>=0);
    if(!known.length)return "—";
    const min=Math.min(...known),max=Math.max(...known);
    return min===max?`$${formatTransitCardAmount(min)}`:`$${formatTransitCardAmount(min)}–${formatTransitCardAmount(max)}`;
  };
  return <TooltipProvider delay={120}><TonePanel tone="ink" className="flex h-14 min-w-0 shrink-0 flex-col justify-center gap-1 px-2 py-2">
    <div className="flex min-w-0 justify-between gap-2 text-[10px]"><span className="text-muted-foreground">输入 / 百万Token</span><span className="truncate font-mono font-semibold tabular-nums">{range(rows.map(r=>r.input))}</span></div>
    <div className="flex min-w-0 items-center justify-between gap-2 text-[10px]"><span className="text-muted-foreground">输出 / 百万Token</span><div className="flex min-w-0 items-center gap-1.5"><span className="truncate font-mono font-semibold tabular-nums">{range(rows.map(r=>r.output))}</span>
      <Tooltip><TooltipTrigger type="button" aria-label="查看图片模型Token报价" className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"><Info className="size-3" aria-hidden /></TooltipTrigger>
        <TooltipContent className="max-w-[min(30rem,calc(100vw-1.5rem))]"><p className="mb-2 border-b border-border/60 pb-2 text-xs font-semibold">图片报价 · USD / 百万Token</p><dl className="space-y-2">{rows.map(row=><div key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 text-[11px]"><dt className="min-w-0 break-words [overflow-wrap:anywhere]">{row.model}</dt><dd className="text-right font-mono tabular-nums">{formatTransitMediaPrice(row.mediaPricing)}</dd></div>)}</dl><p className="mt-2 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">已含折扣，输入输出分开计费；未提供固定单张价。</p></TooltipContent>
      </Tooltip></div></div>
  </TonePanel></TooltipProvider>;
}
