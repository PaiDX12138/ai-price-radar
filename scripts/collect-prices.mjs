#!/usr/bin/env node
/**
 * 卡网全 kind 采集（对照 参考站 collectors.json）。
 * 默认采集非 shopApi（kami/dujiao/API/HTML…）；ShopApi 店铺仍用 collect:shopapi（需 token）。
 *
 * Usage:
 *   pnpm collect:prices -- --all
 *   pnpm collect:prices -- --kind kami
 *   pnpm collect:prices -- --kind dujiao --limit 5
 *   pnpm collect:prices -- --source kami-aisou.pro
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { seedProducts } from "../collectors/classify.mjs";
import { collectByKind } from "../collectors/dispatch.mjs";
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
import { syncHostFavicons } from "../collectors/favicon.mjs";
import {
  listShops,
  requireShopsDb,
  shopRowToCollectTarget,
  updateShopProbeHealth,
} from "../collectors/shops-db.mjs";
import { delay, hostOf } from "../collectors/util.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  console.error(`[collect:prices] ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = {
    all: false,
    kind: null,
    source: null,
    limit: null,
    offset: 0,
    includeShopApi: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--all") out.all = true;
    else if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--include-shopapi") out.includeShopApi = true;
    else if (arg === "--kind") {
      out.kind = argv[++i] || null;
    } else if (arg?.startsWith("--kind=")) out.kind = arg.slice(7);
    else if (arg === "--source") out.source = argv[++i] || null;
    else if (arg?.startsWith("--source=")) out.source = arg.slice(9);
    else if (arg === "--limit") out.limit = Number(argv[++i]);
    else if (arg?.startsWith("--limit=")) out.limit = Number(arg.slice(8));
    else if (arg === "--offset") out.offset = Number(argv[++i]);
    else if (arg?.startsWith("--offset=")) out.offset = Number(arg.slice(9));
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.all && !args.kind && !args.source)) {
    console.log(`Usage:
  pnpm collect:prices -- --all
  pnpm collect:prices -- --kind kami
  pnpm collect:prices -- --kind dujiao --limit 5
  pnpm collect:prices -- --source kami-aisou.pro`);
    process.exit(args.help ? 0 : 1);
  }

  let db;
  try {
    db = requireShopsDb();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  /** @type {any[]} */
  let targets;
  if (args.includeShopApi) {
    targets = listShops(db, { enabled: true }).map(shopRowToCollectTarget);
  } else {
    targets = listShops(db, {
      enabled: true,
      excludeKinds: ["shopApi", "shop16688"],
    }).map(shopRowToCollectTarget);
  }
  if (args.kind) {
    targets = targets.filter((t) => t.kind === args.kind || t.collectorKind === args.kind);
  }
  if (args.source) {
    targets = targets.filter((t) => t.id === args.source);
    if (!targets.length) fail(`No target id=${args.source}`);
  }
  const offset = args.offset || 0;
  const pool = targets.length;
  targets =
    args.limit != null ? targets.slice(offset, offset + args.limit) : targets.slice(offset);
  if (!targets.length) fail("No targets after filters. Run `pnpm shops:migrate` first.");

  console.log(
    `[collect:prices] targets=${targets.length}/${pool}` +
      (args.kind ? ` kind=${args.kind}` : "") +
      (args.includeShopApi ? " includeShopApi" : ""),
  );

  const runId = `prices-${Date.now()}`;
  const startedAt = new Date().toISOString();
  /** @type {any[]} */
  const batchSuccess = [];
  /** @type {string[]} */
  const withdrawSourceIds = [];
  /** @type {any[]} */
  const crawlRuns = [];
  let success = 0;
  let failed = 0;
  let offersRaw = 0;
  const hostDelay = Number(process.env.COLLECTOR_HOST_DELAY_MS || 1200);

  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    if (i > 0 && hostDelay > 0) await delay(hostDelay);
    console.log(`\n==> [${target.kind}] ${target.id} @ ${target.baseUrl}`);
    const result = await collectByKind(target, {});
    const finishedAt = new Date().toISOString();
    const withdraw = Boolean(result.withdrawDisplay);
    const run = {
      id: `${runId}-${target.id}`,
      runId,
      sourceId: target.id,
      kind: target.kind,
      status: result.ok ? "success" : "failed",
      offerCount: result.offers?.length || 0,
      message: withdraw
        ? `withdraw:${result.withdrawReason || result.displayState || "closed"}`
        : result.ok
          ? `collected ${result.offers.length}`
          : result.error,
      startedAt,
      finishedAt,
    };
    crawlRuns.push(run);
    appendCrawlRun(run);
    writeRawSource(
      target.id,
      {
        source: target,
        result: {
          ok: result.ok,
          error: result.error,
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

    if (withdraw) withdrawSourceIds.push(target.id);

    if (result.ok && (result.offers?.length || 0) > 0 && !withdraw) {
      success += 1;
      offersRaw += result.offers.length;
      console.log(`  ok offers=${result.offers.length}`);
      batchSuccess.push({
        sourceId: target.id,
        sourceMeta: {
          id: target.id,
          name: target.name,
          platform: target.platform,
          collectorKind: target.kind,
          host: target.host || hostOf(target.baseUrl),
          listedAt: target.listedAt || undefined,
        },
        offers: result.offers,
      });
      updateShopProbeHealth(db, target.id, { ok: true, at: finishedAt });
    } else if (result.ok) {
      success += 1;
      const tag = withdraw ? ` withdraw=${result.withdrawReason || result.displayState}` : "";
      console.log(`  ok offers=0${tag}`);
      updateShopProbeHealth(db, target.id, { ok: true, at: finishedAt });
    } else {
      failed += 1;
      const tag = withdraw ? " (withdraw display)" : "";
      console.log(`  FAIL: ${result.error}${tag}`);
      updateShopProbeHealth(db, target.id, {
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
    mode: "live-prices",
    isDemo: false,
    runId,
    stats: {
      sourcesAttempted: targets.length,
      sourcesSuccess: success,
      sourcesFailed: failed,
      offersRaw,
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
  console.log(`\n[collect:prices] wrote ${path}`);
  console.log(
    `[collect:prices] success=${success} failed=${failed} offersRaw=${offersRaw} classified=${publicOffers.length}`,
  );
  console.log(`[collect:prices] crawl_runs → ${CRAWL_RUNS_PATH}`);
  console.log(`[collect:prices] catalog → ${CATALOG_PATH}`);

  // 自建站 favicon：采集后自动拉浏览器图标，Kami/独角/平台店跳过
  try {
    const fav = await syncHostFavicons(snapshot.sources, { force: false, concurrency: 3 });
    console.log(
      `[collect:prices] favicons hosts=${fav.hosts} saved=${fav.saved}`,
    );
  } catch (error) {
    console.warn(`[collect:prices] favicon sync skipped: ${error?.message || error}`);
  }

  if (success < 1 && batchSuccess.length < 1) {
    fail("No source produced offers. Check network / kind filters.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
