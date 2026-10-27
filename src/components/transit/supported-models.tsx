"use client";

import { useState, useRef, useEffect } from "react";
import { Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToneChip } from "@/components/catalog/tone-chip";
import { cn } from "@/lib/utils";

/** Matches the group cards: one line by default, explicit expansion only. */
export function SupportedModels({ models, showCount = true, overlayExpanded = false }: { models: string[]; showCount?: boolean; overlayExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [fitCount, setFitCount] = useState(models.length);
  const container = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const update = () => {
      const widths = Array.from(measure.current?.children ?? []).map((child) => child.getBoundingClientRect().width);
      const available = element.clientWidth;
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
  }, [models]);
  const visible = expanded ? models : models.slice(0, fitCount);
  const hiddenCount = models.length - fitCount;
  return (
    <div className={cn("relative flex min-w-0 items-start gap-2", overlayExpanded && "h-5")}>
      <div ref={measure} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 flex w-max gap-1.5">{models.map((model) => <ToneChip key={model} tone="sky" className="shrink-0 text-[10px]">{model}</ToneChip>)}</div>
      <div ref={container} className={cn("relative flex min-h-5 min-w-0 flex-1 items-center gap-1.5", expanded ? "flex-wrap" : "flex-nowrap overflow-hidden", expanded && overlayExpanded && "absolute left-0 top-0 z-30 max-h-32 w-full overflow-y-auto rounded-lg border border-border bg-card p-2 shadow-md")} aria-label="站点支持模型">
        {visible.map((model) => <ToneChip key={model} tone="sky" className="shrink-0 text-[10px] text-neutral-950 dark:text-sky-100" title={model}>{model}</ToneChip>)}
        {(hiddenCount > 0 || expanded) && <Button size="xs" variant="secondary" className="h-5 shrink-0 rounded-md bg-sky-100 px-1.5 text-[10px] text-neutral-950 hover:bg-sky-200 dark:bg-sky-400/15 dark:text-sky-100" aria-expanded={expanded} aria-label={expanded ? "收起支持模型" : `展开其余 ${hiddenCount} 个模型`} onClick={() => setExpanded((value) => !value)}>{expanded ? "收起" : `+${hiddenCount}`}</Button>}
      </div>
      {showCount && <ToneChip tone="sky" className="h-5 shrink-0 text-[10px]" title={`支持 ${models.length} 个模型`}><Layers3 className="size-3" aria-hidden /><span className="font-mono tabular-nums">{models.length}</span>模型</ToneChip>}
    </div>
  );
}
