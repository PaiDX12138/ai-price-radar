export const CHICKENER_SCHEMA_SQL=`
CREATE TABLE IF NOT EXISTS transit_chickener_catalog_versions (
 station_id TEXT NOT NULL REFERENCES transit_stations(id), hash TEXT NOT NULL, source_url TEXT NOT NULL,
 parser_version TEXT NOT NULL, inventory_json TEXT NOT NULL, payload_json TEXT NOT NULL,
 first_seen_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,PRIMARY KEY(station_id,hash));
CREATE TABLE IF NOT EXISTS transit_chickener_metadata_versions (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),kind TEXT NOT NULL,hash TEXT NOT NULL,
 source_url TEXT NOT NULL,payload_json TEXT NOT NULL,first_seen_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,
 PRIMARY KEY(station_id,kind,hash));
CREATE TABLE IF NOT EXISTS transit_chickener_metric_subjects (
 station_id TEXT NOT NULL REFERENCES transit_stations(id),model TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,
 next_attempt_at TEXT NOT NULL,last_success_at TEXT,fail_count INTEGER NOT NULL DEFAULT 0,last_error TEXT,
 PRIMARY KEY(station_id,model));
CREATE INDEX IF NOT EXISTS idx_chickener_subject_due ON transit_chickener_metric_subjects(station_id,active,next_attempt_at);
`;
export function saveChickenerCatalog(db,{stationId,hash,sourceUrl,parserVersion,inventory,payload,at}){
  db.prepare(`INSERT INTO transit_chickener_catalog_versions VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(station_id,hash) DO UPDATE SET last_seen_at=excluded.last_seen_at`)
    .run(stationId,hash,sourceUrl,parserVersion,JSON.stringify(inventory),JSON.stringify(payload),at,at);
}
export function saveChickenerMetadata(db,{stationId,kind,hash,sourceUrl,payload,at}){
  db.prepare(`INSERT INTO transit_chickener_metadata_versions VALUES (?,?,?,?,?,?,?) ON CONFLICT(station_id,kind,hash) DO UPDATE SET last_seen_at=excluded.last_seen_at`)
    .run(stationId,kind,hash,sourceUrl,JSON.stringify(payload),at,at);
}
export function syncChickenerSubjects(db,id,models,at){
  db.prepare('UPDATE transit_chickener_metric_subjects SET active=0 WHERE station_id=?').run(id);
  const stmt=db.prepare(`INSERT INTO transit_chickener_metric_subjects(station_id,model,next_attempt_at) VALUES (?,?,?)
    ON CONFLICT(station_id,model) DO UPDATE SET active=1`);
  for(const model of new Set(models))stmt.run(id,model,at);
}
export function saveChickenerChargeItems(db,id,offers,at){
  const insert=db.prepare('INSERT INTO transit_offer_charge_items VALUES (?,?,?,?,?,?,?,?,?,?)');
  for(const offer of offers){
    const offerId=`${id}:${offer.groupKey}:${offer.rawModel}:${offer.priceKind}`;
    db.prepare('DELETE FROM transit_offer_charge_items WHERE offer_id=?').run(offerId);
    for(const c of offer.effectivePrice.chargeItems??[])insert.run(offerId,c.key,c.unit,c.baseCurrency,c.basePrice,c.multiplier,c.creditPrice,offer.sourceModelVersion,offer.sourceUrl,at);
  }
}
