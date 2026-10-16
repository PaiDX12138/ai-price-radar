#!/usr/bin/env node
/**
 * Prove process TTL + stale-if-error without starting Next.
 * Usage: node scripts/verify-catalog-cache.mjs
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicPath = join(root, "data/catalog/public.json");
const latestPath = join(root, "data/catalog/latest.json");
const bakPath = join(root, "data/catalog/public.json.verify-bak");

const TTL_MIN = 30;
const TTL_MAX = 300;
const TTL_DEFAULT = 60;

function clampTtl(raw) {
  const n = Number(raw ?? TTL_DEFAULT);
  if (!Number.isFinite(n)) return TTL_DEFAULT;
  return Math.min(TTL_MAX, Math.max(TTL_MIN, Math.trunc(n)));
}

function isValid(parsed) {
  return (
    parsed &&
    typeof parsed.generatedAt === "string" &&
    parsed.generatedAt &&
    Array.isArray(parsed.offers) &&
    parsed.offers.length > 0 &&
    Array.isArray(parsed.products) &&
    Array.isArray(parsed.sources)
  );
}

/** Same semantics as src/lib/catalog/store.ts (in-process). */
function createCache(ttlSeconds) {
  let memory = null;
  return {
    load(now = Date.now()) {
      if (memory && now - memory.loadedAtMs < ttlSeconds * 1000) {
        return { ...memory, cacheHit: true, ttlSeconds };
      }
      const path = existsSync(publicPath) ? publicPath : latestPath;
      try {
        if (!existsSync(path)) throw new Error("missing");
        const parsed = JSON.parse(readFileSync(path, "utf8"));
        if (!isValid(parsed)) throw new Error("invalid");
        memory = {
          snapshot: parsed,
          loadedAtMs: now,
          degraded: false,
          path,
        };
        return { ...memory, cacheHit: false, ttlSeconds };
      } catch {
        if (memory) {
          memory = { ...memory, loadedAtMs: now, degraded: true };
          return { ...memory, cacheHit: true, ttlSeconds };
        }
        return null;
      }
    },
    reset() {
      memory = null;
    },
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function main() {
  const src = existsSync(publicPath) ? publicPath : latestPath;
  if (!existsSync(src)) {
    console.error("[verify-catalog-cache] missing snapshot; run: pnpm collect:shopapi -- --fixture");
    process.exit(1);
  }

  mkdirSync(dirname(publicPath), { recursive: true });
  if (src !== publicPath) copyFileSync(src, publicPath);

  const good = JSON.parse(readFileSync(publicPath, "utf8"));
  assert(isValid(good), "fixture snapshot invalid");
  assert(typeof good.generatedAt === "string", "generatedAt required");

  const ttlSeconds = clampTtl(process.env.CATALOG_CACHE_TTL_SECONDS || 30);
  const cache = createCache(ttlSeconds);
  const t0 = 1_000_000;

  const first = cache.load(t0);
  assert(first && first.degraded === false && first.cacheHit === false, "first load should be fresh");
  assert(first.snapshot.generatedAt === good.generatedAt, "generatedAt match");

  const second = cache.load(t0 + 1000);
  assert(second && second.cacheHit === true && second.degraded === false, "within TTL → cache hit");

  // Corrupt on-disk snapshot
  copyFileSync(publicPath, bakPath);
  writeFileSync(publicPath, "{not-json", "utf8");
  if (existsSync(latestPath)) {
    copyFileSync(latestPath, `${latestPath}.verify-bak`);
    writeFileSync(latestPath, "{not-json", "utf8");
  }

  const stale = cache.load(t0 + ttlSeconds * 1000 + 1);
  assert(stale && stale.degraded === true, "after TTL + bad disk → degraded");
  assert(stale.snapshot.generatedAt === good.generatedAt, "stale-if-error keeps last-good generatedAt");
  assert(stale.snapshot.offers.length === good.offers.length, "stale-if-error keeps offers");

  // Restore
  renameSync(bakPath, publicPath);
  if (existsSync(`${latestPath}.verify-bak`)) {
    renameSync(`${latestPath}.verify-bak`, latestPath);
  }

  const recovered = cache.load(t0 + ttlSeconds * 2000 + 2);
  assert(recovered && recovered.degraded === false, "good disk after TTL clears degraded");

  console.log("[verify-catalog-cache] OK");
  console.log(
    JSON.stringify(
      {
        ttlSeconds,
        generatedAt: good.generatedAt,
        offers: good.offers.length,
        steps: ["fresh", "ttl-hit", "stale-if-error", "recovered"],
      },
      null,
      2,
    ),
  );
}

try {
  main();
} catch (error) {
  // best-effort restore
  try {
    if (existsSync(bakPath)) renameSync(bakPath, publicPath);
    if (existsSync(`${latestPath}.verify-bak`)) renameSync(`${latestPath}.verify-bak`, latestPath);
  } catch {
    // ignore
  }
  console.error("[verify-catalog-cache] FAIL", error instanceof Error ? error.message : error);
  process.exit(1);
}
