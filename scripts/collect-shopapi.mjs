#!/usr/bin/env node
/**
 * ShopApi collector CLI.
 * Usage:
 *   pnpm collect:shopapi -- --all
 *   pnpm collect:shopapi -- --source <id>
 *   pnpm collect:shopapi -- --platform yunmao --limit 10 --offset 0
 *   pnpm collect:shopapi -- --fixture   # mock = shop OK + 1 shop fail, no live tokens
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collectShopApi, isWafError } from "../collectors/shopApi.mjs";
import { seedProducts } from "../collectors/classify.mjs";
import {
  appendCrawlRun,
  CATALOG_PATH,
  CRAWL_RUNS_PATH,
  loadCatalogSnapshot,
  loadRawLastGoodBySourceId,
  mergeCatalogBySourceId,
  PUBLIC_SNAPSHOT_PATH,
  writeCatalogSnapshot,
  writeRawSource,
} from "../collectors/persist.mjs";
import { FIXTURE_SOURCES, mockShopApiFetch } from "../collectors/fixtures/shopapi-mock-fetch.mjs";
import { createProxiedFetch, describeCollectorProxy } from "../collectors/http-proxy.mjs";
import { sanitizeShopDisplayName, looksLikeAgentCodeName } from "../collectors/sanitize-shop-name.mjs";
import {
  listShops,
  requireShopsDb,
  shopRowToCollectTarget,
  updateShopProbeHealth,
} from "../collectors/shops-db.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  console.error(`[collect:shopapi] ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = {
    all: false,
    fixture: false,
    source: null,
    platform: null,
    limit: null,
    offset: 0,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--all") out.all = true;
    else if (arg === "--fixture") out.fixture = true;
    else if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--source") {
      out.source = argv[i + 1] || null;
      i += 1;
    } else if (arg.startsWith("--source=")) {
      out.source = arg.slice("--source=".length);
    } else if (arg === "--platform") {
      out.platform = argv[i + 1] || null;
      i += 1;
    } else if (arg.startsWith("--platform=")) {
      out.platform = arg.slice("--platform=".length);
    } else if (arg === "--limit") {
      out.limit = Number(argv[i + 1]);
      i += 1;
    } else if (arg.startsWith("--limit=")) {
      out.limit = Number(arg.slice("--limit=".length));
    } else if (arg === "--offset") {
      out.offset = Number(argv[i + 1]);
      i += 1;
    } else if (arg.startsWith("--offset=")) {
      out.offset = Number(arg.slice("--offset=".length));
    }
  }
  if (out.limit != null && (!Number.isFinite(out.limit) || out.limit < 0)) {
    fail(`Invalid --limit=${out.limit}`);
  }
  if (!Number.isFinite(out.offset) || out.offset < 0) {
    fail(`Invalid --offset=${out.offset}`);
  }
  if (out.platform) out.platform = String(out.platform).trim().toLowerCase();
  return out;
}

function loadDbShopApiSources() {
  let db;
  try {
    db = requireShopsDb();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  return listShops(db, { collectorKind: "shopApi", enabled: true }).map(shopRowToCollectTarget);
}

function platformToSourcePlatform(platform) {
  if (platform === "yunmao") return "yunmao";
  if (platform === "qxvx") return "qxvx";
  return "liandong";
}

function isHttp502(error) {
  const msg = String(error || "");
  return /\b502\b/.test(msg) || /Bad Gateway/i.test(msg);
}

function isWafBlock(error) {
  return isWafError(error);
}

function isLiandongTarget(source) {
  return (
    String(source?.platform || "").toLowerCase() === "liandong" ||
    /(wzyp|ldxp)\.cn/i.test(String(source?.baseUrl || ""))
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:
  pnpm collect:shopapi -- --all
  pnpm collect:shopapi -- --source <id>
  pnpm collect:shopapi -- --platform yunmao --limit 10 --offset 0
  pnpm collect:shopapi -- --fixture`);
    process.exit(0);
  }

  const useFixture = args.fixture || process.env.COLLECTOR_USE_FIXTURE === "1";
  /** @type {any[]} */
  let sources;
  /** @type {typeof fetch | undefined} */
  let fetchImpl;
  let poolSize = 0;
  let skippedBySlice = 0;

  if (useFixture) {
    sources = FIXTURE_SOURCES;
    fetchImpl = mockShopApiFetch;
    console.log("[collect:shopapi] mode=fixture (mock fetch; no live ShopApi)");
  } else {
    let enabled = loadDbShopApiSources().filter((item) => item && item.shopToken);
    if (args.source) {
      enabled = enabled.filter((item) => item.id === args.source);
      if (!enabled.length) fail(`No enabled source with id=${args.source}`);
    }
    if (args.platform) {
      enabled = enabled.filter(
        (item) => String(item.platform || "").toLowerCase() === args.platform,
      );
      if (!enabled.length) fail(`No enabled sources for platform=${args.platform}`);
    }
    poolSize = enabled.length;
    const offset = args.offset || 0;
    const sliced =
      args.limit != null ? enabled.slice(offset, offset + args.limit) : enabled.slice(offset);
    skippedBySlice = Math.max(0, enabled.length - sliced.length);
    sources = sliced;
    if (!sources.length) {
      fail(
        "No enabled shopApi sources with shopToken in shops.sqlite. Run `pnpm shops:migrate`, or use --fixture.",
      );
    }
    fetchImpl = createProxiedFetch();
    console.log(
      `[collect:shopapi] mode=live sources=${sources.length} pool=${poolSize}` +
        (args.platform ? ` platform=${args.platform}` : "") +
        (args.limit != null ? ` limit=${args.limit}` : "") +
        (offset ? ` offset=${offset}` : "") +
        ` proxy=${describeCollectorProxy()}`,
    );
  }

  const runId = `run-${Date.now()}`;
  const startedAt = new Date().toISOString();
  const crawlRuns = [];
  /** @type {any[]} */
  const batchSuccess = [];
  /** @type {string[]} */
  const withdrawSourceIds = [];
  /** @type {any[]} */
  const batchOffersRaw = [];
  let successShops = 0;
  let failedShops = 0;
  let http502 = 0;
  let offersEmptyOk = 0;
  let wafHits = 0;
  const wafCooldownMs = Number(process.env.COLLECTOR_WAF_COOLDOWN_MS || 45_000);
  const shopDelayMs = useFixture ? 0 : Number(process.env.COLLECTOR_SHOP_DELAY_MS || 0);
  const liandongShopDelayMs = useFixture ? 0 : Number(process.env.COLLECTOR_LIANDONG_SHOP_DELAY_MS || 4000);
  const wafMaxRetries = Number(process.env.COLLECTOR_WAF_MAX_RETRIES || 3);
  const wafMaxCooldownMs = Number(process.env.COLLECTOR_WAF_MAX_COOLDOWN_MS || 300_000);
  const wafCircuitAfter = Number(process.env.COLLECTOR_WAF_CIRCUIT_AFTER || 3);
  let wafStreak = 0;
  let circuitOpen = false;
  let circuitSkipped = 0;
  /** @type {Map<string, { error: string, at: string, waf: boolean }>} */
  const failedById = new Map();
  const shopsDb = useFixture ? null : requireShopsDb();

  for (const source of sources) {
    console.log(`\n==> ${source.id} @ ${source.baseUrl}`);
    const liandong = isLiandongTarget(source);
    /** @type {any} */
    let result;
    if (liandong && circuitOpen) {
      // 熔断：本轮链动连续被拦，后面的链动店不再请求，只记采集失败（不是缺货）
      circuitSkipped += 1;
      result = {
        ok: false,
        sourceId: source.id,
        error: "waf_circuit_open: 本轮链动连续被 WAF 拦截，跳过未请求",
        offers: [],
        shopInfo: null,
        resolvedBase: null,
      };
    } else {
      const perShopDelay = liandong ? Math.max(shopDelayMs, liandongShopDelayMs) : shopDelayMs;
      result = await collectShopApi(source, {
        fetchImpl,
        pageDelayMs: useFixture ? 0 : undefined,
        shopDelayMs: useFixture ? 0 : perShopDelay || undefined,
      });

      // WAF / 挑战页：指数退避重试（默认 45s、90s、180s，封顶 COLLECTOR_WAF_MAX_COOLDOWN_MS）
      for (let attempt = 1; !result.ok && isWafBlock(result.error) && !useFixture && attempt <= wafMaxRetries; attempt += 1) {
        wafHits += 1;
        const wait = Math.min(wafCooldownMs * 2 ** (attempt - 1), wafMaxCooldownMs);
        console.log(`  WAF/challenge: backoff ${wait}ms, retry ${attempt}/${wafMaxRetries}`);
        await sleep(wait);
        result = await collectShopApi(source, {
          fetchImpl,
          pageDelayMs: useFixture ? 0 : undefined,
          shopDelayMs: useFixture ? 0 : Math.max(perShopDelay, 1500),
        });
      }

      if (liandong && !useFixture) {
        if (!result.ok && isWafBlock(result.error)) {
          wafStreak += 1;
          if (wafStreak >= wafCircuitAfter) {
            circuitOpen = true;
            console.log(`  WAF circuit open after ${wafStreak} blocked shops; remaining liandong shops skipped this run`);
          }
        } else {
          wafStreak = 0;
        }
      }
    }

    const finishedAt = new Date().toISOString();
    const run = {
      id: `${runId}-${source.id}`,
      runId,
      sourceId: source.id,
      status: result.ok ? "success" : "failed",
      offerCount: result.offers.length,
      message: result.ok ? `collected ${result.offers.length} offers` : result.error,
      startedAt,
      finishedAt,
    };
    crawlRuns.push(run);
    appendCrawlRun(run);
    const withdraw = Boolean(result.withdrawDisplay);
    // 失败不覆盖已有 last-good raw（避免 WAF 空结果冲掉上次成功）；打样/封禁强制清空
    if (result.ok || withdraw || !existsSync(join(root, "data/raw", `${source.id}.json`))) {
      writeRawSource(
        source.id,
        {
          source,
          result: {
            ok: result.ok,
            error: result.error,
            shopInfo: result.shopInfo,
            offerCount: result.offers.length,
            withdrawDisplay: withdraw,
            withdrawReason: result.withdrawReason || null,
            displayState: result.displayState || null,
          },
          offers: result.offers,
          capturedAt: finishedAt,
        },
        { force: withdraw },
      );
    } else if (!result.ok) {
      console.log(`  skip raw overwrite (keep last-good)`);
    }

    if (withdraw) {
      withdrawSourceIds.push(source.id);
    }

    if (result.ok) {
      successShops += 1;
      if (result.offers.length === 0) offersEmptyOk += 1;
      const tag = withdraw ? ` withdraw=${result.withdrawReason || result.displayState}` : "";
      console.log(
        `  ok offers=${result.offers.length} shop=${result.shopInfo?.name || "?"} base=${result.resolvedBase || source.baseUrl || "?"}${tag}`,
      );
      if ((result.offers.length > 0 || result.collectionComplete === true) && !withdraw) {
        batchSuccess.push({
          collectionComplete: result.collectionComplete === true,
          sourceId: source.id,
          sourceMeta: {
            id: source.id,
            name: sanitizeShopDisplayName(
              looksLikeAgentCodeName(result.shopInfo?.name) && !looksLikeAgentCodeName(source.name)
                ? source.name
                : result.shopInfo?.name || source.name || source.id,
              source.shopToken || source.id,
            ),
            platform: platformToSourcePlatform(source.platform),
            collectorKind: "shopApi",
            host: result.shopInfo?.host || safeHost(source.baseUrl),
            listedAt: source.listedAt || undefined,
          },
          offers: result.offers,
        });
        batchOffersRaw.push(...result.offers);
      }
      if (shopsDb) {
        updateShopProbeHealth(shopsDb, source.id, {
          ok: true,
          at: finishedAt,
          displayState: result.displayState || null,
          withdrawReason: result.withdrawReason || null,
        });
      }
    } else {
      failedShops += 1;
      failedById.set(source.id, {
        error: String(result.error || ""),
        at: finishedAt,
        waf: isWafBlock(result.error) || /waf_circuit_open/.test(String(result.error)),
      });
      if (isHttp502(result.error)) http502 += 1;
      const tag = withdraw ? " (withdraw display)" : "";
      console.log(`  FAIL: ${result.error} (isolated; other shops untouched)${tag}`);
      if (shopsDb) {
        updateShopProbeHealth(shopsDb, source.id, {
          ok: false,
          error: result.error,
          at: finishedAt,
          displayState: result.displayState || null,
          withdrawReason: result.withdrawReason || null,
        });
      }
    }
  }

  const previous = loadCatalogSnapshot();
  const rawLastGood = loadRawLastGoodBySourceId();
  const merged = mergeCatalogBySourceId({
    previous,
    rawLastGood,
    batchSuccess,
    withdrawSourceIds,
  });
  // 本轮失败的店：保留上次成功的报价（不改成缺货），在店铺上标采集失败
  const attemptAt = new Date().toISOString();
  merged.sources = merged.sources.map((src) => {
    const f = failedById.get(src?.id);
    if (f) {
      return { ...src, collectStatus: "failed", collectError: f.waf ? "waf" : f.error.slice(0, 160), lastAttemptAt: f.at };
    }
    if (merged.overlaySourceIds.includes(src?.id)) {
      const { collectError, ...rest } = src;
      return { ...rest, collectStatus: "ok", lastAttemptAt: attemptAt };
    }
    return src;
  });

  const products = seedProducts();
  const seedSlugs = new Set(products.map((p) => p.slug));
  // Drop goodsKey from public catalog shape; keep classified seed offers only
  const publicOffers = merged.offers
    .filter((o) => seedSlugs.has(o.productSlug))
    .map(({ goodsKey, classified, ...rest }) => rest);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    mode: useFixture ? "fixture" : "live",
    isDemo: false,
    runId,
    stats: {
      sourcesAttempted: sources.length,
      sourcesSuccess: successShops,
      sourcesFailed: failedShops,
      sourcesSkipped: skippedBySlice,
      offersRaw: batchOffersRaw.length,
      offersClassified: publicOffers.length,
      sourcesRetained: merged.retainedSourceIds.length,
      sourcesOverlay: merged.overlaySourceIds.length,
      http502,
    },
    sources: merged.sources,
    products,
    offers: publicOffers,
    crawlRuns,
  };

  const prevOffers = Array.isArray(previous?.offers) ? previous.offers.length : 0;
  const wouldWrite = successShops > 0 && publicOffers.length > 0;
  const path = await writeCatalogSnapshot(snapshot);

  const crawlBatch = {
    runId,
    mode: useFixture ? "fixture" : "live",
    platform: args.platform || null,
    limit: args.limit,
    offset: args.offset || 0,
    poolSize: useFixture ? sources.length : poolSize,
    attempted: sources.length,
    success: successShops,
    failed: failedShops,
    skipped: skippedBySlice,
    offersEmptyOk,
      http502,
      wafHits,
      wafCircuitOpen: circuitOpen,
      wafCircuitSkipped: circuitSkipped,
      offersRaw: batchOffersRaw.length,
    offersClassified: publicOffers.length,
    sourcesRetained: merged.retainedSourceIds.length,
    sourcesOverlay: merged.overlaySourceIds.length,
    prevOffers,
    catalogPath: path,
    catalogWritten: wouldWrite,
    emptyGuardHeld: !wouldWrite,
    finishedAt: new Date().toISOString(),
  };
  appendCrawlRun({ id: `${runId}-batch`, type: "crawl_batch", ...crawlBatch });

  console.log(`\n[collect:shopapi] wrote ${path}`);
  console.log(
    `[collect:shopapi] success_shops=${successShops} failed_shops=${failedShops} http502=${http502} offers_classified=${publicOffers.length}`,
  );
  console.log(
    `[collect:shopapi] merge overlay=${merged.overlaySourceIds.length} retained=${merged.retainedSourceIds.length}`,
  );
  console.log(`[collect:shopapi] crawl_batch ${JSON.stringify(crawlBatch)}`);
  console.log(`[collect:shopapi] crawl_runs → ${CRAWL_RUNS_PATH}`);
  console.log(`[collect:shopapi] catalog → ${CATALOG_PATH}`);
  console.log(`[collect:shopapi] public snapshot → ${path}`);

  if (successShops < 1) {
    fail("No shop produced offers. Check tokens / network, or use --fixture.");
  }

  await prewarmAfterCollect();
}

async function prewarmAfterCollect() {
  const base = (process.env.PREWARM_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(
    /\/$/,
    "",
  );
  if (!base) {
    console.log("[collect:shopapi] prewarm skipped (set PREWARM_BASE_URL to enable)");
    return;
  }
  const prewarm = join(root, "scripts/prewarm-catalog.mjs");
  console.log("[collect:shopapi] prewarm via", prewarm);
  const result = spawnSync(process.execPath, [prewarm], {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    shell: false,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status) {
    console.warn("[collect:shopapi] prewarm exited", result.status, "(non-fatal)");
  }
}

function safeHost(baseUrl) {
  try {
    return new URL(baseUrl).host;
  } catch {
    return String(baseUrl || "");
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
