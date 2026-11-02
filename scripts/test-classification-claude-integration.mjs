#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, relative, isAbsolute, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { seedProducts } from "../collectors/classify.mjs";
import { reclassifyOffersInFreshProcess } from "../collectors/persist.mjs";

// Exercise migration + the real frontend queries, not a duplicate aggregation implementation.
const scratchRoot = resolve(tmpdir());
const dir = mkdtempSync(join(scratchRoot, "radar-claude-classify-"));
try {
const catalogDir = join(dir, "data", "catalog");
mkdirSync(catalogDir, { recursive: true });
const path = join(catalogDir, "public.json");
const cli = fileURLToPath(new URL("./reclassify-catalog-snapshot.mjs", import.meta.url));
const at = "2026-11-02T10:37:00.000Z";
const make = (id, title, price, slug = "claude-pro-month", lifecycle = "active") => ({
  id, sourceId: id, sourceTitle: title, productSlug: slug, price, status: "in_stock",
  stockCount: 995, capturedAt: at, lastSeenAt: at, lifecycle, lifecycleReason: "test",
  delistedAt: lifecycle === "delisted" ? at : null, tags: [], warranty: false,
  url: `https://shop.example.com/${id}`,
});
const offers = [
  ...[0.2, 1, 5, 10, 20].map((amount) => make(`multi-${amount}`,
    `耀耀中转站 ${amount}USD 【永不过期】0.1不降智6a，claude，codex plus/pro大模型API卡密`, amount)),
  make("pure", "Claude Pro API卡密 独享", 0.1),
  make("max-api", "Claude Max 20x API KEY 质保订阅", 0.3, "claude-max-20x"),
  make("pro", "Claude Pro-二人车", 50),
  make("pro-warranty", "Claude Pro 官方充值月卡 质保订阅30天", 134),
  make("max-account", "Claude Max 20x 号池专供账号", 600, "claude-max-20x"),
  make("pure-old", "Claude中转站", 0.4, "chatgpt-mirror"),
  make("gone", "Claude Pro API额度 月卡", 0.01, "claude-pro-month", "delisted"),
  // A separate pre-existing classification defect must not be changed by --platform claude.
  make("unrelated", "ChatGPT Plus 成品号", 18, "chatgpt-free-account"),
];
const original = { generatedAt: at, mode: "live", isDemo: false,
  stats: { sourcesSuccess: offers.length }, products: seedProducts(), offers,
  sources: offers.map(({ id }) => ({ id, name: id, platform: "liandong", host: "shop.example.com" })),
};
const input = JSON.stringify(original);
writeFileSync(path, input);
const run = (apply = false, platform = "claude") => {
  const result = spawnSync(process.execPath,
    [cli, "--snapshot", path, "--platform", platform, ...(apply ? ["--apply"] : [])], { encoding: "utf8" });
  return result;
};
const success = (apply = false) => {
  const result = run(apply);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};
assert.notEqual(run(true, "invalid-platform").status, 0);
assert.equal(success().results[0].changed, 10);
assert.equal(readFileSync(path, "utf8"), input, "dry-run must not write");
assert.equal(readdirSync(catalogDir).length, 1);
const applied = success(true);
assert.ok(applied.results[0].backup);
assert.equal(readFileSync(applied.results[0].backup, "utf8"), input);
const snapshot = JSON.parse(readFileSync(path, "utf8"));
assert.equal(snapshot.generatedAt, at, "classification is not a new price confirmation");
assert.deepEqual(snapshot.sources, original.sources);
assert.equal(snapshot.offers.length, original.offers.length);
for (let i = 0; i < offers.length; i++) {
  const { productSlug: oldSlug, warranty: oldWarranty, ...before } = offers[i];
  const { productSlug, warranty, ...after } = snapshot.offers[i];
  assert.ok(oldSlug && productSlug && typeof oldWarranty === "boolean" && typeof warranty === "boolean");
  assert.deepEqual(after, before, "preserve stock/price/IDs/lifecycle/timestamps");
}
assert.deepEqual(snapshot.offers.at(-1), offers.at(-1), "do not reclassify unrelated platforms");
assert.equal(success(true).results[0].changed, 0, "idempotent");

// Same fresh-process path used by long-running workers when publishing their snapshots.
const fresh = reclassifyOffersInFreshProcess(offers.slice(0, 11));
assert.deepEqual(fresh.offers.map((offer) => offer.productSlug), snapshot.offers.slice(0, 11).map((offer) => offer.productSlug));

for (const [name, url] of [
  ["store", "../src/lib/catalog/store.ts"], ["format", "../src/lib/catalog/format.ts"],
  ["queries", "../src/lib/catalog/queries.ts"], ["demo", "../src/data/demo/catalog.ts"],
]) {
  const source = readFileSync(new URL(url, import.meta.url), "utf8")
    .replaceAll("@/data/demo/catalog", "./demo.mjs")
    .replace(/@\/lib\/catalog\/([^"\n]+)/g, "./$1.mjs");
  writeFileSync(join(dir, `${name}.mjs`), ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText);
}
const cwd = process.cwd();
const realNow = Date.now;
process.chdir(dir);
Date.now = () => Date.parse(at) + 30 * 60 * 1000;
try {
  const ui = await import(pathToFileURL(join(dir, "queries.mjs")).href);
  assert.deepEqual(new Set(ui.getOffersForProduct("claude-pro-month").map(({ id }) => id)), new Set(["pro", "pro-warranty"]));
  const summary = (slug, platform) => ui.listProductSummaries(platform).find((p) => p.slug === slug);
  const pro = summary("claude-pro-month", "claude");
  assert.equal(pro.lowestPrice, 50, "API credit must not determine Pro minimum");
  assert.equal(pro.nonWarrantyLowestPrice, 50);
  assert.equal(pro.warrantyLowestPrice, 134);
  assert.equal(pro.channelCount, 2);
  assert.equal(pro.inStockCount, 2);
  const max = summary("claude-max-20x", "claude");
  assert.equal(max.lowestPrice, 600);
  assert.equal(max.warrantyLowestPrice, null, "API marketing must not set Max warranty minimum");
  assert.equal(max.channelCount, 1);
  const claudeTransit = summary("claude-mirror", "claude");
  assert.equal(claudeTransit.lowestPrice, 0.1, "delisted credit must not be resurrected");
  assert.equal(claudeTransit.channelCount, 3);
  const multi = summary("chatgpt-mirror", "chatgpt");
  assert.equal(multi.lowestPrice, 0.2);
  assert.equal(multi.channelCount, 5);
} finally { Date.now = realNow; process.chdir(cwd); }
console.log("PASS Claude integration: screenshot offers, scoped migration, backup, idempotence, fresh worker, original fields preserved, real UI minima/channel/stock counts");
} finally {
  const inside = relative(scratchRoot, resolve(dir));
  if (inside && !isAbsolute(inside) && !inside.startsWith("..") && basename(dir).startsWith("radar-claude-classify-")) {
    rmSync(dir, { recursive: true, force: true });
  }
}
