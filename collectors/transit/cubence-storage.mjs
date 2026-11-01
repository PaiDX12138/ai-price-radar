import {existsSync,unlinkSync} from 'node:fs';
import {resolve,sep} from 'node:path';

export const CUBENCE_SCHEMA_SQL=`
CREATE TABLE IF NOT EXISTS transit_cubence_catalog_versions (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),version_hash TEXT NOT NULL,
 source_url TEXT NOT NULL,source_payload_hash TEXT NOT NULL,parser_version TEXT NOT NULL,catalog_json TEXT NOT NULL,inventory_json TEXT NOT NULL,
 first_observed_at TEXT NOT NULL,last_observed_at TEXT NOT NULL,PRIMARY KEY(station_id,version_hash));
CREATE INDEX IF NOT EXISTS idx_cubence_catalog_history ON transit_cubence_catalog_versions(station_id,last_observed_at);
CREATE TABLE IF NOT EXISTS transit_cubence_metadata_observations (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),version_hash TEXT NOT NULL,source_url TEXT NOT NULL,source_payload_hash TEXT NOT NULL,
 payload_json TEXT NOT NULL,first_observed_at TEXT NOT NULL,last_observed_at TEXT NOT NULL,
 PRIMARY KEY(station_id,version_hash));
`;

export function saveCubenceCatalog(db,{stationId,hash,sourcePayloadHash,catalog,inventory,sourceUrl,parserVersion,observedAt}) {
  db.prepare(`INSERT INTO transit_cubence_catalog_versions
    (station_id,version_hash,source_url,source_payload_hash,parser_version,catalog_json,inventory_json,first_observed_at,last_observed_at)
    VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(station_id,version_hash) DO UPDATE SET last_observed_at=excluded.last_observed_at`)
    .run(stationId,hash,sourceUrl,sourcePayloadHash,parserVersion,JSON.stringify(catalog),JSON.stringify(inventory),observedAt,observedAt);
}
export function saveCubenceSettings(db,{stationId,hash,sourcePayloadHash,settings,sourceUrl,observedAt}) {
  db.prepare(`INSERT INTO transit_cubence_metadata_observations
    (station_id,version_hash,source_url,source_payload_hash,payload_json,first_observed_at,last_observed_at) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(station_id,version_hash) DO UPDATE SET last_observed_at=excluded.last_observed_at`)
    .run(stationId,hash,sourceUrl,sourcePayloadHash,JSON.stringify(settings),observedAt,observedAt);
}

/** Drop only old unreferenced transport copies; keep every accepted price/config
 * version's original evidence. Never remove files outside this station archive. */
export function pruneCubenceArchives(db,stationId,rawDir,observedAt) {
  const cutoff=new Date(Date.parse(observedAt)-7*86400000).toISOString();
  const referenced=new Set([
    ...db.prepare('SELECT source_payload_hash FROM transit_cubence_catalog_versions WHERE station_id=?').all(stationId),
    ...db.prepare('SELECT source_payload_hash FROM transit_cubence_metadata_observations WHERE station_id=?').all(stationId),
  ].map(r=>r.source_payload_hash));
  const directory=resolve(rawDir,stationId),rows=db.prepare('SELECT id,payload_hash,payload_path FROM transit_source_snapshots WHERE station_id=? AND captured_at<?').all(stationId,cutoff);
  let removed=0;
  for(const row of rows){
    if(referenced.has(row.payload_hash)||!row.payload_path)continue;
    const file=resolve(row.payload_path);
    if(!file.startsWith(directory+sep)||!/(?:pricing|metadata|logo)-[a-f0-9]{64}\.txt\.gz$/.test(file))continue;
    if(existsSync(file))unlinkSync(file);
    db.transaction(()=>{
      db.prepare('UPDATE transit_collection_runs SET raw_snapshot_path=NULL WHERE station_id=? AND raw_snapshot_path=?').run(stationId,row.payload_path);
      db.prepare('DELETE FROM transit_source_snapshots WHERE id=? AND station_id=?').run(row.id,stationId);
    }).immediate();removed++;
  }
  return removed;
}
