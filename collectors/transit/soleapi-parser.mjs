import {createHash} from 'node:crypto';

export const soleHash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const units=new Set(['per_M_tokens','per_k_calls','per_image','per_second','per_minute','per_request','per_song','per_hour','per_GB_day']);

/** The official favicon paints paths with CSS while its root has fill="none".
 * Flatten the observed light/dark rule BEFORE removing CSS, or every path vanishes.
 * App dark mode is handled by the image class, not the OS favicon media query.
 */
export function normalizeSoleLogo(source) {
  if(typeof source!=='string'||Buffer.byteLength(source)>128*1024||!/<svg\b/.test(source)
    ||/<script|<foreignObject|<!DOCTYPE|<!ENTITY|\bon\w+\s*=|(?:href\s*=\s*["'](?!#))|url\(/i.test(source))throw new Error('invalid_sole_svg');
  const styles=[...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1].replace(/\s+/g,''));
  const known='path{fill:#000}@media(prefers-color-scheme:dark){path{fill:#fff}}';
  if(!styles.length||styles.some(style=>style!==known))throw new Error('unrecognized_sole_logo_paint');
  let paths=0;
  const svg=source.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<path\b([^>]*?)(\/?)>/gi,(_,attrs,close)=>{
    paths++;
    const attributes=attrs.replace(/\sfill\s*=\s*(["'])[^"']*\1/gi,'');
    return `<path fill="#000"${attributes}${close}>`;
  });
  if(!paths)throw new Error('empty_sole_logo');
  return svg;
}

/** Exact decimal strings are authoritative; Number is only a UI projection. */
export function soleDecimal(value) {
  const text=String(value),match=text.match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
  if(!match||text.length>100)throw new Error('invalid_sole_decimal');
  const exponent=Number(match[3]??0),fraction=match[2]??'';
  if(Math.abs(exponent)>24||fraction.length>24)throw new Error('sole_decimal_scale');
  let digits=(match[1]+fraction).replace(/^0+(?=\d)/,'');let scale=fraction.length-exponent;
  if(scale<0){digits+='0'.repeat(-scale);scale=0;}
  digits=digits.padStart(scale+1,'0');
  const integer=scale?digits.slice(0,-scale):digits,tail=scale?digits.slice(-scale).replace(/0+$/,''):'';
  return `${integer.replace(/^0+(?=\d)/,'')}${tail?`.${tail}`:''}`;
}
export function soleMultiply(a,b) {
  const parts=[soleDecimal(a),soleDecimal(b)].map(s=>({n:BigInt(s.replace('.','')),scale:(s.split('.')[1]??'').length}));
  const scale=parts[0].scale+parts[1].scale,digits=String(parts[0].n*parts[1].n).padStart(scale+1,'0');
  const result=scale?`${digits.slice(0,-scale)}.${digits.slice(-scale)}`:digits;
  return result.replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');
}
export function soleData(payload) {
  if(payload?.code!==200||!object(payload.data))throw new Error('invalid_sole_public_response');
  return payload.data;
}
export function soleFamily(model) {
  const known={anthropic:'Claude',openai:'GPT',google:'Gemini',deepseek:'DeepSeek',xai:'Grok',zhipu:'GLM',qwen:'Qwen',minimax:'MiniMax',kimi:'Kimi',typesafe:'TypeSafe'};
  return known[model.providerFamily]??model.providerFamily??'其他';
}
export function soleModality(model) {
  if(model.protocols.some(p=>p.taskType==='video'))return 'video';
  // Gemini's generateContent can produce images without an image-specific route.
  if(model.protocols.some(p=>p.taskType==='image')||Object.keys(model.charges).some(k=>/^image_output/.test(k)))return 'image';
  return 'text';
}
function validateModel(model) {
  if(!object(model)||typeof model.canonicalName!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,179}$/.test(model.canonicalName)
    ||!['usd','cny'].includes(model.priceCurrency)||!object(model.charges)||!Array.isArray(model.channels)||!model.channels.length
    ||!Array.isArray(model.protocols)||typeof model.providerFamily!=='string')throw new Error('invalid_sole_model');
  if(Number(soleDecimal(model.priceMultiplier))<=0)throw new Error('invalid_sole_model_multiplier');
  for(const [key,item]of Object.entries(model.charges)){
    if(!/^[a-z0-9_]{1,80}$/.test(key)||!object(item)||!units.has(item.unit))throw new Error(`unknown_sole_charge_unit:${model.canonicalName}:${key}:${item?.unit}`);
    soleDecimal(item.price);
  }
  if(!Object.keys(model.charges).length)throw new Error('empty_sole_charges');
  const seen=new Set();for(const c of model.channels){if(typeof c?.name!=='string'||!c.name||c.name.length>160||seen.has(c.name)||Number(soleDecimal(c.multiplier))<=0)throw new Error('invalid_sole_model_channel');seen.add(c.name);}
}
export function parseSoleCatalog(payload,config) {
  const data=soleData(payload);
  if(!Array.isArray(data.list)||data.list.length<(config.minimumModels??10)||data.list.length>2000||data.total!==data.list.length
    ||!Array.isArray(data.channels)||!data.channels.length)throw new Error('incomplete_sole_catalog');
  const seen=new Set(),channels=new Map();
  for(const c of data.channels){if(typeof c?.name!=='string'||!c.name||channels.has(c.name)||Number(soleDecimal(c.multiplier))<=0)throw new Error('invalid_sole_channel');channels.set(c.name,c);}
  for(const m of data.list){validateModel(m);if(seen.has(m.canonicalName))throw new Error('duplicate_sole_model');seen.add(m.canonicalName);
    for(const c of m.channels)if(!channels.has(c.name))throw new Error(`unmatched_sole_channel:${c.name}`);}
  const families=new Set(data.list.map(soleFamily));
  const missing=(config.requiredFamilies??[]).filter(f=>!families.has(f));
  if(missing.length)throw new Error(`incomplete_sole_families:${missing.join(',')}`);
  return data;
}
export function parseSoleFx(payload,observedAt) {
  const value=soleData(payload),at=Date.parse(value.updatedAt);
  if(!object(value.rates)||!Number.isFinite(at)||at>Date.parse(observedAt)+300000||Date.parse(observedAt)-at>48*3600000)throw new Error('stale_or_invalid_sole_fx');
  for(const [currency,rate]of Object.entries(value.rates))if(!/^[A-Z]{3}$/.test(currency)||Number(soleDecimal(rate))<=0)throw new Error('invalid_sole_fx_rate');
  return {rates:value.rates,source:String(value.source??'unknown'),updatedAt:value.updatedAt};
}

/** Parse inert JSON in React Flight, never execute source JS or evaluate patterns. */
export function parseSoleDetail(html,modelName) {
  if(typeof html!=='string'||html.length>2097152)throw new Error('invalid_sole_detail_size');
  const streams=[];
  for(const match of html.matchAll(/<script\b[^>]*>(self\.__next_f\.push\([\s\S]*?)<\/script>/g)){
    const source=match[1];try{const row=JSON.parse(source.slice(source.indexOf('(')+1,source.lastIndexOf(')')));if(row[0]===1&&typeof row[1]==='string')streams.push(row[1]);}catch{/* non-JSON flight metadata */}
  }
  const matches=[];let visits=0;
  const walk=(value,depth=0)=>{
    if(!value||typeof value!=='object'||depth>40||++visits>100000)return;
    if(value.model?.canonicalName===modelName&&object(value.model.charges)){matches.push(value.model);return;}
    for(const child of Object.values(value))walk(child,depth+1);
  };
  for(const line of streams.join('').split('\n')){const row=line.match(/^[a-f0-9]+:(.+)$/);if(row)try{walk(JSON.parse(row[1]));}catch{/* non-JSON Flight record */}}
  if(matches.length!==1)throw new Error(`unmatched_sole_detail:${modelName}`);
  const model=matches[0];validateModel(model);
  if(!Array.isArray(model.tiers)||model.tiers.length>100)throw new Error('invalid_sole_tiers');
  for(const t of model.tiers){if(typeof t?.label!=='string'||!Array.isArray(t.triggers)||typeof t.group!=='string')throw new Error('invalid_sole_tier');soleDecimal(t.factor??1);
    if(t.chargeFactors)for(const factor of Object.values(t.chargeFactors))soleDecimal(factor);}
  // Related models are not this subject's metadata/history and are intentionally omitted.
  const result={...model};delete result.related;
  return {model:result,creditBasisVerified:/1\s*Credit\s*=\s*(?:¥|&#165;|&yen;)\s*1/.test(html)};
}
export function soleProbeRows(model,observedAt) {
  if(!model.health?.history)return [];
  const history=model.health.history;
  if(!Array.isArray(history)||history.length>5000)throw new Error('invalid_sole_history');
  const seen=new Set();
  return history.map(p=>{
    const m=typeof p.at==='string'?p.at.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/):null;
    const at=Date.parse(p.at);
    if(!m||!Number.isFinite(at)||at>Date.parse(observedAt)+300000||at<Date.parse(observedAt)-35*86400000
      ||new Date(at).toISOString().slice(0,19)!==m[1]||typeof p.ok!=='boolean'||p.latencyMs!=null&&!finite(p.latencyMs))throw new Error('invalid_sole_probe');
    const time=`${m[1]}.${(m[2]??'').padEnd(6,'0')}Z`;
    if(seen.has(time))throw new Error('duplicate_sole_probe');seen.add(time);
    return {time,at,ok:p.ok,latency:p.latencyMs??null};
  });
}

export function buildSoleQuotes(catalog,config,{details=new Map(),fx=null,creditBasisVerified=false,observedAt}={}) {
  const offers=[],warnings=[],groups=catalog.channels.map(c=>({groupKey:c.name,displayName:c.name,modelRatio:Number(c.multiplier),status:'active',disclosure:'站点公开',rawGroup:c}));
  for(const model of catalog.list){
    const detail=details.get(model.canonicalName);
    const tiers=detail?.model?.tiers??null;
    const mismatch=Number(model.priceMultiplier)!==Math.min(...model.channels.map(c=>Number(c.multiplier)));
    if(mismatch)warnings.push(`catalog_channel_multiplier_mismatch:${model.canonicalName}`);
    const modality=soleModality(model);
    for(const channel of model.channels){
      const items=Object.entries(model.charges).map(([key,item])=>({key,unit:item.unit,baseCurrency:model.priceCurrency.toUpperCase(),basePrice:soleDecimal(item.price),multiplier:soleDecimal(channel.multiplier),creditPrice:soleMultiply(item.price,channel.multiplier)}));
      const token=key=>{const item=items.find(i=>i.key===key&&i.unit==='per_M_tokens');return item?Number(item.creditPrice):null;};
      const hero=items.find(i=>i.key==='video_output'&&['per_second','per_minute'].includes(i.unit))??items.find(i=>i.key==='image_output'&&i.unit==='per_image')??items.find(i=>i.unit==='per_request');
      const priceKind=hero?'fixed':'token',priceUnit=hero?({per_second:'秒',per_minute:'分钟',per_image:'张',per_request:'次'}[hero.unit]):'M Token';
      const referenceRate=model.priceCurrency==='cny'?'1':fx?.rates.USD;
      const ratio=referenceRate&&creditBasisVerified?Number(soleMultiply(channel.multiplier,referenceRate)):null;
      const discount=ratio===null?null:{ratio,source:'station_formula',basis:'station_reference',details:{sourceUrl:config.modelDetailUrl.replace('{model}',encodeURIComponent(model.canonicalName)),observedAt,
        formula:'channel_multiplier * reference_currency_per_credit',metric:hero?'request':'input',reportedDiscountPercent:model.discountPercent??null,
        conversion:{fxDate:fx?.updatedAt??null,usdToCny:fx?.rates.USD?1/Number(fx.rates.USD):null},nominalRatio:Number(channel.multiplier),referenceCurrency:model.priceCurrency.toUpperCase()}};
      offers.push({groupKey:channel.name,rawModel:model.canonicalName,standardModel:model.canonicalName,family:soleFamily(model),modality,vendorName:model.providerFamily,
        currency:'CREDIT',priceKind,priceUnit,billingMode:hero?.unit??(tiers?.length?'tiered':'token'),
        inputPrice:token('prompt'),outputPrice:token('completion'),cacheReadPrice:token('cache_read'),cacheWritePrice:token('cache_write_5m')??token('cache_write'),cacheWrite1hPrice:token('cache_write_1h'),
        fixedPrice:hero?Number(hero.creditPrice):null,discount,chargeItems:items,tiers,
        imageBilling:modality==='image'?(hero?'per_image':'token'):null,supportedEndpointTypes:[...new Set(model.protocols.map(p=>p.path))],sourceUrl:config.pricingUrl,
        sourceModelVersion:soleHash({charges:model.charges,channel,tiers}),
        basePrice:{currency:model.priceCurrency,charges:model.charges},
        effectivePrice:{basis:'sole_public_credit',groupRate:Number(channel.multiplier),currencyKind:'cny_credit',chargeItems:items,
          currentTierApplied:true,activeTiers:model.activeTiers??[],tiers,detailObservedAt:detail?.observedAt??null,
          detailStale:!detail||Date.parse(observedAt)-Date.parse(detail.observedAt)>config.detailIntervalMs,
          catalogMultiplier:model.priceMultiplier,catalogChannelMismatch:mismatch,reportedDiscountPercent:model.discountPercent??null,
          creditBasisVerified,fxUpdatedAt:fx?.updatedAt??null,contextWindow:model.contextWindow,maxOutputTokens:model.maxOutputTokens,capabilities:model.capabilities,protocols:model.protocols},rawOffer:model});
    }
  }
  return {groups,offers,warnings,modelCount:catalog.list.length};
}
