import {existsSync,unlinkSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {soleHash,soleProbeRows} from './soleapi-parser.mjs';

export const SOLE_SCHEMA_SQL=`
CREATE TABLE IF NOT EXISTS transit_model_catalog_versions (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),canonical_model TEXT NOT NULL,content_hash TEXT NOT NULL,
 model_json TEXT NOT NULL,source_url TEXT NOT NULL,source_updated_at TEXT,observed_at TEXT NOT NULL,
 PRIMARY KEY(station_id,canonical_model,content_hash));
CREATE TABLE IF NOT EXISTS transit_offer_charge_items (
 offer_id TEXT NOT NULL REFERENCES transit_offers(id) ON DELETE CASCADE,charge_key TEXT NOT NULL,unit TEXT NOT NULL,
 base_currency TEXT NOT NULL,base_price_text TEXT NOT NULL,channel_multiplier_text TEXT NOT NULL,effective_credit_price_text TEXT NOT NULL,
 pricing_version_hash TEXT NOT NULL,source_url TEXT NOT NULL,observed_at TEXT NOT NULL,PRIMARY KEY(offer_id,charge_key));
CREATE TABLE IF NOT EXISTS transit_model_detail_state (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),canonical_model TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,
 model_json TEXT,raw_hash TEXT,credit_basis_verified INTEGER NOT NULL DEFAULT 0,last_success_at TEXT,last_attempt_at TEXT,
 next_attempt_at TEXT NOT NULL,fail_count INTEGER NOT NULL DEFAULT 0,last_error TEXT,
 PRIMARY KEY(station_id,canonical_model));
CREATE TABLE IF NOT EXISTS transit_model_probe_observations (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),canonical_model TEXT NOT NULL,probe_at TEXT NOT NULL,
 ok INTEGER NOT NULL CHECK(ok IN (0,1)),latency_ms REAL,source_url TEXT NOT NULL,raw_hash TEXT NOT NULL,
 first_seen_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,PRIMARY KEY(station_id,canonical_model,probe_at));
CREATE INDEX IF NOT EXISTS idx_model_probe_time ON transit_model_probe_observations(station_id,probe_at,canonical_model);
CREATE TABLE IF NOT EXISTS transit_model_probe_hourly (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),canonical_model TEXT NOT NULL,bucket_at TEXT NOT NULL,
 success_count INTEGER NOT NULL,failed_count INTEGER NOT NULL,latency_count INTEGER NOT NULL,latency_sum_ms REAL NOT NULL,
 first_sample_at TEXT NOT NULL,last_sample_at TEXT NOT NULL,largest_gap_seconds REAL NOT NULL,is_partial INTEGER NOT NULL,
 observed_at TEXT NOT NULL,PRIMARY KEY(station_id,canonical_model,bucket_at));
CREATE TABLE IF NOT EXISTS transit_model_metric_summaries (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),canonical_model TEXT NOT NULL,metric_kind TEXT NOT NULL,
 window_hours INTEGER NOT NULL,observed_at TEXT NOT NULL,payload_json TEXT NOT NULL,source_url TEXT NOT NULL,
 last_probe_at TEXT,PRIMARY KEY(station_id,canonical_model,metric_kind,window_hours,observed_at));
CREATE INDEX IF NOT EXISTS idx_model_metric_latest ON transit_model_metric_summaries(station_id,canonical_model,metric_kind,observed_at DESC);
CREATE TABLE IF NOT EXISTS transit_fx_observations (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),currency TEXT NOT NULL,source_updated_at TEXT NOT NULL,content_hash TEXT NOT NULL,
 amount_per_credit_text TEXT NOT NULL,source TEXT NOT NULL,captured_at TEXT NOT NULL,
 PRIMARY KEY(station_id,currency,source_updated_at,content_hash));
`;
const HOUR=3600000,iso=ms=>new Date(ms).toISOString();
const probeIso=ms=>iso(ms).replace(/(\.\d{3})Z$/,(_,fraction)=>`${fraction}000Z`);
const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;

export function loadSoleDetails(db,id) {
  const map=new Map();
  for(const row of db.prepare('SELECT * FROM transit_model_detail_state WHERE station_id=?').all(id)){
    if(row.model_json)try{map.set(row.canonical_model,{model:JSON.parse(row.model_json),observedAt:row.last_success_at,creditBasisVerified:Boolean(row.credit_basis_verified),state:row});}catch{/* malformed legacy cache is re-fetched */}
  }
  return map;
}
export function syncSoleSubjects(db,id,catalog,observedAt) {
  db.prepare('UPDATE transit_model_detail_state SET active=0 WHERE station_id=?').run(id);
  const insert=db.prepare(`INSERT INTO transit_model_detail_state(station_id,canonical_model,active,next_attempt_at) VALUES (?,?,1,?)
    ON CONFLICT(station_id,canonical_model) DO UPDATE SET active=1`);
  for(const m of catalog.list)insert.run(id,m.canonicalName,observedAt);
}
export function saveSolePrices(db,id,catalog,parsed,fx,sourceUrl,observedAt) {
  const version=db.prepare(`INSERT OR IGNORE INTO transit_model_catalog_versions
    (station_id,canonical_model,content_hash,model_json,source_url,source_updated_at,observed_at) VALUES (?,?,?,?,?,?,?)`);
  for(const m of catalog.list){const pricing={...m};delete pricing.health;delete pricing.throughputTps;const tiers=parsed.offers.find(o=>o.rawModel===m.canonicalName)?.tiers;
    const value={...pricing,tiers};version.run(id,m.canonicalName,soleHash(value),JSON.stringify(value),sourceUrl,m.updatedAt??null,observedAt);}
  const item=db.prepare(`INSERT INTO transit_offer_charge_items
    (offer_id,charge_key,unit,base_currency,base_price_text,channel_multiplier_text,effective_credit_price_text,pricing_version_hash,source_url,observed_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  for(const o of parsed.offers){const offerId=`${id}:${o.groupKey}:${o.rawModel}:${o.priceKind}`;
    db.prepare('DELETE FROM transit_offer_charge_items WHERE offer_id=?').run(offerId);
    for(const c of o.chargeItems)item.run(offerId,c.key,c.unit,c.baseCurrency,c.basePrice,c.multiplier,c.creditPrice,o.sourceModelVersion,sourceUrl,observedAt);}
  if(fx){const save=db.prepare(`INSERT OR IGNORE INTO transit_fx_observations
    (station_id,currency,source_updated_at,content_hash,amount_per_credit_text,source,captured_at) VALUES (?,?,?,?,?,?,?)`);
    for(const [currency,rate]of Object.entries(fx.rates))save.run(id,currency,fx.updatedAt,soleHash(fx),String(rate),fx.source,observedAt);}
}
export function saveSoleSummary(db,id,model,sourceUrl,observedAt) {
  const save=db.prepare(`INSERT OR REPLACE INTO transit_model_metric_summaries
    (station_id,canonical_model,metric_kind,window_hours,observed_at,payload_json,source_url,last_probe_at) VALUES (?,?,?,?,?,?,?,?)`);
  const health=model.health,a=health?.availability;
  if(a){if(!Number.isSafeInteger(a.success)||!Number.isSafeInteger(a.total)||a.success<0||a.total<a.success)throw new Error('invalid_sole_summary_counts');
    save.run(id,model.canonicalName,'probe_summary',168,observedAt,JSON.stringify(a),sourceUrl,health.lastProbeAt??null);}
  if(finite(model.throughputTps))save.run(id,model.canonicalName,'traffic_throughput',168,observedAt,JSON.stringify({value:model.throughputTps}),sourceUrl,null);
  if(finite(health?.avgLatencyMs))save.run(id,model.canonicalName,'last60_latency',0,observedAt,JSON.stringify({average:health.avgLatencyMs,p95:health.p95LatencyMs??null,count:health.history?.length??null}),sourceUrl,health.lastProbeAt??null);
}
export function saveSoleDetail(db,id,detail,{sourceUrl,observedAt,intervalMs,rawHash,includePerformance=true}) {
  const model=detail.model,probes=soleProbeRows(model,observedAt);
  return db.transaction(()=>{
    let inserted=0;
    if(includePerformance){
      const get=db.prepare('SELECT ok,latency_ms FROM transit_model_probe_observations WHERE station_id=? AND canonical_model=? AND probe_at=?');
      const insert=db.prepare(`INSERT INTO transit_model_probe_observations(station_id,canonical_model,probe_at,ok,latency_ms,source_url,raw_hash,first_seen_at,last_seen_at)
        VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(station_id,canonical_model,probe_at) DO UPDATE SET last_seen_at=excluded.last_seen_at`);
      for(const p of probes){const old=get.get(id,model.canonicalName,p.time);
        if(old&&(old.ok!==+p.ok||old.latency_ms!==p.latency))throw new Error(`conflicting_sole_probe:${model.canonicalName}:${p.time}`);
        insert.run(id,model.canonicalName,p.time,+p.ok,p.latency,sourceUrl,rawHash,observedAt,observedAt);if(!old)inserted++;}
      saveSoleSummary(db,id,model,sourceUrl,observedAt);
    }
    db.prepare(`UPDATE transit_model_detail_state SET model_json=?,raw_hash=?,credit_basis_verified=?,last_success_at=?,last_attempt_at=?,
      next_attempt_at=?,fail_count=0,last_error=NULL WHERE station_id=? AND canonical_model=?`)
      .run(JSON.stringify(model),rawHash,+detail.creditBasisVerified,observedAt,observedAt,iso(Date.parse(observedAt)+intervalMs),id,model.canonicalName);
    return inserted;
  }).immediate();
}
export function failSoleDetail(db,id,name,error,observedAt,retryAfter) {
  const previous=db.prepare('SELECT fail_count FROM transit_model_detail_state WHERE station_id=? AND canonical_model=?').get(id,name);
  const count=(previous?.fail_count??0)+1;
  const seconds=Number(retryAfter),date=Date.parse(retryAfter);
  const serverDelay=retryAfter==null?0:Number.isFinite(seconds)?seconds*1000:Number.isFinite(date)?Math.max(0,date-Date.parse(observedAt)):0;
  const delay=Math.max(serverDelay,Math.min(360,15*2**Math.min(count-1,5))*60000);
  db.prepare(`UPDATE transit_model_detail_state SET last_attempt_at=?,next_attempt_at=?,fail_count=?,last_error=? WHERE station_id=? AND canonical_model=?`)
    .run(observedAt,iso(Date.parse(observedAt)+delay),count,error,id,name);
}
export function rebuildSoleHours(db,id,now) {
  const rows=db.prepare('SELECT * FROM transit_model_probe_observations WHERE station_id=? AND probe_at>=? ORDER BY canonical_model,probe_at').all(id,iso(Date.parse(now)-35*86400000));
  const buckets=new Map();
  for(const r of rows){const at=iso(Math.floor(Date.parse(r.probe_at)/HOUR)*HOUR),key=JSON.stringify([r.canonical_model,at]);const b=buckets.get(key)??{name:r.canonical_model,at,rows:[]};b.rows.push(r);buckets.set(key,b);}
  db.transaction(()=>{
    const insert=db.prepare(`INSERT OR REPLACE INTO transit_model_probe_hourly
      (station_id,canonical_model,bucket_at,success_count,failed_count,latency_count,latency_sum_ms,first_sample_at,last_sample_at,largest_gap_seconds,is_partial,observed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    for(const b of buckets.values()){const good=b.rows.filter(r=>r.ok),lat=good.filter(r=>finite(r.latency_ms)&&r.latency_ms>0);
      const gap=Math.max(0,...b.rows.slice(1).map((r,i)=>(Date.parse(r.probe_at)-Date.parse(b.rows[i].probe_at))/1000));
      insert.run(id,b.name,b.at,good.length,b.rows.length-good.length,lat.length,lat.reduce((s,r)=>s+r.latency_ms,0),b.rows[0].probe_at,b.rows.at(-1).probe_at,gap,+(Date.parse(b.at)+HOUR>Date.parse(now)),now);}
  }).immediate();
}

/** Model probes only: no invented group identities or fabricated hourly throughput. */
export function buildSolePerformance(db,id,names,{now=Date.now()}={}) {
  const end=Math.floor(now/HOUR)*HOUR+HOUR,start=end-360*HOUR;
  const rows=db.prepare('SELECT canonical_model,probe_at,ok,latency_ms,last_seen_at FROM transit_model_probe_observations WHERE station_id=? AND probe_at>=? AND probe_at<=? ORDER BY probe_at')
    .all(id,probeIso(start),probeIso(now));
  const byModel=new Map(names.map(name=>[name,[]]));for(const r of rows)byModel.get(r.canonical_model)?.push(r);
  const summary=db.prepare(`SELECT payload_json,observed_at,source_url,last_probe_at FROM transit_model_metric_summaries
    WHERE station_id=? AND canonical_model=? AND metric_kind=? AND observed_at>=? ORDER BY observed_at DESC LIMIT 1`);
  const models={};
  const stat=(points,scope)=>{
    const good=points.filter(p=>p.ok),timed=good.filter(p=>p.latency_ms>0),hours=new Set(points.map(p=>Math.floor(Date.parse(p.probe_at)/HOUR)));
    return {kind:'model_probe_availability',scope,capabilities:{ttft:false,latency:true,throughput:false},windowHours:360,windowStart:iso(start),windowEnd:iso(now),
      availability:points.length?100*good.length/points.length:null,latestTtftMs:null,latestLatencyMs:points.at(-1)?.latency_ms??null,
      averageLatencyMs:mean(timed.map(p=>p.latency_ms)),latestThroughputTps:null,averageThroughputTps:null,
      samples:hours.size,probeCount:points.length,expectedHours:360,latencyHours:new Set(timed.map(p=>Math.floor(Date.parse(p.probe_at)/HOUR))).size,throughputHours:0,
      latestBucketAt:points.at(-1)?.probe_at??null,collectedAt:points.length?points.reduce((m,p)=>p.last_seen_at>m?p.last_seen_at:m,''):null,
      method:scope.modelName?'probe_count_weighted':'model_equal_weight',bars:Array.from({length:60},(_,i)=>{
        const at=start+i*6*HOUR,chunk=points.filter(p=>Date.parse(p.probe_at)>=at&&Date.parse(p.probe_at)<at+6*HOUR),lat=chunk.filter(p=>p.ok&&p.latency_ms>0);
        return {availability:chunk.length?100*chunk.filter(p=>p.ok).length/chunk.length:null,latencyMs:mean(lat.map(p=>p.latency_ms)),ttftMs:null,
          startAt:iso(at),endAt:iso(Math.min(at+6*HOUR,now)),knownHours:new Set(chunk.map(p=>Math.floor(Date.parse(p.probe_at)/HOUR))).size,expectedHours:6,label:''};
      })};
  };
  for(const [name,points]of byModel){const value=stat(points,{stationId:id,groupKey:null,modelName:name});
    // Temporary hour series for group fallback. Preserve real sample counts within
    // each model/hour; the shared exporter then averages member models per hour.
    const hourly=new Map();
    for(const point of points){
      const at=Math.floor(Date.parse(point.probe_at)/HOUR)*HOUR;
      const bucket=hourly.get(at)??[];bucket.push(point);hourly.set(at,bucket);
    }
    value._hourly=[...hourly].map(([at,chunk])=>({bucketAt:iso(at),
      availability:100*chunk.filter(p=>p.ok).length/chunk.length,
      latencyMs:mean(chunk.filter(p=>p.ok&&p.latency_ms>0).map(p=>p.latency_ms)),
      ttftMs:null,throughputTps:null}));
    const record=summary.get(id,name,'traffic_throughput',iso(now-48*HOUR));
    if(record)try{const data=JSON.parse(record.payload_json);if(finite(data.value))value.throughputSummary={value:data.value,windowHours:168,observedAt:record.observed_at,sourceUrl:record.source_url};}catch{/* absent summary */}
    models[name]=value;}
  const station=stat(rows.filter(r=>byModel.has(r.canonical_model)),{stationId:id,groupKey:null});
  const known=Object.values(models).filter(m=>m.probeCount>0);
  station.availability=mean(known.map(m=>m.availability));station.averageLatencyMs=mean(known.map(m=>m.averageLatencyMs).filter(finite));
  station.monitoredModels=known.length;station.totalModels=names.length;
  station.latestLatencyMs=mean(known.map(m=>m.latestLatencyMs).filter(finite));
  station.bars=station.bars.map((bar,index)=>({...bar,availability:mean(known.map(m=>m.bars[index].availability).filter(finite)),latencyMs:mean(known.map(m=>m.bars[index].latencyMs).filter(finite))}));
  return {stationId:id,station,models,groups:{}};
}

export function pruneSoleHistory(db,id,observedAt,rawDir,days=35) {
  const cutoff=iso(Date.parse(observedAt)-Math.max(35,days)*86400000),htmlCutoff=iso(Date.parse(observedAt)-7*86400000);
  const expired=db.prepare(`SELECT id,payload_path FROM transit_source_snapshots WHERE station_id=? AND captured_at<?
    AND (source_kind LIKE 'detail-%' OR captured_at<?)
    AND payload_hash NOT IN (SELECT raw_hash FROM transit_model_detail_state WHERE station_id=? AND raw_hash IS NOT NULL)
    AND payload_hash NOT IN (SELECT source_fingerprint FROM transit_stations WHERE id=? AND source_fingerprint IS NOT NULL)
    ORDER BY captured_at LIMIT 100`).all(id,htmlCutoff,cutoff,id,id);
  db.transaction(()=>{
    for(const table of ['transit_model_probe_observations','transit_model_probe_hourly'])db.prepare(`DELETE FROM ${table} WHERE station_id=? AND ${table.endsWith('hourly')?'bucket_at':'probe_at'}<?`).run(id,cutoff);
    db.prepare('DELETE FROM transit_model_metric_summaries WHERE station_id=? AND observed_at<?').run(id,cutoff);
    for(const row of expired)db.prepare('DELETE FROM transit_source_snapshots WHERE id=?').run(row.id);
  }).immediate();
  const allowed=resolve(rawDir,id)+sep;
  for(const r of expired){if(!r.payload_path)continue;const target=resolve(r.payload_path);
    if(!target.startsWith(allowed))continue;
    if(!db.prepare('SELECT 1 FROM transit_source_snapshots WHERE payload_path=? LIMIT 1').get(r.payload_path)&&existsSync(target))unlinkSync(target);}
}
