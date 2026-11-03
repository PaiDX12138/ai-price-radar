#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { seedProducts } from "../collectors/classify.mjs";
import { reclassifyOffersInFreshProcess } from "../collectors/persist.mjs";

// Test the existing migration, worker publication and actual UI aggregations together.
const scratchRoot = resolve(tmpdir());
const dir = mkdtempSync(join(scratchRoot, "radar-gpt-free-classify-"));
try {
  const catalogDir = join(dir, "data", "catalog");
  mkdirSync(catalogDir, { recursive: true });
  const path = join(catalogDir, "public.json");
  const cli = fileURLToPath(new URL("./reclassify-catalog-snapshot.mjs", import.meta.url));
  const at = "2026-11-03T15:17:00.000Z";
  const make = (id, title, price, slug = "chatgpt-plus", extra = {}) => ({
    id, sourceId: id, sourceTitle: title, productSlug: slug, price, listedPrice: price,
    status: "in_stock", stockCount: 108, capturedAt: at, lastSeenAt: at,
    lifecycle: "active", lifecycleReason: "test", delistedAt: null, tags: ["shopApi"],
    warranty: false, url: `https://shop.example.com/item/${id}`, ...extra,
  });
  const offers = [
    make("screenshot", "G Plus 半成品 质保首登", 1.5),
    make("half-with-reset", "Plus半成品未接马momo渠道有两张重置卡 质保一小时内首登", 5, "chatgpt-codex-service"),
    make("gone", "G Plus 半成品 质保首登", 0.01, "chatgpt-plus", { lifecycle: "delisted", delistedAt: at }),
    make("sold-out", "GPT 半成品 账号RT 未开通Plus", 0.1, "chatgpt-plus", { status: "out_of_stock", stockCount: 0 }),
    make("free", "GPT Free 普号", 2.5, "chatgpt-free-account"),
    make("plus", "Plus独享成品号 已接码 账密2FA 质保首登", 17.15),
    make("plus-warranty", "GPT Plus 成品号 质保订阅30天", 29.16, "chatgpt-plus", { warranty: true }),
    make("activated", "Plus 半成品 已开通Plus 未接码 质保首登", 22),
    make("recharge", "Plus 官方充值 自备半成品账号 须账号为Free状态", 135, "chatgpt-plus-recharge"),
    make("sms", "GPT Plus 半成品专用 手机号接码服务 不提供账号", 0.5, "sms-openai"),
    make("api", "GPT Plus 半成品号池 API KEY额度充值", 0.2, "chatgpt-mirror"),
    // A separate old Claude classification defect must not change under --platform chatgpt.
    make("unrelated", "Claude 普号 Free账号", 10, "claude-pro-month"),
  ];
  const original = { generatedAt: at, mode: "live", isDemo: false,
    stats: { sourcesSuccess: offers.length }, products: seedProducts(), offers,
    sources: offers.map(({ id }) => ({ id, name: id, platform: "liandong", host: "shop.example.com" })),
  };
  const input = JSON.stringify(original);
  writeFileSync(path, input);
  const run = (apply = false, titleContains = null) => {
    const result = spawnSync(process.execPath,
      [cli, "--snapshot", path, "--platform", "chatgpt", ...(titleContains ? ["--title-contains", titleContains] : []), ...(apply ? ["--apply"] : [])], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  // A targeted repair must not also fix an unrelated old ChatGPT classification.
  const unrelatedGpt = make("unrelated-gpt", "ChatGPT Plus 成品号", 40, "chatgpt-free-account");
  writeFileSync(path, JSON.stringify({ ...original, offers: [...offers, unrelatedGpt] }));
  assert.equal(run(true, "半成品").results[0].changed, 4);
  assert.deepEqual(JSON.parse(readFileSync(path, "utf8")).offers.at(-1), unrelatedGpt);
  assert.equal(run(true, "半成品").results[0].changed, 0);
  const invalidTitle = spawnSync(process.execPath, [cli, "--snapshot", path, "--title-contains", "--apply"], { encoding: "utf8" });
  assert.notEqual(invalidTitle.status, 0, "missing title scope must not become an unscoped write");
  writeFileSync(path, input);
  assert.equal(run().results[0].changed, 4);
  assert.equal(readFileSync(path, "utf8"), input, "dry-run must not write");
  const applied = run(true);
  assert.equal(applied.results[0].changed, 4);
  assert.deepEqual(readdirSync(catalogDir), ["public.json"], "no extra backups or leftover temporary files");
  const snapshot = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(snapshot.generatedAt, at, "classification is not a new price/stock confirmation");
  assert.deepEqual(snapshot.sources, original.sources);
  assert.equal(snapshot.offers.length, offers.length);
  for (let i = 0; i < offers.length; i++) {
    const { productSlug: oldSlug, warranty: oldWarranty, ...before } = offers[i];
    const { productSlug, warranty, ...after } = snapshot.offers[i];
    assert.ok(oldSlug && productSlug && typeof oldWarranty === "boolean" && typeof warranty === "boolean");
    assert.deepEqual(after, before, "preserve all prices, stock, URLs, IDs, lifecycle and timestamps");
  }
  assert.deepEqual(snapshot.offers.at(-1), offers.at(-1), "leave unrelated platform unchanged");
  assert.equal(run(true).results[0].changed, 0, "migration is idempotent");
  const fresh = reclassifyOffersInFreshProcess(offers.slice(0, -1));
  assert.deepEqual(fresh.offers.map(o => o.productSlug), snapshot.offers.slice(0, -1).map(o => o.productSlug));

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
    const ids = slug => new Set(ui.getOffersForProduct(slug).map(o => o.id));
    assert.deepEqual(ids("chatgpt-plus"), new Set(["plus", "plus-warranty", "activated"]));
    assert.deepEqual(ids("chatgpt-free-account"), new Set(["screenshot", "half-with-reset", "sold-out", "free"]));
    const summary = slug => ui.listProductSummaries("chatgpt").find(p => p.slug === slug);
    const plus = summary("chatgpt-plus");
    assert.equal(plus.lowestPrice, 17.15, "Free offer must not determine Plus minimum");
    assert.equal(plus.nonWarrantyLowestPrice, 17.15);
    assert.equal(plus.warrantyLowestPrice, 29.16);
    assert.equal(plus.channelCount, 3);
    assert.equal(plus.inStockCount, 3);
    const free = summary("chatgpt-free-account");
    assert.equal(free.lowestPrice, 1.5, "delisted/sold-out Free offers must not set the live minimum");
    assert.equal(free.channelCount, 4);
    assert.equal(free.inStockCount, 3);
    assert.equal(free.warrantyLowestPrice, null, "first-login warranty is not a subscription warranty");
  } finally { Date.now = realNow; process.chdir(cwd); }
  console.log("PASS ChatGPT Free integration: screenshot, scoped migration, idempotence, fresh worker, original fields, real UI minima/channel/stock counts");
} finally {
  const inside = relative(scratchRoot, resolve(dir));
  if (inside && !isAbsolute(inside) && !inside.startsWith("..") && basename(dir).startsWith("radar-gpt-free-classify-")) {
    rmSync(dir, { recursive: true, force: true });
  }
}
