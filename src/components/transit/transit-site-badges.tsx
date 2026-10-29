import { CircleDollarSign } from "lucide-react";
import { ToneChip } from "@/components/catalog/tone-chip";
import { rechargeHint, compactMonitorTime } from "@/lib/transit/monitor-hints";
import type { TransitSiteView } from "@/lib/transit/view";

export function TransitBillingBadge({ site }: { site: TransitSiteView }) {
  const cash=site.currencyKind==="usd_cash";
  return <ToneChip tone="sky" className="h-5 shrink-0 gap-1.5 px-2 text-xs" tooltip={cash
    ? {title:"计价单位",rows:[{label:"币种",value:"USD（美元）"}],note:"报价已含模型折扣；未核实人民币充值兑换比例。"}
    : rechargeHint(site)}>
    <CircleDollarSign className="size-3.5 shrink-0" aria-hidden />
    {cash ? <span>USD计价</span> : <><span>倍率</span><span className="font-mono font-medium tabular-nums">{site.rechargeMultiplier===null?"未披露":`¥1 = $${new Intl.NumberFormat("zh-CN",{maximumFractionDigits:4}).format(1/site.rechargeMultiplier)}`}</span></>}
  </ToneChip>;
}

export function TransitServiceStatus({ site }: { site: TransitSiteView }) {
  const state=site.serviceState;
  if(!state || state.allowSignup&&state.allowTopup)return null;
  const text=!state.allowSignup&&!state.allowTopup?"注册/充值暂停":!state.allowSignup?"暂停注册":"暂停充值";
  return <ToneChip tone="amber" className="h-5 shrink-0 text-[10px]" tooltip={{title:"站点开放状态",rows:[
    {label:"新注册",value:state.allowSignup?"开放":"暂停"},{label:"充值",value:state.allowTopup?"开放":"暂停"},
    {label:"更新时间",value:compactMonitorTime(state.observedAt)},
  ],note:"来自站点公开配置，不代表已有用户无法使用。"}}>{text}</ToneChip>;
}
