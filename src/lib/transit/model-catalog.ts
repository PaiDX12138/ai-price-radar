import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TransitModelCatalog } from "./model-order";

let cache: { path: string; checkedAt: number; models: TransitModelCatalog } | undefined;
/** Memory + local JSON only. No request-time database access or remote metadata calls. */
export function loadTransitModelCatalog(): TransitModelCatalog {
  const path = process.env.TRANSIT_MODEL_CATALOG_PATH || join(process.cwd(), "data/transit/model-catalog.json");
  const now = Date.now();
  if (cache?.path === path && now - cache.checkedAt < 30000) return cache.models;
  for (const candidate of [path, `${path}.last-good`]) {
    try {
      const value = JSON.parse(readFileSync(candidate, "utf8"));
      if (value.schemaVersion !== 1 || !value.models || typeof value.models !== "object" || Array.isArray(value.models) || Object.keys(value.models).length < 20) continue;
      cache = { path, checkedAt: now, models: value.models };
      return cache.models;
    } catch { /* retain memory/last-good on missing, corrupt or concurrently replaced files */ }
  }
  const models = cache?.path === path ? cache.models : {};
  cache = { path, checkedAt: now, models };
  return models;
}
