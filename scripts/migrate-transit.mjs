#!/usr/bin/env node
/** Initialize the API transit SQLite store and read-side snapshot. */
import {
  closeTransitDb,
  exportTransitSnapshot,
  openTransitDb,
  resolveTransitDbPath,
  TRANSIT_SNAPSHOT_PATH,
} from "../collectors/transit-db.mjs";

const dbPath = resolveTransitDbPath();
const db = openTransitDb(dbPath);
try {
  const snapshotPath = exportTransitSnapshot(db);
  const counts = {
    stations: db.prepare("SELECT COUNT(*) AS n FROM transit_stations").get().n,
    groups: db.prepare("SELECT COUNT(*) AS n FROM transit_groups").get().n,
    offers: db.prepare("SELECT COUNT(*) AS n FROM transit_offers").get().n,
  };
  console.log(JSON.stringify({ ok: true, dbPath, snapshotPath: snapshotPath || TRANSIT_SNAPSHOT_PATH, ...counts }));
} finally {
  closeTransitDb();
}
