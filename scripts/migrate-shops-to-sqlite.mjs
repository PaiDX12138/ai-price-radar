#!/usr/bin/env node
/**
 * Migrate shop registry JSON → data/shops.sqlite with listed_at backfill.
 *
 * Usage:
 *   pnpm shops:migrate
 *   pnpm shops:migrate -- --force-refresh-meta
 *   pnpm shops:migrate -- --db path/to/shops.sqlite
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expandCollectorTargets } from "../collectors/dispatch.mjs";
import {
  closeShopsDb,
  insertShop,
  openShopsDb,
  resolveListedAtFromRaw,
  resolveShopsDbPath,
} from "../collectors/shops-db.mjs";
import { hostOf, kindToPlatform } from "../collectors/util.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOPAPI_CFG = join(root, "config/sources.shopapi.json");
const CFG16688 = join(root, "config/sources.16688.json");
const COLLECTORS_CFG = join(root, "config/collectors.json");

function parseArgs(argv) {
  const out = { forceRefreshMeta: false, db: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--force-refresh-meta") out.forceRefreshMeta = true;
    else if (arg === "--db") out.db = argv[++i] || null;
    else if (arg?.startsWith("--db=")) out.db = arg.slice(5);
  }
  return out;
}

function loadJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * listed_at priority: importedAt → raw capturedAt/mtime → file updatedAt → migrate now
 * @returns {{ listedAt: string, source: string, fallback?: boolean }}
 */
function resolveListedAt(entry, fileUpdatedAt, migrateNow) {
  if (typeof entry?.importedAt === "string" && entry.importedAt) {
    return { listedAt: entry.importedAt, source: "importedAt" };
  }
  const fromRaw = resolveListedAtFromRaw(entry.id);
  if (fromRaw) {
    return { listedAt: fromRaw, source: "raw" };
  }
  if (typeof fileUpdatedAt === "string" && fileUpdatedAt) {
    return { listedAt: fileUpdatedAt, source: "fileUpdatedAt" };
  }
  return { listedAt: migrateNow, source: "migrate", fallback: true };
}

function shopUrlFor(entry, kind) {
  if (entry.sourceUrl || entry.shopUrl) return String(entry.sourceUrl || entry.shopUrl);
  if (kind === "shopApi" && entry.shopToken && entry.baseUrl) {
    return `${String(entry.baseUrl).replace(/\/$/, "")}/shop/${encodeURIComponent(entry.shopToken)}`;
  }
  if (kind === "shop16688" && (entry.shopNo || entry.shopToken)) {
    const no = entry.shopNo || entry.shopToken;
    return `https://www.16688.com.cn/shop/${encodeURIComponent(no)}`;
  }
  return entry.baseUrl || null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:
  pnpm shops:migrate
  pnpm shops:migrate -- --force-refresh-meta
  pnpm shops:migrate -- --db path/to/shops.sqlite`);
    process.exit(0);
  }

  const migrateNow = new Date().toISOString();
  const dbPath = resolveShopsDbPath(args.db);
  const db = openShopsDb(dbPath);
  const opts = { forceRefreshMeta: args.forceRefreshMeta };

  let inserted = 0;
  let skipped = 0;
  let updated = 0;
  let fallbackListed = 0;

  /** @param {object} shop */
  function commit(shop) {
    const result = insertShop(db, shop, opts);
    if (result.action === "inserted") inserted += 1;
    else if (result.action === "updated") updated += 1;
    else skipped += 1;
  }

  // --- shopApi ---
  const shopapiDoc = loadJson(SHOPAPI_CFG);
  const shopapiSources = Array.isArray(shopapiDoc?.sources) ? shopapiDoc.sources : [];
  const shopapiFileUpdated = shopapiDoc?.updatedAt || null;
  for (const s of shopapiSources) {
    if (!s?.id) continue;
    const listed = resolveListedAt(s, shopapiFileUpdated, migrateNow);
    if (listed.fallback) fallbackListed += 1;
    const enabled = s.enabled !== false;
    commit({
      id: s.id,
      name: s.name || s.id,
      platform: s.platform || "liandong",
      collectorKind: "shopApi",
      baseUrl: s.baseUrl || "",
      shopUrl: shopUrlFor(s, "shopApi"),
      shopToken: s.shopToken || null,
      enabled,
      status: enabled ? "active" : "disabled",
      submittedBy: s.importedAt ? "import" : "seed",
      listedAt: listed.listedAt,
      disabledReason: s.disabledReason || null,
      note: s.note || null,
      meta: {
        listed_at_source: listed.source,
        ...(listed.fallback ? { listed_at_fallback: "migrate" } : {}),
        migratedFrom: "sources.shopapi.json",
      },
    });
  }
  console.log(`[shops:migrate] shopApi candidates=${shopapiSources.length}`);

  // --- 16688 ---
  const doc16688 = loadJson(CFG16688);
  const sources16688 = Array.isArray(doc16688?.sources) ? doc16688.sources : [];
  const fileUpdated16688 = doc16688?.updatedAt || null;
  for (const s of sources16688) {
    if (!s?.id) continue;
    const listed = resolveListedAt(s, fileUpdated16688, migrateNow);
    if (listed.fallback) fallbackListed += 1;
    const enabled = s.enabled !== false;
    commit({
      id: s.id,
      name: s.name || s.id,
      platform: s.platform || "shop16688",
      collectorKind: s.collectorKind || "shop16688",
      baseUrl: s.baseUrl || "https://www.16688.com.cn",
      shopUrl: shopUrlFor(s, "shop16688"),
      shopNo: s.shopNo || s.shopToken || null,
      enabled,
      status: enabled ? "active" : "disabled",
      submittedBy: s.importedAt ? "import" : "seed",
      listedAt: listed.listedAt,
      note: s.note || null,
      meta: {
        listed_at_source: listed.source,
        ...(listed.fallback ? { listed_at_fallback: "migrate" } : {}),
        migratedFrom: "sources.16688.json",
      },
    });
  }
  console.log(`[shops:migrate] shop16688 candidates=${sources16688.length}`);

  // --- collectors.json hosts (skip shopApi / shop16688 registry-only) ---
  const collectorsDoc = loadJson(COLLECTORS_CFG);
  if (collectorsDoc) {
    const targets = expandCollectorTargets(collectorsDoc, { skipShopApi: true });
    for (const t of targets) {
      // Prefer raw; else migrate now (no file updatedAt for collectors hosts)
      const fromRaw = resolveListedAtFromRaw(t.id);
      const listedFinal = fromRaw
        ? { listedAt: fromRaw, source: "raw" }
        : { listedAt: migrateNow, source: "migrate", fallback: true };
      if (listedFinal.fallback) fallbackListed += 1;
      commit({
        id: t.id,
        name: t.name || t.id,
        platform: t.platform || kindToPlatform(t.kind),
        collectorKind: t.kind || t.collectorKind,
        baseUrl: t.baseUrl,
        shopUrl: t.sourceUrl || t.baseUrl,
        enabled: true,
        status: "active",
        submittedBy: "seed",
        listedAt: listedFinal.listedAt,
        meta: {
          listed_at_source: listedFinal.source,
          ...(listedFinal.fallback ? { listed_at_fallback: "migrate" } : {}),
          migratedFrom: "collectors.json",
          host: t.host || hostOf(t.baseUrl),
        },
      });
    }
    console.log(`[shops:migrate] collectors hosts candidates=${targets.length}`);
  } else {
    console.log("[shops:migrate] skip collectors.json (missing)");
  }

  const total = db.prepare("SELECT COUNT(*) AS n FROM shops").get().n;
  console.log(
    `[shops:migrate] done db=${dbPath} total=${total} inserted=${inserted} skipped=${skipped} updated=${updated} listed_at_fallback=${fallbackListed}`,
  );
  closeShopsDb();
}

main();
