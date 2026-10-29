import { randomUUID, createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { upsertTransitCollection, recordTransitSourceSnapshot } from "../transit-db.mjs";
import { saveZetaServiceState, saveZetaMonitoring, pruneZetaMonitoring } from "./zetaapi-storage.mjs";

const root=join(dirname(fileURLToPath(import.meta.url)),"../..");
const hash=value=>createHash('sha256').update(value).digest('hex');
const nonnegative=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const family=name=>/^claude/i.test(name)?'Claude':/^(gpt|codex|o\d)/i.test(name)?'GPT':/^gemini/i.test(name)?'Gemini':/^deepseek/i.test(name)?'DeepSeek':/^grok/i.test(name)?'Grok':/^qwen/i.test(name)?'Qwen':/^(kimi|moonshot)/i.test(name)?'Kimi':'其他';

/** Extract a JSON string literal, not arbitrary JavaScript. Never eval/vm the source. */
export function parseZetaPricing(html,config,{observedAt=new Date().toISOString()}={}) {
  const literal=html.match(/\bconst\s+pricingJson\s*=\s*("(?:\\.|[^"\\])*")\s*;/);
  if(!literal)throw new Error('missing_zeta_embedded_pricing');
  const data=JSON.parse(JSON.parse(literal[1]));
  if(!Array.isArray(data)||data.length<(config.minimumModels??20)||data.length>10000)throw new Error('invalid_zeta_pricing_count');
  if(!/USD\s*\/\s*1M\s*tokens/i.test(html))throw new Error('unverified_zeta_price_unit');
  const tableKeys=[...html.matchAll(/<tr\b[^>]*\bdata-model="([^"]+)"/g)].map(m=>m[1]);
  if(tableKeys.length!==data.length||new Set(tableKeys).size!==data.length)throw new Error('zeta_table_json_count_mismatch');
  const tableSet=new Set(tableKeys),seen=new Set();
  const offers=data.map(row=>{
    if(!object(row)||typeof row.key!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,180}$/.test(row.key)
      ||seen.has(row.key)||!tableSet.has(row.key)||typeof row.label!=='string'||typeof row.provider!=='string')throw new Error('invalid_zeta_model_identity');
    seen.add(row.key);
    for(const key of ['input','output'])if(!nonnegative(row[key]))throw new Error(`invalid_zeta_price:${row.key}:${key}`);
    for(const key of ['cacheRead','cacheWrite','cacheWrite1h','officialInput','officialOutput','multiplier','savingsPct'])
      if(row[key]!=null&&!nonnegative(row[key]))throw new Error(`invalid_zeta_field:${row.key}:${key}`);
    if(row.multiplier!=null&&row.multiplier<=0||row.savingsPct!=null&&row.savingsPct>1)throw new Error('invalid_zeta_discount');
    const ratios=['Input','Output'].filter(k=>row[`official${k}`]>0).map(k=>row[k.toLowerCase()]/row[`official${k}`]);
    const ratio=row.savingsPct!=null?1-row.savingsPct:ratios[0]??null;
    if(ratio!==null&&ratios.some(v=>Math.abs(v-ratio)>1e-6)||row.multiplier!=null&&ratios.some(v=>Math.abs(v-row.multiplier)>1e-6))
      throw new Error(`zeta_discount_price_conflict:${row.key}`);
    const modality=/(?:^gpt-image-|(?:^|-)image(?:-|$)|^imagen)/i.test(row.key)?'image':/^(veo|sora|kling|wan\d)/i.test(row.key)?'video':'text';
    const cache=key=>row[key]>0?row[key]*1e6:null; // The source renders zero cache rates as an em dash, not free.
    const discount=ratio!==null?{ratio,source:row.savingsPct!=null?'station_reported':'calculated',basis:'station_reference',
      details:{sourceUrl:config.pricingUrl,observedAt,metric:'input',reference:{input:row.officialInput>0?row.officialInput*1e6:null,currency:'USD',unit:'M Token'},
        currency:'USD',reportedSavings:row.savingsPct??null,calculation:'effective USD input / station reference USD input'}}:null;
    return {groupKey:'public',rawModel:row.key,standardModel:row.key,family:family(row.key),modality,
      vendorName:row.provider||null,priceKind:'token',currency:'USD',priceUnit:'M Token',billingMode:'token',
      inputPrice:row.input*1e6,outputPrice:row.output*1e6,cacheReadPrice:cache('cacheRead'),cacheWritePrice:cache('cacheWrite'),
      cacheWrite1hPrice:cache('cacheWrite1h'),cacheCreationPrice:cache('cacheWrite'),fixedPrice:null,
      imageBilling:modality==='image'?'token':null,sourceUrl:config.pricingUrl,discount,
      supportedEndpointTypes:modality==='image'&&/^gpt-image-/.test(row.key)?['images']:family(row.key)==='Claude'?['anthropic','chat_completions']:['chat_completions'],
      basePrice:{currency:'USD',input:row.officialInput??null,output:row.officialOutput??null,unit:'USD/token',source:'station_reference'},
      effectivePrice:{groupRate:row.multiplier??ratio,currencyKind:'usd_cash',billing:'token',cacheWriteDurationSeconds:300,
        cacheWrite1hPrice:cache('cacheWrite1h'),zeroCacheMeaning:'not_disclosed',displayName:row.label,
        modalityEvidence:modality==='text'?'model_identity':'model_identity_and_public_image_documentation',
        mediaPriceConflict:modality==='image'?'pricing table specifies Token; guide also describes per-call billing; no fixed per-image price':null},
      rawOffer:row};
  });
  return {offers,modelCount:seen.size,groups:[{groupKey:'public',displayName:'公开报价',disclosure:'站点公开',
    description:'公开价目目录，非上游渠道分组',rawGroup:{origin:'synthetic_public_catalog'},status:'active'}]};
}

export function parseZetaMonitorConfig(payload) {
  if(payload?.config?.published!==true||!Array.isArray(payload.publicGroupList))throw new Error('invalid_zeta_monitor_config');
  const monitors=[],seen=new Set();
  for(const group of payload.publicGroupList){
    if(typeof group.name!=='string'||!Array.isArray(group.monitorList))throw new Error('invalid_zeta_monitor_group');
    for(const m of group.monitorList){
      if(!Number.isInteger(m.id)||m.id<=0||seen.has(m.id)||typeof m.name!=='string'||!m.name.trim()||!['push','http','port','dns','keyword','json-query'].includes(m.type))throw new Error('invalid_zeta_monitor_identity');
      seen.add(m.id);
      const model=m.type==='push'&&/^(claude|gpt|gemini|deepseek|grok|qwen|kimi)[a-zA-Z0-9_.:/-]*$/.test(m.name)?m.name:null;
      monitors.push({id:m.id,name:m.name,type:m.type,group:group.name,scope:model?'model':'infrastructure',model,raw:m});
    }
  }
  if(!monitors.length||monitors.length>100)throw new Error('invalid_zeta_monitor_count');
  return monitors;
}

/** Uptime Kuma 1.x public timestamps are UTC SQL datetime, not local server time. */
function probeTime(value,observedAt){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(value))throw new Error('invalid_zeta_probe_time');
  const raw=value.replace(' ','T')+'Z',at=Date.parse(raw);
  if(!Number.isFinite(at)||at>Date.parse(observedAt)+300000||at<Date.parse(observedAt)-35*86400000)throw new Error('stale_or_future_zeta_probe');
  if(new Date(at).toISOString().slice(0,19)!==raw.slice(0,19))throw new Error('invalid_zeta_calendar_time');
  return new Date(at).toISOString();
}
export function parseZetaHeartbeats(payload,monitors,{sourceUrl,observedAt}) {
  if(!object(payload?.heartbeatList)||!object(payload?.uptimeList))throw new Error('invalid_zeta_heartbeat_response');
  const ids=new Set(monitors.map(m=>String(m.id))),probes=[],summaries=[];
  for(const[id,points]of Object.entries(payload.heartbeatList)){
    if(!ids.has(id)||!Array.isArray(points)||points.length>2000)throw new Error('unmatched_zeta_heartbeat');
    const seen=new Set();
    for(const p of points){
      if(!object(p)||![0,1,2,3].includes(p.status)||p.ping!=null&&!nonnegative(p.ping))throw new Error('invalid_zeta_heartbeat_point');
      const time=probeTime(p.time,observedAt);
      if(seen.has(time))throw new Error('duplicate_zeta_heartbeat_time');seen.add(time);
      probes.push({id:Number(id),time,status:p.status,ping:p.ping??null,raw:p});
    }
  }
  for(const m of monitors){
    if(!Object.hasOwn(payload.heartbeatList,String(m.id)))throw new Error('incomplete_zeta_heartbeat_subjects');
    const rate=payload.uptimeList[`${m.id}_24`];
    if(rate!=null){if(!nonnegative(rate)||rate>1)throw new Error('invalid_zeta_uptime');
      summaries.push({id:m.id,hours:24,availability:rate*100,sourceUrl,kind:'kuma_rolling_summary'});}
  }
  if(!probes.length)throw new Error('empty_zeta_heartbeats');
  return {probes,summaries};
}

function parseBadge(svg){
  if(!/<svg\b/.test(svg)||!svg.includes('Uptime (360h)'))throw new Error('invalid_zeta_uptime_badge');
  const values=[...new Set([...svg.matchAll(/<text\b[^>]*>\s*([\d.]+)%\s*<\/text>/g)].map(m=>Number(m[1])))];
  if(values.length!==1||!nonnegative(values[0])||values[0]>100)throw new Error('invalid_zeta_badge_value');
  return values[0];
}
const recordRun=(db,config,runId,stage,status,startedAt,finishedAt,error=null,count=0)=>db.prepare(`INSERT OR REPLACE INTO transit_collection_runs
  (run_id,station_id,collector_kind,stage,status,started_at,finished_at,offer_count,error_message) VALUES (?,?,?,?,?,?,?,?,?)`)
  .run(runId,config.id,config.collectorKind,stage,status,startedAt,finishedAt,count,error);

export async function collectZetaApiSource(db,config,options,runtime){
  if(!config.enabled)return{id:config.id,status:'skipped'};
  const {fetchPublic,claimTransit,finishTransit}=runtime,owner=options.owner??randomUUID();
  const now=()=>options.now??new Date().toISOString(),warnings=[];
  const rawDir=options.rawDir??join(root,'data/transit/raw');
  let runId=`transit-${config.id}-${randomUUID()}`,status='skipped',parsed;
  const get=async(url,kind,json=true)=>{
    const response=await fetchPublic(url,config,options.fetchImpl),digest=hash(response.text);
    const path=join(rawDir,config.id,`${kind}-${digest}.txt`);mkdirSync(dirname(path),{recursive:true});
    if(!existsSync(path))writeFileSync(path,response.text,'utf8');
    recordTransitSourceSnapshot(db,{...response,stationId:config.id,runId,sourceKind:kind,sourceUrl:url,
      payloadText:response.text,payloadHash:digest,payloadPath:path,capturedAt:now()});
    return json?JSON.parse(response.text):response.text;
  };
  const startedAt=now();
  if(claimTransit(db,config,{owner,now:startedAt,force:options.force})){
    try{
      const html=await get(config.pricingUrl,'pricing',false);parsed=parseZetaPricing(html,config,{observedAt:now()});
      const previousCount=db.prepare(`SELECT COUNT(DISTINCT raw_model) AS n FROM transit_offers o JOIN transit_groups g ON g.id=o.group_id
        WHERE g.station_id=? AND o.status='active'`).get(config.id).n;
      if(previousCount&&parsed.modelCount<previousCount*(config.minimumCatalogFraction??0.8))throw new Error('zeta_catalog_shrank_requires_review');
      let service=null; const old=db.prepare('SELECT * FROM transit_stations WHERE id=?').get(config.id);
      let oldMeta={};try{oldMeta=JSON.parse(old?.raw_meta_json??'{}');}catch{/* no prior metadata */}
      try{
        service=await get(config.metadataUrl,'site-context');
        if(typeof service.allow_signup!=='boolean'||typeof service.allow_topup!=='boolean'
          ||service.website_origin!=='https://www.zetaapi.ai'||service.api_origin!=='https://api.zetaapi.ai')throw new Error('invalid_zeta_site_context');
      }catch(error){service=null;warnings.push(`site-context: ${error.message}`);}
      const documentation={...(oldMeta.documentation??{})};
      for(const[kind,url]of [['image',config.imageDocumentationUrl],['api',config.apiDocumentationUrl]]){
        try{const text=await get(url,`document-${kind}`,false);if(!/<(?:html|main)\b/i.test(text))throw new Error('invalid_document_html');
          documentation[kind]={url,sha256:hash(text),observedAt:now()};}
        catch(error){warnings.push(`document-${kind}: ${error.message}`);}
      }
      let logoLocalPath=old?.logo_local_path??null,logo=oldMeta.logo??null;
      try{
        const svg=await get(config.logoUrl,'logo',false);
        if(Buffer.byteLength(svg)>128*1024||!/<svg\b/.test(svg)||/<script|<foreignObject|<!DOCTYPE|<!ENTITY|\bon\w+\s*=|(?:href\s*=\s*["'](?!#))|url\(/i.test(svg))throw new Error('unsafe_zeta_svg');
        const path=join(options.publicRoot??join(root,'public'),config.logoLocalPath.replace(/^\//,''));mkdirSync(dirname(path),{recursive:true});
        writeFileSync(`${path}.${process.pid}.tmp`,svg);renameSync(`${path}.${process.pid}.tmp`,path);
        logoLocalPath=config.logoLocalPath;logo={url:config.logoUrl,sha256:hash(svg),observedAt:now()};
      }catch(error){warnings.push(`logo: ${error.message}`);}
      const at=now();
      db.transaction(()=>{
        upsertTransitCollection(db,{station:{...config,config,recharge:null,sourceType:'official_public',logoLocalPath,
          description:'ZetaAPI · 公开模型报价',rawMeta:{...oldMeta,logo,documentation,currencyKind:'usd_cash',groupOrigin:'synthetic_public_catalog',
            service:service?{allowSignup:service.allow_signup,allowTopup:service.allow_topup,observedAt:at,sourceUrl:config.metadataUrl}:oldMeta.service??null}},
          ...parsed,collectionComplete:true,observedAt:at,run:{runId,collectorKind:config.collectorKind,status:'success',startedAt,finishedAt:at,httpStatus:200,errorMessage:warnings.join('; ')||null}});
        if(service)saveZetaServiceState(db,config.id,service,config.metadataUrl,at);
        finishTransit(db,config.id,owner,{ok:true,at,intervalMs:warnings.length?15*60000:options.intervalMs});
      }).immediate();status='success';
    }catch(error){
      recordRun(db,config,runId,'pricing','failed',startedAt,now(),error.message);
      finishTransit(db,config.id,owner,{ok:false,at:now(),error:error.message,retryAfter:error.retryAfter});
      status='failed';warnings.push(`pricing: ${error.message}`);
    }
  }
  let performanceRows=0;
  if(options.includePerformance!==false&&claimTransit(db,config,{owner,now:now(),force:options.force,task:'performance'})){
    runId=`transit-${config.id}-monitor-${randomUUID()}`;const perfStarted=now();
    try{
      const monitors=parseZetaMonitorConfig(await get(config.monitorConfigUrl,'monitor-config'));
      const heartbeat=await get(config.performanceUrl,'heartbeats');const observedAt=now();
      const {probes,summaries}=parseZetaHeartbeats(heartbeat,monitors,{sourceUrl:config.performanceUrl,observedAt});
      // The heartbeat endpoint's 24h value is a rolling summary. Keep it as a
      // checkpoint, not a five-minute duplicate; raw points are the durable history.
      for (let index=summaries.length-1; index>=0; index--) {
        const summary=summaries[index];
        const last=db.prepare('SELECT MAX(observed_at) AS at FROM transit_monitor_summaries WHERE station_id=? AND monitor_id=? AND window_hours=?').get(config.id,summary.id,summary.hours)?.at;
        if (last && Date.parse(observedAt)-Date.parse(last)<(config.summaryIntervalMs??21600000)) summaries.splice(index,1);
      }
      // Refresh each subject's 15d summary at most every six hours. This is never hourly history.
      let consecutiveFailures=0;
      for(const m of monitors){
        const last=db.prepare('SELECT MAX(observed_at) AS at FROM transit_monitor_summaries WHERE station_id=? AND monitor_id=? AND window_hours=360').get(config.id,m.id)?.at;
        if(last&&Date.parse(observedAt)-Date.parse(last)<(config.summaryIntervalMs??21600000))continue;
        if(consecutiveFailures>=3)break;
        const sourceUrl=`${config.monitorOrigin}/api/badge/${m.id}/uptime/360`;
        try{const svg=await get(sourceUrl,`summary360-${m.id}`,false);summaries.push({id:m.id,hours:360,availability:parseBadge(svg),sourceUrl,kind:'kuma_360h_badge'});consecutiveFailures=0;}
        catch(error){warnings.push(`summary:${m.id}: ${error.message}`);consecutiveFailures++;if([403,429].includes(error.httpStatus))break;}
      }
      const saved=saveZetaMonitoring(db,{stationId:config.id,monitors,probes,summaries,sourceUrl:config.performanceUrl,configUrl:config.monitorConfigUrl,observedAt,runId});
      performanceRows=saved.inserted;
      recordRun(db,config,runId,'performance','success',perfStarted,observedAt,null,saved.returned);
      finishTransit(db,config.id,owner,{ok:true,at:now(),task:'performance',intervalMs:config.performanceIntervalMs??300000});
      try{pruneZetaMonitoring(db,config.id,observedAt,config.retentionDays,rawDir);}catch(error){warnings.push(`retention: ${error.message}`);}
    }catch(error){
      warnings.push(`performance: ${error.message}`);
      recordRun(db,config,runId,'performance','failed',perfStarted,now(),error.message);
      db.prepare(`INSERT OR REPLACE INTO transit_monitor_polls(station_id,run_id,observed_at,ok,source_url,error) VALUES (?,?,?,0,?,?)`)
        .run(config.id,runId,now(),config.performanceUrl,error.message);
      finishTransit(db,config.id,owner,{ok:false,at:now(),task:'performance',error:error.message,retryAfter:error.retryAfter});
    }
  }
  return{id:config.id,status,models:parsed?.modelCount,offers:parsed?.offers.length,performanceRows,warnings};
}
