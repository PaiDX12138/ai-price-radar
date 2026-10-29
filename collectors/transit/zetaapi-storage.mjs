/** Zeta's monitoring is probe uptime, not inference request success or inference latency. */
import { buildPerformanceMonitor } from "../../src/lib/transit/performance.mjs";
import { unlinkSync } from "node:fs";
import { resolve, sep } from "node:path";

export const ZETA_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS transit_monitor_identities (
  station_id TEXT NOT NULL REFERENCES transit_stations(id) ON DELETE CASCADE,
  monitor_id INTEGER NOT NULL, name TEXT NOT NULL, monitor_type TEXT NOT NULL,
  scope_kind TEXT NOT NULL CHECK(scope_kind IN ('model','infrastructure')),
  model_name TEXT, source_group TEXT NOT NULL, source_url TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1, observed_at TEXT NOT NULL, raw_json TEXT NOT NULL,
  PRIMARY KEY(station_id,monitor_id)
);
CREATE TABLE IF NOT EXISTS transit_monitor_probes (
  station_id TEXT NOT NULL, monitor_id INTEGER NOT NULL, source_time TEXT NOT NULL,
  status INTEGER NOT NULL CHECK(status IN (0,1,2,3)), ping_ms REAL,
  source_url TEXT NOT NULL, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  PRIMARY KEY(station_id,monitor_id,source_time),
  FOREIGN KEY(station_id,monitor_id) REFERENCES transit_monitor_identities(station_id,monitor_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_transit_probes_time ON transit_monitor_probes(station_id,source_time,monitor_id);
CREATE TABLE IF NOT EXISTS transit_monitor_polls (
  station_id TEXT NOT NULL REFERENCES transit_stations(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL, observed_at TEXT NOT NULL, ok INTEGER NOT NULL,
  returned_points INTEGER NOT NULL DEFAULT 0, inserted_points INTEGER NOT NULL DEFAULT 0,
  source_url TEXT NOT NULL, error TEXT, PRIMARY KEY(station_id,run_id)
);
CREATE TABLE IF NOT EXISTS transit_monitor_hourly (
  station_id TEXT NOT NULL, monitor_id INTEGER NOT NULL, bucket_at TEXT NOT NULL,
  up_count INTEGER NOT NULL, down_count INTEGER NOT NULL,
  pending_count INTEGER NOT NULL, maintenance_count INTEGER NOT NULL,
  first_sample_at TEXT NOT NULL, last_sample_at TEXT NOT NULL, largest_gap_seconds REAL NOT NULL,
  usable INTEGER NOT NULL, observed_at TEXT NOT NULL,
  PRIMARY KEY(station_id,monitor_id,bucket_at),
  FOREIGN KEY(station_id,monitor_id) REFERENCES transit_monitor_identities(station_id,monitor_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS transit_monitor_summaries (
  station_id TEXT NOT NULL, monitor_id INTEGER NOT NULL, window_hours INTEGER NOT NULL,
  availability REAL NOT NULL CHECK(availability>=0 AND availability<=100),
  source_url TEXT NOT NULL, observed_at TEXT NOT NULL, source_kind TEXT NOT NULL,
  PRIMARY KEY(station_id,monitor_id,window_hours,observed_at),
  FOREIGN KEY(station_id,monitor_id) REFERENCES transit_monitor_identities(station_id,monitor_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS transit_service_states (
  station_id TEXT NOT NULL REFERENCES transit_stations(id) ON DELETE CASCADE,
  observed_at TEXT NOT NULL, allow_signup INTEGER NOT NULL, allow_topup INTEGER NOT NULL,
  source_url TEXT NOT NULL, raw_json TEXT NOT NULL,
  PRIMARY KEY(station_id,observed_at)
);
`;
const HOUR = 3600000;
const iso = ms => new Date(ms).toISOString();
export function saveZetaServiceState(db, stationId, value, sourceUrl, observedAt) {
  db.prepare(`INSERT OR REPLACE INTO transit_service_states
    (station_id,observed_at,allow_signup,allow_topup,source_url,raw_json) VALUES (?,?,?,?,?,?)`)
    .run(stationId,observedAt,+value.allow_signup,+value.allow_topup,sourceUrl,JSON.stringify(value));
}

export function saveZetaMonitoring(db, { stationId, monitors, probes, summaries, sourceUrl, configUrl, observedAt, runId }) {
  return db.transaction(() => {
    const identity = db.prepare(`INSERT INTO transit_monitor_identities
      (station_id,monitor_id,name,monitor_type,scope_kind,model_name,source_group,source_url,active,observed_at,raw_json)
      VALUES (@stationId,@id,@name,@type,@scope,@model,@group,@configUrl,1,@observedAt,@raw)
      ON CONFLICT(station_id,monitor_id) DO UPDATE SET name=excluded.name,monitor_type=excluded.monitor_type,
        scope_kind=excluded.scope_kind,model_name=excluded.model_name,source_group=excluded.source_group,
        active=1,observed_at=excluded.observed_at,raw_json=excluded.raw_json,source_url=excluded.source_url`);
    db.prepare("UPDATE transit_monitor_identities SET active=0 WHERE station_id=?").run(stationId);
    for (const m of monitors) {
      const previous = db.prepare("SELECT model_name,scope_kind FROM transit_monitor_identities WHERE station_id=? AND monitor_id=?").get(stationId,m.id);
      // Reusing an ID for a different subject must never relabel its historical samples.
      if (previous && (previous.model_name !== m.model || previous.scope_kind !== m.scope)) throw new Error(`zeta_monitor_identity_changed:${m.id}`);
      identity.run({...m,stationId,configUrl,observedAt,raw:JSON.stringify(m.raw)});
    }
    const insert = db.prepare(`INSERT INTO transit_monitor_probes
      (station_id,monitor_id,source_time,status,ping_ms,source_url,first_seen_at,last_seen_at,raw_json)
      VALUES (@stationId,@id,@time,@status,@ping,@sourceUrl,@observedAt,@observedAt,@raw)
      ON CONFLICT(station_id,monitor_id,source_time) DO UPDATE SET last_seen_at=excluded.last_seen_at`);
    let inserted = 0;
    const exists = db.prepare("SELECT status,ping_ms FROM transit_monitor_probes WHERE station_id=? AND monitor_id=? AND source_time=?");
    for (const p of probes) {
      const old = exists.get(stationId,p.id,p.time);
      if (old && (old.status !== p.status || old.ping_ms !== p.ping)) throw new Error("zeta_conflicting_heartbeat");
      insert.run({...p,stationId,sourceUrl,observedAt,raw:JSON.stringify(p.raw)});
      if (!old) inserted++;
    }
    const saveSummary = db.prepare(`INSERT OR REPLACE INTO transit_monitor_summaries
      (station_id,monitor_id,window_hours,availability,source_url,observed_at,source_kind) VALUES (?,?,?,?,?,?,?)`);
    for (const s of summaries) saveSummary.run(stationId,s.id,s.hours,s.availability,s.sourceUrl,observedAt,s.kind);
    db.prepare(`INSERT INTO transit_monitor_polls (station_id,run_id,observed_at,ok,returned_points,inserted_points,source_url)
      VALUES (?,?,?,1,?,?,?)`).run(stationId,runId,observedAt,probes.length,inserted,sourceUrl);
    // Rebuild from persisted probes, never only the most recent rolling API response.
    const hourGroups = new Map();
    const end = Math.floor(Date.parse(observedAt)/HOUR)*HOUR;
    const start = end-360*HOUR;
    for (const row of db.prepare(`SELECT monitor_id,source_time,status FROM transit_monitor_probes
      WHERE station_id=? AND source_time>=? AND source_time<? ORDER BY monitor_id,source_time`).all(stationId,iso(start),iso(end))) {
      const bucket = iso(Math.floor(Date.parse(row.source_time)/HOUR)*HOUR), key = `${row.monitor_id}:${bucket}`;
      const group = hourGroups.get(key) ?? {id:row.monitor_id,bucket,rows:[]}; group.rows.push(row); hourGroups.set(key,group);
    }
    const hourly = db.prepare(`INSERT INTO transit_monitor_hourly
      (station_id,monitor_id,bucket_at,up_count,down_count,pending_count,maintenance_count,first_sample_at,last_sample_at,largest_gap_seconds,usable,observed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(station_id,monitor_id,bucket_at) DO UPDATE SET
      up_count=excluded.up_count,down_count=excluded.down_count,pending_count=excluded.pending_count,
      maintenance_count=excluded.maintenance_count,first_sample_at=excluded.first_sample_at,last_sample_at=excluded.last_sample_at,
      largest_gap_seconds=excluded.largest_gap_seconds,usable=excluded.usable,observed_at=excluded.observed_at`);
    for (const g of hourGroups.values()) {
      const valid = g.rows.filter(r=>r.status===0||r.status===1);
      const span = valid.length ? Date.parse(valid.at(-1).source_time)-Date.parse(valid[0].source_time) : 0;
      const gap = Math.max(0,...g.rows.slice(1).map((r,i)=>(Date.parse(r.source_time)-Date.parse(g.rows[i].source_time))/1000));
      // Conservative sample coverage, not a claim of 60 minutes continuously observed.
      const usable = valid.length>=2 && span>=30*60000 && gap<=25*60;
      hourly.run(stationId,g.id,g.bucket,...[1,0,2,3].map(status=>g.rows.filter(r=>r.status===status).length),
        g.rows[0].source_time,g.rows.at(-1).source_time,gap,+usable,observedAt);
    }
    return {inserted,returned:probes.length,hours:hourGroups.size};
  }).immediate();
}

export function pruneZetaMonitoring(db, stationId, observedAt, retentionDays=35, rawDir=null) {
  const cutoff=iso(Date.parse(observedAt)-Math.max(35,retentionDays)*86400000);
  const paths=[];
  db.transaction(()=>{
    for(const [table,column] of [["transit_monitor_probes","source_time"],["transit_monitor_hourly","bucket_at"],
      ["transit_monitor_polls","observed_at"],["transit_monitor_summaries","observed_at"]])
      db.prepare(`DELETE FROM ${table} WHERE station_id=? AND ${column}<?`).run(stationId,cutoff);
    const old=db.prepare(`SELECT id,payload_path FROM transit_source_snapshots WHERE station_id=? AND captured_at<?
      AND (source_kind='heartbeats' OR source_kind LIKE 'summary360-%')`).all(stationId,cutoff);
    for(const row of old){db.prepare('DELETE FROM transit_source_snapshots WHERE id=?').run(row.id);if(row.payload_path)paths.push(row.payload_path);}
  }).immediate();
  // Only individual archived monitor payloads inside this station's archive directory.
  // Never delete directories, pricing evidence, or a path still referenced by another snapshot.
  if(rawDir){
    const allowed=resolve(rawDir,stationId)+sep;
    for(const path of paths){
      const full=resolve(path);
      if(!full.startsWith(allowed)||db.prepare('SELECT 1 FROM transit_source_snapshots WHERE payload_path=? LIMIT 1').get(path))continue;
      try{unlinkSync(full);}catch(error){if(error.code!=='ENOENT')throw error;}
    }
  }
}

export function buildZetaPerformance(db,stationId,modelNames,{now=Date.now()}={}) {
  const identities=db.prepare("SELECT * FROM transit_monitor_identities WHERE station_id=? AND active=1").all(stationId);
  const rows=db.prepare(`SELECT h.*,i.model_name,i.scope_kind FROM transit_monitor_hourly h
    JOIN transit_monitor_identities i ON i.station_id=h.station_id AND i.monitor_id=h.monitor_id
    WHERE h.station_id=? AND h.bucket_at>=? AND i.active=1 AND h.usable=1`)
    .all(stationId,iso(Math.floor(now/HOUR)*HOUR-359*HOUR));
  const modelsSet=new Set(modelNames);
  const modelMonitors=identities.filter(i=>i.scope_kind==='model'&&modelsSet.has(i.model_name));
  const collectAt=db.prepare("SELECT MAX(observed_at) AS at FROM transit_monitor_polls WHERE station_id=? AND ok=1").get(stationId)?.at??null;
  const summaryFor = id => {
    const s=db.prepare(`SELECT availability,observed_at,source_url FROM transit_monitor_summaries
      WHERE station_id=? AND monitor_id=? AND window_hours=360 ORDER BY observed_at DESC LIMIT 1`).get(stationId,id);
    return s&&now-Date.parse(s.observed_at)<=48*HOUR ? {availability:s.availability,observedAt:s.observed_at,sourceUrl:s.source_url}:undefined;
  };
  const make=(selected,{modelName,groupKey=null,monitoredModels=modelMonitors.length,sourceSummary}={})=>({
    ...buildPerformanceMonitor(selected.map(r=>({station_id:stationId,model_name:r.model_name??`monitor:${r.monitor_id}`,
      group_key:'monitor',bucket_at:r.bucket_at,success_rate:100*r.up_count/(r.up_count+r.down_count),
      has_data:1,window_hours:360,avg_ttft_ms:null,avg_latency_ms:null,avg_tps:null,observed_at:r.observed_at})),{now,modelName:modelName??null}),
    capabilities:{ttft:false,latency:false,throughput:false},collectedAt:collectAt,
    scope:{stationId,groupKey,...(modelName?{modelName}:{})},
    kind:'probe_availability',method:'observed_probe_hour_equal_weight',monitoredModels,totalModels:modelNames.length,sourceSummary,
  });
  return {stationId,
    station:make(rows.filter(r=>r.scope_kind==='model'&&modelsSet.has(r.model_name))),
    // No source group identity exists. Never reuse model/station uptime as a pricing group's uptime.
    groups:{public:make([],{groupKey:'public',monitoredModels:0})},
    models:Object.fromEntries(modelNames.map(modelName=>{
      const m=modelMonitors.find(i=>i.model_name===modelName);
      return [modelName,make(m?rows.filter(r=>r.monitor_id===m.monitor_id):[],{modelName,monitoredModels:m?1:0,sourceSummary:m?summaryFor(m.monitor_id):undefined})];
    })),
    infrastructure:identities.filter(i=>i.scope_kind==='infrastructure').map(i=>({id:i.monitor_id,name:i.name,
      monitor:{...make(rows.filter(r=>r.monitor_id===i.monitor_id),{monitoredModels:0,sourceSummary:summaryFor(i.monitor_id)}),coverageScope:'infrastructure'}})),
  };
}
