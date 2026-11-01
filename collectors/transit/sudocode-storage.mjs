import {existsSync,unlinkSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {sudoHash,sudoGroupTiers,SUDO_PARSER_VERSION} from './sudocode-parser.mjs';
import {buildPerformanceMonitor} from '../../src/lib/transit/performance.mjs';
import {withModelDerivedGroups} from './group-performance.mjs';

export const SUDO_SCHEMA_SQL=`
CREATE TABLE IF NOT EXISTS transit_sudocode_catalog_versions (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),version_hash TEXT NOT NULL,source_payload_hash TEXT NOT NULL,
 policy_payload_hash TEXT NOT NULL,policy_url TEXT NOT NULL,policy_json TEXT NOT NULL,catalog_json TEXT NOT NULL,
 inventory_json TEXT NOT NULL,parser_version TEXT NOT NULL,first_observed_at TEXT NOT NULL,last_observed_at TEXT NOT NULL,
 PRIMARY KEY(station_id,version_hash));
CREATE TABLE IF NOT EXISTS transit_sudocode_metadata_versions (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),version_hash TEXT NOT NULL,source_payload_hash TEXT NOT NULL,
 notice_payload_hash TEXT,payload_json TEXT NOT NULL,first_observed_at TEXT NOT NULL,last_observed_at TEXT NOT NULL,
 PRIMARY KEY(station_id,version_hash));
CREATE TABLE IF NOT EXISTS transit_sudocode_tier_hourly (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),model TEXT NOT NULL,tier TEXT NOT NULL,bucket_at TEXT NOT NULL,
 source_snapshot_at TEXT NOT NULL,success_rate REAL NOT NULL,ttft_ms REAL,latency_ms REAL,tps REAL,popularity REAL NOT NULL,
 has_data INTEGER NOT NULL,is_partial INTEGER NOT NULL,mapping_status TEXT NOT NULL,source_hash TEXT NOT NULL,
 observed_at TEXT NOT NULL,PRIMARY KEY(station_id,model,tier,bucket_at));
CREATE INDEX IF NOT EXISTS idx_sudo_tier_window ON transit_sudocode_tier_hourly(station_id,bucket_at);
`;

export function saveSudoCatalog(db,config,parsed,{policy,policyUrl,sourceHash,observedAt}){
  const version=sudoHash({catalog:parsed.catalog,policyHash:policy.sourceHash});
  db.prepare(`INSERT INTO transit_sudocode_catalog_versions VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(station_id,version_hash) DO UPDATE SET last_observed_at=excluded.last_observed_at`)
    .run(config.id,version,sourceHash,policy.sourceHash,policyUrl,JSON.stringify(policy),JSON.stringify(parsed.catalog),
      JSON.stringify(parsed.inventory),SUDO_PARSER_VERSION,observedAt,observedAt);
}
export function saveSudoMetadata(db,id,metadata,notice,{sourceHash,noticeHash,observedAt}){
  const value={metadata,notice};
  db.prepare(`INSERT INTO transit_sudocode_metadata_versions VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(station_id,version_hash) DO UPDATE SET last_observed_at=excluded.last_observed_at`)
    .run(id,sudoHash(value),sourceHash,noticeHash??null,JSON.stringify(value),observedAt,observedAt);
}
export function latestSudoCatalog(db,id){
  const row=db.prepare('SELECT catalog_json FROM transit_sudocode_catalog_versions WHERE station_id=? ORDER BY last_observed_at DESC LIMIT 1').get(id);
  return row?JSON.parse(row.catalog_json):null;
}
export function saveSudoPerformance(db,id,parsed,{sourceHash,observedAt}){
  const newest=db.prepare('SELECT MAX(source_snapshot_at) at FROM transit_sudocode_tier_hourly WHERE station_id=?').get(id)?.at;
  if(newest&&newest>parsed.snapshotAt)throw new Error('sudo_performance_snapshot_regressed');
  const put=db.prepare(`INSERT INTO transit_sudocode_tier_hourly VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(station_id,model,tier,bucket_at) DO UPDATE SET
      source_snapshot_at=excluded.source_snapshot_at,success_rate=excluded.success_rate,ttft_ms=excluded.ttft_ms,
      latency_ms=excluded.latency_ms,tps=excluded.tps,popularity=excluded.popularity,has_data=excluded.has_data,
      is_partial=excluded.is_partial,mapping_status=excluded.mapping_status,source_hash=excluded.source_hash,observed_at=excluded.observed_at
    WHERE excluded.source_snapshot_at>transit_sudocode_tier_hourly.source_snapshot_at
      AND (transit_sudocode_tier_hourly.is_partial=1 OR excluded.is_partial=0)`);
  let count=0;
  for(const r of parsed.rows)count+=put.run(id,r.model,r.tier,r.bucketAt,r.snapshotAt,r.successRate,r.ttftMs,r.latencyMs,r.tps,
    r.popularity,r.hasData?1:0,r.isPartial?1:0,r.mappingStatus,sourceHash,observedAt).changes;
  return count;
}

/** Version metrics remain version facts. Only read-side membership indices are made
 * for actual groups; no fake channel observations or request-weighted SLA. */
export function buildSudoPerformance(db,id,stationGroups,offers,{now=Date.now()}={}){
  const catalog=latestSudoCatalog(db,id),tiers=catalog?sudoGroupTiers(catalog):new Map();
  const groupById=new Map(stationGroups.map(g=>[g.id,g])),members=new Map(stationGroups.map(g=>[g.group_key,new Set()])),pairs=new Set();
  for(const o of offers){const group=groupById.get(o.group_id);if(!group)continue;members.get(group.group_key).add(o.raw_model);
    const tier=tiers.get(group.group_key);if(tier)pairs.add(JSON.stringify([o.raw_model,tier.tier]));}
  const since=new Date(Math.floor(now/3600000)*3600000-359*3600000).toISOString();
  const rows=db.prepare(`SELECT model AS model_name,tier AS group_key,bucket_at,success_rate,ttft_ms AS avg_ttft_ms,
    latency_ms AS avg_latency_ms,tps AS avg_tps,has_data,observed_at FROM transit_sudocode_tier_hourly
    WHERE station_id=? AND bucket_at>=? ORDER BY bucket_at,model,tier`).all(id,since)
    .filter(r=>pairs.has(JSON.stringify([r.model_name,r.group_key])));
  const capabilities={ttft:true,latency:true,throughput:true};
  const names=[...new Set([...members.values()].flatMap(set=>[...set]))];
  const models=Object.fromEntries(names.map(modelName=>[modelName,{
    ...buildPerformanceMonitor(rows,{now,modelName,includeHourly:true}),capabilities,
    sourceVersion:'站方版本汇总',scope:{stationId:id,groupKey:null,modelName},
  }]));
  const result=withModelDerivedGroups({stationId:id,station:{...buildPerformanceMonitor(rows,{now}),capabilities,
    sourceVersion:'站方版本汇总',scope:{stationId:id,groupKey:null}},groups:{},models},stationGroups,offers,{now});
  for(const g of stationGroups){
    const tier=tiers.get(g.group_key);if(!tier)continue;
    const groupRows=rows.filter(r=>r.group_key===tier.tier&&members.get(g.group_key).has(r.model_name));
    // No version data means no data; do not borrow another version via the fallback.
    const known=new Set(groupRows.filter(r=>r.has_data).map(r=>r.model_name));
    result.groups[g.group_key]={...buildPerformanceMonitor(groupRows,{now}),capabilities,
      scope:{stationId:id,groupKey:g.group_key},sourceVersion:tier.label??tier.tier,
      method:'version_member_model_hour_equal_weight',
      aggregation:{kind:'group_models',monitoredModels:known.size,totalModels:members.get(g.group_key).size}};
  }
  return result;
}
export function pruneSudoHistory(db,config,rawDir,at){
  db.prepare('DELETE FROM transit_sudocode_tier_hourly WHERE station_id=? AND bucket_at<?')
    .run(config.id,new Date(Date.parse(at)-(config.retentionDays??35)*86400000).toISOString());
  const pinned=new Set(db.prepare(`SELECT source_payload_hash h FROM transit_sudocode_catalog_versions WHERE station_id=?
    UNION SELECT policy_payload_hash FROM transit_sudocode_catalog_versions WHERE station_id=?
    UNION SELECT source_payload_hash FROM transit_sudocode_metadata_versions WHERE station_id=?
    UNION SELECT notice_payload_hash FROM transit_sudocode_metadata_versions WHERE station_id=?`)
    .all(config.id,config.id,config.id,config.id).map(r=>r.h));
  const directory=resolve(rawDir,config.id),cutoff=new Date(Date.parse(at)-7*86400000).toISOString();
  for(const row of db.prepare('SELECT id,payload_hash,payload_path FROM transit_source_snapshots WHERE station_id=? AND captured_at<?').all(config.id,cutoff)){
    if(!row.payload_path||pinned.has(row.payload_hash))continue;const file=resolve(row.payload_path);
    if(!file.startsWith(directory+sep)||!/[a-f0-9]{64}\.gz$/.test(file))continue;
    if(existsSync(file))unlinkSync(file);
    db.prepare('UPDATE transit_collection_runs SET raw_snapshot_path=NULL WHERE station_id=? AND raw_snapshot_path=?').run(config.id,row.payload_path);
    db.prepare('DELETE FROM transit_source_snapshots WHERE id=?').run(row.id);
  }
}
