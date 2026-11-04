#!/usr/bin/env node
/** Recover already-collected unresolved goods without fetching shops or replacing current facts. */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRawLastGoodBySourceId, RAW_DIR } from "../collectors/persist.mjs";
import { recoverCatalogOther } from "../collectors/catalog-recovery.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const option = name => {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a path`);
  return resolve(value);
};
const selected = option("--snapshot");
const rawDir = option("--raw-dir") || RAW_DIR;
if (!existsSync(rawDir)) throw new Error(`Raw directory missing: ${rawDir}`);
const paths = selected ? [selected] : ["public", "latest"].map(name => join(root, "data", "catalog", `${name}.json`));
const rawEntries = loadRawLastGoodBySourceId(rawDir);
const results = [];
for (const path of paths) {
  const text = readFileSync(path, "utf8");
  const original = JSON.parse(text);
  if (!Array.isArray(original.offers) || !Array.isArray(original.sources) || !Array.isArray(original.products)) {
    throw new Error(`Invalid catalog snapshot: ${path}`);
  }
  const { snapshot, remapped, recovered } = recoverCatalogOther(original, rawEntries);
  if (apply && (remapped || recovered)) {
    if (readFileSync(path, "utf8") !== text) throw new Error(`Snapshot changed; retry instead of overwriting newer data: ${path}`);
    const temp = `${path}.${Date.now()}-${process.pid}.tmp`;
    writeFileSync(temp, `${JSON.stringify({ ...snapshot, reclassifiedAt: new Date().toISOString() }, null, 2)}\n`);
    renameSync(temp, path);
  }
  results.push({ path, before: original.offers.length, after: snapshot.offers.length, remapped, recovered });
}
console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", rawSources: rawEntries.size, results }, null, 2));
