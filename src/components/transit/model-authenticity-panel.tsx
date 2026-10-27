"use client";

import { useState } from "react";
import { ScanLine } from "lucide-react";
import { TonePanel } from "@/components/catalog/tone-panel";
import { ToneChip } from "@/components/catalog/tone-chip";
import { TextBand } from "@/components/catalog/text-band";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildAuthenticityPreview } from "@/data/demo/transit-authenticity";
import { cn } from "@/lib/utils";

export function ModelAuthenticityPanel({ platform, models, hasData = true }: {
  platform: string;
  models: string[];
  /** Preview fixture: availability samples and identity comparisons are independent. */
  hasData?: boolean;
}) {
  const [selection, setSelection] = useState(models[0] ?? "");
  const model = models.includes(selection) ? selection : models[0] ?? "";
  const result = hasData && model ? buildAuthenticityPreview(platform, model, models) : null;
  const score = result?.authenticity ?? null;
  const tone = score === null ? "muted" : score >= 90 ? "emerald" : score >= 70 ? "amber" : "rose";

  return (
    <TonePanel tone="sky" className="@container flex h-full min-h-0 flex-col gap-2 px-2.5 py-2">
      <div className="flex h-5 shrink-0 items-center justify-between gap-1.5">
        <ScanLine className="size-3 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
        <Select value={model || null} disabled={!result} onValueChange={(value) => { if (value) setSelection(value); }}>
          <SelectTrigger aria-label="选择真伪比对模型" className="h-5 min-w-0 flex-1 gap-1 rounded border-0 px-0 py-0 text-[10px] font-medium shadow-none hover:text-sky-700 dark:hover:text-sky-300 [&_svg]:size-3">
            <SelectValue className="min-w-0 truncate" placeholder="暂无模型" />
          </SelectTrigger>
          <SelectContent align="start" alignItemWithTrigger={false}>
            {models.map((name) => <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <ToneChip tone="muted" className="h-4 shrink-0 px-1 text-[9px]" title="样式示例，尚未接入真实检测。真实度表示标称模型的行为一致性评分，不是厂商身份认证。">示例</ToneChip>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[54px_minmax(0,1fr)] items-center gap-2 @[240px]:grid-cols-[80px_minmax(0,1fr)] @[240px]:gap-3">
        <div className="flex flex-col items-center gap-1.5">
          <CircularProgress value={score} label={`${model || "模型"}真实度（示例）`}
            className="size-[54px] @[240px]:size-20"
            indicatorClassName={cn(score === null ? "text-muted-foreground" : score >= 90
              ? "text-emerald-500" : score >= 70 ? "text-amber-500" : "text-rose-500")} />
          <span className="whitespace-nowrap font-mono text-[9px] leading-none tabular-nums text-muted-foreground" title="独立比对样本数（示例）">{result ? `${result.comparisons} 次比对` : "尚未检测"}</span>
        </div>

        <div className="flex min-w-0 flex-col justify-center gap-1.5">
          {result ? <div className="flex items-center justify-between gap-1 text-[9px] leading-none text-muted-foreground">
            <span>相似模型</span>
            <span title="各候选模型独立计算相似度，不要求合计100%，不等于身份概率">相似度</span>
          </div> : null}
          {result ? <ol className="space-y-1.5" aria-label="相似模型排名">
            {result.candidates.map((candidate, index) => (
              <li key={candidate.model} className="min-w-0 space-y-1" title={`${candidate.model}：相似度 ${candidate.similarity.toFixed(1)}%（示例）`}>
                <div className="flex min-w-0 items-center gap-1 text-[10px] leading-3">
                  <span className={cn("w-2 shrink-0 font-mono text-[9px] tabular-nums", index === 0 ? "text-sky-600 dark:text-sky-300" : "text-muted-foreground/60")}>{index + 1}</span>
                  <span className={cn("min-w-0 flex-1 truncate", index === 0 ? "font-medium text-foreground" : "text-muted-foreground")}>{candidate.model}</span>
                  <TextBand tone={candidate.model === model ? tone : index === 0 ? "sky" : "muted"} className="shrink-0 whitespace-nowrap px-0.5 font-mono text-[9px] font-medium tabular-nums">{candidate.similarity.toFixed(1)}%</TextBand>
                </div>
                <div className="ml-3 h-[3px] overflow-hidden rounded-full bg-sky-200/60 dark:bg-sky-400/15" aria-hidden>
                  <div className={cn("h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500", candidate.model === model
                    ? score !== null && score >= 90 ? "bg-emerald-400" : score !== null && score >= 70 ? "bg-amber-400" : "bg-rose-400"
                    : index === 0 ? "bg-sky-400" : "bg-sky-300 dark:bg-sky-500/70")} style={{ width: `${candidate.similarity}%` }} />
                </div>
              </li>
            ))}
          </ol> : (
            <div className="flex h-[82px] flex-col items-center justify-center gap-2 text-muted-foreground" role="status">
              <ScanLine className="size-5 text-sky-400/65 dark:text-sky-400/40" strokeWidth={1.25} aria-hidden />
              <p className="text-[10px]">暂无检测数据</p>
            </div>
          )}
        </div>
      </div>
    </TonePanel>
  );
}
