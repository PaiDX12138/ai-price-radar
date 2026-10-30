import { randomUUID, createHash } from "node:crypto";
import { readFileSync, readdirSync, mkdirSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { upsertTransitStation, upsertTransitCollection, upsertTransitPerformance, recordTransitSourceSnapshot, exportTransitSnapshot } from "../transit-db.mjs";
import { parsePackyPricing } from "./packyapi.mjs";
import { parsePackyDiscountPolicy, packyOfferDiscount } from "./discounts.mjs";
import { parsePackyRecharge } from "./recharge.mjs";
import { collectRightApiSource } from "./rightapi.mjs";
import { collectZetaApiSource } from "./zetaapi.mjs";
import { fetchTransitPublic, describeTransitError } from "./transport.mjs";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
export const TRANSIT_INTERVAL_MS=6*60*60*1000;
export function loadTransitSources() {
  const directory = join(root, "config/transit");
  const configs = readdirSync(directory).filter(name => /^[a-z0-9-]+\.json$/.test(name))
    .sort().map(name => JSON.parse(readFileSync(join(directory, name), "utf8")));
  const ids = new Set();
  for (const config of configs) {
    if (!/^[a-z0-9-]+$/.test(config.id) || ids.has(config.id)) throw new Error("invalid_or_duplicate_transit_id");
    ids.add(config.id);
  }
  return configs;
}
const hash=s=>createHash("sha256").update(s).digest("hex");

/** Bounded GET including the response body; no cookies, keys or admin APIs. */
export async function fetchPublic(url, config, fetchImpl) {
  return fetchTransitPublic(url,config,fetchImpl===fetch?undefined:fetchImpl);
}

export function claimTransit(db, config, {owner,now=new Date().toISOString(),force=false,task="pricing"}={}) {
  const table = task === "performance" ? "transit_performance_schedule" : "transit_collect_schedule";
  return db.transaction(()=>{
    upsertTransitStation(db,{...config,sourceType:config.sourceType??"official_public",status:"candidate"});
    db.prepare(`INSERT OR IGNORE INTO ${table}(station_id,next_collect_at) VALUES (?,?)`).run(config.id,now);
    return db.prepare(`UPDATE ${table} SET lease_owner=@owner,lease_until=@until
      WHERE station_id=@id AND (lease_until IS NULL OR lease_until<=@now)
      AND (@force=1 OR next_collect_at<=@now)`).run({owner,until:new Date(Date.parse(now)+5*60*1000).toISOString(),id:config.id,now,force:force?1:0}).changes===1;
  })();
}

export function finishTransit(db,id,owner,{ok,error=null,at=new Date().toISOString(),retryAfter=null,intervalMs=TRANSIT_INTERVAL_MS,task="pricing"}={}) {
  const table = task === "performance" ? "transit_performance_schedule" : "transit_collect_schedule";
  const row=db.prepare(`SELECT * FROM ${table} WHERE station_id=? AND lease_owner=?`).get(id,owner);
  if(!row) throw new Error("transit_lease_lost");
  const count=ok?0:row.fail_count+1;
  let delay=ok?intervalMs:Math.min(6*60,15*2**Math.min(count-1,5))*60000;
  if(/HTTP (403|429)/.test(error??"")) delay=Math.max(delay,60*60000);
  const retrySeconds=Number(retryAfter); const retryDate=Date.parse(retryAfter);
  const retryMs=retryAfter==null?0:Number.isFinite(retrySeconds)?retrySeconds*1000:Number.isFinite(retryDate)?Math.max(0,retryDate-Date.parse(at)):0;
  delay=Math.max(delay,retryMs);
  const next=new Date(Date.parse(at)+delay).toISOString();
  db.prepare(`UPDATE ${table} SET next_collect_at=?,fail_count=?,lease_owner=NULL,lease_until=NULL,
    last_attempt_at=?,last_success_at=CASE WHEN ?=1 THEN ? ELSE last_success_at END,last_error=? WHERE station_id=? AND lease_owner=?`).run(next,count,at,ok?1:0,at,error,id,owner);
  return next;
}

function archive(db,config,runId,kind,result,rawDir,capturedAt,parseStatus="captured",sourceUrlOverride=null) {
  const digest=hash(result.text); const path=join(rawDir,config.id,`${kind}-${digest}.txt`);
  mkdirSync(dirname(path),{recursive:true});
  if(!existsSync(path)) writeFileSync(path,result.text,"utf8");
  recordTransitSourceSnapshot(db,{...result,stationId:config.id,runId,sourceKind:kind,sourceUrl:sourceUrlOverride??(kind==="pricing"?config.pricingUrl:kind==="metadata"?config.metadataUrl:config.siteUrl),payloadText:result.text,payloadPath:path,payloadHash:digest,capturedAt,parseStatus});
  return path;
}

export function performanceRows(payload, { modelName, groupKey, observedAt }) {
  if(typeof modelName!=="string" || !modelName || typeof groupKey!=="string" || !groupKey || !Array.isArray(payload?.series)) throw new Error("invalid_performance_identity_or_series");
  const series = payload.series;
  const rows = [];
  for (const point of series) {
    const num=(v)=>typeof v==="number"&&Number.isFinite(v)&&v>=0?v:null;
    const ts=num(point.ts);
    if(ts===null || ts%3600!==0 || ts*1000>Date.parse(observedAt)+3600000 || ts<946684800) throw new Error("invalid_performance_bucket");
    const bucketAt=new Date(ts*1000).toISOString();
    const avgTtftMs=num(point.avg_ttft_ms),avgLatencyMs=num(point.avg_latency_ms),successRate=num(point.success_rate),avgTps=num(point.avg_tps);
    if(successRate===null||successRate>100) throw new Error("invalid_performance_rate");
    // 100% with all zero timings has no proven traffic. A zero-timing failure IS evidence.
    const hasData=successRate<100 || (avgTtftMs??0)>0 || (avgLatencyMs??0)>0 || (avgTps??0)>0;
    rows.push({ modelName, groupKey, bucketAt, avgTtftMs, avgLatencyMs, successRate, avgTps, hasData });
  }
  return rows;
}

async function collectPerformance(db, config, parsed, { fetchImpl, rawDir, runId, observedAt }) {
  if (!config.performanceSummaryUrl || !config.performanceUrl) return { rows: 0, warnings: [] };
  const warnings = []; let rows = 0; let requests=0; let blocked=false; let retryAfter=null; let consecutiveFailures=0;
  const deadline=Date.now()+120000;
  try {
    const result = await fetchPublic(config.performanceSummaryUrl, config, fetchImpl);
    archive(db, config, runId, "performance-summary", result, rawDir, observedAt, "captured", config.performanceSummaryUrl);
    const payload = JSON.parse(result.text);
    if (payload.success !== true || !Array.isArray(payload.data?.models)) throw new Error("invalid_performance_summary");
    // Summary hourly timings are often zeros. Do not duplicate those rows into station stats;
    // use the model/group endpoint as the one aligned source of all three metrics.
  } catch (error) {
    warnings.push(`performance-summary: ${error.message}`);
    if(error.httpStatus===403||error.httpStatus===429){blocked=true;retryAfter=error.retryAfter;}
  }

  const modelNames = [...new Set(parsed.offers.map(o => o.rawModel))];
  const queue = modelNames.slice();
  const worker = async () => {
    while (queue.length && !blocked) {
      const modelName = queue.shift(); if (!modelName) return;
      if(Date.now()>deadline){warnings.push("performance: time budget reached; remaining models will be rescanned");return;}
      const sourceUrl = config.performanceUrl.replace("{model}", encodeURIComponent(modelName));
      try {
        const result = await fetchPublic(sourceUrl, config, fetchImpl);
        requests++;
        archive(db, config, runId, `performance-model-${hash(modelName).slice(0, 16)}`, result, rawDir, observedAt, "captured", sourceUrl);
        const payload = JSON.parse(result.text);
        if (payload.success !== true || payload.data?.model_name!==modelName || !Array.isArray(payload.data?.groups)) throw new Error("invalid_performance_model");
        const modelRows = payload.data.groups.flatMap(group => performanceRows(group, { modelName, groupKey: group.group, observedAt }));
        rows += upsertTransitPerformance(db, { stationId: config.id, rows: modelRows, sourceUrl, sourceSchema: payload.data.series_schema, observedAt, windowHours: 360 });
        consecutiveFailures=0;
      } catch (error) {
        warnings.push(`performance:${modelName}: ${error.message}`);
        consecutiveFailures++;
        if(error.httpStatus===403||error.httpStatus===429){blocked=true;retryAfter=error.retryAfter;return;}
        if(consecutiveFailures>=3){warnings.push("performance: three consecutive failures; stop and rescan later");return;}
      }
      // Public source: serial, bounded and gently paced, never a request burst.
      if(fetchImpl===fetch) await new Promise(resolve=>setTimeout(resolve,100));
    }
  };
  await worker();
  return { rows, warnings, requests, blocked, retryAfter };
}

export async function collectTransitSource(db,config,options={}) {
  const owner=options.owner??randomUUID(); const startedAt=options.now??new Date().toISOString();
  if(!config.enabled || !claimTransit(db,config,{owner,now:startedAt,force:options.force})) return {id:config.id,status:"skipped"};
  const runId=`transit-${config.id}-${randomUUID()}`; const rawDir=options.rawDir??join(root,"data/transit/raw");
  const warnings=[]; let priceResult; let rawPath; let parsed;
  try {
    if(config.collectorKind!=="packyapi_v1") throw new Error("unsupported_collector");
    priceResult=await fetchPublic(config.pricingUrl,config,options.fetchImpl);
    // Archive before parsing so malformed responses can be investigated offline.
    rawPath=archive(db,config,runId,"pricing",priceResult,rawDir,startedAt);
    parsed=parsePackyPricing(JSON.parse(priceResult.text),config);
  } catch(error) {
    const at=options.now??new Date().toISOString();
    upsertTransitCollection(db,{station:{...config,status:"candidate"},run:{runId,collectorKind:config.collectorKind,status:"failed",startedAt,finishedAt:at,httpStatus:error.httpStatus??priceResult?.httpStatus,errorCode:"pricing_failed",errorMessage:error.message,rawSnapshotPath:rawPath}});
    const next=finishTransit(db,config.id,owner,{ok:false,error:error.message,at,retryAfter:error.retryAfter});
    // No last-good data or public snapshot is replaced on price failure.
    return {id:config.id,status:"failed",error:error.message,nextCollectAt:next};
  }

  // Performance is public and optional: a failure must never discard a valid price snapshot.
  const performance = options.includePerformance === false ? {rows:0,warnings:[]} : await collectPerformance(db, config, parsed, { fetchImpl: options.fetchImpl ?? fetch, rawDir: options.rawDir ?? join(root, "data/transit/raw"), runId, observedAt: startedAt });
  warnings.push(...performance.warnings);

  const old=db.prepare("SELECT * FROM transit_stations WHERE id=?").get(config.id);
  let publicStatus, homepageText;
  const station={...config,status:config.status??"candidate",sourceFingerprint:hash(priceResult.text),config,sourceType:"official_public"};
  try {
    const meta=await fetchPublic(config.metadataUrl,config,options.fetchImpl);
    archive(db,config,runId,"metadata",meta,rawDir,startedAt);
    const json=JSON.parse(meta.text);
    if(json.success!==true || !json.data) throw new Error("invalid_metadata");
    station.name=json.data.system_name||config.name;
    publicStatus=json.data;
    station.rawMeta={publicStatus:json.data,pricingRoot:Object.fromEntries(Object.entries(JSON.parse(priceResult.text)).filter(([k])=>k!=="data"))};
  } catch(error) { warnings.push(`metadata: ${error.message}`); }
  if(config.recharge?.kind==="packy_public_base_v1") {
    try {
      const sourceUrl=config.recharge.documentationUrl;
      const document=await fetchPublic(sourceUrl,config,options.fetchImpl);
      archive(db,config,runId,"recharge-document",document,rawDir,startedAt,"captured",sourceUrl);
      station.recharge=parsePackyRecharge(document.text,publicStatus,{sourceUrl,statusUrl:config.metadataUrl,observedAt:startedAt});
    } catch(error) {
      // An explicit semantic mismatch must not leave a stale ratio next to fresh prices.
      station.recharge=null;warnings.push(`recharge: ${error.message}`);
    }
  }
  try {
    const homepage=await fetchPublic(config.siteUrl,config,options.fetchImpl);
    homepageText=homepage.text;
    archive(db,config,runId,"homepage",homepage,rawDir,startedAt);
    station.description=homepage.text.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1]??null;
  } catch(error) { warnings.push(`homepage: ${error.message}`); }
  if(config.discount?.kind==="packy_public_formula_v1") {
    let policy, policySourceUrl, policyHash;
    try {
      const asset=homepageText?.match(/<script[^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["']/)?.[1];
      if(!asset) throw new Error("missing_pricing_bundle");
      policySourceUrl=new URL(asset,config.siteUrl).href;
      if(new URL(policySourceUrl).origin!==new URL(config.siteUrl).origin) throw new Error("cross_origin_pricing_bundle");
      const result=await fetchPublic(policySourceUrl,config,options.fetchImpl);
      archive(db,config,runId,"discount-policy",result,rawDir,startedAt,"captured",policySourceUrl);
      policy=parsePackyDiscountPolicy(result.text);policyHash=hash(result.text);
      station.rawMeta={...(station.rawMeta??{}),discountPolicy:{...policy,policySourceUrl,policyHash,observedAt:startedAt}};
    } catch(error) { warnings.push(`discount-policy: ${error.message}`); }
    let references={};
    for(const path of [process.env.TRANSIT_MODEL_CATALOG_PATH??join(root,"data/transit/model-catalog.json"),`${process.env.TRANSIT_MODEL_CATALOG_PATH??join(root,"data/transit/model-catalog.json")}.last-good`]) {
      try {const catalog=JSON.parse(readFileSync(path,"utf8"));if(catalog.schemaVersion===1&&catalog.models){references=catalog.models;break;}}catch{/* optional local price references */}
    }
    for(const offer of parsed.offers) offer.discount=packyOfferDiscount(offer,{status:publicStatus,policy,policySourceUrl,policyHash,
      reference:references[offer.rawModel.toLowerCase()]?.priceReference,conversionSourceUrl:config.discount.rechargeDocumentationUrl,observedAt:startedAt});
  }
  try {
    const logo=await fetchPublic(config.logoUrl,{...config,maxBytes:128*1024},options.fetchImpl);
    if(!logo.contentType?.includes("image/svg+xml") || !/<svg[\s>]/i.test(logo.text) || /<script|<foreignObject|<!DOCTYPE|<!ENTITY|\bon\w+\s*=|(?:href\s*=\s*["'](?!#))|url\(/i.test(logo.text)) throw new Error("unsafe_or_invalid_svg");
    const publicRoot=options.publicRoot??join(root,"public");
    const path=join(publicRoot,config.logoLocalPath.replace(/^\//,"")); mkdirSync(dirname(path),{recursive:true});
    // currentColor SVG is black by default; the UI places it on a light tile.
    writeFileSync(`${path}.tmp`,logo.text,"utf8");renameSync(`${path}.tmp`,path);
    station.logoLocalPath=config.logoLocalPath;
    station.rawMeta={...(station.rawMeta??{}),logo:{sha256:hash(logo.text),url:config.logoUrl,checkedAt:startedAt}};
  } catch(error) { warnings.push(`logo: ${error.message}`);station.logoLocalPath=old?.logo_local_path??null; }
  const at=options.now??new Date().toISOString();
  db.transaction(()=>{
    upsertTransitCollection(db,{station,groups:parsed.groups,offers:parsed.offers,collectionComplete:true,observedAt:at,run:{runId,collectorKind:config.collectorKind,status:"success",startedAt,finishedAt:at,httpStatus:priceResult.httpStatus,rawSnapshotPath:rawPath,errorMessage:warnings.join("; ")||null}});
    // Incomplete optional assets re-scan after 15m, while successful pricing is retained.
    finishTransit(db,config.id,owner,{ok:true,at,retryAfter:performance.retryAfter,intervalMs:performance.blocked?3600000:warnings.length?15*60000:options.intervalMs??TRANSIT_INTERVAL_MS});
  })();
  return {id:config.id,status:"success",models:parsed.modelCount,groups:parsed.groups.length,offers:parsed.offers.length,unpriced:parsed.unresolved.length,performanceRows:performance.rows,warnings};
}

/** Rebuilding is cheap and repairs a missed/failed export even with nothing due. */
export async function runTransitCollection(db,options={}) {
  const results=[];
  for(const config of options.sources??loadTransitSources()) {
    try {
      if(config.collectorKind === "zetaapi_v1") {
        results.push(await collectZetaApiSource(db,config,options,{fetchPublic,claimTransit,finishTransit}));
      } else if(config.collectorKind === "rightapi_v1") {
        results.push(await collectRightApiSource(db,config,options,{fetchPublic,claimTransit,finishTransit}));
      } else if(config.collectorKind === "packyapi_v1") {
        results.push(await collectTransitSource(db,config,options));
      } else {
        results.push({id:config.id,status:"failed",error:"unsupported_collector"});
      }
    } catch(error) {
      // One unexpected adapter/storage failure must not prevent the other sites
      // from collecting or prevent their successful rows reaching the snapshot.
      const message=describeTransitError(error),at=options.now??new Date().toISOString();
      results.push({id:config.id,status:"failed",error:message});
      try{upsertTransitCollection(db,{station:{...config,status:"candidate",sourceType:"official_public"},
        run:{runId:`transit-${config.id}-${randomUUID()}`,collectorKind:config.collectorKind,stage:"dispatch",
          status:"failed",startedAt:at,finishedAt:at,errorMessage:message}});}catch{/* retain original error and last-good snapshot data */}
    }
  }
  exportTransitSnapshot(db,options.snapshotPath);
  return results;
}
