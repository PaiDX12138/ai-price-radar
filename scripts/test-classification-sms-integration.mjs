import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { seedProducts } from "../collectors/classify.mjs";

// Isolated snapshot + actual reclassification CLI + actual frontend query modules.
const dir = mkdtempSync(join(tmpdir(), "radar-sms-classify-"));
mkdirSync(join(dir, "data", "catalog"), { recursive: true });
const path = join(dir, "data", "catalog", "public.json");
const cli = fileURLToPath(new URL("./reclassify-catalog-snapshot.mjs", import.meta.url));
const at = "2026-10-27T00:00:00.000Z";
const make = (id, title, price, lifecycle = "active") => ({ id, sourceId: id,
  sourceTitle: title, productSlug: "chatgpt-plus", price, status: "in_stock",
  stockCount: 17, capturedAt: at, lastSeenAt: at, lifecycle, lifecycleReason: "test",
  delistedAt: lifecycle === "delisted" ? at : null, tags: [], warranty: false,
  url: `https://shop.example.com/${id}`,
});
const original = { generatedAt: at, mode: "live", isDemo: false, stats: { sourcesSuccess: 3 },
  products: seedProducts(), offers: [
    make("phone", "🔥美国实卡codex 20-30天接马【质保不来马】plus 长效接马 最多能绑定三个号", 6.85),
    make("account", "ChatGPT Plus 成品号 未接码 质保首登", 18),
    make("gone", "Plus 长期接码 30天 可绑定三个号", 1, "delisted"),
  ], sources: ["phone", "account", "gone"].map((id) => ({ id, name: id, platform: "liandong", host: "shop.example.com" })),
};
const input = JSON.stringify(original);
writeFileSync(path, input);
const run = (apply = false) => {
  const result = spawnSync(process.execPath, [cli, "--snapshot", path, ...(apply ? ["--apply"] : [])], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};
assert.equal(run().results[0].changed, 2);
assert.equal(readFileSync(path, "utf8"), input, "dry-run must not write");
assert.equal(readdirSync(join(dir, "data", "catalog")).length, 1);
const applied = run(true);
assert.ok(applied.results[0].backup);
assert.equal(readFileSync(applied.results[0].backup, "utf8"), input);
const snapshot = JSON.parse(readFileSync(path, "utf8"));
assert.equal(snapshot.offers.length, original.offers.length);
assert.deepEqual(snapshot.sources, original.sources);
assert.equal(snapshot.generatedAt, at, "reclassification is not a fresh price collection");
for (let i = 0; i < snapshot.offers.length; i++) {
  const { productSlug: ignoredSlug, warranty: ignoredWarranty, ...before } = original.offers[i];
  const { productSlug, warranty, ...after } = snapshot.offers[i];
  assert.equal(typeof productSlug, "string");
  assert.equal(typeof warranty, "boolean");
  assert.ok(ignoredSlug && ignoredWarranty === false);
  assert.deepEqual(after, before, "classification must preserve prices, stock, IDs and lifecycle");
}
assert.equal(run(true).results[0].changed, 0, "idempotent");

// Compile only the real read/query modules. Demo module has no runtime dependencies.
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
  assert.deepEqual(ui.getOffersForProduct("chatgpt-plus").map((offer) => offer.id), ["account"]);
  assert.deepEqual(ui.getOffersForProduct("sms-openai").map((offer) => offer.id), ["phone"]);
  const plus = ui.listProductSummaries("chatgpt").find((summary) => summary.slug === "chatgpt-plus");
  assert.equal(plus.lowestPrice, 18, "SMS price must not determine subscription minimum");
  assert.equal(plus.channelCount, 1, "SMS must not inflate subscription channels");
  assert.equal(plus.inStockCount, 1, "SMS must not inflate subscription stock-offer count");
  const sms = ui.listProductSummaries("sms").find((summary) => summary.slug === "sms-openai");
  assert.equal(sms.lowestPrice, 6.85, "delisted phone must not be resurrected");
  assert.equal(sms.channelCount, 1);
} finally { Date.now = realNow; process.chdir(cwd); }
console.log("PASS SMS classification: dry-run, backup, idempotent migration, original fields/lifecycle preserved, real UI prices/channel/stock counts isolated from subscriptions");
