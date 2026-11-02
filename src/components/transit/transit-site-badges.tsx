import { CircleDollarSign } from "lucide-react";
import { ToneChip } from "@/components/catalog/tone-chip";
import { rechargeHint, compactMonitorTime } from "@/lib/transit/monitor-hints";
import type { TransitSiteView } from "@/lib/transit/view";
import { formatTransitMultiplierAmount } from "@/lib/transit/format";

export function TransitBillingBadge({ site }: { site: TransitSiteView }) {
  if(site.currencyKind==="usd_base")return <ToneChip tone="sky" className="h-5 shrink-0 gap-1.5 px-2 text-xs" tooltip={{title:"公开基础报价",rows:[{label:"币种",value:"USD / 美元"},{label:"报价",value:"基础价及适用Token阶梯"}],note:"不含分组与峰谷倍率；充值换算未核实。"}}><CircleDollarSign className="size-3.5 shrink-0" aria-hidden /><span>USD基础价</span></ToneChip>;
  const cash=site.currencyKind==="usd_cash";
  if(site.currencyKind==="usd_credit")return <ToneChip tone="sky" className="h-5 shrink-0 gap-1.5 px-2 text-xs" tooltip={{title:"计价单位",rows:[{label:"币种",value:"美元额度"},...(site.billingConfiguration?[{label:"基础充值参考",value:`¥${site.billingConfiguration.price} / $1额度`},{label:"展示汇率",value:`¥${site.billingConfiguration.usdExchangeRate} / $1`}]:[])],note:"站点公开配置，非付款报价；不含个人优惠。"}}><CircleDollarSign className="size-3.5 shrink-0" aria-hidden /><span>USD额度</span></ToneChip>;
  if(site.currencyKind==="cny_credit")return <ToneChip tone="sky" className="h-5 shrink-0 gap-1.5 px-2 text-xs" tooltip={{title:"结算单位",rows:[{label:"币种",value:"Credits"},{label:"公开基准",value:site.rechargeInfo?"1 Credit = ¥1":"尚未核实"}],note:site.rechargeInfo?"卡片¥为Credits公开基准，不含个人优惠。":"卡片¥为站内标价，实际充值换算未核实。"}}><CircleDollarSign className="size-3.5 shrink-0" aria-hidden /><span>Credits</span>{site.rechargeInfo&&<span className="font-mono font-medium">¥1 = 1</span>}</ToneChip>;
  return <ToneChip tone="sky" className="h-5 shrink-0 gap-1.5 px-2 text-xs" tooltip={cash
    ? {title:"计价单位",rows:[{label:"币种",value:"USD（美元）"}],note:"报价已含模型折扣；未核实人民币充值兑换比例。"}
    : rechargeHint(site)}>
    <CircleDollarSign className="size-3.5 shrink-0" aria-hidden />
    {cash ? <span>USD计价</span> : <><span>倍率</span><span className="font-mono font-medium tabular-nums">{site.rechargeMultiplier===null?"未披露":`¥1 = $${formatTransitMultiplierAmount(1/site.rechargeMultiplier)}`}</span></>}
  </ToneChip>;
}

export function TransitServiceStatus({ site }: { site: TransitSiteView }) {
  const state=site.serviceState;
  if(state?.closed)return <ToneChip tone="amber" tooltip={{title:"已停止服务",rows:[
    {label:"来源",value:"官网停服公告"},...(state.closedAt?[{label:"停服日期",value:state.closedAt}]:[]),
  ],note:"保留历史报价与监测记录，不代表当前仍可使用。"}}>已停止服务</ToneChip>;
  if(!state || state.allowSignup&&state.allowTopup)return null;
  const text=!state.allowSignup&&!state.allowTopup?"注册/充值暂停":!state.allowSignup?"暂停注册":"暂停充值";
  return <ToneChip tone="amber" className="h-5 shrink-0 text-[10px]" tooltip={{title:"站点开放状态",rows:[
    {label:"新注册",value:state.allowSignup?"开放":"暂停"},{label:"充值",value:state.allowTopup?"开放":"暂停"},
    {label:"更新时间",value:compactMonitorTime(state.observedAt)},
  ],note:"来自站点公开配置，不代表已有用户无法使用。"}}>{text}</ToneChip>;
}
