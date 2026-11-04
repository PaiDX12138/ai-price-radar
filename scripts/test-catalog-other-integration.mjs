#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { classifyTitle, classifyCatalogTitle, seedProducts } from "../collectors/classify.mjs";
import { mergeCatalogBySourceId, reclassifyOffer, reclassifyOffersInFreshProcess } from "../collectors/persist.mjs";
import { collectKami } from "../collectors/kami.mjs";
import { collectDujiao } from "../collectors/dujiao.mjs";
import { collectPublicProductsApi } from "../collectors/jsonKinds.mjs";
import { collectMooncakeCatalog } from "../collectors/htmlKinds.mjs";
import { collectShop16688 } from "../collectors/shop16688.mjs";
import { collectShopApi } from "../collectors/shopApi.mjs";
import { verifyDetailOfferAgainstType } from "../collectors/probe-shop-url.mjs";

const root = resolve(tmpdir());
const dir = mkdtempSync(join(root, "radar-other-catalog-"));
try {
  for (const title of ["Discord 老号", "未支持的新工具订阅", "ChatGPT Pro 10x 月卡", "GPT Plus 充值定金", "ChatGPT PRO 5X/20X"]) {
    assert.equal(classifyTitle(title).productSlug, null);
    assert.equal(classifyCatalogTitle(title).productSlug, "other-product");
  }
  assert.equal(classifyCatalogTitle("GPT Plus 成品号").productSlug, "chatgpt-plus");
  assert.equal(verifyDetailOfferAgainstType({ title: "Discord 老号", platform: "other", deliveryType: "其他" }).ok, true);
  const title = "未知工具甲会员";
  const response = payload => new Response(typeof payload === "string" ? payload : JSON.stringify(payload), { status: 200 });
  const source = id => ({ id, name: id, baseUrl: "https://shop.example.com" });
  const collected = await Promise.all([
    collectKami(source("kami"), { fetchImpl: async () => response({ data: [{ id: 1, name: title, price: 3, stock: 7 }] }) }),
    collectDujiao(source("dujiao"), { fetchImpl: async () => response({ data: [{ id: 1, title, price_amount: 3, auto_stock_available: 7 }] }) }),
    collectPublicProductsApi(source("json"), { fetchImpl: async () => response([{ id: 1, name: title, price: 3, stock: 7 }]) }),
    collectMooncakeCatalog(source("html"), { fetchImpl: async () => response(`[{name:"${title}",price:3}]`) }),
    collectShop16688({ ...source("16688"), shopNo: "test" }, { shopDelayMs: 0, fetchImpl: async url => response(url.endsWith("/detail")
      ? { code: 1, data: { name: "test" } } : { code: 1, data: { list: [{ goods_no: "test1", name: title, price: 3, stock_available_quantity: 7 }] } }) }),
    collectShopApi({ ...source("shopapi"), shopToken: "fixture-test" }, { shopDelayMs: 0, pageDelayMs: 0, fetchImpl: async url => response(
      url.endsWith("/info") ? { code: 1, data: { name: "test", custom_status: 1 } } : url.endsWith("/categoryList") ? { code: 1, data: [] }
        : { code: 1, data: { list: [{ goods_key: "test1", name: title, price: 3, extend: { stock_count: 7 } }] } }) }),
  ]);
  for (const result of collected) {
    assert.equal(result.ok, true, result.error);
    assert.equal(result.offers.length, 1, result.sourceId);
    assert.equal(result.offers[0].productSlug, "other-product");
    assert.equal(result.offers[0].sourceTitle, title);
    assert.equal(result.offers[0].price, 3);
  }
  const at = "2026-11-04T04:00:00.000Z";
  const make = (id, sourceTitle, productSlug = "other-unclassified", extra = {}) => ({ id, sourceId: "shop", sourceTitle, productSlug,
    price: 3, listedPrice: 3, stockCount: 7, status: "in_stock", tags: [], warranty: false,
    capturedAt: at, lastSeenAt: at, lifecycle: "active", url: `https://shop.example.com/${id}`, ...extra });
  const offers = [make("unknown", title), make("mixed", "ChatGPT Pro 10x 月卡"),
    make("known", "GPT Plus 成品号", "chatgpt-plus"), make("gone", "未知工具乙会员", "other-unclassified", { lifecycle: "delisted", delistedAt: at }),
    make("old", "未知工具丙会员", "other-unclassified", { capturedAt: "2020-01-01T00:00:00Z", lastSeenAt: "2020-01-01T00:00:00Z" })];
  const slugs = new Set(seedProducts().map(product => product.slug));
  const merged = mergeCatalogBySourceId({ previous: null, batchSuccess: [{ sourceId: "shop", sourceMeta: { id: "shop", name: "店铺甲" }, offers }] });
  assert.equal(merged.offers.filter(offer => slugs.has(offer.productSlug)).length, offers.length);
  assert.equal(merged.sources.length, 1, "unknown-only sources must not be lost");
  const fresh = reclassifyOffersInFreshProcess(offers);
  assert.equal(fresh.offers.length, offers.length, "fresh worker must not drop unresolved titles");
  for (let i = 0; i < offers.length; i++) {
    const { productSlug, ...before } = offers[i];
    const { productSlug: nextSlug, ...after } = fresh.offers[i];
    assert.ok(productSlug && nextSlug);
    assert.deepEqual(after, before, "preserve price/stock/lifecycle/timestamps and do not add markers");
  }
  assert.equal(reclassifyOffer(make("new", "GPT Plus 成品号", "other-product")).productSlug, "chatgpt-plus", "later rules must move goods out of Other");
  assert.equal(reclassifyOffer(make("future", title, "other-product"), {
    classifyTitle: () => ({ productSlug: "chatgpt-plus", warranty: false }), LEGACY_PRODUCT_SLUG_MAP: {},
  }).productSlug, "chatgpt-plus", "a later matching rule must move the same original title out of Other");

  const catalogDir = join(dir, "data", "catalog");
  const rawDir = join(dir, "raw");
  mkdirSync(catalogDir, { recursive: true }); mkdirSync(rawDir);
  const path = join(catalogDir, "public.json");
  const original = { generatedAt: at, mode: "live", isDemo: false, stats: { sourcesSuccess: 1 }, products: seedProducts(),
    sources: [{ id: "shop", name: "店铺甲", platform: "kami", host: "shop.example.com" }], offers };
  const writeRaw = (sid, rawOffers, result = { ok: true }) => writeFileSync(join(rawDir, `${sid}.json`), JSON.stringify({
    source: { id: sid, name: sid === "new-shop" ? "全未分类店" : sid, kind: "kami", baseUrl: "https://shop.example.com", shopToken: "private-test" },
    capturedAt: at, result, offers: rawOffers,
  }));
  writeRaw("shop", [make("unknown", title, "other-unclassified", { price: 0.01 }), make("recovered", "未知工具丁会员"), make("gone", "未知工具乙会员")]);
  writeRaw("new-shop", [make("new-shop-item", "未知工具戊会员", "other-unclassified", { sourceId: "new-shop", goodsKey: "private-key-test" })]);
  for (const sid of ["failed", "withdrawn", "fixture-ignore"]) writeRaw(sid, [make(`${sid}-item`, "未知工具", "other-unclassified", { sourceId: sid })], sid === "failed" ? { ok: false } : sid === "withdrawn" ? { ok: true, withdrawDisplay: true } : { ok: true });
  // Different raw filenames for one source: an old successful file must not bypass a newer withdrawal.
  writeFileSync(join(rawDir, "withdrawn-old.json"), JSON.stringify({ source: { id: "withdrawn", kind: "kami" },
    capturedAt: "2026-11-03T00:00:00Z", result: { ok: true }, offers: [make("withdrawn-old", title, "other-unclassified", { sourceId: "withdrawn" })] }));
  writeFileSync(path, JSON.stringify(original));
  const cli = fileURLToPath(new URL("./recover-catalog-other.mjs", import.meta.url));
  const run = (apply = false) => {
    const result = spawnSync(process.execPath, [cli, "--snapshot", path, "--raw-dir", rawDir, ...(apply ? ["--apply"] : [])], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout);
  };
  const text = readFileSync(path, "utf8");
  assert.equal(run().results[0].recovered, 2);
  assert.equal(readFileSync(path, "utf8"), text, "preview must not write");
  assert.equal(run(true).results[0].recovered, 2);
  assert.equal(run(true).results[0].recovered, 0, "recovery is idempotent");
  const repaired = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(repaired.generatedAt, at);
  assert.equal(repaired.offers.find(o => o.id === "unknown").price, 3, "raw must never replace an existing fact");
  assert.equal(repaired.offers.find(o => o.id === "gone").lifecycle, "delisted", "raw must never resurrect a delisted item");
  assert.equal(repaired.offers.length, offers.length + 2);
  assert.equal(repaired.sources.length, 2);
  assert.equal(JSON.stringify(repaired).includes("private-test"), false);
  assert.equal(JSON.stringify(repaired).includes("private-key-test"), false);
  assert.deepEqual(readdirSync(catalogDir), ["public.json"], "no backup or leftover temp files");

  for (const [name, url] of [["store", "../src/lib/catalog/store.ts"], ["format", "../src/lib/catalog/format.ts"],
    ["queries", "../src/lib/catalog/queries.ts"], ["demo", "../src/data/demo/catalog.ts"]]) {
    const sourceText = readFileSync(new URL(url, import.meta.url), "utf8").replaceAll("@/data/demo/catalog", "./demo.mjs")
      .replace(/@\/lib\/catalog\/([^"\n]+)/g, "./$1.mjs");
    writeFileSync(join(dir, `${name}.mjs`), ts.transpileModule(sourceText, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText);
  }
  // Verify legacy read-side compatibility too, without relying on migration first.
  writeFileSync(path, JSON.stringify({ ...repaired, products: repaired.products.filter(p => p.slug !== "other-product"),
    offers: repaired.offers.map(o => o.id === "unknown" ? { ...o, productSlug: "other-unclassified" } : o.id === "mixed" ? { ...o, productSlug: "obsolete-plan" } : o) }));
  const cwd = process.cwd(), now = Date.now;
  process.chdir(dir); Date.now = () => Date.parse(at) + 60_000;
  try {
    const ui = await import(pathToFileURL(join(dir, "queries.mjs")).href);
    assert.ok(ui.getProduct("other-product"));
    assert.deepEqual(new Set(ui.getOffersForProduct("other-product").map(o => o.id)), new Set(["unknown", "mixed", "recovered", "new-shop-item"]));
    assert.equal(ui.getOffersForProduct("chatgpt-plus").length, 1);
    const other = ui.listProductSummaries("other").find(p => p.slug === "other-product");
    assert.equal(other.channelCount, 4); assert.equal(other.inStockCount, 4); assert.equal(other.lowestPrice, 3);
    assert.equal(ui.filterProductSummaries("other", { q: "未知工具丁" })[0].slug, "other-product");
    assert.equal(ui.filterProductSummaries("other", { q: "全未分类店" })[0].slug, "other-product");
    assert.equal(JSON.stringify(ui.getOffersForProduct("other-product")).includes("classificationPending"), false);
  } finally { Date.now = now; process.chdir(cwd); }
  console.log("PASS Other catalog: 6 collectors, unknown-only shops, no-drop fresh worker, additive raw recovery, legacy UI, title/shop search, lifecycle, no markers/private fields");
} finally {
  const inside = relative(root, resolve(dir));
  if (inside && !isAbsolute(inside) && !inside.startsWith("..") && basename(dir).startsWith("radar-other-catalog-")) rmSync(dir, { recursive: true, force: true });
}
