import {createHash} from 'node:crypto';
import {classifyPackyModel} from './packyapi.mjs';
import {multiply} from '../../src/lib/transit/runapi-pricing.mjs';
import {chickenerExpressionPrices} from '../../src/lib/transit/chickener-pricing.mjs';
export const CHICKENER_PARSER_VERSION='chickener_public_v1';
export const chickenerHash=v=>createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
const number=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const identity=v=>typeof v==='string'&&v.length>0&&v.length<=300&&!/[\u0000-\u001f]/.test(v);
const requireValue=(test,message)=>{if(!test)throw Error(message);};
export function parseChickenerMetadata(payload){
  const d=payload?.data;
  requireValue(payload?.success===true&&d?.quota_display_type==='CNY'&&number(d.price)&&number(d.usd_exchange_rate)&&d.quota_per_unit===500000,'chickener_invalid_metadata');
  return {name:d.system_name,version:d.version,displayCurrency:'CNY',currencyKind:'cny_credit',price:d.price,usdExchangeRate:d.usd_exchange_rate,
    quotaPerUnit:d.quota_per_unit,registerEnabled:d.register_enabled,redemptionBonusTiers:d.redemption_bonus_tiers??null,
    rechargeVerified:false,sourceKind:'public_configuration_not_payment_quote'};
}
export function parseChickenerCatalog(payload,config,{observedAt=new Date().toISOString(),previousModels=0}={}){
  requireValue(payload?.success===true&&Array.isArray(payload.data)&&payload.data.length>=(config.minimumModels??5)&&payload.data.length<=5000,'chickener_invalid_catalog');
  requireValue(payload.all_group_ratio&&typeof payload.all_group_ratio==='object'&&payload.group_ratio&&payload.usable_group,'chickener_missing_group_metadata');
  if(previousModels&&payload.data.length<previousModels*(config.minimumCatalogFraction??0.8))throw Error('chickener_catalog_shrank');
  const vendors=new Map((payload.vendors??[]).map(v=>[v.id,v])),seen=new Set(),members=new Map(),offers=[],warnings=[];
  for(const m of payload.data){
    requireValue(identity(m.model_name)&&!seen.has(m.model_name)&&[0,1].includes(m.quota_type)&&Array.isArray(m.enable_groups)&&m.enable_groups.length>0&&m.enable_groups.length<=100&&new Set(m.enable_groups).size===m.enable_groups.length&&Array.isArray(m.supported_endpoint_types),'chickener_invalid_model');seen.add(m.model_name);
    if(m.billing_expr&&m.billing_mode!=='tiered_expr')throw Error('chickener_expression_mode_mismatch');
    const vendor=vendors.get(m.vendor_id),classified=classifyPackyModel(m.model_name,m.supported_endpoint_types,vendor?.name);
    const modality=/^gpt-image-/i.test(m.model_name)||m.quota_type===1&&m.supported_endpoint_types.includes('image-generation')?'image':classified.modality;
    const conflict=/不支持\s*Responses/i.test(m.description??'')&&m.supported_endpoint_types.includes('openai-response');
    if(conflict)warnings.push(`endpoint_declaration_conflict:${m.model_name}`);
    for(const group of m.enable_groups){
      requireValue(identity(group)&&Object.hasOwn(payload.all_group_ratio,group)&&number(payload.all_group_ratio[group]),'chickener_group_ratio_missing');
      const rate=payload.all_group_ratio[group];members.set(group,[...(members.get(group)??[]),m.model_name]);
      let projection={inputPrice:null,outputPrice:null,cacheReadPrice:null,cacheWritePrice:null,cacheWrite1hPrice:null,tiers:[],chargeItems:[]},fixed=null,expressionError=null;
      if(m.billing_mode==='tiered_expr'){
        try{projection=chickenerExpressionPrices(m.billing_expr,rate,Date.parse(observedAt));}
        catch(error){expressionError=error.message;warnings.push(`expression_quarantined:${m.model_name}:${expressionError}`);}
      }else if(m.quota_type===0){
        requireValue(number(m.model_ratio)&&number(m.completion_ratio),'chickener_invalid_token_price');
        for(const k of ['cache_ratio','create_cache_ratio'])if(m[k]!=null)requireValue(number(m[k]),'chickener_invalid_cache_price');
        const input=Number(multiply(multiply(m.model_ratio,2),rate));projection={...projection,inputPrice:input,outputPrice:Number(multiply(input,m.completion_ratio)),
          cacheReadPrice:m.cache_ratio==null?null:Number(multiply(input,m.cache_ratio)),cacheWritePrice:m.create_cache_ratio==null?null:Number(multiply(input,m.create_cache_ratio))};
      }else{requireValue(number(m.model_price),'chickener_invalid_request_price');fixed=Number(multiply(m.model_price,rate));}
      if(m.billing_mode!=='tiered_expr'){
        const values=m.quota_type===1?{request:fixed}:{prompt:projection.inputPrice,completion:projection.outputPrice,cache_read:projection.cacheReadPrice,cache_write:projection.cacheWritePrice};
        const baseInput=m.quota_type===0?Number(multiply(m.model_ratio,2)):null;
        const bases=m.quota_type===1?{request:m.model_price}:{prompt:baseInput,completion:Number(multiply(baseInput,m.completion_ratio)),
          cache_read:m.cache_ratio==null?null:Number(multiply(baseInput,m.cache_ratio)),cache_write:m.create_cache_ratio==null?null:Number(multiply(baseInput,m.create_cache_ratio))};
        projection.chargeItems=Object.entries(values).filter(([,v])=>v!==null).map(([key,v])=>({key,unit:m.quota_type===1?'per_request':'per_M_tokens',creditPrice:String(v),basePrice:String(bases[key]),baseCurrency:'CNY_CREDIT',multiplier:String(rate)}));
      }
      if(m.billing_mode&&!['tiered_expr','token','fixed'].includes(m.billing_mode))throw Error('chickener_unknown_billing_mode');
      offers.push({groupKey:group,rawModel:m.model_name,standardModel:m.model_name,family:classified.family,modality,vendorId:m.vendor_id,vendorName:vendor?.name??null,
        quotaType:m.quota_type,priceKind:m.quota_type===1?'fixed':'token',priceUnit:m.quota_type===1?'次':'M Token',currency:'CNY',billingMode:m.quota_type===1?'per_request':m.billing_mode??'token',
        inputPrice:projection.inputPrice,outputPrice:projection.outputPrice,cacheReadPrice:projection.cacheReadPrice,cacheWritePrice:projection.cacheWritePrice,cacheWrite1hPrice:projection.cacheWrite1hPrice,
        fixedPrice:fixed,compositeMultiplier:rate,tiers:projection.tiers,supportedEndpointTypes:m.supported_endpoint_types,sourceUrl:config.pricingUrl,
        sourceModelVersion:m.pricing_version??chickenerHash(m),rawOffer:m,
        basePrice:{modelRatio:m.model_ratio,modelPrice:m.model_price,currencyKind:'cny_credit'},
        effectivePrice:{basis:'chickener_public_credit_v1',currencyKind:'cny_credit',groupRate:rate,mediaUnit:m.quota_type===1?'次':undefined,
          billingExpr:m.billing_expr??null,expressionError,tiers:projection.tiers,chargeItems:projection.chargeItems,detailObservedAt:observedAt,
          endpointDeclarationConflict:conflict,cacheWriteTtl:'unspecified',rechargeVerified:false},discount:null});
    }
  }
  const groups=[...members].map(([group,models])=>({groupKey:group,displayName:payload.usable_group[group]||group,modelRatio:payload.all_group_ratio[group],disclosure:'站点公开',
    description:/仅限/.test(group)?group:null,rawGroup:{models,accountSelectable:Object.hasOwn(payload.usable_group,group),source:'public_catalog_membership'}}));
  return {groups,offers,warnings,modelCount:seen.size,inventory:{models:seen.size,groups:groups.length,offers:offers.length,dynamicModels:payload.data.filter(m=>m.billing_mode==='tiered_expr').length,
    metadataOnlyGroups:Object.keys(payload.all_group_ratio).filter(g=>!members.has(g)),families:[...new Set(offers.map(o=>o.family))]}};
}
export function parseChickenerPerformance(payload,model,groups,observedAt){
  requireValue(payload?.success===true&&payload.data?.model_name===model&&Array.isArray(payload.data.groups)&&payload.data.groups.length<=100,'chickener_invalid_performance');
  const rows=[],seen=new Map(),known=new Set(groups),unmatched=[];
  for(const g of payload.data.groups){
    requireValue(identity(g.group)&&Array.isArray(g.series)&&g.series.length<=1000,'chickener_invalid_performance_group');
    for(const p of g.series){
      requireValue(Number.isInteger(p.ts)&&p.ts%3600===0&&p.ts*1000>=Date.parse(observedAt)-361*3600000&&p.ts*1000<=Date.parse(observedAt)+300000
        &&number(p.success_rate)&&p.success_rate<=100&&['avg_ttft_ms','avg_latency_ms','avg_tps'].every(k=>p[k]==null||number(p[k])),'chickener_invalid_performance_point');
      const key=g.group+'|'+p.ts,hash=chickenerHash(p);if(seen.has(key)){requireValue(seen.get(key)===hash,'chickener_conflicting_bucket');continue;}seen.set(key,hash);
      if(!known.has(g.group)){unmatched.push({group:g.group,ts:p.ts});continue;}
      rows.push({modelName:model,groupKey:g.group,bucketAt:new Date(p.ts*1000).toISOString(),bucketEndAt:new Date((p.ts+3600)*1000).toISOString(),
        avgTtftMs:p.avg_ttft_ms>0?p.avg_ttft_ms:null,avgLatencyMs:p.avg_latency_ms>0?p.avg_latency_ms:null,avgTps:p.avg_tps>0?p.avg_tps:null,successRate:p.success_rate,
        hasData:p.success_rate<100||p.avg_ttft_ms>0||p.avg_latency_ms>0||p.avg_tps>0,isPartial:(p.ts+3600)*1000>Date.parse(observedAt),resolutionSeconds:3600});
    }
  }
  return {rows,unmatched,sourceSchema:typeof payload.data.series_schema==='string'?payload.data.series_schema:null};
}
