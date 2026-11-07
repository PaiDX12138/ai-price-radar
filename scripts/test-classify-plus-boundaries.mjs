#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { classifyTitle, seedProducts } from "../collectors/classify.mjs";
import { reclassifyOffers, reclassifyOffersInFreshProcess } from "../collectors/persist.mjs";

const mirrorCategory = "镜像站（国内使用G5.6，不用翻墙）";
const cases = [
  ["Codex plus 一号一码，超高质量美国实卡", {}, "sms-openai"],
  ["Codex plus 一号一码，超高质量美国实卡", { category: "Plus账号" }, "sms-openai"],
  ["Codex Plus 一号一码 美国实卡 成品号 账密2FA", {}, "chatgpt-plus"],
  ["Codex Plus VISA 虚拟信用卡 一号一码", {}, "virtual-card"],
  ["upi plus 扫码1次", {}, "chatgpt-codex-service"],
  ["upi plus 扫码5次", {}, "chatgpt-codex-service"],
  ["upi plus 扫码10次", {}, "chatgpt-codex-service"],
  ["upi plus 扫码1次", { category: "Plus成品号" }, "chatgpt-codex-service"],
  ["ChatGPT Plus 成品号 扫码登录", {}, "chatgpt-plus"],
  ["UPI Plus 独享成品号 首登 质保订阅", {}, "chatgpt-plus"],
  ["GPlus套餐天卡", { url: "https://wzyp.cn/item/jgf8sl" }, "chatgpt-mirror"],
  ["GPlus套餐周卡", { url: "https://wzyp.cn/item/xuevzo" }, "chatgpt-mirror"],
  ["GPlus套餐月卡", { url: "https://wzyp.cn/item/hg0guq" }, "chatgpt-mirror"],
  ["Gplus套餐季卡", { url: "https://wzyp.cn/item/2xfaaq" }, "chatgpt-mirror"],
  ["Gplus套餐半年卡", { url: "https://wzyp.cn/item/wcom5j" }, "chatgpt-mirror"],
  ["Gplus套餐年卡", { url: "https://wzyp.cn/item/vuz0pv" }, "chatgpt-mirror"],
  ["GPlus套餐天卡", { url: "https://wzyp.cn/item/jgf8sl?aff=test&utm_source=test" }, "chatgpt-mirror"],
  ["GPlus套餐天卡", { category: mirrorCategory }, "chatgpt-mirror"],
  ["GPlus套餐周卡", { category: mirrorCategory }, "chatgpt-mirror"],
  ["GPlus套餐月卡", { category: [mirrorCategory, "card", "shopApi"] }, "chatgpt-mirror"],
  ["GPT Plus 天卡", { category: "网页中转" }, "chatgpt-mirror"],
  ["GPlus套餐天卡", {}, "chatgpt-plus"], // A short title alone cannot establish mirror delivery.
  ["GPlus套餐天卡", { url: "https://another.example/item/jgf8sl" }, "chatgpt-plus"],
  ["GPlus套餐天卡 新套餐", { url: "https://wzyp.cn/item/jgf8sl" }, "chatgpt-plus"],
  ["GPlus套餐天卡", { category: "非镜像站" }, "chatgpt-plus"],
  ["GPlus套餐天卡", { category: "不是网页镜像" }, "chatgpt-plus"],
  ["GPlus套餐天卡", { category: "不支持网页中转" }, "chatgpt-plus"],
  ["GPlus套餐天卡", { category: "Claude镜像站" }, "chatgpt-plus"],
  ["GPT Plus 成品号 账密2FA", { category: mirrorCategory }, "chatgpt-plus"],
  ["GPT Plus 独享账号 已接码", { category: mirrorCategory }, "chatgpt-plus"],
  ["ChatGPT Plus 官方直充 质保30天", { category: mirrorCategory }, "chatgpt-plus-recharge"],
  ["GPT Plus 正价代充 自备账号", { category: mirrorCategory }, "chatgpt-plus-recharge"],
  ["GPT Plus 半成品 Free号", { category: mirrorCategory }, "chatgpt-free-account"],
  ["GPT Plus VISA 0刀虚拟卡", { category: mirrorCategory }, "virtual-card"],
  ["Plus 美国实卡 专用接码", { category: mirrorCategory }, "sms-openai"],
  ["GPT Plus 正规充值定金", { category: mirrorCategory }, null],
];
for (const [title, context, expected] of cases) assert.equal(classifyTitle(title, context).productSlug, expected, JSON.stringify({ title, context }));
assert.equal(seedProducts().length, 69);

// Reproduce all three incorrect persisted Plus offers without touching real data.
const at = "2026-11-07T10:29:37.558Z";
const offers = [
  { sourceTitle: "Codex plus 一号一码，超高质量美国实卡", price: 4, stockCount: 7,
    url: "https://www.16688.com.cn/goods/G74897726", tags: ["C933645", "自动发货", "16688"] },
  { sourceTitle: "upi plus 扫码1次", price: 4.5, stockCount: 8,
    url: "https://catfk.com/item/ze2j8u", tags: ["upi plus 扫码", "card", "shopApi"] },
  { sourceTitle: "GPlus套餐天卡", price: 4.8, stockCount: 7,
    url: "https://wzyp.cn/item/jgf8sl", tags: [mirrorCategory, "card", "shopApi"] },
].map((offer, i) => ({ id: "plus-boundary-" + i, sourceId: "fixture-source", productSlug: "chatgpt-plus",
  status: "in_stock", lifecycle: "active", capturedAt: at, lastSeenAt: at, lastVerifiedAt: at,
  warranty: false, listedPrice: offer.price, ...offer }));
const expected = ["sms-openai", "chatgpt-codex-service", "chatgpt-mirror"];
const assertMoved = (changed) => {
  assert.deepEqual(changed.map(o => o.productSlug), expected);
  for (let i = 0; i < offers.length; i++) {
    const { productSlug: beforeSlug, classified: beforeMarker, ...before } = offers[i];
    const { productSlug: afterSlug, classified: afterMarker, ...after } = changed[i];
    assert.ok(beforeSlug && afterSlug); assert.equal(beforeMarker, undefined); assert.ok(afterMarker === undefined || afterMarker === true);
    assert.deepEqual(after, before, "classification cannot change price, stock, identity, lifecycle or observation times");
  }
};
assertMoved(reclassifyOffers(offers));
assertMoved(reclassifyOffersInFreshProcess(offers).offers);

const root = resolve(tmpdir()), dir = mkdtempSync(join(root, "radar-plus-boundaries-"));
try {
  const snapshot = join(dir, "snapshot.json");
  writeFileSync(snapshot, JSON.stringify({ generatedAt: at, offers, sources: [{ id: "fixture-source" }], products: seedProducts() }));
  const cli = fileURLToPath(new URL("./reclassify-catalog-snapshot.mjs", import.meta.url));
  const run = (apply) => {
    const result = spawnSync(process.execPath, [cli, "--snapshot", snapshot, ...(apply ? ["--apply"] : [])], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout).results[0];
  };
  const before = readFileSync(snapshot, "utf8");
  assert.equal(run(false).changed, 3); assert.equal(readFileSync(snapshot, "utf8"), before);
  assert.equal(run(true).changed, 3);
  const repaired = JSON.parse(readFileSync(snapshot, "utf8"));
  assertMoved(repaired.offers); assert.equal(repaired.generatedAt, at);
  assert.equal(run(true).changed, 0, "repeat migration must be idempotent");
  console.log(`PASS Plus delivery boundaries: ${cases.length} title/context cases; actual three offers, fresh worker and offline preview/apply; no price/stock/time changes; no new categories`);
} finally {
  const inside = relative(root, resolve(dir));
  if (inside && !inside.startsWith("..") && !isAbsolute(inside) && basename(dir).startsWith("radar-plus-boundaries-")) rmSync(dir, { recursive: true, force: true });
}
