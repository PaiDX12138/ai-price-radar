/** Packy-specific rules, verified against the live pricing page (2026-10-28).
 * model_group_ratio[group][model] replaces group_ratio, never multiplies it.
 * Display-credit input/M = model_ratio*2*effectiveGroupRatio; output adds
 * completion_ratio. Base price is not an official model-price reference.
 */
export function classifyPackyModel(model, endpoints = [], vendor = "") {
  const name=model.toLowerCase();
  const family=/claude/.test(name)?"Claude":/^(gpt|o\d|codex|chatgpt)/.test(name)?"GPT":/gemini|imagen|banana|veo/.test(name)?"Gemini":/grok/.test(name)?"Grok":/glm|^zai/.test(name)?"GLM":/deepseek/.test(name)?"DeepSeek":/kimi|moonshot/.test(name)?"Kimi":/qwen/.test(name)?"Qwen":vendor || "其他";
  const modality=endpoints.some(e=>/video/.test(e)) || /^(veo|sora|MiniMax-H)/i.test(model)?"video":endpoints.includes("image-generation") || /image|imagen|banana/i.test(model)?"image":"text";
  return {family,modality};
}

function number(value, field) {
  if (value == null || value === "" || !Number.isFinite(Number(value)) || Number(value)<0) throw new Error(`invalid_${field}`);
  return Number(value);
}
const optional=(v,field)=>v==null?null:number(v,field);
const round=v=>v==null?null:Number(v.toPrecision(12));

export function parsePackyPricing(payload, config) {
  if(payload?.success!==true || !Array.isArray(payload.data) || payload.data.length<(config.minimumModels??5) || !payload.group_ratio || typeof payload.group_ratio!=="object") throw new Error("invalid_pricing_schema_or_empty");
  const vendors=new Map((payload.vendors??[]).map(v=>[v.id,v.name]));
  const groups=new Map(); const offers=[]; const unresolved=[]; const seen=new Set();
  const inactive=new Set(payload.inactive_groups??[]);
  for(const model of payload.data) {
    if(typeof model.model_name!=="string" || !model.model_name.trim() || !Array.isArray(model.enable_groups)) throw new Error("invalid_model_shape");
    if(seen.has(model.model_name)) throw new Error("duplicate_model"); seen.add(model.model_name);
    const quota=number(model.quota_type,"quota_type");
    for(const key of model.enable_groups) {
      if(typeof key!=="string" || !key) throw new Error("invalid_group_key");
      const override=payload.model_group_ratio?.[key]?.[model.model_name];
      const ratioValue=override??payload.group_ratio[key];
      // Some publicly listed test groups have no rate. Archive them, do not
      // silently charge at 1x or publish an invented price.
      const ratio=ratioValue==null?null:number(ratioValue,"group_ratio");
      if(ratio===null) unresolved.push(`${key}:${model.model_name}`);
      const endpoints=payload.model_group_endpoints?.[key]?.[model.model_name]??model.supported_endpoint_types??[];
      if(!Array.isArray(endpoints)) throw new Error("invalid_endpoints");
      const existing=groups.get(key);
      groups.set(key,{
        groupKey:key, displayName:key,
        modelRatio:optional(payload.group_ratio[key],"group_ratio"),
        rechargeRatio:null, description:payload.usable_group?.[key]??null,
        disclosure:"站点公开", status:inactive.has(key)?"inactive":"active",
        supportedProtocols:[...new Set([...(existing?.supportedProtocols??[]),...endpoints])],
        endpointOverrides:payload.model_group_endpoints?.[key]??{},
        rawGroup:{group_ratio:payload.group_ratio[key],model_group_ratio:payload.model_group_ratio?.[key],description:payload.usable_group?.[key]},
      });
      const {family,modality}=classifyPackyModel(model.model_name,endpoints,vendors.get(model.vendor_id));
      const baseInput=quota===0?number(model.model_ratio,"model_ratio")*2:null;
      const baseOutput=quota===0?baseInput*number(model.completion_ratio,"completion_ratio"):null;
      const tokenPrice=v=>ratio==null||v==null?null:round(v*ratio);
      const cacheWrite=model.cache_creation_ratio_5m??model.create_cache_ratio;
      const mediaRules=quota===1 && (model.image_billing || model.model_price_min!=null || model.model_price_max!=null);
      const fixed=quota===1?number(model.model_price,"model_price"):null;
      if(quota!==0 && quota!==1) throw new Error("unsupported_quota_type");
      offers.push({
        groupKey:key,rawModel:model.model_name,standardModel:null,family,modality,
        priceKind:quota===0?"token":"fixed",currency:"CREDIT",priceUnit:quota===0?"M Token":"次（基础价，以原站规格为准）",
        inputPrice:tokenPrice(baseInput),outputPrice:tokenPrice(baseOutput),
        cacheReadPrice:quota===0 && model.cache_ratio!=null?tokenPrice(baseInput*number(model.cache_ratio,"cache_ratio")):null,
        cacheWritePrice:quota===0 && cacheWrite!=null?tokenPrice(baseInput*number(cacheWrite,"cache_creation_ratio")):null,
        fixedPrice:mediaRules?null:tokenPrice(fixed),
        modelPriceMin:tokenPrice(optional(model.model_price_min,"model_price_min")),modelPriceMax:tokenPrice(optional(model.model_price_max,"model_price_max")),
        vendorId:model.vendor_id??null,vendorName:vendors.get(model.vendor_id)??null,quotaType:quota,
        billingMode:mediaRules?"variable_media":quota===0?(model.tiers?.length?"tiered":"token"):"per_request",
        tiers:model.tiers??null,imageBilling:model.image_billing??null,imageRatio:model.image_ratio??null,
        supportedEndpointTypes:endpoints,sourceUrl:config.pricingUrl,
        basePrice:{model_ratio:model.model_ratio,completion_ratio:model.completion_ratio,group_ratio:ratio,cache_ratio:model.cache_ratio,cache_creation_ratio_5m:cacheWrite,model_price:fixed},
        effectivePrice:{basis:"new_api_display_credit",formula:"model_ratio * 2 * (model_group_ratio[group][model] ?? group_ratio[group])",groupRate:ratio,peakRules:payload.peak_pricing??null,peakActiveAtCapture:payload.peak_active?.[model.model_name]??null},
        rawOffer:model,
        // A meter multiplier is NOT an official API discount.
        compositeMultiplier:null,
      });
    }
  }
  if(!offers.length || !groups.size) throw new Error("empty_group_offers");
  const activeFamilies = new Set(offers.filter(o => groups.get(o.groupKey)?.status === "active").map(o => o.family));
  const missingFamilies = (config.requiredFamilies ?? []).filter(family => !activeFamilies.has(family));
  if (missingFamilies.length) throw new Error(`incomplete_pricing_families:${missingFamilies.join(",")}`);
  return {groups:[...groups.values()],offers,modelCount:payload.data.length,unresolved};
}
