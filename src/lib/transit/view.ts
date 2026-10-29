import type {TransitDemo} from "@/data/demo/transit";
import type {TransitSite} from "./types";
import type {TransitMonitorStats} from "./snapshot";
import type {TransitModelCatalog} from "./model-order";

export type TransitPrice=TransitDemo["prices"][number]&{
  inputPrice:number|null;
  outputPrice:number|null;
  isLive:true;
  modality?:string;
  discount?:TransitDiscount|null;
  mediaPricing?:TransitMediaPricing;
  currencyKind?: "usd_cash";
  cacheReadPrice?: number | null;
  cacheWritePrice?: number | null;
  cacheWrite1hPrice?: number | null;
};
export type TransitMediaPricing={
  min:number|null;
  max:number|null;
  fixed:number|null;
  billing:"token"|"per_image"|"upstream_cost"|"per_request"|"variable";
  groupKey:string;
  tokenInput?:number|null;
  tokenOutput?:number|null;
  tokenCurrencyKind?:"usd_cash";
};
export type TransitDiscount={
  ratio:number;
  source:"station_reported"|"station_formula"|"calculated";
  basis:"station_reference"|"official_input_price"|"public_reference_input_price";
  groupKey:string;
  sourceUrl:string|null;
  observedAt:string;
  reference?:{price:number;currency:string;unit:string};
  metric?:"input"|"request";
  fxDate?:string;
  usdToCny?:number;
};
export type TransitQuote={
  id:string;family:string;category:string;model:string;group:string;groupKey:string;
  multiplier:number|null;input:number|null;output:number|null;
  cacheRead:number|null;cacheWrite:number|null;fixedPrice:number|null;
  cacheWrite1h?:number|null;
  currencyKind?:"usd_cash";
  unit:string;cacheHitRate:null;
  mediaPricing?:TransitMediaPricing;
};
export type TransitSiteView=Omit<TransitDemo,"prices">&{
  isLive:true;
  logoPath:string;
  renderedAt:number;
  siteUrl:string;
  prices:TransitPrice[];
  detail:{quotes:TransitQuote[];listedAt:string};
  groupLabels:Record<string,{pool:string|null;subscription:string|null;disclosure:string|null;description:string|null}>;
  monitor?:TransitMonitorStats;
  monitorsByGroup:Record<string,TransitMonitorStats>;
  monitorsByModel:Record<string,TransitMonitorStats>;
  modelCatalog:TransitModelCatalog;
  rechargeInfo:{sourceUrl:string;observedAt:string}|null;
  serviceState?: { allowSignup:boolean;allowTopup:boolean;observedAt:string };
  catalogOnly?:boolean;
  currencyKind?:"usd_cash";
  infrastructure?:{id:number;name:string;monitor:TransitMonitorStats}[];
};
const valid=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v);
const mediaAmount=(v:unknown):number|null=>valid(v)&&v>=0?v:null;
type Offer=TransitSite["groups"][number]["offers"][number];
function mediaPricing(offer:Offer,groupKeys:Map<string,string>):TransitMediaPricing {
  const min=mediaAmount(offer.model_price_min),max=mediaAmount(offer.model_price_max);
  const coherent=min===null||max===null||max>=min;
  let billing:TransitMediaPricing["billing"]=offer.billing_mode==="per_request"?"per_request":"variable";
  try {
    const raw:unknown=JSON.parse(offer.image_billing_json??"null");
    if(raw==="token"||raw==="per_image"||raw==="upstream_cost")billing=raw;
  }catch{/* No verified mode: keep the specification-based label. */}
  // These persisted bounds already include this offer's group rate. Never multiply again.
  let exactTokens=false;try {exactTokens=JSON.parse(offer.effective_price_json??"{}").currencyKind==="usd_cash"&&billing==="token";}catch{/* no exact token quote */}
  return {min:coherent?min:null,max:coherent?max:null,fixed:mediaAmount(offer.fixed_price),billing,groupKey:groupKeys.get(offer.group_id)??offer.group_id,
    ...(exactTokens?{tokenInput:offer.input_price,tokenOutput:offer.output_price,tokenCurrencyKind:"usd_cash" as const}:{})};
}
function mediaFloor(offer:Offer):number {
  const price=mediaPricing(offer,new Map());
  return price.min??price.fixed??price.max??Infinity;
}
function offerDiscount(offer:TransitSite["groups"][number]["offers"][number],groupKeys:Map<string,string>):TransitDiscount|null {
  if(!valid(offer.discount_ratio)||offer.discount_ratio<0 || !["station_reported","station_formula","calculated"].includes(offer.discount_source??"") || !["station_reference","official_input_price","public_reference_input_price"].includes(offer.discount_basis??"")) return null;
  let sourceUrl:string|null=null;
  const evidence:Pick<TransitDiscount,"reference"|"metric"|"fxDate"|"usdToCny">={};
  try {
    const details=JSON.parse(offer.discount_details_json??"{}");
    sourceUrl=typeof details.sourceUrl==="string"?details.sourceUrl:null;
    if(valid(details.reference?.input)&&details.reference.input>0&&typeof details.reference.currency==="string"&&typeof details.reference.unit==="string")
      evidence.reference={price:details.reference.input,currency:details.reference.currency,unit:details.reference.unit};
    if(details.metric==="input"||details.metric==="request")evidence.metric=details.metric;
    if(typeof details.conversion?.fxDate==="string")evidence.fxDate=details.conversion.fxDate;
    if(valid(details.conversion?.usdToCny)&&details.conversion.usdToCny>0)evidence.usdToCny=details.conversion.usdToCny;
  }catch{/* basic value remains usable */}
  return {ratio:offer.discount_ratio,source:offer.discount_source as TransitDiscount["source"],basis:offer.discount_basis as TransitDiscount["basis"],groupKey:groupKeys.get(offer.group_id)??offer.group_id,sourceUrl,observedAt:offer.observed_at,...evidence};
}
/** Never substitute whole-station statistics when a group has no data. */
export function getTransitMonitor(site:Pick<TransitSiteView,"id"|"monitor"|"monitorsByGroup">, groupKey:string|null=null):TransitMonitorStats|undefined {
  const stats=groupKey===null?site.monitor:site.monitorsByGroup[groupKey];
  if(stats?.scope?.stationId!==site.id || stats.scope.groupKey!==groupKey || stats.scope.modelName!==undefined || stats.windowHours!==360) return undefined;
  return stats;
}
/** An exact raw-model match only; never fall back to a platform, group or station average. */
export function getTransitModelMonitor(site:Pick<TransitSiteView,"id">&{monitorsByModel?:Record<string,TransitMonitorStats>},modelName:string):TransitMonitorStats|undefined {
  if(!Object.hasOwn(site.monitorsByModel??{},modelName))return undefined;
  const stats=site.monitorsByModel?.[modelName];
  if(stats?.scope?.stationId!==site.id||stats.scope.groupKey!==null||stats.scope.modelName!==modelName||stats.windowHours!==360)return undefined;
  return stats;
}
const numericRange=(values:(number|null)[])=>{
  const ns=values.filter(valid);if(!ns.length)return "—";
  const min=Math.min(...ns),max=Math.max(...ns);
  return min===max?`${min}×`:`${min}–${max}×`;
};
/** Maps persisted data into the existing card contract; no visual redesign. */
export function toTransitView(site:TransitSite, catalog:TransitModelCatalog={}, {includeModelMonitors=false}:{includeModelMonitors?:boolean}={}):TransitSiteView {
  const s=site.station;
  const currencyKind=s.currency_kind;
  let rechargeInfo:TransitSiteView["rechargeInfo"]=null;
  try {const detail=JSON.parse(s.recharge_details_json??"{}");if(typeof detail.sourceUrl==="string"&&detail.sourceUrl.startsWith("https://")&&typeof detail.observedAt==="string")rechargeInfo={sourceUrl:detail.sourceUrl,observedAt:detail.observedAt};}catch{/* older snapshots have no verified recharge evidence */}
  const rechargeMultiplier=rechargeInfo&&valid(s.recharge_ratio)&&s.recharge_ratio>0?s.recharge_ratio:null;
  const groupKeys=new Map(site.groups.map(({group})=>[group.id,group.group_key]));
  const quotes:TransitQuote[]=site.groups.flatMap(({group:g,offers})=>offers.map(o=>({
    id:o.id,family:o.family??"其他",category:o.modality,model:o.raw_model,group:g.display_name,groupKey:g.group_key,
    multiplier:null,input:o.input_price,output:o.output_price,cacheRead:o.cache_read_price,cacheWrite:o.cache_write_price,
    fixedPrice:o.fixed_price,unit:o.price_unit??"未披露",cacheHitRate:null,currencyKind,cacheWrite1h:o.cache_write_1h_price,
    ...(o.modality==="image"||o.modality==="video"?{mediaPricing:mediaPricing(o,groupKeys)}:{}),
  })));
  const all=site.groups.flatMap(g=>g.offers);
  const byModel=new Map<string,typeof all>();
  for(const o of all){const key=JSON.stringify([o.raw_model,o.modality]);const rows=byModel.get(key)??[];rows.push(o);byModel.set(key,rows);}
  const prices:TransitPrice[]=[...byModel.entries()].map(([key,rows])=>{
    const first=rows[0];
    const isMedia=first.modality==="image"||first.modality==="video";
    const lowest=isMedia
      ? [...rows].sort((a,b)=>{const left=mediaFloor(a),right=mediaFloor(b);return left===right?0:left-right;})[0]??first
      : rows.filter(o=>valid(o.input_price)||valid(o.fixed_price)).sort((a,b)=>(a.input_price??a.fixed_price??Infinity)-(b.input_price??b.fixed_price??Infinity))[0]??first;
    // Display the metering group rate, never an invented official-price ratio.
    const rate=rows.map(o=>{
      const rateJson=o.effective_price_json;
      try{return rateJson?JSON.parse(rateJson).groupRate??null:null;}catch{return null;}
    });
    return {id:key,family:first.family??"其他",modelName:first.raw_model,
      category:first.modality==="image"||first.modality==="video"?first.modality:undefined,modality:first.modality,
      range:numericRange(rate),inputPrice:lowest.input_price,outputPrice:lowest.output_price,
      currencyKind,cacheReadPrice:lowest.cache_read_price,cacheWritePrice:lowest.cache_write_price,cacheWrite1hPrice:lowest.cache_write_1h_price,
      discount:offerDiscount(lowest,groupKeys),
      ...(isMedia?{mediaPricing:mediaPricing(lowest,groupKeys)}:{}),
      fixedPrice:lowest.fixed_price??undefined,priceUnit:first.price_unit??undefined,isLive:true as const};
  });
  const performance=site.performance?.stationId===s.id?site.performance:undefined;
  const monitor=performance?.station;
  const monitorsByGroup=performance?.groups??{};
  return {
    id:s.id,name:s.name,isLive:true,logoPath:s.logo_local_path??"",siteUrl:s.site_url,renderedAt:Date.now(),
    updatedAt:s.last_seen_at??s.listed_at,system:s.system==="new_api"?"New API":s.system==="sub_to_api"?"Sub2API":"自研",
    description:s.description??"",models:[...new Set(all.map(o=>o.raw_model))],groups:site.groups.length,prices,
    channels:[...new Set(site.groups.flatMap(g=>g.group.channel_type?[g.group.channel_type]:[]))].length?[...new Set(site.groups.flatMap(g=>g.group.channel_type?[g.group.channel_type]:[]))]:["未披露"],
    availability:monitor?.availability==null?null:`${monitor.availability.toFixed(2)}%`,samples:monitor?.samples??0,latency:monitor?.averageLatencyMs==null?null:`${(monitor.averageLatencyMs/1000).toFixed(1)}s`,recharge:rechargeMultiplier===null?"未披露":`¥1 = $${1/rechargeMultiplier}`,rechargeMultiplier,rechargeInfo,cacheHitRate:null,monitoringSource:monitor?.samples?"station_public":"unknown",
    detail:{quotes,listedAt:s.listed_at},
    groupLabels:Object.fromEntries(site.groups.map(({group:g})=>[g.display_name,{pool:g.pool_type,subscription:g.subscription,disclosure:g.disclosure??null,description:g.description??null}])),
    monitor,monitorsByGroup,monitorsByModel:includeModelMonitors?(performance?.models??{}):{},
    serviceState:s.service_state,catalogOnly:s.catalog_only,currencyKind,infrastructure:performance?.infrastructure,
    modelCatalog:Object.fromEntries([...new Set(all.map(o=>o.raw_model.toLowerCase()))].filter(name=>Object.hasOwn(catalog,name)).map(name=>[name,catalog[name]])),
  };
}
