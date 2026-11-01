import {createHash} from 'node:crypto';
import {decimal,multiply,runPriceProjection,parseRunExpression} from '../../src/lib/transit/runapi-pricing.mjs';
import {resolveTransitDiscount} from './discounts.mjs';
import {classifyPackyModel} from './packyapi.mjs';
export const runHash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const identity=v=>typeof v==='string'&&v.length>0&&v.length<=200&&!/[\x00-\x20]/.test(v);
const optional=(value)=>value==null?null:decimal(value);
export function parseRunMetadata(payload){
  const d=payload?.data;if(payload?.success!==true||!object(d)||d.quota_display_type!=='USD'||!finite(d.price)||d.price<=0||!finite(d.usd_exchange_rate)||d.usd_exchange_rate<=0)throw new Error('invalid_runapi_metadata');
  let groupDisplay={};try{groupDisplay=typeof d.GroupDisplayRatio==='string'?JSON.parse(d.GroupDisplayRatio):d.GroupDisplayRatio??{};}catch{/* non-price display text */}
  return {systemName:d.system_name,price:d.price,usdExchangeRate:d.usd_exchange_rate,stripeUnitPrice:finite(d.stripe_unit_price)?d.stripe_unit_price:null,
    quotaPerUnit:d.quota_per_unit,displayCurrency:'USD',groupDisplay,mainlandPolicy:!!d.mainland_display_policy_enabled,isMainland:!!d.is_mainland_ip,
    announcements:Array.isArray(d.announcements)?d.announcements:[],sourceKind:'public_configuration_not_payment_quote'};
}
export function parseRunCatalog(payload,config,{metadata,observedAt=new Date().toISOString(),references={}}={}){
  if(payload?.success!==true||!Array.isArray(payload.data)||payload.data.length<(config.minimumModels??100)||payload.data.length>10000
    ||!object(payload.group_ratio)||!object(payload.usable_group))throw new Error('invalid_runapi_catalog');
  const seen=new Set(),vendors=new Map((payload.vendors??[]).map(v=>[v.id,v])),offers=[],warnings=[],memberships=[],billing=[],families=new Set();
  const keys=new Set([...Object.keys(payload.usable_group),...payload.data.flatMap(m=>m.enable_groups??[])]);
  const groups=[...keys].map(key=>{
    if(!identity(key))throw new Error('invalid_runapi_group');
    const visible=Object.hasOwn(payload.usable_group,key)&&finite(payload.group_ratio[key]);
    return {groupKey:key,displayName:key,status:visible?'active':'withdrawn',modelRatio:visible?payload.group_ratio[key]:null,
      description:payload.usable_group[key]??null,disclosure:visible?'站点公开':null,
      rawGroup:{sourceVisibility:visible?'public':'referenced_only',ratio:payload.group_ratio[key]??null,displayText:metadata?.groupDisplay?.[key]??null}};
  });
  const publicGroups=new Set(groups.filter(g=>g.status==='active').map(g=>g.groupKey));
  if(!publicGroups.size)throw new Error('empty_runapi_public_groups');
  for(const m of payload.data){
    if(!identity(m.model_name)||seen.has(m.model_name)||![0,1].includes(m.quota_type)||!Array.isArray(m.enable_groups)||!m.enable_groups.length||new Set(m.enable_groups).size!==m.enable_groups.length||!Array.isArray(m.supported_endpoint_types))throw new Error('invalid_runapi_model');
    seen.add(m.model_name);
    const vendor=vendors.get(m.vendor_id),classification=classifyPackyModel(m.model_name,m.supported_endpoint_types,vendor?.name);
    const tags=String(m.tags??'').toLowerCase();let modality=classification.modality;
    if(tags.includes('image generation'))modality='image';else if(tags.includes('video generation'))modality='video';
    else if(/audio|music/.test(tags))modality='audio';else if(/embedding|rerank/.test(tags))modality='embedding';
    const family=classification.family;families.add(family);
    if(m.billing_expr&&m.billing_mode!=='tiered_expr')throw new Error('runapi_expression_mode_mismatch');
    let expressionError=null;
    if(m.billing_mode==='tiered_expr')try{parseRunExpression(m.billing_expr);runPriceProjection(m.billing_expr,1,Date.parse(observedAt));}catch(error){expressionError=error.message;warnings.push(`expression_quarantined:${m.model_name}:${expressionError}`);}
    else if(m.quota_type===0){decimal(m.model_ratio);decimal(m.completion_ratio);optional(m.cache_ratio);optional(m.create_cache_ratio);}
    else decimal(m.model_price);
    if(m.billing_mode&& !['tiered_expr','token','fixed'].includes(m.billing_mode))throw new Error('unrecognized_runapi_billing_mode');
    if(m.billing_expr)billing.push({model:m.model_name,expression:m.billing_expr,parseError:expressionError});
    for(const groupKey of m.enable_groups){
      memberships.push({model:m.model_name,group:groupKey,priceAvailable:publicGroups.has(groupKey)});
      if(!publicGroups.has(groupKey))continue;
      const rate=decimal(payload.group_ratio[groupKey]),token=m.quota_type===0;
      let input=null,output=null,cacheRead=null,cacheWrite=null,cache1h=null,fixed=null,chargeItems,tiers;
      if(m.billing_mode==='tiered_expr'){
        if(!expressionError){const v=runPriceProjection(m.billing_expr,rate,Date.parse(observedAt));input=v.inputPrice;output=v.outputPrice;cacheRead=v.cacheReadPrice;cacheWrite=v.cacheWritePrice;cache1h=v.cacheWrite1hPrice;chargeItems=v.chargeItems;tiers=v.tiers;}
      }else if(token){
        input=Number(multiply(multiply(m.model_ratio,2),rate));output=Number(multiply(input,m.completion_ratio));
        cacheRead=m.cache_ratio==null?null:Number(multiply(input,m.cache_ratio));cacheWrite=m.create_cache_ratio==null?null:Number(multiply(input,m.create_cache_ratio));
      }else fixed=Number(multiply(m.model_price,rate));
      const effectivePrice={basis:'runapi_public_usd_credit',currencyKind:'usd_credit',groupRate:Number(rate),
        ...(m.billing_mode==='tiered_expr'?{billingExpr:m.billing_expr,expressionError,chargeItems,tiers}:{}),detailObservedAt:observedAt};
      const offer={groupKey,rawModel:m.model_name,standardModel:m.model_name,family,modality,vendorId:m.vendor_id,vendorName:vendor?.name??null,
        quotaType:m.quota_type,priceKind:token?'token':'fixed',priceUnit:token?'M Token':'次',currency:'USD',billingMode:token?(m.billing_mode??'token'):'per_request',
        inputPrice:input,outputPrice:output,cacheReadPrice:cacheRead,cacheWritePrice:cacheWrite,cacheWrite1hPrice:cache1h,fixedPrice:fixed,
        imageBilling:modality==='image'&&token?'token':null,tiers:tiers??[],supportedEndpointTypes:m.supported_endpoint_types,
        sourceUrl:config.pricingUrl,sourceModelVersion:m.pricing_version??runHash(m),basePrice:{modelRatio:m.model_ratio,modelPrice:m.model_price,unit:token?'M Token':'次'},
        effectivePrice,rawOffer:m};
      const reference=references[m.model_name.toLowerCase()]?.priceReference;
      offer.discount=resolveTransitDiscount({offer,reference,observedAt});
      if(offer.discount)offer.discount.details.currencyBasis='station_usd_credit_nominal_not_cash_payment';
      offers.push(offer);
    }
  }
  for(const f of config.requiredFamilies??['Claude','GPT','Gemini','DeepSeek'])if(!families.has(f))throw new Error(`incomplete_runapi_families:${f}`);
  if(!offers.length)throw new Error('empty_runapi_offers');
  return {groups,offers,memberships,billing,warnings,modelCount:seen.size,inventory:{models:seen.size,groups:publicGroups.size,referencedGroups:groups.length,memberships:memberships.length,offers:offers.length,
    missingRatioGroups:groups.filter(g=>g.status!=='active').map(g=>g.groupKey),dynamicModels:billing.length,families:[...families]}};
}

export function runProbeTime(value,at){
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value))throw new Error('invalid_runapi_probe_time');
  const ms=Date.parse(value),fraction=value.match(/\.(\d{1,6})/)?.[1]??'';
  const [year,month,day,hour,minute,second]=value.slice(0,19).match(/\d+/g).map(Number);
  if(year<2000||month<1||month>12||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate()||hour>23||minute>59||second>59)throw new Error('invalid_runapi_calendar');
  if(!Number.isFinite(ms)||ms>Date.parse(at)+300000||ms<Date.parse(at)-35*86400000)throw new Error('runapi_probe_out_of_range');
  return new Date(ms).toISOString().slice(0,19)+'.'+fraction.padEnd(6,'0')+'Z';
}
export function parseRunMonitoring(payload,{observedAt}={}){
  if(!Array.isArray(payload?.providerTimelines)||!payload.providerTimelines.length||payload.providerTimelines.length>200||payload.total!==payload.providerTimelines.length
    ||payload.trendPeriod!=='15d'||!finite(payload.generatedAt)||payload.generatedAt>Date.parse(observedAt)+300000||payload.generatedAt<Date.parse(observedAt)-86400000||!object(payload.availabilityStats))throw new Error('invalid_runapi_dashboard');
  const targets=[],probes=[],summaries=[],ids=new Set(),states=new Set(['operational','degraded','failed','validation_failed','maintenance','error']);
  for(const timeline of payload.providerTimelines){
    const latest=timeline.latest,id=timeline.id;
    if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id)||ids.has(id)||!identity(latest?.model)||typeof latest.name!=='string'||latest.name.length>300||!Array.isArray(timeline.items)||timeline.items.length>2000)throw new Error('invalid_runapi_target');
    ids.add(id);const endpoint=new URL(latest.endpoint);if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search)throw new Error('invalid_runapi_probe_endpoint');
    targets.push({id,name:latest.name,model:latest.model,groupHint:latest.groupName??latest.name.split(' - ')[0],endpoint:endpoint.href,type:latest.type,raw:latest});
    const seen=new Map();
    for(const point of [...timeline.items,latest]){
      if(point.id!==id||point.model!==latest.model||!states.has(point.status)||[point.latencyMs,point.pingLatencyMs].some(v=>v!=null&&!finite(v)))throw new Error('invalid_runapi_probe');
      const time=runProbeTime(point.checkedAt,observedAt),fingerprint=runHash({status:point.status,model:point.model,latency:point.latencyMs??null,ping:point.pingLatencyMs??null});
      if(seen.has(time)){if(seen.get(time)!==fingerprint)throw new Error('runapi_conflicting_response_probe');continue;}seen.set(time,fingerprint);
      probes.push({id,time,status:point.status,latency:point.latencyMs??null,ping:point.pingLatencyMs??null,fingerprint,raw:point});
    }
    const stats=payload.availabilityStats[id];if(!Array.isArray(stats))throw new Error('missing_runapi_summary');
    const periods=new Set();for(const s of stats){
      if(!['7d','15d','30d'].includes(s.period)||periods.has(s.period)||!Number.isInteger(s.totalChecks)||s.totalChecks<0||!Number.isInteger(s.operationalCount)||s.operationalCount<0||s.operationalCount>s.totalChecks||!finite(s.availabilityPct)||s.availabilityPct>100
        ||s.totalChecks>0&&Math.abs(100*s.operationalCount/s.totalChecks-s.availabilityPct)>0.011)throw new Error('invalid_runapi_summary');
      periods.add(s.period);summaries.push({id,...s});
    }
    if(!periods.has('15d'))throw new Error('missing_runapi_15d_summary');
  }
  return {targets,probes,summaries,generatedAt:new Date(payload.generatedAt).toISOString(),pollIntervalMs:payload.pollIntervalMs};
}
