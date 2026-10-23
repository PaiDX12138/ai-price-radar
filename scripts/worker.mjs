#!/usr/bin/env node
/**
 * Built-in collect worker (separate from Next.js).
 *
 *   pnpm worker
 *   pnpm worker -- --once
 *   pnpm worker -- --once --shop=<id>   # 单店立即采一次（收录申请用）
 *
 * - Polls shops.sqlite every 10m for due shops
 * - Concurrent by platform group; 链动 uses optional proxy channels
 * - Batch-writes catalog snapshot + optional prewarm
 *
 * Proxy (optional, 链动 only):
 *   PROXY_API_URL=...   or   PROXY_URL=http://user:pass@host:port
 */
import { verifyMissingShopApiOffers } from "../collectors/offer-lifecycle.mjs";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hostname } from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { loadEnvLocal } from "./load-env-local.mjs";
import { collectByKind } from "../collectors/dispatch.mjs";
import { seedProducts } from "../collectors/classify.mjs";
import {
  appendCrawlRun,
  CATALOG_PATH,
  loadCatalogSnapshot,
  loadRawLastGoodBySourceId,
  mergeCatalogBySourceId,
  writeCatalogSnapshot,
  writeRawSource,
} from "../collectors/persist.mjs";
import {
  claimDueShops,
  claimShopById,
  closeShopsDb,
  completeShopCollect,
  deferShopsOnChannel,
  requireShopsDb,
  scheduleShopCollectNow,
  shopsDbExists,
} from "../collectors/shops-db.mjs";
import {
  dueOfficialMode,
  officialDbExists,
  openOfficialDb,
  resolveOfficialDbPath,
} from "../collectors/official-prices-db.mjs";
import {
  getLiandongChannelCount,
  getProxyMode,
  getSharedProxyPool,
} from "../collectors/proxy-pool.mjs";
import { isWafError } from "../collectors/shopApi.mjs";
import {
  looksLikeAgentCodeName,
  sanitizeShopDisplayName,
} from "../collectors/sanitize-shop-name.mjs";
import { hostOf } from "../collectors/util.mjs";

loadEnvLocal();

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const TICK_MS = Number(process.env.WORKER_TICK_MS || 600_000);
const CLAIM_LIMIT = Number(process.env.WORKER_CLAIM_LIMIT || 64);
const ONCE = process.argv.includes("--once");

/** Optional: force collect one shop then exit (`--shop=<id>` or `--shop <id>`). Implies once. */
function parseShopArg(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--shop=")) return a.slice("--shop=".length).trim() || null;
    if (a === "--shop" && argv[i + 1]) return String(argv[i + 1]).trim() || null;
  }
  return null;
}
const FORCE_SHOP_ID = parseShopArg(process.argv);
const CONCURRENCY = {
  liandong: null, // channel-driven
  yunmao: 3,
  qxvx: 3,
  shop16688: 3,
  independent: 12,
};

/** Prevent overlapping official price collects inside one worker process. */
let officialCollectRunning = false;

/** OTP（邮箱/接码）平台价：默认每 6 小时采一次。 */
const OTP_COLLECT_INTERVAL_MS = Number(
  process.env.OTP_COLLECT_INTERVAL_MS || 6 * 60 * 60 * 1000,
);
const OTP_COLLECT_STARTUP_GRACE_MS = Number(
  process.env.OTP_COLLECT_STARTUP_GRACE_MS || 20_000,
);
let otpCollectRunning = false;
let otpCollectLastAt = 0;
const workerBootAt = Date.now();

/**
 * Low-frequency OTP platform prices (5SIM guest / Grizzly / page probes + optional API keys).
 * First run after a short startup grace (avoid racing official FX collect).
 */
function maybeRunOtpCollect() {
  if (FORCE_SHOP_ID) return;
  if (otpCollectRunning) return;
  const now = Date.now();
  if (!otpCollectLastAt) {
    if (now - workerBootAt < OTP_COLLECT_STARTUP_GRACE_MS) return;
  } else if (now - otpCollectLastAt < OTP_COLLECT_INTERVAL_MS) {
    return;
  }

  otpCollectRunning = true;
  otpCollectLastAt = now;
  console.log("[worker] otp collect due");
  const child = spawn(
    process.execPath,
    [join(root, "scripts/collect-otp-platforms.mjs")],
    {
      cwd: root,
      env: process.env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let errBuf = "";
  child.stderr?.on("data", (chunk) => {
    errBuf += String(chunk);
    if (errBuf.length > 800) errBuf = errBuf.slice(-800);
  });
  child.on("exit", (code) => {
    otpCollectRunning = false;
    if (code !== 0) {
      console.warn(
        `[worker] otp collect failed code=${code}`,
        errBuf.slice(0, 400),
      );
    } else {
      console.log("[worker] otp collect ok");
    }
  });
  child.on("error", (err) => {
    otpCollectRunning = false;
    console.warn("[worker] otp collect spawn error:", err.message);
  });
}

/**
 * Low-frequency official prices: FX at 06:00 Asia/Shanghai (catch-up if missed) / weekly full.
 * Spawns collect:official when schedule is due (non-blocking for shop tick).
 */
function maybeRunOfficialCollect() {
  if (FORCE_SHOP_ID) return;
  if (officialCollectRunning) return;
  if (!officialDbExists()) return;
  let mode = null;
  try {
    const odb = openOfficialDb(resolveOfficialDbPath());
    try {
      mode = dueOfficialMode(odb);
    } finally {
      odb.close();
    }
  } catch (err) {
    console.warn(
      "[worker] official schedule check failed:",
      err instanceof Error ? err.message : err,
    );
    return;
  }
  if (!mode) return;

  officialCollectRunning = true;
  console.log(`[worker] official collect due mode=${mode}`);
  const child = spawn(
    process.execPath,
    [join(root, "scripts/collect-official-prices.mjs"), `--mode=${mode}`],
    {
      cwd: root,
      env: process.env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let errBuf = "";
  child.stderr?.on("data", (chunk) => {
    errBuf += String(chunk);
    if (errBuf.length > 800) errBuf = errBuf.slice(-800);
  });
  child.on("exit", (code) => {
    officialCollectRunning = false;
    if (code !== 0) {
      console.warn(
        `[worker] official collect failed code=${code}`,
        errBuf.slice(0, 400),
      );
    } else {
      console.log(`[worker] official collect ok mode=${mode}`);
    }
  });
  child.on("error", (err) => {
    officialCollectRunning = false;
    console.warn("[worker] official collect spawn error:", err.message);
  });
}

const WORKER_OWNER = `worker-${hostname()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isLiandongTarget(source) {
  if (String(source?.platform || "").toLowerCase() === "liandong") return true;
  const h = String(source?.host || hostOf(source?.baseUrl || "") || "").toLowerCase();
  return /(^|\.)(wzyp\.cn|ldxp\.cn)$/i.test(h);
}

/**
 * @param {ReturnType<typeof import('../collectors/shops-db.mjs').shopRowToCollectTarget>} shop
 */
function groupKey(shop) {
  const platform = String(shop.platform || "").toLowerCase();
  const kind = String(shop.collectorKind || shop.kind || "").toLowerCase();
  if (isLiandongTarget(shop)) return "liandong";
  if (platform === "shop16688" || kind === "shop16688") return "shop16688";
  if (platform === "qxvx") return "qxvx";
  if (platform === "yunmao") return "yunmao";
  // Other shopApi hosts share a modest concurrency bucket (same exit IP concerns).
  if (kind === "shopapi") return "yunmao";
  return "independent";
}

/**
 * @template T
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<void>} fn
 */
async function mapPool(items, concurrency, fn) {
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i;
      i += 1;
      await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: n }, () => worker()));
}

function platformToSourcePlatform(platform) {
  const p = String(platform || "").toLowerCase();
  if (p) return p;
  return "public";
}

function buildSourceMeta(source, result) {
  const kind = String(source.collectorKind || source.kind || "");
  if (kind === "shopApi") {
    return {
      id: source.id,
      name: sanitizeShopDisplayName(
        looksLikeAgentCodeName(result.shopInfo?.name) && !looksLikeAgentCodeName(source.name)
          ? source.name
          : result.shopInfo?.name || source.name || source.id,
        source.shopToken || source.id,
      ),
      platform: platformToSourcePlatform(source.platform),
      collectorKind: "shopApi",
      host: result.shopInfo?.host || source.host || hostOf(source.baseUrl),
      listedAt: source.listedAt || undefined,
    };
  }
  return {
    id: source.id,
    name: source.name || source.id,
    platform: source.platform || platformToSourcePlatform(source.platform),
    collectorKind: kind,
    host: source.host || hostOf(source.baseUrl),
    listedAt: source.listedAt || undefined,
  };
}

/**
 * @param {any} source
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 */
async function collectOne(source, opts = {}) {
  const kind = String(source.collectorKind || source.kind || "");
  if (kind === "shopApi") {
    const liandong = isLiandongTarget(source);
    const shopDelayMs = liandong
      ? Number(process.env.COLLECTOR_LIANDONG_SHOP_DELAY_MS || 4000)
      : Number(process.env.COLLECTOR_SHOP_DELAY_MS || 0);
    return collectByKind(source, {
      fetchImpl: opts.fetchImpl,
      shopDelayMs: shopDelayMs || undefined,
    });
  }
  return collectByKind(source, {});
}

async function prewarmAfterCollect() {
  const base = (process.env.PREWARM_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(
    /\/$/,
    "",
  );
  if (!base) {
    console.log("[worker] prewarm skipped (set PREWARM_BASE_URL to enable)");
    return;
  }
  const prewarm = join(root, "scripts/prewarm-catalog.mjs");
  console.log("[worker] prewarm via", prewarm);
  const result = spawnSync(process.execPath, [prewarm], {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    shell: false,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status) {
    console.warn("[worker] prewarm exited", result.status, "(non-fatal)");
  }
}

/**
 * @param {any[]} batchSuccess
 * @param {Map<string, { error: string, at: string, waf: boolean }>} failedById
 * @param {{ attempted: number, success: number, failed: number, runId: string }} stats
 */
async function writeBatchCatalog(batchSuccess, failedById, stats, withdrawSourceIds = []) {
  const previous = loadCatalogSnapshot();
  const rawLastGood = loadRawLastGoodBySourceId();
  const merged = mergeCatalogBySourceId({
    previous,
    rawLastGood,
    batchSuccess,
    withdrawSourceIds,
  });
  const attemptAt = new Date().toISOString();
  merged.sources = merged.sources.map((src) => {
    const f = failedById.get(src?.id);
    if (f) {
      return {
        ...src,
        collectStatus: "failed",
        collectError: f.waf ? "waf" : f.error.slice(0, 160),
        lastAttemptAt: f.at,
      };
    }
    if (merged.overlaySourceIds.includes(src?.id)) {
      const { collectError, ...rest } = src;
      return { ...rest, collectStatus: "ok", lastAttemptAt: attemptAt };
    }
    return src;
  });

  const products = seedProducts();
  const seedSlugs = new Set(products.map((p) => p.slug));
  const publicOffers = merged.offers
    .filter((o) => seedSlugs.has(o.productSlug))
    .map(({ goodsKey, classified, ...rest }) => rest);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    mode: "worker",
    isDemo: false,
    runId: stats.runId,
    stats: {
      sourcesAttempted: stats.attempted,
      sourcesSuccess: stats.success,
      sourcesFailed: stats.failed,
      offersClassified: publicOffers.length,
      sourcesRetained: merged.retainedSourceIds.length,
      sourcesOverlay: merged.overlaySourceIds.length,
    },
    sources: merged.sources,
    products,
    offers: publicOffers,
  };

  const path = await writeCatalogSnapshot(snapshot);
  appendCrawlRun({
    id: `${stats.runId}-batch`,
    type: "worker_batch",
    runId: stats.runId,
    attempted: stats.attempted,
    success: stats.success,
    failed: stats.failed,
    overlay: merged.overlaySourceIds.length,
    retained: merged.retainedSourceIds.length,
    catalogPath: path,
    finishedAt: new Date().toISOString(),
  });
  return path;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {ReturnType<typeof getSharedProxyPool>} pool
 * @param {{ shopId?: string | null }} [opts]
 */
async function runTick(db, pool, opts = {}) {
  const channelCount = pool.channelCount;
  const forceId = String(opts.shopId || "").trim();
  /** @type {ReturnType<typeof claimDueShops>} */
  let claimed;
  if (forceId) {
    scheduleShopCollectNow(db, forceId);
    const one = claimShopById(db, {
      id: forceId,
      owner: WORKER_OWNER,
      channelCount,
    });
    claimed = one ? [one] : [];
    if (!claimed.length) {
      console.warn(`[worker] shop ${forceId} not claimed (missing / disabled / leased)`);
      return { claimed: 0 };
    }
  } else {
    claimed = claimDueShops(db, {
      owner: WORKER_OWNER,
      limit: CLAIM_LIMIT,
      channelCount,
    });
  }
  if (!claimed.length) {
    return { claimed: 0 };
  }

  const runId = `worker-${Date.now()}`;
  console.log(
    `\n[worker] tick claim=${claimed.length} proxy=${pool.mode} channels=${channelCount} owner=${WORKER_OWNER}`,
  );

  /** @type {Map<string, any[]>} */
  const groups = new Map();
  for (const shop of claimed) {
    const key = groupKey(shop);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(shop);
  }

  /** @type {any[]} */
  const batchSuccess = [];
  /** @type {string[]} */
  const withdrawSourceIds = [];
  /** @type {Map<string, { error: string, at: string, waf: boolean }>} */
  const failedById = new Map();
  let success = 0;
  let failed = 0;

  /**
   * @param {any} source
   * @param {{ fetchImpl?: typeof fetch, channelIndex?: number }} [ctx]
   */
  async function finishShop(source, result, ctx = {}) {
    if (result.collectionComplete === true && (source.collectorKind || source.kind) === "shopApi") {
      const old = loadCatalogSnapshot()?.offers?.filter((offer) => offer.sourceId === source.id) || [];
      await verifyMissingShopApiOffers(old, result, { fetchImpl: ctx.fetchImpl });
    }
    const finishedAt = new Date().toISOString();
    const waf = !result.ok && isWafError(result.error);
    const withdraw = Boolean(result.withdrawDisplay);
    appendCrawlRun({
      id: `${runId}-${source.id}`,
      runId,
      sourceId: source.id,
      kind: source.collectorKind || source.kind,
      status: result.ok ? "success" : "failed",
      offerCount: result.offers?.length || 0,
      message: withdraw
        ? `withdraw:${result.withdrawReason || result.displayState || "closed"}`
        : result.ok
          ? `collected ${result.offers?.length || 0}`
          : result.error,
      channelIndex: ctx.channelIndex ?? source.channelIndex,
      finishedAt,
    });

    // 打样/封禁：强制写空 raw，避免 last-good 复活；其它失败仍保留上次成功
    if (result.ok || withdraw || !existsSync(join(root, "data/raw", `${source.id}.json`))) {
      writeRawSource(
        source.id,
        {
          source,
          result: {
            ok: result.ok,
            error: result.error,
            shopInfo: result.shopInfo || null,
            offerCount: result.offers?.length || 0,
            withdrawDisplay: withdraw,
            withdrawReason: result.withdrawReason || null,
            displayState: result.displayState || null,
          },
          offers: result.offers || [],
          capturedAt: finishedAt,
        },
        { force: withdraw },
      );
    }

    completeShopCollect(db, source.id, {
      ok: result.ok,
      error: result.error,
      owner: WORKER_OWNER,
      at: finishedAt,
      displayState: result.displayState || null,
      withdrawReason: result.withdrawReason || null,
    });

    if (withdraw) {
      withdrawSourceIds.push(source.id);
    }

    if (result.ok) {
      success += 1;
      if (((result.offers?.length || 0) > 0 || result.collectionComplete === true) && !withdraw) {
        batchSuccess.push({
          sourceId: source.id,
          sourceMeta: buildSourceMeta(source, result),
          collectionComplete: result.collectionComplete === true,
          offers: result.offers,
        });
      }
      const tag = withdraw ? ` withdraw=${result.withdrawReason || result.displayState}` : "";
      console.log(`  ok ${source.id} offers=${result.offers?.length || 0}${tag}`);
    } else {
      failed += 1;
      failedById.set(source.id, {
        error: String(result.error || ""),
        at: finishedAt,
        waf,
      });
      const tag = withdraw ? " (withdraw display)" : "";
      console.log(`  FAIL ${source.id}: ${result.error}${tag}`);
    }
    return { waf };
  }

  async function runIndependentGroup(shops, concurrency) {
    await mapPool(shops, concurrency, async (source) => {
      console.log(`==> [${source.collectorKind}] ${source.id}`);
      const result = await collectOne(source);
      await finishShop(source, result);
    });
  }

  /**
   * Release remaining shops on a cooled channel without double-finishing the current one.
   * @param {any[]} channelShops
   * @param {number} fromIndex inclusive
   * @param {number} channelIndex
   * @param {string} reason
   */
  function deferRestOnChannel(channelShops, fromIndex, channelIndex, reason) {
    deferShopsOnChannel(db, {
      channelIndex,
      delayMs: 5 * 60 * 1000,
      platforms: ["liandong"],
    });
    for (let i = fromIndex; i < channelShops.length; i += 1) {
      const shop = channelShops[i];
      const at = new Date().toISOString();
      completeShopCollect(db, shop.id, {
        ok: false,
        error: `channel_deferred:${reason}`,
        at,
      });
      failed += 1;
      failedById.set(shop.id, { error: reason, at, waf: true });
      console.log(`  defer ${shop.id} channel=${channelIndex} (${reason})`);
    }
  }

  async function runLiandongGroup(shops) {
    /** @type {Map<number, any[]>} */
    const byChannel = new Map();
    for (const shop of shops) {
      const idx =
        shop.channelIndex != null && Number.isFinite(shop.channelIndex)
          ? Number(shop.channelIndex) % channelCount
          : 0;
      if (!byChannel.has(idx)) byChannel.set(idx, []);
      byChannel.get(idx).push(shop);
    }

    await Promise.all(
      [...byChannel.entries()].map(async ([channelIndex, channelShops]) => {
        for (let i = 0; i < channelShops.length; i += 1) {
          const source = channelShops[i];
          const ensured = await pool.ensureChannel(channelIndex);
          if (ensured.deferred) {
            deferRestOnChannel(
              channelShops,
              i,
              channelIndex,
              ensured.reason || "channel_cooldown",
            );
            break;
          }

          console.log(`==> [liandong/ch${channelIndex}] ${source.id}`);
          let result = await collectOne(source, { fetchImpl: ensured.fetchImpl });
          if (!result.ok && isWafError(result.error)) {
            const rotated = await pool.reportBlocked(channelIndex);
            if (rotated.rotated) {
              console.log(`  WAF → rotated channel=${channelIndex} via ${rotated.source}`);
              const again = await pool.ensureChannel(channelIndex);
              result = await collectOne(source, { fetchImpl: again.fetchImpl });
            } else {
              await finishShop(source, result, { channelIndex });
              deferRestOnChannel(
                channelShops,
                i + 1,
                channelIndex,
                rotated.reason || "waf_cooldown",
              );
              break;
            }
          }

          const fin = await finishShop(source, result, { channelIndex });
          if (fin.waf && pool.isChannelCooling(channelIndex)) {
            deferRestOnChannel(channelShops, i + 1, channelIndex, "waf_cooldown");
            break;
          }
        }
      }),
    );
  }

  const groupJobs = [];
  for (const [key, shops] of groups.entries()) {
    if (key === "liandong") {
      groupJobs.push(runLiandongGroup(shops));
    } else {
      const conc = CONCURRENCY[key] || CONCURRENCY.independent;
      groupJobs.push(runIndependentGroup(shops, conc));
    }
  }
  await Promise.all(groupJobs);

  const path = await writeBatchCatalog(
    batchSuccess,
    failedById,
    {
      runId,
      attempted: claimed.length,
      success,
      failed,
    },
    withdrawSourceIds,
  );
  console.log(
    `[worker] batch done success=${success} failed=${failed} withdrawn=${withdrawSourceIds.length} catalog=${path || CATALOG_PATH}`,
  );
  if (success > 0) await prewarmAfterCollect();

  return { claimed: claimed.length, success, failed };
}

async function main() {
  if (!shopsDbExists()) {
    console.error("[worker] Missing shops DB. Run: pnpm shops:migrate");
    process.exit(1);
  }

  const db = requireShopsDb();
  const pool = getSharedProxyPool({ channelCount: getLiandongChannelCount() });

  const once = ONCE || Boolean(FORCE_SHOP_ID);
  console.log(
    `[worker] start owner=${WORKER_OWNER} tick=${TICK_MS}ms proxy=${getProxyMode()} channels=${pool.channelCount}` +
      (once ? " once=1" : "") +
      (FORCE_SHOP_ID ? ` shop=${FORCE_SHOP_ID}` : ""),
  );
  console.log(`[worker] proxy detail`, JSON.stringify(pool.describe()));

  let stopping = false;
  const onStop = () => {
    if (stopping) return;
    stopping = true;
    console.log("\n[worker] shutting down…");
    closeShopsDb();
    process.exit(0);
  };
  process.on("SIGINT", onStop);
  process.on("SIGTERM", onStop);

  do {
    try {
      maybeRunOfficialCollect();
      maybeRunOtpCollect();
      await runTick(db, pool, { shopId: FORCE_SHOP_ID });
    } catch (error) {
      console.error("[worker] tick error:", error instanceof Error ? error.message : error);
    }
    if (once || stopping) break;
    await sleep(TICK_MS);
  } while (!stopping);

  if (once) {
    closeShopsDb();
    console.log("[worker] once complete");
  }
}

main().catch((error) => {
  console.error("[worker]", error instanceof Error ? error.message : error);
  process.exit(1);
});
