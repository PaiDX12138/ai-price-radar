#!/usr/bin/env node
/** Read-only deployment diagnostic. No migration, credentials or raw responses. */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import Database from "better-sqlite3";
import { loadEnvLocal } from "./load-env-local.mjs";
import { transitProxySetting, redactTransitError } from "../collectors/transit/transport.mjs";
import { transitRuntimeHealth } from "../collectors/transit/health.mjs";
loadEnvLocal();
const cwd=process.cwd(),snapshotPath=resolve(process.env.TRANSIT_SNAPSHOT_PATH||"data/transit/latest.json");
const dbPath=resolve(process.env.TRANSIT_DB_PATH||"data/transit.sqlite"),issues=[];
const readJson=path=>JSON.parse(readFileSync(path,"utf8"));
let configs=[],snapshot=null,db=null,revision=null,buildId=null;
try{revision=execFileSync('git',['rev-parse','--short','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{/* packaged deployment */}
try{buildId=readFileSync(resolve('.next/BUILD_ID'),'utf8').trim();}catch{/* no production build */}
try{configs=readdirSync('config/transit').filter(n=>/^[a-z0-9-]+\.json$/.test(n)).map(n=>readJson(resolve('config/transit',n))).filter(c=>c.enabled);}catch(error){issues.push(`config_unreadable: ${redactTransitError(error.message)}`);}
try{snapshot=readJson(snapshotPath);if(!Array.isArray(snapshot.stations)||!Array.isArray(snapshot.groups)||!Array.isArray(snapshot.offers))throw new Error('invalid_schema');}
catch(error){snapshot=null;issues.push(`snapshot_unreadable: ${redactTransitError(error.message)}`);}
try{if(existsSync(dbPath))db=new Database(dbPath,{readonly:true,fileMustExist:true});else issues.push('database_missing');}catch(error){issues.push(`database_unreadable: ${redactTransitError(error.message)}`);}
const table=name=>Boolean(db?.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
const rowsOf=id=>{
  const groups=snapshot?.groups.filter(g=>g.station_id===id)??[],ids=new Set(groups.map(g=>g.id));
  return {groups,offers:snapshot?.offers.filter(o=>ids.has(o.group_id))??[]};
};
const familyCounts=offers=>offers.reduce((map,o)=>{map[o.family||'其他']=(map[o.family||'其他']??0)+1;return map;},{});
try{
  const runtime=transitRuntimeHealth(db,configs);
  issues.push(...runtime.issues);
  for(const worker of runtime.workers)if(worker.last_error)worker.last_error=redactTransitError(worker.last_error);
  const stations=(snapshot?.stations??[]).map(station=>{
    const {groups,offers}=rowsOf(station.id);
    return {id:station.id,status:station.status,lastCollectOk:station.last_collect_ok,lastCollectedAt:station.last_collected_at,
      groups:groups.length,models:new Set(offers.map(o=>o.raw_model)).size,offers:offers.length,families:familyCounts(offers)};
  });
  const configured=configs.map(config=>{
    const visible=stations.find(s=>s.id===config.id),setting=transitProxySetting(config);
    const station=table('transit_stations')?db.prepare('SELECT status,last_collect_ok,last_collected_at FROM transit_stations WHERE id=?').get(config.id):null;
    let sourceState=null;
    if(table('transit_stations'))try{
      const service=JSON.parse(db.prepare('SELECT raw_meta_json FROM transit_stations WHERE id=?').get(config.id)?.raw_meta_json??'{}').service;
      if(service?.closed===true)sourceState={status:'closed',closedAt:service.closedAt,observedAt:service.observedAt};
    }catch{/* malformed metadata is not evidence of closure */}
    const runs=table('transit_collection_runs')?db.prepare('SELECT stage,status,finished_at,error_message FROM transit_collection_runs WHERE station_id=? ORDER BY finished_at DESC LIMIT 3').all(config.id).map(r=>({...r,error_message:r.error_message?redactTransitError(r.error_message):null})):[];
    const schedule=table('transit_collect_schedule')?db.prepare('SELECT next_collect_at,last_success_at,last_error FROM transit_collect_schedule WHERE station_id=?').get(config.id):null;
    const performanceSchedule=table('transit_performance_schedule')?db.prepare('SELECT next_collect_at,last_success_at,last_error FROM transit_performance_schedule WHERE station_id=?').get(config.id):null;
    for(const item of [schedule,performanceSchedule])if(item?.last_error)item.last_error=redactTransitError(item.last_error);
    const stored=table('transit_offers')?db.prepare(`SELECT o.family,o.raw_model FROM transit_offers o JOIN transit_groups g ON g.id=o.group_id
      WHERE g.station_id=? AND g.status='active' AND o.status='active'`).all(config.id):[];
    const missingFamilies=(config.requiredFamilies??[]).filter(f=>!stored.some(o=>o.family===f));
    let pricingCollection=null;
    if(['packyapi_v1','soleapi_v1','runapi_v1','cubence_v1','crazyrouter_v1','sudocode_v1'].includes(config.collectorKind)&&table('transit_stations')) {
      try {
        const row=db.prepare('SELECT raw_meta_json FROM transit_stations WHERE id=?').get(config.id);
        const collection=JSON.parse(row?.raw_meta_json??'{}').pricingCollection;
        if(collection)pricingCollection={status:collection.status,observedAt:collection.observedAt,
          selectedOrigin:collection.selectedOrigin??null,sourceUrl:collection.sourceUrl?redactTransitError(collection.sourceUrl):null,
          inventory:collection.inventory??null,detailsPending:collection.detailsPending??null,
          multiplierMismatches:collection.multiplierMismatches??[],
          attempts:(Array.isArray(collection.attempts)?collection.attempts:[]).map(attempt=>({
            origin:attempt.origin,status:attempt.status,httpStatus:attempt.httpStatus??null,
            inventory:attempt.inventory??null,payloadHash:attempt.payloadHash??null,
            error:attempt.error?redactTransitError(attempt.error):null,
          }))};
      }catch(error){issues.push(`pricing_collection_unreadable:${config.id}:${redactTransitError(error.message)}`);}
    }
    if(!visible)issues.push(`not_published:${config.id}`);
    if(station?.last_collect_ok===0&&!sourceState)issues.push(`last_collection_failed:${config.id}`);
    if(missingFamilies.length)issues.push(`incomplete_families:${config.id}:${missingFamilies.join(',')}`);
    if(visible&&stored.length!==visible.offers)issues.push(`db_snapshot_offer_mismatch:${config.id}`);
    let detailCollection=null;
    if(config.collectorKind==='soleapi_v1'&&table('transit_model_detail_state')) {
      const detail=db.prepare(`SELECT COUNT(*) AS subjects,SUM(CASE WHEN model_json IS NOT NULL THEN 1 ELSE 0 END) AS saved,
        SUM(CASE WHEN last_error IS NOT NULL THEN 1 ELSE 0 END) AS failed,MIN(last_success_at) AS oldestDetailAt,
        MIN(next_attempt_at) AS nextDetailAt FROM transit_model_detail_state WHERE station_id=? AND active=1`).get(config.id);
      const probes=db.prepare(`SELECT COUNT(*) AS probes,COUNT(DISTINCT canonical_model) AS monitoredModels,MIN(probe_at) AS earliestProbe,MAX(probe_at) AS latestProbe
        FROM transit_model_probe_observations WHERE station_id=? AND probe_at>=?`).get(config.id,new Date(Date.now()-15*86400000).toISOString());
      const errors=db.prepare('SELECT canonical_model,last_error,next_attempt_at FROM transit_model_detail_state WHERE station_id=? AND active=1 AND last_error IS NOT NULL LIMIT 5').all(config.id)
        .map(r=>({...r,last_error:redactTransitError(r.last_error)}));
      detailCollection={...detail,...probes,errors};
      if(detail.failed)issues.push(`detail_collection_failed:${config.id}:${detail.failed}`);
    }
    let runapiMonitoring=null;
    if(config.collectorKind==='runapi_v1'&&table('transit_runapi_probe_targets')) {
      runapiMonitoring={targets:db.prepare('SELECT mapping_status,COUNT(*) AS count FROM transit_runapi_probe_targets WHERE station_id=? AND active=1 GROUP BY mapping_status').all(config.id),
        history:db.prepare('SELECT COUNT(*) AS probes,MIN(checked_at) AS firstProbe,MAX(checked_at) AS lastProbe FROM transit_runapi_probe_observations WHERE station_id=?').get(config.id),
        conflicts:db.prepare("SELECT name,model,group_hint,mapping_status FROM transit_runapi_probe_targets WHERE station_id=? AND active=1 AND mapping_status<>'matched'").all(config.id)};
    }
    return {id:config.id,collectorKind:config.collectorKind,published:Boolean(visible),station:station??null,sourceState,
      ...(config.collectorKind==='runapi_v1'?{pricingCollection,runapiMonitoring}:{}),
      ...(config.collectorKind==='cubence_v1'?{pricingCollection,monitoring:{status:'login_required',pollingEnabled:false},priceBasis:'public_usd_base'}:{}),
      ...(config.collectorKind==='crazyrouter_v1'?{pricingCollection,monitoring:table('transit_crazyrouter_metric_subjects')?db.prepare(`SELECT COUNT(*) subjects,SUM(CASE WHEN last_success_at IS NOT NULL THEN 1 ELSE 0 END) saved,
        SUM(CASE WHEN last_error IS NOT NULL THEN 1 ELSE 0 END) failed,MIN(next_attempt_at) nextSubjectAt FROM transit_crazyrouter_metric_subjects WHERE station_id=? AND active=1`).get(config.id):null}:{}),
      database:{models:new Set(stored.map(o=>o.raw_model)).size,offers:stored.length,families:familyCounts(stored)},
      ...(config.collectorKind==='sudocode_v1'?{pricingCollection,monitoring:table('transit_sudocode_tier_hourly')?db.prepare(`SELECT COUNT(*) versionHourRows,COUNT(DISTINCT model) models,
        COUNT(DISTINCT tier) versions,MIN(bucket_at) earliestHour,MAX(bucket_at) latestHour,MAX(observed_at) lastObservedAt
        FROM transit_sudocode_tier_hourly WHERE station_id=?`).get(config.id):null,monitoringScope:'version_model_hour_not_independent_channel'}:{}),
      ...(config.collectorKind==='packyapi_v1'?{apiOrigins:config.apiOrigins??[new URL(config.pricingUrl).origin],pricingCollection}:{}),
      ...(config.collectorKind==='soleapi_v1'?{pricingCollection,detailCollection}:{}),
      missingFamilies,network:{mode:setting.mode,setting:setting.key},runs,schedule:schedule??null,performanceSchedule:performanceSchedule??null};
  });
  console.log(JSON.stringify({cwd,revision,buildId,dbPath,snapshotPath,generatedAt:snapshot?.generatedAt??null,
    snapshotFingerprint:snapshot?createHash('sha256').update(JSON.stringify(snapshot)).digest('hex').slice(0,16):null,
    stations,configured,runtime,issues},null,2));
  if(!snapshot)process.exitCode=1;
  else if(process.argv.includes('--strict')&&issues.length)process.exitCode=2;
}finally{db?.close();}
