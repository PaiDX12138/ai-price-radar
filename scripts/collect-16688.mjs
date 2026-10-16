#!/usr/bin/env node
/**
 * 16688 collector CLI.
 * Usage:
 *   pnpm collect:16688 -- --all
 *   pnpm collect:16688 -- --source 16688-s687067
 *   pnpm collect:16688 -- --limit 20 --offset 0
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { seedProducts } from "../collectors/classify.mjs";
import { createProxiedFetch, describeCollectorProxy } from "../collectors/http-proxy.mjs";
import {
  appendCrawlRun,
  CATALOG_PATH,
  CRAWL_RUNS_PATH,
  loadCatalogSnapshot,
  loadRawLastGoodBySourceId,
  mergeCatalogBySourceId,
  writeCatalogSnapshot,
  writeRawSource,
} from "../collectors/persist.mjs";
import { sanitizeShopDisplayName } from "../collectors/sanitize-shop-name.mjs";
import { collectShop16688 } from "../collectors/shop16688.mjs";
import {
  listShops,
  requireShopsDb,
  shopRowToCollectTarget,
  updateShopProbeHealth,
} from "../collectors/shops-db.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  console.error(`[collect:16688] ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { all: false, source: null, limit: null, offset: 0, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--all") out.all = true;
    else if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--source") out.source = argv[++i] || null;
    else if (arg?.startsWith("--source=")) out.source = arg.slice(9);
    else if (arg === "--limit") out.limit = Number(argv[++i]);
    else if (arg?.startsWith("--limit=")) out.limit = Number(arg.slice(8));
    else if (arg === "--offset") out.offset = Number(argv[++i]);
    else if (arg?.startsWith("--offset=")) out.offset = Number(arg.slice(9));
  }
  return out;
}

function loadSources() {
  let db;
  try {
    db = requireShopsDb();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  return listShops(db, { collectorKind: "shop16688", enabled: true }).map(shopRowToCollectTarget);
}

function safeHost(baseUrl) {
  try {
    return new URL(baseUrl).host;
  } catch {
    return "www.16688.com.cn";
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:
  pnpm collect:16688 -- --all
  pnpm collect:16688 -- --source 16688-s687067
  pnpm collect:16688 -- --limit 20 --offset 0`);
    process.exit(0);
  }

  let enabled = loadSources().filter((s) => s && (s.shopNo || s.shopToken));
  if (args.source) {
    enabled = enabled.filter((s) => s.id === args.source);
    if (!enabled.length) fail(`No enabled source id=${args.source}`);
  }
  const poolSize = enabled.length;
  const offset = args.offset || 0;
  const sources =
    args.limit != null ? enabled.slice(offset, offset + args.limit) : enabled.slice(offset);
  if (!sources.length) fail("No sources after filters. Run `pnpm shops:migrate` first.");

  const fetchImpl = createProxiedFetch();
  const shopsDb = requireShopsDb();
  console.log(
    `[collect:16688] sources=${sources.length} pool=${poolSize}` +
      (args.limit != null ? ` limit=${args.limit}` : "") +
      (offset ? ` offset=${offset}` : "") +
      ` proxy=${describeCollectorProxy()}`,
  );

  const runId = `run16688-${Date.now()}`;
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

  for (const source of sources) {
    console.log(`\n==> ${source.id} shop_no=${source.shopNo || source.shopToken}`);
    const result = await collectShop16688(source, { fetchImpl });
    const finishedAt = new Date().toISOString();
    const withdraw = Boolean(result.withdrawDisplay);
    const run = {
      id: `${runId}-${source.id}`,
      runId,
      sourceId: source.id,
      status: result.ok ? "success" : "failed",
      offerCount: result.offers.length,
      message: withdraw
        ? `withdraw:${result.withdrawReason || result.displayState || "closed"}`
        : result.ok
          ? `collected ${result.offers.length} offers`
          : result.error,
      startedAt,
      finishedAt,
    };
    crawlRuns.push(run);
    appendCrawlRun(run);
    writeRawSource(
      source.id,
      {
        source,
        result: {
          ok: result.ok,
          error: result.error,
          meta: result.meta,
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

    if (withdraw) withdrawSourceIds.push(source.id);

    if (result.ok) {
      successShops += 1;
      console.log(
        `  ok offers=${result.offers.length} shop=${result.meta?.shopName || source.name || "?"}`,
      );
      if (result.offers.length > 0 && !withdraw) {
        batchSuccess.push({
          sourceId: source.id,
          sourceMeta: {
            id: source.id,
            name: sanitizeShopDisplayName(result.meta?.shopName || source.name || source.id),
            platform: "shop16688",
            collectorKind: "shop16688",
            host: safeHost(source.baseUrl || "https://www.16688.com.cn"),
            listedAt: source.listedAt || undefined,
          },
          offers: result.offers,
        });
        batchOffersRaw.push(...result.offers);
      }
      updateShopProbeHealth(shopsDb, source.id, { ok: true, at: finishedAt });
    } else {
      failedShops += 1;
      const tag = withdraw ? " (withdraw display)" : "";
      console.log(`  FAIL: ${result.error}${tag}`);
      updateShopProbeHealth(shopsDb, source.id, {
        ok: false,
        error: result.error,
        at: finishedAt,
      });
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
  const products = seedProducts();
  const seedSlugs = new Set(products.map((p) => p.slug));
  const publicOffers = merged.offers
    .filter((o) => seedSlugs.has(o.productSlug))
    .map(({ goodsKey, classified, ...rest }) => rest);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    mode: "live",
    isDemo: false,
    runId,
    stats: {
      sourcesAttempted: sources.length,
      sourcesSuccess: successShops,
      sourcesFailed: failedShops,
      offersRaw: batchOffersRaw.length,
      offersClassified: publicOffers.length,
      sourcesRetained: merged.retainedSourceIds.length,
      sourcesOverlay: merged.overlaySourceIds.length,
    },
    sources: merged.sources,
    products,
    offers: publicOffers,
    crawlRuns,
  };

  const path = await writeCatalogSnapshot(snapshot);
  console.log(`\n[collect:16688] wrote ${path}`);
  console.log(
    `[collect:16688] success=${successShops} failed=${failedShops} offers_classified=${publicOffers.length}`,
  );
  console.log(`[collect:16688] catalog → ${CATALOG_PATH}`);
  console.log(`[collect:16688] crawl_runs → ${CRAWL_RUNS_PATH}`);

  if (successShops < 1) fail("No shop produced offers.");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
