#!/usr/bin/env node
/** Read-only deployment diagnostic. Never prints credentials or raw responses. */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvLocal } from "./load-env-local.mjs";
loadEnvLocal();
const path = resolve(process.env.TRANSIT_SNAPSHOT_PATH || "data/transit/latest.json");
if (!existsSync(path)) {
  console.log(JSON.stringify({ cwd: process.cwd(), snapshotPath: path, error: "snapshot_missing" }, null, 2));
  process.exitCode = 1;
} else {
  const snapshot = JSON.parse(readFileSync(path, "utf8"));
  console.log(JSON.stringify({ cwd: process.cwd(), snapshotPath: path, generatedAt: snapshot.generatedAt,
    stations: snapshot.stations.map(station => {
      const groups = snapshot.groups.filter(group => group.station_id === station.id);
      const ids = new Set(groups.map(group => group.id));
      const offers = snapshot.offers.filter(offer => ids.has(offer.group_id));
      const families = {};
      for (const offer of offers) families[offer.family || "其他"] = (families[offer.family || "其他"] || 0) + 1;
      return { id: station.id, status: station.status, lastCollectOk: station.last_collect_ok,
        lastCollectedAt: station.last_collected_at, groups: groups.length,
        models: new Set(offers.map(offer => offer.raw_model)).size, offers: offers.length, families };
    }),
  }, null, 2));
}
