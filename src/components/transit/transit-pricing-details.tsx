"use client";

import { Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import type { TransitChargeItem } from "@/lib/transit/view";
import { formatTransitBucketTime, formatTransitMultiplierAmount } from "@/lib/transit/format";

const labels:Record<string,string>={prompt:"文本输入",completion:"文本输出",cache_read:"缓存读",cache_write:"缓存写",cache_write_5m:"缓存写 · 5分钟",cache_write_1h:"缓存写 · 1小时",cache_write_12h:"缓存写 · 12小时",request:"按次",web_search:"联网搜索",image_input:"图片输入",image_output:"图片输出",image_cache_read:"图片缓存读",audio_input:"音频输入",audio_output:"音频输出",video_input:"视频输入",video_output:"视频输出"};
const units:Record<string,string>={per_M_tokens:"百万Token",per_M_output_tokens:"百万输出Token",per_k_calls:"千次",per_image:"张",per_second:"秒",per_minute:"分钟",per_request:"次",per_song:"首",per_hour:"小时",per_GB_day:"GB·天"};
type PricingRow={model?:string;modelName?:string;groupKey?:string;currencyKind?:string;chargeItems?:TransitChargeItem[];pricingRules?:unknown[];pricingDetailsAt?:string|null};
const object=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==="object"&&!Array.isArray(v);
function timeWindows(value:unknown):string {
  if(!Array.isArray(value))return "按时段";
  const hm=(v:unknown)=>typeof v==="number"?`${String(Math.floor(v/60)).padStart(2,"0")}:${String(v%60).padStart(2,"0")}`:"—";
  return value.filter(object).map(i=>`${Array.isArray(i.days)&&i.days.join(",")==="1,2,3,4,5"?"周一至周五 ":""}${hm(i.start)}–${hm(i.end)}`).join("、");
}
function ruleDescription(value:unknown):string|null {
  if(!object(value)||typeof value.label!=="string")return null;
  if(typeof value.description==="string")return `${value.label}：${value.description}`;
  if(object(value.prices))return `${value.label}：${Object.entries(value.prices).map(([key,price])=>`${({p:"输入",c:"输出",cr:"缓存读",cc:"缓存写",cc1h:"缓存写1h",cc12h:"缓存写12h",ai:"音频输入"} as Record<string,string>)[key]??key} $${String(price)}`).join("、")} / 百万Token`;
  const triggers=Array.isArray(value.triggers)?value.triggers.filter(object):[];
  const when=triggers.map(t=>t.kind==="body_field_matches"?`${String(t.field)}=${String(t.pattern).replace(/^\^|\$$/g,"")}`:t.kind==="time_window"?`${String(t.timezone??"UTC")} ${timeWindows(t.intervals)}`:String(t.kind)).join("；");
  const factors=object(value.chargeFactors)?Object.entries(value.chargeFactors).map(([k,v])=>`${labels[k]??k} ×${formatTransitMultiplierAmount(v)}`).join("、"):`×${formatTransitMultiplierAmount(value.factor??1)}`;
  return `${value.label}${when?` · ${when}`:""}：${factors}`;
}

/** Exact per-item credit amounts and source rules; no new popup style or currency guesses. */
export function TransitPricingDetails({rows}:{rows:PricingRow[]}) {
  const known=rows.filter(r=>r.chargeItems?.length);
  if(!known.length)return null;
  const base=known.every(row=>row.currencyKind==="usd_base");
  return <TooltipProvider delay={120} closeDelay={80}><Tooltip><TooltipTrigger type="button" closeOnClick={false} aria-label="查看完整收费项目与规格" onClick={e=>{e.preventDefault();e.stopPropagation();}} className="relative z-20 inline-flex size-3 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"><Info className="size-3" aria-hidden /></TooltipTrigger>
    <TooltipContent className="max-h-[min(32rem,75vh)] w-[min(28rem,calc(100vw-1.5rem))] overflow-y-auto">
      <p className="mb-2 border-b border-border/60 pb-2 text-xs font-semibold">完整报价 · {base?"USD基础价":known.every(row=>row.currencyKind==="usd_credit")?"美元额度":"Credits"}</p>
      <div className="space-y-3">{known.map((row,i)=><section key={`${row.model??row.modelName}:${row.groupKey??i}`} className="space-y-1.5 text-[11px]">
        <p className="break-words font-medium [overflow-wrap:anywhere]">{row.model??row.modelName}{row.groupKey&&<span className="ml-1 text-[10px] font-normal text-muted-foreground">· {row.groupKey}</span>}</p>
        <dl className="space-y-1">{row.chargeItems!.map(c=><div key={c.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3"><dt className="text-muted-foreground">{labels[c.key]??c.key}</dt><dd className="text-right font-mono tabular-nums">{c.creditPrice} / {units[c.unit]??c.unit}</dd></div>)}</dl>
        {row.pricingRules?.length?<ul className="space-y-1 border-t border-border/40 pt-1 text-[10px] text-muted-foreground">{row.pricingRules.map(ruleDescription).filter((s):s is string=>s!==null).map((text,index)=><li key={index} className="break-words [overflow-wrap:anywhere]">{text}</li>)}</ul>:<p className="text-[10px] text-muted-foreground">{base?"源目录未列额外阶梯":"规格规则待补采"}</p>}
        {row.pricingDetailsAt&&<p className="text-[9px] text-muted-foreground">规则更新 {formatTransitBucketTime(row.pricingDetailsAt)}</p>}
      </section>)}</div><p className="mt-2 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">{base?"公开基础价，不含分组与峰谷倍率。阶梯按输入＋缓存Token匹配，命中后替代基础价；主卡片展示首档。":"已含本组倍率。条件档位依请求参数生效，不在当前价上重复叠乘。"}</p>
    </TooltipContent></Tooltip></TooltipProvider>;
}
