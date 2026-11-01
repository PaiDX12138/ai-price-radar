import {resolve,sep} from 'node:path';
import {existsSync,unlinkSync} from 'node:fs';
import {crazyHash} from './crazyrouter-parser.mjs';
export const CRAZY_SCHEMA_SQL=`
CREATE TABLE IF NOT EXISTS transit_crazyrouter_catalog_versions (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),version_hash TEXT NOT NULL,source_payload_hash TEXT NOT NULL,
 source_url TEXT NOT NULL,parser_version TEXT NOT NULL,catalog_json TEXT NOT NULL,inventory_json TEXT NOT NULL,
 first_observed_at TEXT NOT NULL,last_observed_at TEXT NOT NULL,PRIMARY KEY(station_id,version_hash));
CREATE TABLE IF NOT EXISTS transit_crazyrouter_metric_subjects (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),model TEXT NOT NULL,groups_json TEXT NOT NULL,active INTEGER NOT NULL,
 has_traffic INTEGER NOT NULL DEFAULT 0,next_attempt_at TEXT NOT NULL,last_success_at TEXT,fail_count INTEGER NOT NULL DEFAULT 0,last_error TEXT,
 PRIMARY KEY(station_id,model));
CREATE INDEX IF NOT EXISTS idx_crazy_subject_due ON transit_crazyrouter_metric_subjects(station_id,active,next_attempt_at);
CREATE TABLE IF NOT EXISTS transit_crazyrouter_metadata_versions (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),version_hash TEXT NOT NULL,source_payload_hash TEXT NOT NULL,
 source_url TEXT NOT NULL,payload_json TEXT NOT NULL,first_observed_at TEXT NOT NULL,last_observed_at TEXT NOT NULL,
 PRIMARY KEY(station_id,version_hash));
CREATE TABLE IF NOT EXISTS transit_crazyrouter_metric_summaries (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),observed_at TEXT NOT NULL,source_url TEXT NOT NULL,
 window_hours INTEGER NOT NULL,payload_json TEXT NOT NULL,payload_hash TEXT NOT NULL,PRIMARY KEY(station_id,observed_at));
`;
export function saveCrazyCatalog(db,config,parsed,{sourceHash,sourceUrl,observedAt,parserVersion}){
  const hash=crazyHash(parsed.catalog);
  db.prepare(`INSERT INTO transit_crazyrouter_catalog_versions
    (station_id,version_hash,source_payload_hash,source_url,parser_version,catalog_json,inventory_json,first_observed_at,last_observed_at)
    VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(station_id,version_hash) DO UPDATE SET last_observed_at=excluded.last_observed_at`)
    .run(config.id,hash,sourceHash,sourceUrl,parserVersion,JSON.stringify(parsed.catalog),JSON.stringify(parsed.inventory),observedAt,observedAt);
  db.prepare('UPDATE transit_crazyrouter_metric_subjects SET active=0 WHERE station_id=?').run(config.id);
  const groups=new Map();for(const offer of parsed.offers){const set=groups.get(offer.rawModel)??new Set();set.add(offer.groupKey);groups.set(offer.rawModel,set);}
  const statement=db.prepare(`INSERT INTO transit_crazyrouter_metric_subjects (station_id,model,groups_json,active,next_attempt_at) VALUES (?,?,?,1,?)
    ON CONFLICT(station_id,model) DO UPDATE SET active=1,groups_json=excluded.groups_json`);
  for(const[model,keys]of groups)statement.run(config.id,model,JSON.stringify([...keys]),observedAt);
}
export function saveCrazySummary(db,config,rows,sourceUrl,at){
  const hash=crazyHash(rows);db.prepare(`INSERT OR REPLACE INTO transit_crazyrouter_metric_summaries
    (station_id,observed_at,source_url,window_hours,payload_json,payload_hash) VALUES (?,?,?,24,?,?)`).run(config.id,at,sourceUrl,JSON.stringify(rows),hash);
  db.prepare('UPDATE transit_crazyrouter_metric_subjects SET has_traffic=0 WHERE station_id=?').run(config.id);
  const stmt=db.prepare('UPDATE transit_crazyrouter_metric_subjects SET has_traffic=? WHERE station_id=? AND model=? AND active=1');
  for(const row of rows)stmt.run(row.requests>0?1:0,config.id,row.model);
}
export function saveCrazyMetadata(db,stationId,value,{sourceHash,sourceUrl,observedAt}){
  db.prepare(`INSERT INTO transit_crazyrouter_metadata_versions
    (station_id,version_hash,source_payload_hash,source_url,payload_json,first_observed_at,last_observed_at) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(station_id,version_hash) DO UPDATE SET last_observed_at=excluded.last_observed_at`)
    .run(stationId,crazyHash(value),sourceHash,sourceUrl,JSON.stringify(value),observedAt,observedAt);
}
export function finishCrazySubject(db,config,model,{ok,error=null,observedAt,hasTraffic=false,retryAfter=null}){
  const state=db.prepare('SELECT fail_count FROM transit_crazyrouter_metric_subjects WHERE station_id=? AND model=?').get(config.id,model);
  const fails=ok?0:state.fail_count+1,delay=ok?(hasTraffic?config.performanceIntervalMs:config.inactivePerformanceIntervalMs):Math.min(6*3600000,900000*2**Math.min(fails-1,5));
  const seconds=Number(retryAfter),date=Date.parse(retryAfter),retryMs=retryAfter==null?0:Number.isFinite(seconds)?seconds*1000:Number.isFinite(date)?date-Date.parse(observedAt):0;
  db.prepare(`UPDATE transit_crazyrouter_metric_subjects SET next_attempt_at=?,last_success_at=CASE WHEN ?=1 THEN ? ELSE last_success_at END,
    fail_count=?,last_error=? WHERE station_id=? AND model=?`).run(new Date(Date.parse(observedAt)+Math.max(delay,retryMs)).toISOString(),ok?1:0,observedAt,fails,error,config.id,model);
}
export function pruneCrazyHistory(db,config,rawDir,at){
  const cutoff=new Date(Date.parse(at)-(config.retentionDays??35)*86400000).toISOString();
  db.prepare('DELETE FROM transit_performance_observations WHERE station_id=? AND bucket_at<?').run(config.id,cutoff);
  db.prepare('DELETE FROM transit_crazyrouter_metric_summaries WHERE station_id=? AND observed_at<?').run(config.id,cutoff);
  const refs=new Set(db.prepare(`SELECT source_payload_hash FROM transit_crazyrouter_catalog_versions WHERE station_id=?
    UNION SELECT source_payload_hash FROM transit_crazyrouter_metadata_versions WHERE station_id=?`).all(config.id,config.id).map(r=>r.source_payload_hash));
  const directory=resolve(rawDir,config.id),rawCutoff=new Date(Date.parse(at)-7*86400000).toISOString();
  for(const row of db.prepare('SELECT id,payload_hash,payload_path FROM transit_source_snapshots WHERE station_id=? AND captured_at<?').all(config.id,rawCutoff)){
    if(refs.has(row.payload_hash)||!row.payload_path)continue;
    const file=resolve(row.payload_path);
    if(!file.startsWith(directory+sep)||!/[a-f0-9]{64}\.gz$/.test(file))continue;
    if(existsSync(file))unlinkSync(file);
    db.prepare('UPDATE transit_collection_runs SET raw_snapshot_path=NULL WHERE station_id=? AND raw_snapshot_path=?').run(config.id,row.payload_path);
    db.prepare('DELETE FROM transit_source_snapshots WHERE id=?').run(row.id);
  }
}
