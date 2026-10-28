"use client";

import { Info } from "lucide-react";
import { TonePanel } from "@/components/catalog/tone-panel";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { TransitQuote } from "@/lib/transit/view";
import { formatMediaPriceBounds, formatTransitMediaPrice, mediaPriceBounds, summarizeMediaPrices, MEDIA_BILLING_LABELS } from "@/lib/transit/media-price-format";

/** Same two-line price region as token groups. All values belong to this group. */
export function TransitGroupMediaPrices({ rows, models }: { rows: TransitQuote[]; models: string[] }) {
  const first = rows[0];
  const byModel = new Map(rows.map(row => [row.model, row]));
  const ordered = models.map(model => byModel.get(model)).filter((row): row is TransitQuote => row !== undefined);
  const bounds = ordered.map(row => mediaPriceBounds(row.mediaPricing, row.fixedPrice));
  const known = bounds.filter(value => value !== null).length;
  const quote = formatMediaPriceBounds(summarizeMediaPrices(bounds));
  const unit = first.category === "image" ? "张" : "次";
  const modes = [...new Set(ordered.filter((_, index) => bounds[index] !== null).map(row => row.mediaPricing ? MEDIA_BILLING_LABELS[row.mediaPricing.billing] : "未披露"))];
  const billing = !modes.length ? "未披露" : modes.length > 2 ? "混合计费" : modes.join(" / ");
  return <TooltipProvider delay={120} closeDelay={80}>
    <TonePanel tone="ink" className="flex h-14 min-w-0 shrink-0 flex-col justify-center gap-1 px-2 py-2">
      <div className="flex min-w-0 items-baseline justify-between gap-2 text-[10px]">
        <span className="shrink-0 text-muted-foreground">{first.category === "image" ? "图片报价" : "视频报价"}</span>
        <span className="min-w-0 truncate text-right font-mono font-semibold tabular-nums" data-tooltip={`${quote}${quote === "未披露" ? "" : `/${unit}`} · ${first.groupKey} · 已披露 ${known}/${ordered.length} 个模型`}>
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
              <p className="mb-2 break-all border-b border-border/60 pb-1.5 font-medium">{first.group} · {first.category === "image" ? "图片报价" : "视频报价"}</p>
              <dl className="space-y-2">{ordered.map(row => {
                const price = formatTransitMediaPrice(row.mediaPricing, row.fixedPrice);
                return <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-0.5 text-[11px]">
                  <dt className="min-w-0 break-words [overflow-wrap:anywhere]">{row.model}</dt>
                  <dd className="whitespace-nowrap text-right font-mono tabular-nums">{price}{price === "未披露" ? "" : `/${unit}`}</dd>
                  <dd className="col-span-2 text-[10px] text-muted-foreground">{row.mediaPricing ? MEDIA_BILLING_LABELS[row.mediaPricing.billing] : "计费未披露"}</dd>
                </div>;
              })}</dl>
              <p className="mt-2 border-t border-border/60 pt-1.5 text-[10px] text-muted-foreground">
                {first.category === "video" ? "价格依时长、分辨率等规格。" : modes.includes(MEDIA_BILLING_LABELS.token) ? "Token 模型为输出参考，输入另计；其他模型依规格。" : "价格依质量、尺寸等规格。"} $ 为站内额度，已计入本组倍率，未含峰时变化。{known < ordered.length ? ` 已披露 ${known}/${ordered.length} 个模型，未披露项未计入区间。` : ""}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TonePanel>
  </TooltipProvider>;
}
