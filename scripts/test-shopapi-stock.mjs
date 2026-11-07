#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { collectShopApi } from "../collectors/shopApi.mjs";
import { verifyMissingShopApiOffers } from "../collectors/offer-lifecycle.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const tempRoot = resolve(tmpdir());
const dir = mkdtempSync(join(tempRoot, "radar-shopapi-stock-"));
const at = "2026-11-07T09:41:24.290Z";
const atMs = Date.parse(at);
const hour = 60 * 60 * 1000;
const source = { id: "stock-shop", name: "库存回归店", platform: "liandong", collectorKind: "shopApi", baseUrl: "https://shop.example.com", shopToken: "fixture-stock-only" };
const items = [
  { name: "codex破甲兑换卡 - 质保后续更新升级", price: 68, goods_key: "stock38", extend: { stock_count: 38, show_stock_type: 0 } },
  { name: "Codex/Cursor破甲合卡 - 质保后续更新升级", price: 118, goods_key: "stock40", extend: { stock_count: "40", show_stock_type: 0 } },
  { name: "ChatGPT Plus 成品号", price: 20, goods_key: "empty", extend: { stock_count: 0 } },
  { name: "ChatGPT Plus 月卡", price: 25, goods_key: "low", extend: { stock_count: "3" } },
  { name: "ChatGPT Plus 成品号 已下架", price: 1, goods_key: "disabled", status: 0, extend: { stock_count: 99 } },
].map(item => ({ goods_type: "card", category: { name: "研发工具" }, ...item }));
const response = payload => new Response(JSON.stringify(payload), { status: 200 });
const fetchImpl = async (url, init) => {
  const body = JSON.parse(init.body);
  if (url.endsWith("/info")) return response({ code: 1, data: { nickname: source.name, custom_status: 1 } });
  if (url.endsWith("/categoryList")) return response({ code: 1, data: [{ id: 1, goods_count: items.length }] });
  assert.ok(url.endsWith("/goodsList"));
  return response({ code: 1, data: { total: items.length, list: body.current === 1 ? items : [] } });
};

try {
  const result = await collectShopApi(source, { fetchImpl, pageDelayMs: 0, shopDelayMs: 0 });
  assert.equal(result.ok, true); assert.equal(result.collectionComplete, true);
  assert.deepEqual(result.offers.map(o => o.stockCount), [38, 40, 0, 3, 0]);
  assert.deepEqual(result.offers.map(o => o.status), ["in_stock", "in_stock", "out_of_stock", "low_stock", "out_of_stock"]);
  assert.equal(result.offers.at(-1).lifecycle, "delisted");
  result.offers = result.offers.map(o => ({ ...o, capturedAt: at, lastVerifiedAt: at }));

  // Exercise the actual raw + aggregate writers, rooted in an isolated sandbox.
  const persistText = readFileSync(new URL("../collectors/persist.mjs", import.meta.url), "utf8")
    .replace(/from "(\.\/[^"]+)"/g, (_, path) => `from "${new URL(path, new URL("../collectors/persist.mjs", import.meta.url)).href}"`)
    .replace('const root = join(dirname(fileURLToPath(import.meta.url)), "..");', `const root = ${JSON.stringify(dir)};`)
    .replace('const RECLASSIFY_SCRIPT = join(root, "scripts", "reclassify-offers-once.mjs");',
      `const RECLASSIFY_SCRIPT = ${JSON.stringify(join(root, "scripts", "reclassify-offers-once.mjs"))};`);
  writeFileSync(join(dir, "persist.mjs"), persistText);
  const persist = await import(pathToFileURL(join(dir, "persist.mjs")).href);
  assert.equal(persist.DATA_DIR, join(dir, "data"), "all persistence tests must stay inside the sandbox");
  persist.writeRawSource(source.id, { source, result: { ok: true }, capturedAt: at, offers: result.offers });
  const rawBefore = readFileSync(join(dir, "data/raw", source.id + ".json"), "utf8");
  assert.equal(JSON.parse(rawBefore).offers[0].lastSeenAt, at);
  persist.writeRawSource(source.id, { source, result: { ok: false }, capturedAt: "2026-11-07T12:00:00Z", offers: [] });
  assert.equal(readFileSync(join(dir, "data/raw", source.id + ".json"), "utf8"), rawBefore, "failed collection cannot rewrite last-good stock or timestamps");
  const merged = persist.mergeCatalogBySourceId({ previous: null, rawLastGood: persist.loadRawLastGoodBySourceId(join(dir, "data/raw")), batchSuccess: [] });
  await persist.writeCatalogSnapshot({ generatedAt: at, mode: "live", isDemo: false, stats: { sourcesSuccess: 1 }, sources: merged.sources, offers: merged.offers });
  const publicSnapshot = JSON.parse(readFileSync(join(dir, "data/catalog/public.json"), "utf8"));
  assert.deepEqual(publicSnapshot.offers.map(o => o.stockCount), [38, 40, 0, 3, 0]);
  assert.equal(publicSnapshot.offers[0].lastSeenAt, at);
  assert.equal(publicSnapshot.offers[0].lifecycle, "active");
  assert.equal(publicSnapshot.offers[0].price, 68);
  assert.equal(readFileSync(join(dir, "data/catalog/latest.json"), "utf8"), readFileSync(join(dir, "data/catalog/public.json"), "utf8"));

  // Run read-side queries without the Next runtime or touching real catalog files.
  for (const [name, path] of [["format", "../src/lib/catalog/format.ts"], ["queries", "../src/lib/catalog/queries.ts"],
    ["store", "../src/lib/catalog/store.ts"], ["demo", "../src/data/demo/catalog.ts"]]) {
    const text = readFileSync(new URL(path, import.meta.url), "utf8").replaceAll("@/data/demo/catalog", "./demo.mjs")
      .replace(/@\/lib\/catalog\/([^"\n]+)/g, "./$1.mjs");
    writeFileSync(join(dir, name + ".mjs"), ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText);
  }
  const format = await import(pathToFileURL(join(dir, "format.mjs")).href);
  const offer = publicSnapshot.offers[0];
  assert.equal(format.isOfferLive(offer, atMs + 3 * hour), true, "screenshot: 38/40 stock must not disappear after 2 hours");
  assert.equal(format.isOfferStale(offer, atMs + 3 * hour), true, "show update warning separately");
  assert.equal(format.isOfferLive(offer, atMs + 24 * hour), true);
  assert.equal(format.isOfferLive(offer, atMs + 24 * hour + 1), false);
  assert.equal(format.isOfferVisible(offer, atMs + 24 * hour + 1), false);
  assert.equal(format.isOfferLive({ ...offer, lifecycle: "pending", lastVerifiedAt: new Date(atMs + hour).toISOString() }, atMs + hour), false);
  assert.equal(format.isOfferLive({ ...offer, lifecycle: "delisted" }, atMs), false);
  assert.equal(format.isOfferLive({ ...offer, lastSeenAt: "invalid" }, atMs), false);
  assert.equal(format.isOfferStale({ ...offer, source: { collectStatus: "failed" } }, atMs), true);

  const cwd = process.cwd(), now = Date.now;
  process.chdir(dir); Date.now = () => atMs + 3 * hour;
  try {
    const queries = await import(pathToFileURL(join(dir, "queries.mjs")).href);
    const bundle = { ...publicSnapshot, isDemo: false };
    const product = bundle.products.find(p => p.slug === offer.productSlug);
    const summary = queries.summarizeProduct(product, bundle, bundle.offers.slice(0, 2));
    assert.equal(summary.inStockCount, 2); assert.equal(summary.lowestPrice, 68);
    assert.equal(summary.nonWarrantyAvailability, "in_stock"); assert.equal(summary.warrantyAvailability, "unavailable");
    assert.equal(queries.filterProductSummaries("chatgpt", { q: source.name }).find(p => p.slug === product.slug).inStockCount, 2);
    assert.deepEqual(queries.getOffersForProduct(product.slug).map(o => o.stockCount), [38, 40]);
    const pending = { ...offer, lifecycle: "pending" };
    const pendingSummary = queries.summarizeProduct(product, bundle, [pending]);
    assert.equal(pendingSummary.inStockCount, 0); assert.equal(pendingSummary.outStockCount, 0);
    assert.equal(pendingSummary.nonWarrantyAvailability, "unconfirmed"); assert.equal(pendingSummary.lowestPrice, null);
    assert.equal(queries.summarizeProduct(product, bundle, [{ ...pending, status: "out_of_stock" }]).nonWarrantyAvailability, "unconfirmed", "old empty-stock data plus missing listing is not confirmed sold out");
    assert.equal(queries.summarizeProduct(product, bundle, [bundle.offers[2]]).nonWarrantyAvailability, "out_of_stock");
    const mixed = queries.summarizeProduct(product, bundle, [bundle.offers[2], pending]);
    assert.equal(mixed.nonWarrantyAvailability, "unconfirmed", "a missing channel prevents claiming the whole group sold out");
    assert.equal(queries.summarizeProduct(product, bundle, [{ ...pending, warranty: true }]).warrantyAvailability, "unconfirmed");
    const failedBundle = { ...bundle, sources: bundle.sources.map(source => ({ ...source, collectStatus: "failed" })) };
    const failedSummary = queries.summarizeProduct(product, failedBundle, [offer]);
    assert.equal(failedSummary.nonWarrantyAvailability, "unconfirmed");
    assert.equal(failedSummary.lowestPrice, null, "failed channels must not compete for the current minimum price");
    assert.equal(failedSummary.outStockCount, 0, "failed channels are not sold out");
    assert.equal(queries.summarizeProduct(product, failedBundle, [bundle.offers[2]]).nonWarrantyAvailability, "unconfirmed");
  } finally { Date.now = now; process.chdir(cwd); }

  const detailResult = { ok: true, collectionComplete: true, resolvedBase: source.baseUrl, offers: [] };
  await verifyMissingShopApiOffers([offer], detailResult, { fetchImpl: async () => response({ code: 1, data: { status: 1, name: offer.sourceTitle, price: 68, extend: { limit_count: 1 } } }) });
  assert.equal(detailResult.offers[0].lifecycle, "pending", "goodsInfo listing status without stock cannot prove availability");
  assert.equal(detailResult.offers[0].lastSeenAt, at, "a detail check without stock must not refresh the stock observation");
  assert.equal(detailResult.offers[0].capturedAt, at);
  console.log("PASS ShopApi stock: list -> raw -> public/latest -> search/summary; 38/40 stock after 2h; 24h cutoff; explicit empty/low/delisted; failed/pending/detail-without-stock do not forge confirmation");
} finally {
  const inside = relative(tempRoot, resolve(dir));
  if (inside && !isAbsolute(inside) && !inside.startsWith("..") && basename(dir).startsWith("radar-shopapi-stock-")) rmSync(dir, { recursive: true, force: true });
}
