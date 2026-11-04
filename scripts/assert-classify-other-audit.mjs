#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyCatalogTitle, classifyTitle, seedProducts } from "../collectors/classify.mjs";
import { auditedClassification } from "../collectors/classification-evidence.mjs";

const fixtures = JSON.parse(readFileSync(new URL("./fixtures/catalog-other-audit.json", import.meta.url), "utf8"));
const evidence = JSON.parse(readFileSync(new URL("../config/catalog-classification-evidence.json", import.meta.url), "utf8"));
const slugs = new Set(seedProducts().map((product) => product.slug));
assert.equal(slugs.size, 69, "do not introduce product types");
let failures = 0;
for (const { title, expected, ...context } of fixtures) {
  const result = classifyTitle(title, context);
  if (result.productSlug !== expected) {
    console.error("FAIL", title, "=>", result.productSlug, "expected", expected);
    failures++;
  }
  assert.ok(!expected || slugs.has(expected));
  assert.equal(classifyCatalogTitle(title, context).productSlug, result.productSlug || "other-product");
}

const keys = new Set();
for (const entry of evidence.entries) {
  const key = `${entry.url}\n${entry.sourceTitle}`;
  assert.ok(!keys.has(key), "duplicate evidence key"); keys.add(key);
  assert.ok(slugs.has(entry.productSlug));
  assert.match(entry.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(entry.reason.length > 10);
  assert.equal(auditedClassification(entry.sourceTitle, entry.url), entry.productSlug);
  assert.equal(classifyTitle(entry.sourceTitle, { url: entry.url }).productSlug, entry.productSlug);
  assert.equal(auditedClassification(entry.sourceTitle + " 新套餐", entry.url), null, "changed titles invalidate evidence");
  assert.equal(auditedClassification(entry.sourceTitle, "https://unrelated.example/item/1"), null, "same title in another shop is not evidence");
  assert.equal(auditedClassification(entry.sourceTitle), null, "URL required");
}
assert.equal(classifyTitle("Kling 可灵 国际版26000积分黑金会员", { category: "grok" }).productSlug, null);
assert.equal(classifyTitle("账号", { category: ["grok", "telegram"] }).productSlug, null, "conflicting categories stay unresolved");
assert.equal(classifyTitle("成品号", { category: "Codex | Gemini | Claude | Grok" }).productSlug, null, "mixed parent category is not evidence");
assert.equal(classifyTitle("Twitter 1000个粉丝 手工发货", { category: "Grok" }).productSlug, null, "followers are not accounts");
assert.equal(classifyTitle("Starship Super Heavy 模型摆件").productSlug, null);
assert.equal(classifyTitle("游戏虚拟卡密商品 王者荣耀兑换码").productSlug, null);
assert.equal(classifyTitle("X账号 Grok Ultra 200刀会员").productSlug, "grok-ultra", "X account recognition must not steal a paid Grok subscription");
assert.equal(classifyTitle("GPT Pro 10x 200美元 质保订阅", { category: "GPT Pro 20X" }).productSlug, null);
assert.equal(classifyTitle("GPT Pro 25x 月卡", { category: "GPT Pro 500" }).productSlug, null, "category/price cannot manufacture a missing tier");
assert.equal(classifyTitle("谷歌邮箱API【注册TikTok】").productSlug, "gmail-account");
assert.equal(classifyTitle("iCloud 隐私邮箱 | TikTok").productSlug, "icloud-email");
assert.equal(classifyTitle("（新渠道）G Free号（提供邮箱接马 已经接马）| US注册 | outlook| 家宽注册").productSlug, "chatgpt-free-account");
assert.equal(classifyTitle("【KYC】普区白号 无订阅【30天左右】 老成品号 outlook邮箱").productSlug, null, "unidentified KYC accounts are not email or GPT Free");
assert.equal(classifyTitle("GPT Pro25x 1500刀 套餐").productSlug, null, "500 must be a complete monetary value");
assert.equal(classifyTitle("【注册账号】RAMBLER.RU邮箱 | POP3、SMTP、IMAP 已激活").productSlug, "email-account");
assert.equal(classifyTitle("ChatGPT 200 美刀官方充值").productSlug, "chatgpt-pro-20x");
if (failures) throw new Error(`${failures} audited classification fixtures failed`);
console.log(`PASS Other audit: ${fixtures.length} fixtures, ${evidence.entries.length} URL-scoped evidence entries, ambiguity/negative boundaries, 69 unchanged seeds`);
