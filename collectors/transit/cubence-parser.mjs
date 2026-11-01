import {createHash} from 'node:crypto';
import {resolveTransitDiscount} from './discounts.mjs';

export const CUBENCE_PARSER_VERSION='cubence_public_base_v1';
export const cubenceHash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const fields=['input_price','output_price','cache_read_price','cache_write_price'];
const required=(condition,message)=>{if(!condition)throw new Error(message);};

/** JSON literals only; never eval the scripts or treat Flight references as code. */
export function extractCubenceCatalog(html) {
  required(typeof html==='string'&&Buffer.byteLength(html)<=8*1024*1024,'cubence_invalid_html_size');
  const streams=[];
  for(const match of html.matchAll(/<script\b[^>]*>(self\.__next_f\.push\([\s\S]*?)<\/script>/g)){
    const source=match[1];
    try{const row=JSON.parse(source.slice(source.indexOf('(')+1,source.lastIndexOf(')')));
      if(row[0]===1&&typeof row[1]==='string')streams.push(row[1]);}catch{/* non-JSON Flight metadata */}
  }
  const found=new Map();let visits=0;
  const walk=(value,depth=0)=>{
    if(!value||typeof value!=='object')return;
    required(depth<=50&&++visits<=150000,'cubence_flight_structure_limit');
    if(object(value.catalog)&&Array.isArray(value.catalog.models))found.set(cubenceHash(value.catalog),value.catalog);
    for(const child of Object.values(value))walk(child,depth+1);
  };
  for(const line of streams.join('').split('\n')){
    const match=/^[a-f0-9]+:([\[{].*)$/i.exec(line);if(!match)continue;
    let value;try{value=JSON.parse(match[1]);}catch{continue;}walk(value);
  }
  required(found.size===1,'cubence_missing_or_ambiguous_catalog');
  return [...found.values()][0];
}

export function cubenceFamily(model) {
  const name=model.model_name.toLowerCase();
  const prefixes=[[/^claude/,'Claude'],[/^(gpt|codex|chatgpt|o\d)/,'GPT'],[/^(gemini|imagen|veo|nano-banana)/,'Gemini'],[/^deepseek/,'DeepSeek'],[/^grok/,'Grok'],[/^glm/,'GLM'],[/^(kimi|moonshot)/,'Kimi'],[/^qwen/,'Qwen'],[/^minimax/,'MiniMax'],[/^jev/,'TypeSafe']];
  return prefixes.find(([pattern])=>pattern.test(name))?.[1]??(/^meta/i.test(model.vendor.name)?'Meta':({meta:'Meta',typesafe:'TypeSafe',minimax:'MiniMax'}[model.vendor.slug.toLowerCase()]??'其他'));
}
export function cubenceModality(model) {
  // Vision input is not image generation. Only explicit generation identifiers.
  const name=model.model_name.toLowerCase();
  if(/^(veo|sora|kling)(?:[-\d]|$)/.test(name))return 'video';
  return /^(?:gpt-image|grok-imagine-image|imagen|nano-banana)/.test(name)||/^gemini-.*(?:image|nano-banana)/.test(name)?'image':'text';
}
export function cubenceTier(model,promptTokens) {
  required(Number.isSafeInteger(promptTokens)&&promptTokens>=0,'cubence_invalid_prompt_tokens');
  return model.pricing_tiers.find(t=>promptTokens>=t.min_tokens&&(t.max_tokens===null||promptTokens<=t.max_tokens))??model;
}
function priceItems(value,mode) {
  if(mode==='per_request')return [{key:'image_output',unit:'per_image',baseCurrency:'USD',basePrice:String(value.request_price),creditPrice:String(value.request_price),multiplier:'1'}];
  return [['prompt','input_price'],['completion','output_price'],['cache_read','cache_read_price'],['cache_write','cache_write_price']]
    .map(([key,field])=>({key,unit:'per_M_tokens',baseCurrency:'USD',basePrice:String(value[field]),creditPrice:String(value[field]),multiplier:'1'}));
}
function validateModel(model) {
  required(object(model)&&typeof model.model_name==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,179}$/.test(model.model_name),'cubence_invalid_model_identity');
  required(object(model.vendor)&&Number.isSafeInteger(model.vendor_id)&&model.vendor_id>=0&&model.vendor.id===model.vendor_id
    &&['name','slug'].every(key=>typeof model.vendor[key]==='string'&&model.vendor[key].length>0&&model.vendor[key].length<=160),'cubence_invalid_vendor');
  required(['token','per_request'].includes(model.billing_mode)&&['fixed','dynamic'].includes(model.request_billing_strategy),'cubence_unknown_billing');
  required([...fields,'request_price'].every(key=>finite(model[key])),'cubence_invalid_base_price');
  required(typeof model.updated_at==='string'&&Number.isFinite(Date.parse(model.updated_at)),'cubence_invalid_updated_at');
  required(Array.isArray(model.pricing_tiers)&&model.pricing_tiers.length<=100,'cubence_invalid_tiers');
  let previous=-1;
  for(const tier of model.pricing_tiers){
    required(object(tier)&&Number.isSafeInteger(tier.min_tokens)&&tier.min_tokens===previous+1
      &&(tier.max_tokens===null||(Number.isSafeInteger(tier.max_tokens)&&tier.max_tokens>=tier.min_tokens))
      &&fields.every(key=>finite(tier[key])),'cubence_invalid_tier_bounds_or_prices');
    previous=tier.max_tokens??Infinity;
  }
  required(!model.pricing_tiers.length||previous===Infinity,'cubence_incomplete_tier_coverage');
  if(model.billing_mode==='per_request'){
    // The current source contract is fixed per returned image. Fail closed for
    // new dynamic/video billing until its actual payload and unit are verified.
    required(model.request_billing_strategy==='fixed'&&cubenceModality(model)==='image'&&!model.pricing_tiers.length,'cubence_unverified_request_billing');
  }
}

export function parseCubenceCatalog(html,config,{previousModels=0,references={},observedAt=new Date().toISOString()}={}) {
  const catalog=extractCubenceCatalog(html);
  required(catalog.currency==='USD'&&catalog.price_basis==='base'&&catalog.region_scope==='global','cubence_unknown_price_basis');
  required(catalog.models.length>=(config.minimumModels??20)&&catalog.models.length<=3000,'cubence_incomplete_catalog');
  const seen=new Set(),vendors=new Set(),families={},modalities={};let tiers=0;
  for(const model of catalog.models){
    validateModel(model);required(!seen.has(model.model_name),'cubence_duplicate_model');seen.add(model.model_name);vendors.add(model.vendor_id);
    const family=cubenceFamily(model),modality=cubenceModality(model);families[family]=(families[family]??0)+1;modalities[modality]=(modalities[modality]??0)+1;tiers+=model.pricing_tiers.length;
  }
  required(catalog.models.length>=previousModels*(config.minimumCatalogFraction??0.8),'cubence_catalog_shrank_last_good_retained');
  const missing=(config.requiredFamilies??[]).filter(f=>!families[f]);required(!missing.length,`cubence_incomplete_families:${missing.join(',')}`);
  const groupKey='public-base';
  const offers=catalog.models.map(model=>{
    const selected=cubenceTier(model,0),image=model.billing_mode==='per_request',modality=cubenceModality(model);
    const rules=model.pricing_tiers.map(t=>({label:`${t.min_tokens.toLocaleString('en-US')}–${t.max_tokens===null?'无上限':t.max_tokens.toLocaleString('en-US')} 提示词Token`,
      minTokens:t.min_tokens,maxTokens:t.max_tokens,prices:{p:t.input_price,c:t.output_price,cr:t.cache_read_price,cc:t.cache_write_price}}));
    const offer={groupKey,rawModel:model.model_name,family:cubenceFamily(model),modality,priceKind:image?'fixed':'token',currency:'USD',priceUnit:image?'张':'M Token',
      inputPrice:image?null:selected.input_price,outputPrice:image?null:selected.output_price,
      cacheReadPrice:image?null:selected.cache_read_price,cacheWritePrice:image?null:selected.cache_write_price,
      fixedPrice:image?model.request_price:null,billingMode:image?'per_request':'token',imageBilling:modality==='image'?(image?'per_image':'token'):null,
      modelPriceMin:image?model.request_price:null,modelPriceMax:image?model.request_price:null,
      vendorId:model.vendor_id,vendorName:model.vendor.name,tiers:model.pricing_tiers,supportedEndpointTypes:[],
      sourceModelVersion:model.updated_at,sourceUrl:config.pricingUrl,compositeMultiplier:null,
      // Public USD base data MUST NOT be written into effectivePrice/groupRate.
      effectivePrice:null,basePrice:{basis:CUBENCE_PARSER_VERSION,currencyKind:'usd_base',currency:'USD',priceBasis:'base',regionScope:'global',
        prices:Object.fromEntries([...fields,'request_price'].map(key=>[key,model[key]])),defaultPromptTokens:0,
        chargeItems:priceItems(image?model:selected,model.billing_mode),tiers:rules,detailObservedAt:observedAt,
        tierMetric:'input_plus_cache_read_plus_cache_write',tierBounds:'inclusive',tierApplication:'replace_base'},rawOffer:model};
    const reference=Object.hasOwn(references,model.model_name.toLowerCase())?references[model.model_name.toLowerCase()]?.priceReference:null;
    offer.discount=resolveTransitDiscount({offer,reference,observedAt});
    if(offer.discount)offer.discount.details={...offer.discount.details,currencyBasis:'public_usd_base_not_final_charge',groupKey,sourceUrl:config.pricingUrl};
    return offer;
  });
  const inventory={models:catalog.models.length,vendors:vendors.size,offers:offers.length,groups:0,publicQuoteScopes:1,
    tokenModels:catalog.models.filter(m=>m.billing_mode==='token').length,fixedImageModels:catalog.models.filter(m=>m.billing_mode==='per_request').length,
    tieredModels:catalog.models.filter(m=>m.pricing_tiers.length).length,tiers,families,modalities};
  return {catalog,inventory,offers,groups:[{groupKey,displayName:'公开基础报价',disclosure:'站点公开',modelRatio:null,
    description:'USD基础报价，不含分组与峰谷倍率。Token阶梯按输入及缓存Token之和匹配，命中后替代基础费率。',
    rawGroup:{groupOrigin:'synthetic_public_catalog',priceBasis:'base'},status:'active'}]};
}

export function parseCubenceSettings(payload) {
  required(payload?.code===0&&Array.isArray(payload.data),'cubence_invalid_public_settings');
  const allowed=new Set(['alipay_rmb_to_balance_rate','alipay_min_recharge_rmb','alipay_max_recharge_rmb','recharge_enabled','subscription_enabled','stripe_rmb_to_usd_rate','registration_require_invite','china_region_warning_enabled','recharge_provider_wechat','recharge_provider_alipay','recharge_provider_card']);
  const values={};
  for(const row of payload.data){
    required(object(row)&&typeof row.key==='string'&&typeof row.value==='string'&&row.value.length<=2048,'cubence_invalid_setting');
    if(allowed.has(row.key)){required(!Object.hasOwn(values,row.key),'cubence_duplicate_setting');values[row.key]=row.value;}
  }
  required(['true','false'].includes(values.recharge_enabled)&&['true','false'].includes(values.subscription_enabled),'cubence_missing_public_settings');
  for(const key of ['alipay_rmb_to_balance_rate','alipay_min_recharge_rmb','alipay_max_recharge_rmb','stripe_rmb_to_usd_rate'])
    if(values[key]!==undefined)required(/^\d+(?:\.\d+)?$/.test(values[key])&&Number.isFinite(Number(values[key])),'cubence_invalid_setting_number');
  return {values,priceBasis:'public_payment_configuration_not_verified_exchange_rate',rechargeConversionVerified:false};
}
export function validateCubenceLogo(svg) {
  required(typeof svg==='string'&&Buffer.byteLength(svg)<=128*1024&&/<svg\b/i.test(svg)&&/<(?:path|rect|polygon)\b/i.test(svg)
    &&!/<script|<foreignObject|<!DOCTYPE|<!ENTITY|\bon\w+\s*=|\bhref\s*=|\bstyle\s*=|url\(|<style/i.test(svg),'cubence_unsafe_or_invalid_svg');
  const inertTags=new Set(['svg','g','path','rect','polygon','polyline','circle','ellipse','line']);
  required([...svg.matchAll(/<\/?([a-z][\w:-]*)\b/gi)].every(match=>inertTags.has(match[1].toLowerCase())),'cubence_non_static_svg');
  return svg;
}
