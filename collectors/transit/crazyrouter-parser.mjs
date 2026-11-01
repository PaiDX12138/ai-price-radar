import {createHash} from 'node:crypto';
import {multiply} from '../../src/lib/transit/runapi-pricing.mjs';
import {crazyExpressionPrices,crazyTimePrices} from '../../src/lib/transit/crazyrouter-pricing.mjs';
export const CRAZY_PARSER_VERSION='crazyrouter_public_v1';
export const crazyHash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const requireValue=(ok,message)=>{if(!ok)throw new Error(message);};
export function parseCrazyMetadata(payload){
  const d=payload?.data;
  requireValue(payload?.success===true&&object(d)&&d.quota_display_type==='USD'&&finite(d.price)&&finite(d.usd_exchange_rate)&&d.usd_exchange_rate>0,'crazy_invalid_public_metadata');
  return {name:typeof d.system_name==='string'?d.system_name:'CrazyRouter',logo:d.logo,price:d.price,usdExchangeRate:d.usd_exchange_rate,
    stripeUnitPrice:finite(d.stripe_unit_price)?d.stripe_unit_price:null,quotaPerUnit:d.quota_per_unit,registerEnabled:d.register_enabled,
    sourceKind:'public_configuration_not_payment_quote'};
}
function family(name,vendor){
  const s=(name+' '+vendor).toLowerCase();
  for(const [pattern,label]of [[/claude|anthropic/,'Claude'],[/gpt|openai|codex|^o\d/,'GPT'],[/gemini|google|nano-banana|veo/,'Gemini'],[/deepseek/,'DeepSeek'],[/grok|xai|x\.ai/,'Grok'],[/glm|zhipu/,'GLM'],[/kimi|moonshot/,'Kimi'],[/qwen|alibaba|wan/,'Qwen'],[/minimax|hailuo/,'MiniMax'],[/mimo|xiaomi/,'Xiaomi MiMo'],[/typesafe|jev-/,'TypeSafe']])if(pattern.test(s))return label;
  return vendor||'其他';
}
function modality(m){
  if(m.video_pricing||/^(?:aigc-video-|wan\d|sora|veo|pixverse-video|doubao-seedance|hailuo)/i.test(m.model_name))return 'video';
  if(m.image_pricing||m.billing_mode==='per_image'||/^(?:gpt-image|nano-banana|aigc-image-|mj_|qwen-image|doubao-seedream)/i.test(m.model_name))return 'image';
  if(/speech|whisper|tts|suno|audio/i.test(m.model_name))return 'audio';
  if(/embedding|rerank/i.test(m.model_name))return 'embedding';
  return 'text';
}
const discounted=(price,factor)=>Number(multiply(price,factor));
function mediaRules(m,factor,warnings){
  const matrix=m.image_pricing??m.video_pricing;
  let billing=m.billing_mode??(m.quota_type===1?'per_request':'token');
  if(matrix){
    const declared=matrix.profile?.default_platform_billing_mode;
    if(m.video_pricing&&declared&&declared!==billing){
      warnings.push(`billing_profile_mismatch:${m.model_name}:${billing}/${declared}`);
      // The returned rule matrix explicitly carries its physical unit. Do not
      // label a per-second matrix as a per-request package just due to stale tag.
      if(billing==='per_request'&&declared==='per_second'&&!matrix.sell_skus?.length)billing=declared;
      else throw new Error('crazy_conflicting_matrix_unit');
    }
    if(m.image_pricing)billing='per_image';
  }
  const unit={per_image:'张',per_second:'秒',per_output_token:'百万输出Token',per_request:'次'}[billing];
  requireValue(Boolean(unit),'crazy_unknown_media_unit');
  const amounts=[],rules=[],items=[];
  if(matrix){
    requireValue(Array.isArray(matrix.rules)&&matrix.rules.length>0&&matrix.rules.length<=1000,'crazy_invalid_media_matrix');
    const seen=new Set();
    for(const rule of matrix.rules){
      requireValue(object(rule)&&typeof rule.rule_id==='string'&&!seen.has(rule.rule_id)&&(rule.model_name===m.model_name||rule.model_name===matrix.profile?.model_name)
        &&rule.platform_currency==='USD'&&finite(rule.platform_base_price),'crazy_invalid_media_rule');seen.add(rule.rule_id);
      if(rule.status==='disabled')continue;
      const price=discounted(rule.platform_base_price,factor),extra=rule.capability_bucket==='input_image';
      const dims=[rule.capability_bucket,rule.resolution,rule.mode,rule.reference_count_bucket,rule.aspect_ratio_bucket,rule.output_format,
        rule.has_audio===true?'含音频':rule.has_audio===false?'无音频':null,
        rule.has_video_input===true?'含输入视频':rule.has_video_input===false?'无输入视频':null,rule.duration_bucket?rule.duration_bucket+'秒':null].filter(Boolean).join(' · ');
      if(!extra)amounts.push(price);
      items.push({key:rule.rule_id,unit:billing==='per_second'?'per_second':billing==='per_output_token'?'per_M_output_tokens':billing==='per_image'?'per_image':'per_request',
        creditPrice:String(price),basePrice:String(rule.platform_base_price),baseCurrency:'USD_CREDIT',multiplier:String(factor)});
      rules.push({label:dims||rule.rule_id,description:`$${price}/${unit}${extra?' · 附加输入图，不计入主价格区间':''}${rule.verification_status?` · ${rule.verification_status}`:''}${rule.notes?' · '+rule.notes:''}`});
    }
  }else{
    requireValue(finite(m.model_price)&&m.model_price>0,'crazy_missing_fixed_price');amounts.push(discounted(m.model_price,factor));
    items.push({key:'request',unit:billing==='per_image'?'per_image':'per_request',creditPrice:String(amounts[0]),basePrice:String(m.model_price),baseCurrency:'USD_CREDIT',multiplier:String(factor)});
  }
  requireValue(amounts.length>0,'crazy_no_enabled_media_prices');
  const min=Math.min(...amounts),max=Math.max(...amounts);
  return {billingMode:billing,priceUnit:unit,modelPriceMin:min,modelPriceMax:max,fixedPrice:min===max?min:null,
    imageBilling:billing==='per_image'?'per_image':null,chargeItems:items,tiers:rules,mediaUnit:unit};
}
export function parseCrazyCatalog(payload,config,{previousModels=0,observedAt=new Date().toISOString()}={}){
  requireValue(payload?.success===true&&Array.isArray(payload.data)&&object(payload.group_ratio)&&object(payload.usable_group)&&Array.isArray(payload.vendors),'crazy_invalid_catalog');
  requireValue(payload.data.length>=(config.minimumModels??40)&&payload.data.length<=5000&&payload.data.length>=previousModels*(config.minimumCatalogFraction??.8),'crazy_catalog_shrank_or_incomplete');
  const vendors=new Map(payload.vendors.map(v=>[v.id,v])),seen=new Set(),groups=[],offers=[],warnings=[],families={};
  for(const key of Object.keys(payload.usable_group)){
    requireValue(typeof key==='string'&&key.length>0&&key.length<=160&&finite(payload.group_ratio[key])&&payload.group_ratio[key]>0,'crazy_invalid_group');
    groups.push({groupKey:key,displayName:String(payload.usable_group[key]||key),modelRatio:payload.group_ratio[key],disclosure:'站点公开',status:'active',rawGroup:{name:key,ratio:payload.group_ratio[key]}});
  }
  requireValue(groups.length>0,'crazy_no_public_groups');
  for(const m of payload.data){
    requireValue(object(m)&&typeof m.model_name==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,179}$/.test(m.model_name)&&!seen.has(m.model_name)
      &&[0,1].includes(m.quota_type)&&Array.isArray(m.enable_groups)&&m.enable_groups.length>0&&Array.isArray(m.supported_endpoint_types),'crazy_invalid_model');seen.add(m.model_name);
    const vendor=vendors.get(m.vendor_id),fam=family(m.model_name,vendor?.name),mode=modality(m);families[fam]=(families[fam]??0)+1;
    const memberships=new Set();
    for(const group of m.enable_groups){
      requireValue(!memberships.has(group),'crazy_duplicate_membership');memberships.add(group);
      requireValue(Object.hasOwn(payload.group_ratio,group)&&Object.hasOwn(payload.usable_group,group),'crazy_missing_public_group_ratio');
      const discount=m.group_discounts?.[group]??m.discount;
      requireValue(finite(discount)&&discount>0&&discount<=10,'crazy_missing_discount');
      const groupRate=payload.group_ratio[group],factor=Number(multiply(groupRate,discount));
      let prices={inputPrice:null,outputPrice:null,cacheReadPrice:null,cacheWritePrice:null,cacheWrite1hPrice:null,fixedPrice:null,chargeItems:[],tiers:[]},parseError=null;
      try{
        if(m.quota_type===0){
          if(m.billing_mode==='tiered_expr'){requireValue(typeof m.billing_expr==='string'&&m.billing_expr.length>0,'crazy_missing_expression');prices={...prices,...crazyExpressionPrices(m.billing_expr,factor)};}
          else if(m.time_pricing||m.billing_mode==='time_tiered')prices={...prices,...crazyTimePrices(m.time_pricing,factor,Date.parse(observedAt))};
          else{
            requireValue((m.billing_mode===undefined||m.billing_mode==='per_token')&&finite(m.model_ratio)&&finite(m.completion_ratio),'crazy_unknown_token_billing');
            const input=Number(multiply(multiply(m.model_ratio,2),factor));
            const cache=(field,enabled)=>enabled===false?null:finite(m[field])?discounted(input,m[field]):null;
            prices={...prices,inputPrice:input,outputPrice:discounted(input,m.completion_ratio),cacheReadPrice:cache('cache_ratio',m.cache_ratio_configured),cacheWritePrice:cache('cache_creation_ratio',m.cache_creation_priced)};
            prices.chargeItems=[['prompt',prices.inputPrice],['completion',prices.outputPrice],['cache_read',prices.cacheReadPrice],['cache_write',prices.cacheWritePrice]].filter(([,value])=>value!==null)
              .map(([key,value])=>({key,unit:'per_M_tokens',creditPrice:String(value),basePrice:String(value/factor),baseCurrency:'USD_CREDIT',multiplier:String(factor)}));
          }
        }else prices={...prices,...mediaRules(m,factor,warnings)};
      }catch(error){parseError=error.message;warnings.push(`pricing_quarantined:${m.model_name}:${parseError}`);}
      const effectivePrice={basis:'crazyrouter_public_usd_credit',currencyKind:'usd_credit',groupRate:factor,baseGroupRate:groupRate,siteDiscount:discount,totalFactor:factor,
        chargeItems:prices.chargeItems,tiers:prices.tiers,detailObservedAt:observedAt,parseError,
        ...(m.time_pricing?{timePricing:m.time_pricing,currentTier:prices.currentTier}:{}),...(prices.mediaUnit?{mediaUnit:prices.mediaUnit}:{}),billingExpr:m.billing_expr??null};
      offers.push({groupKey:group,rawModel:m.model_name,standardModel:m.model_name,family:fam,modality:mode,vendorId:m.vendor_id,vendorName:vendor?.name??null,
        currency:'USD',priceKind:m.quota_type===0?'token':'fixed',priceUnit:m.quota_type===0?'M Token':prices.priceUnit??null,
        billingMode:m.quota_type===0?'token':prices.billingMode??m.billing_mode??'per_request',quotaType:m.quota_type,
        ...Object.fromEntries(['inputPrice','outputPrice','cacheReadPrice','cacheWritePrice','cacheWrite1hPrice','fixedPrice','modelPriceMin','modelPriceMax','imageBilling'].map(key=>[key,prices[key]??null])),
        supportedEndpointTypes:[...(m.public_endpoint_types??m.supported_endpoint_types)].sort(),tiers:prices.tiers,basePrice:{modelRatio:m.model_ratio,modelPrice:m.model_price,imagePricing:m.image_pricing,videoPricing:m.video_pricing,timePricing:m.time_pricing},
        effectivePrice,compositeMultiplier:null,rawOffer:m,sourceUrl:config.pricingUrl,
        discount:{ratio:discount,source:'station_reported',basis:'station_reference',details:{ratio:discount,groupKey:group,sourceUrl:config.pricingUrl,
          observedAt,metric:m.quota_type===0?'input':'request',currencyBasis:'station_usd_credit_nominal_not_cash_payment'}}});
    }
  }
  const missing=(config.requiredFamilies??[]).filter(f=>!families[f]);requireValue(!missing.length,`crazy_missing_families:${missing.join(',')}`);
  requireValue(offers.length>0,'crazy_no_public_offers');
  // This source iterates model maps in a different order on each request. A
  // transport reorder is not a price change; preserve original order in raw
  // archives and canonicalize the versioned business catalog only.
  const catalog={...payload,data:payload.data.map(m=>({...m,enable_groups:[...m.enable_groups].sort(),supported_endpoint_types:[...m.supported_endpoint_types].sort(),
    ...(Array.isArray(m.public_endpoint_types)?{public_endpoint_types:[...m.public_endpoint_types].sort()}:{}),
  })).sort((a,b)=>a.model_name.localeCompare(b.model_name,'en')),
    vendors:[...payload.vendors].sort((a,b)=>a.id-b.id)};
  return {catalog,groups,offers,warnings,inventory:{models:seen.size,groups:groups.length,offers:offers.length,families,expressionModels:payload.data.filter(m=>m.billing_expr).length,
    timeModels:payload.data.filter(m=>m.time_pricing).length,mediaMatrices:payload.data.filter(m=>m.image_pricing||m.video_pricing).length,
    matrixRules:payload.data.reduce((n,m)=>n+(m.image_pricing?.rules?.length??0)+(m.video_pricing?.rules?.length??0),0),quarantined:offers.filter(o=>o.effectivePrice.parseError).length}};
}
export function parseCrazySummary(payload){
  requireValue(payload?.success===true&&Array.isArray(payload.data?.models),'crazy_invalid_summary');
  const seen=new Set();return payload.data.models.map(m=>{
    requireValue(typeof m.model_name==='string'&&!seen.has(m.model_name)&&Number.isSafeInteger(m.request_count)&&m.request_count>=0,'crazy_invalid_summary_model');seen.add(m.model_name);
    // Keep rolling statistics separately, never copy a 24h average into each hour.
    return {model:m.model_name,requests:m.request_count,availability:m.success_rate,averageLatencyMs:m.avg_latency_ms,averageTtftMs:m.avg_ttft_ms,averageTps:m.avg_tps};
  });
}
export function parseCrazyPerformance(payload,{model,groups,observedAt}){
  requireValue(payload?.success===true&&payload.data?.model_name===model&&payload.data.series_schema==='bucket'&&Array.isArray(payload.data.groups),'crazy_invalid_performance_identity');
  const rows=[],seen=new Set(),now=Date.parse(observedAt),allowed=new Set(groups);
  for(const g of payload.data.groups){
    requireValue(allowed.has(g.group)&&!seen.has(g.group)&&Array.isArray(g.series)&&g.series.length<=360,'crazy_invalid_performance_group');seen.add(g.group);
    const timestamps=new Set();
    for(const point of g.series){
      const ts=point.ts;
      requireValue(Number.isSafeInteger(ts)&&ts%3600===0&&ts*1000>=now-16*86400000&&ts*1000<=now+300000&&!timestamps.has(ts)
        &&finite(point.success_rate)&&point.success_rate<=100,'crazy_invalid_performance_point');timestamps.add(ts);
      for(const key of ['avg_ttft_ms','avg_latency_ms','avg_tps'])requireValue(point[key]===null||finite(point[key]),'crazy_invalid_metric_value');
      rows.push({modelName:model,groupKey:g.group,bucketAt:new Date(ts*1000).toISOString(),bucketEndAt:new Date((ts+3600)*1000).toISOString(),
        successRate:point.success_rate,avgTtftMs:point.avg_ttft_ms>0?point.avg_ttft_ms:null,avgLatencyMs:point.avg_latency_ms>0?point.avg_latency_ms:null,
        avgTps:point.avg_tps>0?point.avg_tps:null,hasData:point.success_rate<100||point.avg_ttft_ms>0||point.avg_latency_ms>0||point.avg_tps>0,
        resolutionSeconds:3600,isPartial:(ts+3600)*1000>now});
    }
  }
  return rows;
}
