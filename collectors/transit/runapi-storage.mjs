import {existsSync,unlinkSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {runHash} from './runapi-parser.mjs';
import {buildPerformanceMonitor} from '../../src/lib/transit/performance.mjs';
export const RUN_SCHEMA_SQL=`
CREATE TABLE IF NOT EXISTS transit_runapi_catalog_versions (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),version_hash TEXT NOT NULL,observed_at TEXT NOT NULL,
 source_url TEXT NOT NULL,catalog_json TEXT NOT NULL,inventory_json TEXT NOT NULL,PRIMARY KEY(station_id,version_hash));
CREATE TABLE IF NOT EXISTS transit_runapi_billing_versions (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),model TEXT NOT NULL,version_hash TEXT NOT NULL,expression TEXT NOT NULL,
 parse_error TEXT,parser_version TEXT NOT NULL,observed_at TEXT NOT NULL,PRIMARY KEY(station_id,model,version_hash));
CREATE TABLE IF NOT EXISTS transit_runapi_metadata_observations (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),version_hash TEXT NOT NULL,observed_at TEXT NOT NULL,
 source_url TEXT NOT NULL,payload_json TEXT NOT NULL,PRIMARY KEY(station_id,version_hash));
CREATE TABLE IF NOT EXISTS transit_runapi_memberships (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),group_key TEXT NOT NULL,model TEXT NOT NULL,
 price_available INTEGER NOT NULL,active INTEGER NOT NULL,observed_at TEXT NOT NULL,PRIMARY KEY(station_id,group_key,model));
CREATE TABLE IF NOT EXISTS transit_runapi_probe_targets (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),target_id TEXT NOT NULL,binding_hash TEXT NOT NULL,name TEXT NOT NULL,
 model TEXT NOT NULL,group_hint TEXT,group_key TEXT,mapping_status TEXT NOT NULL,active INTEGER NOT NULL,raw_json TEXT NOT NULL,
 source_url TEXT NOT NULL,first_seen_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,PRIMARY KEY(station_id,target_id,binding_hash));
CREATE TABLE IF NOT EXISTS transit_runapi_probe_observations (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),target_id TEXT NOT NULL,checked_at TEXT NOT NULL,binding_hash TEXT NOT NULL,
 status TEXT NOT NULL,latency_ms REAL,ping_latency_ms REAL,fingerprint TEXT NOT NULL,source_url TEXT NOT NULL,
 raw_hash TEXT NOT NULL,first_seen_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,PRIMARY KEY(station_id,target_id,checked_at));
CREATE INDEX IF NOT EXISTS idx_runapi_probe_window ON transit_runapi_probe_observations(station_id,checked_at,target_id);
CREATE TABLE IF NOT EXISTS transit_runapi_probe_hourly (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),target_id TEXT NOT NULL,binding_hash TEXT NOT NULL,bucket_at TEXT NOT NULL,
 normal_count INTEGER NOT NULL,degraded_count INTEGER NOT NULL,failed_count INTEGER NOT NULL,maintenance_count INTEGER NOT NULL,
 latency_count INTEGER NOT NULL,latency_sum_ms REAL NOT NULL,first_sample_at TEXT NOT NULL,last_sample_at TEXT NOT NULL,
 largest_gap_seconds REAL NOT NULL,is_partial INTEGER NOT NULL,observed_at TEXT NOT NULL,
 PRIMARY KEY(station_id,target_id,binding_hash,bucket_at));
CREATE TABLE IF NOT EXISTS transit_runapi_monitor_summaries (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),target_id TEXT NOT NULL,binding_hash TEXT NOT NULL,window_hours INTEGER NOT NULL,
 generated_at TEXT NOT NULL,observed_at TEXT NOT NULL,total_checks INTEGER NOT NULL,normal_count INTEGER NOT NULL,availability REAL NOT NULL,
 source_url TEXT NOT NULL,PRIMARY KEY(station_id,target_id,binding_hash,window_hours,generated_at));
`;
const HOUR=3600000,iso=at=>new Date(at).toISOString();
const mean=ns=>ns.length?ns.reduce((a,b)=>a+b,0)/ns.length:null;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export function saveRunCatalog(db,id,payload,parsed,metadata,{sourceUrl,metadataUrl,observedAt}){
  const normalized={...payload,data:[...payload.data].sort((a,b)=>a.model_name.localeCompare(b.model_name)),vendors:[...(payload.vendors??[])].sort((a,b)=>a.id-b.id)};
  db.prepare(`INSERT INTO transit_runapi_catalog_versions VALUES (?,?,?,?,?,?) ON CONFLICT(station_id,version_hash) DO UPDATE SET observed_at=excluded.observed_at`)
    .run(id,runHash(normalized),observedAt,sourceUrl,JSON.stringify(payload),JSON.stringify(parsed.inventory));
  const billing=db.prepare('INSERT OR IGNORE INTO transit_runapi_billing_versions VALUES (?,?,?,?,?,?,?)');
  for(const b of parsed.billing)billing.run(id,b.model,runHash(b.expression),b.expression,b.parseError,'runapi-linear-v1',observedAt);
  db.prepare('INSERT OR IGNORE INTO transit_runapi_metadata_observations VALUES (?,?,?,?,?)').run(id,runHash(metadata),observedAt,metadataUrl,JSON.stringify(metadata));
  db.prepare('UPDATE transit_runapi_memberships SET active=0 WHERE station_id=?').run(id);
  const membership=db.prepare(`INSERT INTO transit_runapi_memberships VALUES (?,?,?,?,1,?) ON CONFLICT(station_id,group_key,model)
    DO UPDATE SET price_available=excluded.price_available,active=1,observed_at=excluded.observed_at`);
  for(const row of parsed.memberships)membership.run(id,row.group,row.model,row.priceAvailable?1:0,observedAt);
}
export function currentRunCatalog(db,id){
  const row=db.prepare('SELECT catalog_json FROM transit_runapi_catalog_versions WHERE station_id=? ORDER BY observed_at DESC,rowid DESC LIMIT 1').get(id);
  return row?JSON.parse(row.catalog_json):null;
}
export function saveRunMonitoring(db,id,data,catalog,{observedAt,sourceUrl,rawHash}){
  const models=new Map((catalog?.data??[]).map(m=>[m.model_name,m]));
  const groupKeys=Object.keys(catalog?.usable_group??{}),groups=new Map(groupKeys.map(g=>[g.toLowerCase(),g]));
  const targetInsert=db.prepare(`INSERT INTO transit_runapi_probe_targets VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(station_id,target_id,binding_hash)
    DO UPDATE SET group_key=excluded.group_key,mapping_status=excluded.mapping_status,active=1,last_seen_at=excluded.last_seen_at,raw_json=excluded.raw_json`);
  const probeInsert=db.prepare('INSERT OR IGNORE INTO transit_runapi_probe_observations VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  const summaries=db.prepare('INSERT OR IGNORE INTO transit_runapi_monitor_summaries VALUES (?,?,?,?,?,?,?,?,?,?)');
  const changed=new Map(),bindings=new Map();let inserted=0;
  return db.transaction(()=>{
    db.prepare('UPDATE transit_runapi_probe_targets SET active=0 WHERE station_id=?').run(id);
    for(const t of data.targets){
      const hint=String(t.groupHint??'').trim(),key=groups.get(hint.toLowerCase());
      const matched=!!key&&models.get(t.model)?.enable_groups.includes(key)&&finite(catalog?.group_ratio?.[key]);
      const status=matched?'matched':models.has(t.model)&&key?'membership_conflict':'unmapped';
      const binding=runHash({name:t.name,model:t.model,hint,endpoint:t.endpoint,type:t.type});
      targetInsert.run(id,t.id,binding,t.name,t.model,hint,matched?key:null,status,1,JSON.stringify(t.raw),sourceUrl,observedAt,observedAt);
      bindings.set(t.id,binding);
    }
    for(const p of data.probes){
      const prior=db.prepare('SELECT fingerprint,binding_hash FROM transit_runapi_probe_observations WHERE station_id=? AND target_id=? AND checked_at=?').get(id,p.id,p.time);
      if(prior&&(prior.fingerprint!==p.fingerprint||prior.binding_hash!==bindings.get(p.id)))throw new Error('runapi_saved_probe_conflict_last_good_retained');
      const binding=bindings.get(p.id);
      const result=probeInsert.run(id,p.id,p.time,binding,p.status,p.latency,p.ping,p.fingerprint,sourceUrl,rawHash,observedAt,observedAt);
      inserted+=result.changes;
      db.prepare('UPDATE transit_runapi_probe_observations SET last_seen_at=? WHERE station_id=? AND target_id=? AND checked_at=?').run(observedAt,id,p.id,p.time);
      const bucket=iso(Math.floor(Date.parse(p.time)/HOUR)*HOUR);changed.set(JSON.stringify([p.id,binding,bucket]),[p.id,binding,bucket]);
    }
    for(const s of data.summaries)summaries.run(id,s.id,bindings.get(s.id),Number.parseInt(s.period)*24,data.generatedAt,observedAt,s.totalChecks,s.operationalCount,s.availabilityPct,sourceUrl);
    const hourInsert=db.prepare('INSERT OR REPLACE INTO transit_runapi_probe_hourly VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    for(const[target,binding,bucket]of changed.values()){
      const points=db.prepare(`SELECT * FROM transit_runapi_probe_observations WHERE station_id=? AND target_id=? AND binding_hash=? AND checked_at>=? AND checked_at<? ORDER BY checked_at`)
        .all(id,target,binding,bucket.replace('.000Z','.000000Z'),iso(Date.parse(bucket)+HOUR).replace('.000Z','.000000Z'));
      const count=state=>points.filter(p=>p.status===state).length;
      const timed=points.filter(p=>['operational','degraded'].includes(p.status)&&p.latency_ms>0);
      const gap=Math.max(0,...points.slice(1).map((p,i)=>(Date.parse(p.checked_at)-Date.parse(points[i].checked_at))/1000));
      hourInsert.run(id,target,binding,bucket,count('operational'),count('degraded'),points.filter(p=>['failed','validation_failed','error'].includes(p.status)).length,count('maintenance'),
        timed.length,timed.reduce((n,p)=>n+p.latency_ms,0),points[0].checked_at,points.at(-1).checked_at,gap,+(Date.parse(bucket)+HOUR>Date.parse(observedAt)),observedAt);
    }
    return {inserted,returned:data.probes.length,mapped:data.targets.length-db.prepare("SELECT COUNT(*) AS n FROM transit_runapi_probe_targets WHERE station_id=? AND active=1 AND mapping_status<>'matched'").get(id).n};
  }).immediate();
}

export function buildRunPerformance(db,id,names,{now=Date.now()}={}){
  const groupTotals=new Map(db.prepare(`SELECT g.group_key,COUNT(DISTINCT o.raw_model) AS n FROM transit_groups g JOIN transit_offers o ON o.group_id=g.id
    WHERE g.station_id=? AND g.status='active' AND o.status='active' GROUP BY g.group_key`).all(id).map(r=>[r.group_key,r.n]));
  const cutoff=iso(Math.floor(now/HOUR)*HOUR-359*HOUR);
  // Recheck current membership at export too, so a price-only update cannot keep
  // an obsolete group binding alive until the next five-minute dashboard poll.
  const targets=db.prepare(`SELECT t.* FROM transit_runapi_probe_targets t WHERE t.station_id=? AND t.active=1 AND t.mapping_status='matched'
    AND EXISTS (SELECT 1 FROM transit_groups g JOIN transit_offers o ON o.group_id=g.id
      WHERE g.station_id=t.station_id AND g.group_key=t.group_key AND g.status='active' AND o.status='active' AND o.raw_model=t.model)`).all(id);
  const eligible=new Set(names),byIdentity=new Map(targets.filter(t=>eligible.has(t.model)).map(t=>[`${t.target_id}:${t.binding_hash}`,t]));
  const buckets=new Map();
  const rows=db.prepare('SELECT * FROM transit_runapi_probe_hourly WHERE station_id=? AND bucket_at>=? AND bucket_at<=?').all(id,cutoff,iso(now));
  for(const row of rows){
    const target=byIdentity.get(`${row.target_id}:${row.binding_hash}`),total=row.normal_count+row.degraded_count+row.failed_count;
    if(!target||!total)continue;
    const key=JSON.stringify([target.model,target.group_key,row.bucket_at]);
    const entry=buckets.get(key)??{target,at:row.bucket_at,rows:[]};entry.rows.push(row);buckets.set(key,entry);
  }
  const series=[...buckets.values()].map(({target,at,rows})=>({station_id:id,model_name:target.model,group_key:target.group_key,bucket_at:at,has_data:1,window_hours:360,
    success_rate:mean(rows.map(r=>100*r.normal_count/(r.normal_count+r.degraded_count+r.failed_count))),
    avg_latency_ms:mean(rows.filter(r=>r.latency_count>0).map(r=>r.latency_sum_ms/r.latency_count)),avg_ttft_ms:null,avg_tps:null,
    observed_at:rows.map(r=>r.observed_at).sort().at(-1),probe_count:rows.reduce((n,r)=>n+r.normal_count+r.degraded_count+r.failed_count,0)}));
  const summaryRows=db.prepare('SELECT * FROM transit_runapi_monitor_summaries WHERE station_id=? AND window_hours=360 AND generated_at>=? ORDER BY generated_at DESC').all(id,iso(now-48*HOUR));
  const summaryMap=new Map();for(const r of summaryRows){const key=`${r.target_id}:${r.binding_hash}`;if(!summaryMap.has(key)&&byIdentity.has(key)&&r.total_checks>0)summaryMap.set(key,r);}
  const make=(selected,scope)=>{
    const stats=buildPerformanceMonitor(selected,{now,modelName:scope.modelName??null,includeHourly:!!scope.modelName});
    const inScope=targets.filter(t=>eligible.has(t.model)&&(!scope.modelName||t.model===scope.modelName)&&(scope.groupKey===null||t.group_key===scope.groupKey));
    const summarized=new Map();let observed=null,sourceUrl=null;
    for(const t of inScope){const s=summaryMap.get(`${t.target_id}:${t.binding_hash}`);if(!s)continue;const values=summarized.get(t.model)??[];values.push(s.availability);summarized.set(t.model,values);observed=observed===null||s.generated_at<observed?s.generated_at:observed;sourceUrl=s.source_url;}
    return {...stats,scope,kind:'model_probe_availability',availabilityBasis:'normal_probe',capabilities:{ttft:false,latency:true,throughput:false},
      probeCount:selected.reduce((n,r)=>n+r.probe_count,0),monitoredModels:new Set(selected.map(r=>r.model_name)).size,totalModels:scope.modelName?1:scope.groupKey===null?names.length:groupTotals.get(scope.groupKey)??0,
      ...(summarized.size?{sourceSummary:{availability:mean([...summarized.values()].map(mean)),observedAt:observed,sourceUrl}}:{}),method:'normal_probe_model_hour_equal_weight'};
  };
  const groupKeys=[...new Set(targets.map(t=>t.group_key))];
  // Unmonitored models already render the shared empty state. Do not serialize
  // 60 placeholder buckets for each of the ~190 models with no source probe.
  const monitoredNames=new Set(targets.filter(t=>eligible.has(t.model)).map(t=>t.model));
  return {stationId:id,station:make(series,{stationId:id,groupKey:null}),
    models:Object.fromEntries(names.filter(name=>monitoredNames.has(name)).map(name=>[name,make(series.filter(r=>r.model_name===name),{stationId:id,groupKey:null,modelName:name})])),
    groups:Object.fromEntries(groupKeys.map(key=>[key,make(series.filter(r=>r.group_key===key),{stationId:id,groupKey:key})]))};
}

export function pruneRunHistory(db,id,at,rawDir,days=35){
  const cutoff=iso(Date.parse(at)-Math.max(35,days)*86400000),rawCutoff=iso(Date.parse(at)-7*86400000);
  const expired=db.prepare(`SELECT id,payload_path FROM transit_source_snapshots WHERE station_id=? AND captured_at<?
    AND id NOT IN (SELECT MAX(id) FROM transit_source_snapshots WHERE station_id=? GROUP BY source_kind)
    AND payload_hash NOT IN (SELECT source_fingerprint FROM transit_stations WHERE id=? AND source_fingerprint IS NOT NULL)
    ORDER BY captured_at LIMIT 100`).all(id,rawCutoff,id,id);
  db.transaction(()=>{
    for(const[table,column]of [['transit_runapi_probe_observations','checked_at'],['transit_runapi_probe_hourly','bucket_at'],['transit_runapi_monitor_summaries','generated_at']])db.prepare(`DELETE FROM ${table} WHERE station_id=? AND ${column}<?`).run(id,cutoff);
    for(const row of expired)db.prepare('DELETE FROM transit_source_snapshots WHERE id=?').run(row.id);
  }).immediate();
  const allowed=resolve(rawDir,id)+sep;
  for(const row of expired){if(!row.payload_path)continue;const path=resolve(row.payload_path);if(path.startsWith(allowed)&&existsSync(path)&&!db.prepare('SELECT 1 FROM transit_source_snapshots WHERE payload_path=? LIMIT 1').get(row.payload_path))unlinkSync(path);}
}
