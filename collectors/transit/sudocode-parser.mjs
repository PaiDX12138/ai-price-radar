import {createHash} from 'node:crypto';
export const SUDO_PARSER_VERSION='sudocode_public_v1';
export const sudoHash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const assert=(ok,message)=>{if(!ok)throw new Error(message);};

/** Verify the CURRENT bundle's actual public price formula; 6.89 is NOT the
 * metadata payment/display FX (currently 6.68). Neither executes as JavaScript. */
export function parseSudoPolicy(script){
  assert(typeof script==='string'&&Buffer.byteLength(script)<16*1024*1024,'sudo_invalid_policy_size');
  const match=/\.model_ratio\*2\/([A-Za-z_$][\w$]*)\*([A-Za-z_$][\w$]*)/.exec(script);
  assert(match,'sudo_unrecognized_input_formula');
  const variable=match[1],escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const assignments=[...script.matchAll(new RegExp(`(?:^|[,;])${escape(variable)}=(\\d+(?:\\.\\d+)?)(?=[,;])`,'g'))].map(m=>Number(m[1]));
  assert(assignments.length===1&&assignments[0]>0&&assignments[0]<=100,'sudo_unverified_price_denominator');
  assert(new RegExp(`\\.model_ratio\\*[^,;]{0,60}\\.completion_ratio\\*2/${escape(variable)}\\*`).test(script),'sudo_unverified_output_formula');
  assert(new RegExp(`const ([\\w$]+)=([\\w$]+)/${escape(variable)},[\\w$]+=parseFloat\\([^)]*\\.model_price\\)\\*\\1`).test(script),'sudo_unverified_request_formula');
  return {denominator:assignments[0],variable,sourceHash:sudoHash(script),formula:'model_ratio * 2 * raw_group_ratio / denominator',discountFormula:'raw_group_ratio / denominator'};
}
export function sudoAssetUrl(html,siteUrl){
  const src=html.match(/<script[^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["']/)?.[1];
  assert(src,'sudo_missing_current_bundle');const url=new URL(src,siteUrl);
  assert(url.origin===new URL(siteUrl).origin&&url.protocol==='https:','sudo_unapproved_bundle_origin');return url.href;
}
export function parseSudoMetadata(payload){
  const d=payload?.data;
  assert(payload?.success===true&&object(d)&&d.quota_display_type==='USD'&&finite(d.price)&&finite(d.usd_exchange_rate)&&d.usd_exchange_rate>0,'sudo_invalid_metadata');
  return {systemName:d.system_name,logo:d.logo,price:d.price,usdExchangeRate:d.usd_exchange_rate,stripeUnitPrice:finite(d.stripe_unit_price)?d.stripe_unit_price:null,
    quotaPerUnit:d.quota_per_unit,docsLink:d.docs_link,apiInfo:Array.isArray(d.api_info)?d.api_info:[],
    sourceKind:'public_configuration_not_payment_quote'};
}
function family(m,v){
  const name=(m.model_name+' '+v).toLowerCase();
  for(const [pattern,f]of [[/claude|anthropic/,'Claude'],[/gpt|openai|codex/,'GPT'],[/gemini|google/,'Gemini'],[/deepseek/,'DeepSeek'],[/grok|xai/,'Grok'],[/glm|智谱/,'GLM'],[/kimi|moonshot/,'Kimi'],[/minimax/,'MiniMax']])if(pattern.test(name))return f;
  return v||'其他';
}
function modality(m){return /^seed-audio|audio|speech/i.test(m.model_name)?'audio':/gpt-image|gemini-.*image/i.test(m.model_name)?'image':'text';}
// Source prices are JavaScript numbers; retain their precision, not display rounding.
const times=(a,b)=>{const result=a*b;assert(finite(result),'sudo_price_overflow');return result;};
export function sudoGroupTiers(payload){
  const map=new Map();
  for(const [tier,data]of Object.entries(payload.tier_groups??{})){
    assert(object(data)&&Array.isArray(data.groups),'sudo_invalid_tier_membership');
    for(const key of data.groups){assert(!map.has(key),'sudo_ambiguous_tier_group');map.set(key,{tier,...data.meta});}
  }
  return map;
}
export function parseSudoCatalog(payload,config,{policy,previousModels=0,observedAt=new Date().toISOString(),policyUrl}={}){
  assert(payload?.success===true&&Array.isArray(payload.data)&&object(payload.group_ratio)&&object(payload.usable_group)&&Array.isArray(payload.vendors),'sudo_invalid_catalog');
  assert(finite(policy?.denominator)&&policy.denominator>0,'sudo_price_policy_required');
  assert(payload.data.length>=(config.minimumModels??20)&&payload.data.length<=3000&&payload.data.length>=previousModels*(config.minimumCatalogFraction??.8),'sudo_catalog_shrank_or_incomplete');
  const tiers=sudoGroupTiers(payload),vendors=new Map(payload.vendors.map(v=>[v.id,v.name])),seen=new Set(),offers=[],families={},warnings=[];
  const groups=Object.keys(payload.usable_group).map(key=>{
    const ratio=payload.group_ratio[key];assert(finite(ratio)&&ratio>0,'sudo_missing_group_ratio');const tier=tiers.get(key);
    return {groupKey:key,displayName:payload.usable_group[key]||key,modelRatio:ratio/policy.denominator,disclosure:'站点公开',status:'active',
      description:tier?.description??null,rawGroup:{sourceGroupRatio:ratio,normalizationDenominator:policy.denominator,tier:tier?.tier??null,tierLabel:tier?.label??null}};
  });
  let tieredOffers=0,token=0,fixed=0;
  for(const m of payload.data){
    assert(object(m)&&typeof m.model_name==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,179}$/.test(m.model_name)&&!seen.has(m.model_name)
      &&[0,1].includes(m.quota_type)&&Array.isArray(m.enable_groups)&&m.enable_groups.length>0&&new Set(m.enable_groups).size===m.enable_groups.length&&Array.isArray(m.supported_endpoint_types),'sudo_invalid_model');seen.add(m.model_name);
    const fam=family(m,vendors.get(m.vendor_id)),mode=modality(m);families[fam]=(families[fam]??0)+1;if(m.quota_type===0)token++;else fixed++;
    for(const group of m.enable_groups){
      assert(Object.hasOwn(payload.group_ratio,group)&&Object.hasOwn(payload.usable_group,group),'sudo_unmatched_group');
      const ratio=payload.group_ratio[group]/policy.denominator,unit=m.quota_type===1?'次':'M Token';
      let input=null,output=null,cacheRead=null,cacheWrite=null,cache1h=null,fixedPrice=null,billingMode=m.quota_type===1?'per_request':'token',priceUnit=unit,mediaUnit;
      const items=[],rules=[];
      const add=(key,price,itemUnit='per_M_tokens')=>{if(price!==null)items.push({key,unit:itemUnit,creditPrice:String(price),basePrice:String(price/ratio),baseCurrency:'USD_CREDIT',multiplier:String(ratio)});};
      if(m.video_dynamic_billing){
        const rule=payload.video_billing?.[m.model_name];assert(rule?.mode==='per_second'&&finite(rule.rate_per_second),'sudo_unknown_dynamic_audio_rule');
        fixedPrice=times(rule.rate_per_second,ratio);billingMode='per_second';priceUnit='秒';mediaUnit='秒';add('audio_output',fixedPrice,'per_second');
        rules.push({label:'时长计费',description:`$${fixedPrice}/秒${finite(rule.max_duration_sec)?`，单次最多${rule.max_duration_sec}秒`:''}`});
      }else if(m.quota_type===1){assert(finite(m.model_price),'sudo_invalid_request_price');fixedPrice=times(m.model_price,ratio);mediaUnit='次';add('request',fixedPrice,'per_request');}
      else{
        assert(finite(m.model_ratio)&&finite(m.completion_ratio),'sudo_invalid_token_prices');
        input=times(times(m.model_ratio,2),ratio);output=times(input,m.completion_ratio);
        const cache=(field)=>{assert(m[field]==null||finite(m[field]),'sudo_invalid_optional_ratio');return m[field]==null?null:times(input,m[field]);};
        cacheRead=cache('cache_ratio');cacheWrite=cache('create_cache_ratio');cache1h=cache('create_cache_ratio_1h');
        add('prompt',input);add('completion',output);add('cache_read',cacheRead);add('cache_write_5m',cacheWrite);add('cache_write_1h',cache1h);
        add('image_input',cache('image_ratio'));add('image_output',cache('image_completion_ratio'));
        const dynamic=payload.dynamic_billing?.[m.model_name];
        if(dynamic&&dynamic.enabled!==false&&(!Array.isArray(dynamic.groups)||dynamic.groups.length===0||dynamic.groups.includes(group))){
          assert(Number.isSafeInteger(dynamic.threshold)&&dynamic.threshold>=0&&dynamic.mode==='full'&&dynamic.detect==='input'&&dynamic.count_mode==='total_input'
            &&['input_ratio','output_ratio','cache_read_ratio','cache_write_ratio'].every(k=>finite(dynamic[k])),'sudo_unknown_dynamic_token_rule');
          tieredOffers++;
          rules.push({label:`≤${dynamic.threshold.toLocaleString('en-US')} 总输入Token`,prices:{p:String(input),c:String(output),...(cacheRead!==null?{cr:String(cacheRead)}:{}),...(cacheWrite!==null?{cc:String(cacheWrite)}:{})}},
            {label:`>${dynamic.threshold.toLocaleString('en-US')} 总输入Token · 全量替换`,prices:{p:String(times(input,dynamic.input_ratio)),c:String(times(input,dynamic.output_ratio)),
              ...(cacheRead!==null?{cr:String(times(input,dynamic.cache_read_ratio))}:{}),...(cacheWrite!==null?{cc:String(times(input,dynamic.cache_write_ratio))}:{})}},
            {label:'判档口径',description:'输入含缓存Token；高档各项均相对基础输入价，不是相对输出价或缓存价再乘。原始规则完整保存。'});
          if(cache1h!==null)rules.push({label:'长缓存档位',description:'源高档配置未单列1小时缓存系数；不推导其高档价格。'});
        }
      }
      offers.push({groupKey:group,rawModel:m.model_name,standardModel:m.model_name,family:fam,modality:mode,vendorId:m.vendor_id??null,vendorName:vendors.get(m.vendor_id)??null,
        priceKind:m.quota_type===1||m.video_dynamic_billing?'fixed':'token',quotaType:m.quota_type,currency:'USD',priceUnit,billingMode,inputPrice:input,outputPrice:output,cacheReadPrice:cacheRead,cacheWritePrice:cacheWrite,cacheWrite1hPrice:cache1h,fixedPrice,
        modelPriceMin:fixedPrice,modelPriceMax:fixedPrice,imageBilling:mode==='image'&&m.quota_type===0?'token':null,tiers:rules,supportedEndpointTypes:[...m.supported_endpoint_types].sort(),sourceUrl:config.pricingUrl,
        basePrice:{modelRatio:m.model_ratio,modelPrice:m.model_price,rawGroupRatio:payload.group_ratio[group],dynamicBilling:payload.dynamic_billing?.[m.model_name]??null,videoBilling:payload.video_billing?.[m.model_name]??null},
        effectivePrice:{basis:'sudocode_public_usd_credit',currencyKind:'usd_credit',groupRate:ratio,chargeItems:items,tiers:rules,detailObservedAt:observedAt,...(mediaUnit?{mediaUnit}:{})},rawOffer:m,
        discount:{ratio,source:'station_formula',basis:'station_reference',details:{ratio,groupKey:group,sourceUrl:policyUrl,policyHash:policy.sourceHash,observedAt,formula:policy.discountFormula,
          rawGroupRatio:payload.group_ratio[group],normalizationDenominator:policy.denominator,currencyBasis:'station_usd_credit_nominal_not_cash_payment'}}});
    }
  }
  assert((config.requiredFamilies??[]).every(f=>families[f]),'sudo_missing_required_family');
  const activeGroups=new Set(offers.map(o=>o.groupKey));for(const g of groups){
    if(!activeGroups.has(g.groupKey))g.status='inactive';
    g.supportedProtocols=[...new Set(offers.filter(o=>o.groupKey===g.groupKey).flatMap(o=>o.supportedEndpointTypes))].sort();
  }
  const catalog={...payload,data:payload.data.map(m=>({...m,enable_groups:[...m.enable_groups].sort(),supported_endpoint_types:[...m.supported_endpoint_types].sort()})).sort((a,b)=>a.model_name.localeCompare(b.model_name,'en')),
    vendors:[...payload.vendors].sort((a,b)=>a.id-b.id)};
  return {catalog,groups,offers,warnings,inventory:{models:seen.size,groups:activeGroups.size,definedGroups:groups.length,offers:offers.length,tokenModels:token,fixedModels:fixed,
    dynamicModels:Object.keys(payload.dynamic_billing??{}).length,tieredOffers,versionTiers:Object.keys(payload.tier_groups??{}).length,families}};
}

export function parseSudoPerformance(payload,{observedAt,knownModels,knownTiers}){
  const d=payload?.data,snapshot=d?.snapshot_at;
  assert(payload?.success===true&&Array.isArray(d?.models)&&d.models.length>0&&d.models.length<=3000&&Number.isSafeInteger(snapshot)&&snapshot*1000<=Date.parse(observedAt)+300000&&Date.parse(observedAt)-snapshot*1000<7200000,'sudo_stale_or_invalid_performance');
  const rows=[],models=new Set(),identities=new Set();
  for(const m of d.models){
    assert(typeof m.model_name==='string'&&!models.has(m.model_name)&&Array.isArray(m.groups)&&m.groups.length<=100,'sudo_invalid_performance_model');models.add(m.model_name);
    const versions=new Set();
    for(const g of m.groups){
      assert(typeof g.group==='string'&&g.group===g.tier&&!versions.has(g.tier)&&Array.isArray(g.series)&&g.series.length<=360,'sudo_unverified_performance_scope');versions.add(g.tier);
      for(const point of g.series){
        const ts=point.ts,key=JSON.stringify([m.model_name,g.tier,ts]);
        assert(Number.isSafeInteger(ts)&&ts%3600===0&&ts*1000>=snapshot*1000-16*86400000&&ts*1000<=snapshot*1000&&!identities.has(key)
          &&finite(point.success_rate)&&point.success_rate<=100&&['avg_ttft_ms','avg_latency_ms','avg_tps','popularity'].every(k=>finite(point[k])),'sudo_invalid_performance_point');identities.add(key);
        rows.push({model:m.model_name,tier:g.tier,bucketAt:new Date(ts*1000).toISOString(),snapshotAt:new Date(snapshot*1000).toISOString(),
          successRate:point.success_rate,ttftMs:point.avg_ttft_ms>0?point.avg_ttft_ms:null,latencyMs:point.avg_latency_ms>0?point.avg_latency_ms:null,tps:point.avg_tps>0?point.avg_tps:null,
          popularity:point.popularity,hasData:point.popularity>0||point.success_rate<100||point.avg_ttft_ms>0||point.avg_latency_ms>0||point.avg_tps>0,isPartial:(ts+3600)>snapshot,
          mappingStatus:knownModels.has(m.model_name)&&knownTiers.has(g.tier)?'matched':'historical_unmapped'});
      }
    }
  }
  assert(rows.length>0,'sudo_empty_performance_history');
  return {rows,snapshotAt:new Date(snapshot*1000).toISOString(),models:models.size};
}
