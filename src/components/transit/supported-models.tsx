"use client";

import { useState, useRef, useEffect } from "react";
import { Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToneChip } from "@/components/catalog/tone-chip";
import { cn } from "@/lib/utils";

const modelButtonClass = "flex h-5 max-w-full shrink-0 items-center rounded-md border px-1.5 py-0 text-[10px] font-medium leading-none tracking-tight whitespace-nowrap transition-colors active:translate-y-0 focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-1";
const idleModelClass = "border-sky-200/70 bg-sky-50/70 text-sky-900/80 hover:border-sky-300 hover:bg-sky-100 hover:text-sky-950 dark:border-sky-400/20 dark:bg-sky-400/5 dark:text-sky-200/80 dark:hover:bg-sky-400/15";
const activeModelClass = "border-sky-500/70 bg-sky-100 text-sky-950 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-sky-500)_18%,transparent)] hover:bg-sky-100 dark:border-sky-400/70 dark:bg-sky-400/20 dark:text-sky-100";

/** Matches the group cards: one line by default, explicit expansion only. */
export function SupportedModels({ models, showCount = true, overlayExpanded = false, selectedModel, onModelSelect }: { models: string[]; showCount?: boolean; overlayExpanded?: boolean; selectedModel?: string; onModelSelect?: (model: string) => void }) {
  const interactive = Boolean(onModelSelect);
  const [expanded, setExpanded] = useState(false);
  const [fitCount, setFitCount] = useState(models.length);
  const container = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const element = container.current;
    if (!element) return;
    const document = element.ownerDocument;
    const dismissOutside = (event: PointerEvent) => {
      if (!event.composedPath().includes(element)) setExpanded(false);
    };
    document.addEventListener("pointerdown", dismissOutside, true);
    return () => document.removeEventListener("pointerdown", dismissOutside, true);
  }, [expanded]);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const update = () => {
      const widths = Array.from(measure.current?.children ?? []).map((child) => child.getBoundingClientRect().width);
      // Leave room for the focus outline without clipping the first/last model.
      const available = element.clientWidth - (interactive ? 4 : 0);
      const total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * 6;
      if (total <= available) { setFitCount(models.length); return; }
      let used = 0, count = 0;
      // Reserve the overflow chip only when all labels cannot fit.
      const overflowWidth = 26 + String(models.length).length * 7;
      for (const width of widths) {
        if (used + width + 6 + overflowWidth > available) break;
        used += width + 6;
        count++;
      }
      setFitCount(count);
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [models, interactive]);
  const visible = expanded ? models : models.slice(0, fitCount);
  const hiddenCount = models.length - fitCount;
  return (
    <div className={cn("relative flex min-w-0 items-start gap-2", overlayExpanded && (onModelSelect ? "h-6" : "h-5"))}>
      {/* Keep intrinsic label measurements, but never let the invisible row widen the page. */}
      <div aria-hidden="true" className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden">
        <div ref={measure} className="flex w-max items-center gap-1.5">{models.map((model) => onModelSelect ? <span key={model} className={cn(modelButtonClass, idleModelClass)}>{model}</span> : <ToneChip key={model} tone="sky" className="shrink-0 text-[10px]">{model}</ToneChip>)}</div>
      </div>
      <div ref={container} className={cn("relative flex min-h-5 min-w-0 flex-1 items-center gap-1.5", onModelSelect && "min-h-6 px-0.5 py-0.5", expanded ? "flex-wrap" : "flex-nowrap overflow-hidden", expanded && overlayExpanded && "absolute left-0 top-0 z-30 max-h-32 w-full overflow-y-auto rounded-lg border border-border bg-card p-2 shadow-md")} role={onModelSelect ? "group" : undefined} aria-label={onModelSelect ? "选择检测模型" : "站点支持模型"}>
        {visible.map((model) => onModelSelect ? (
          <Button key={model} type="button" variant="ghost" size="xs" aria-pressed={selectedModel === model} aria-label={`选择模型 ${model}`} data-tooltip={model} onClick={() => onModelSelect(model)} className={cn(modelButtonClass, selectedModel === model ? activeModelClass : idleModelClass)}>{model}</Button>
        ) : <ToneChip key={model} tone="sky" className="shrink-0 text-[10px] text-neutral-950 dark:text-sky-100" tooltip={model}>{model}</ToneChip>)}
        {(hiddenCount > 0 || expanded) && <Button size="xs" variant="secondary" className={cn("h-5 shrink-0 rounded-md bg-sky-100 px-1.5 text-[10px] text-neutral-950 hover:bg-sky-200 dark:bg-sky-400/15 dark:text-sky-100", onModelSelect && "flex min-w-6 items-center border border-sky-200/70 py-0 leading-none tracking-tight active:translate-y-0 dark:border-sky-400/20")} aria-expanded={expanded} aria-label={expanded ? "收起支持模型" : `展开其余 ${hiddenCount} 个模型`} onClick={() => setExpanded((value) => !value)}>{expanded ? "收起" : `+${hiddenCount}`}</Button>}
      </div>
      {showCount && <ToneChip tone="sky" className="h-5 shrink-0 text-[10px]" tooltip={`支持 ${models.length} 个模型`}><Layers3 className="size-3" aria-hidden /><span className="font-mono tabular-nums">{models.length}</span>模型</ToneChip>}
    </div>
  );
}
