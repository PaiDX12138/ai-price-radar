import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
const dir = mkdtempSync(join(tmpdir(), "radar-full-audit-"));
process.env.OFFICIAL_SNAPSHOT_PATH = join(dir, "snapshot.json");
const api = await import("../collectors/official-prices-db.mjs");
const audit = await import("../collectors/official-pricing-audit.mjs");
const dbPath = join(dir, "prices.sqlite");
const db = api.openOfficialDb(dbPath);
api.migrateOfficialPrices(db);
db.exec("DELETE FROM official_prices");
const rates = { USD: 1, CNY: 7, JPY: 150, MOP: 8, BRL: 5 };
api.upsertFx(db, { rates, date: "2026-10-27", source: "test" });
const old = "2026-10-01T00:00:00Z", now = "2026-10-27T00:00:00Z";
const plan = (app, slug) => db.prepare("SELECT p.* FROM official_plans p JOIN official_apps a ON a.id=p.app_id WHERE a.slug=? AND p.slug=?").get(app, slug);
const region = (cc) => db.prepare("SELECT * FROM official_regions WHERE country_code=?").get(cc);
const add = (app, slug, cc, value, currency) => api.upsertPrice(db, { planId: plan(app, slug).id, regionId: region(cc).id,
  channel: "ios_store", priceValue: value, priceText: `${currency} ${value}`, currencyCode: currency,
  cnyPrice: api.convertToCny(value, currency, rates), fxRateToCny: api.rateToCny(currency, rates), fxDate: "2026-10-27", updatedAt: old, lastSuccessAt: old });
add("cursor", "premium-annual", "BR", 169.9, "BRL");
add("cursor", "super-annual", "BR", 669.9, "BRL");
add("cursor", "ultra-monthly", "MO", 259.99, "MOP");
add("gemini", "pro-annual", "JP", 3000, "JPY");
add("claude", "pro-monthly", "JP", 3000, "JPY");
const item = (name, offerName, priceValue, currencyCode) => ({ name, offerName, priceValue, priceText: `${currencyCode} ${priceValue}`, currencyCode });
const page = (app, country, currencyCode, items) => ({ app, country, currencyCode, items, ok: true,
  storefront: { cc: country, id: region(country).storefront_id }, capturedAt: now });
const evidence = { fx: { rates, date: "2026-10-27", source: "test" }, ios: [
  page("cursor", "BR", "BRL", [item("X Premium", "x.premium.monthly", 169.9, "BRL"), item("X Premium", "x.premium.yearly", 1699, "BRL"), item("X Super", "x.super.monthly", 669.9, "BRL")]),
  page("cursor", "MO", "USD", [item("X Ultra", "x.ultra.monthly", 259.99, "USD")]),
  page("gemini", "JP", "JPY", [item("Google AI Pro (5 TB)", "com.google.gemini.5tb.m", 3000, "JPY"), item("Google AI Pro (5 TB)", "com.google.gemini.5tb.y", 30000, "JPY")]),
  { app: "claude", country: "JP", ok: false, status: 503, capturedAt: now },
], web: [{ country: "US", ok: true, capturedAt: now, url: "https://chatgpt.com/backend-api/checkout_pricing_config/configs/US",
  config: { country_code: "US", currency_config: { symbol_code: "USD", minor_unit_exponent: 2, plus: { month: { amount: 20, tax: "exclusive" }, year: { amount: 16.67, tax: "exclusive" } } } } } ] };
const result = audit.applyOfficialPriceEvidence(db, evidence);
assert.equal(result.quarantined.length, 1);
const read = (app, slug, cc) => db.prepare("SELECT * FROM official_prices WHERE plan_id=? AND region_id=?").get(plan(app, slug).id, region(cc).id);
assert.equal(read("cursor", "premium-annual", "BR").price_value, 1699);
assert.equal(read("cursor", "super-annual", "BR").status, "invalid");
assert.equal(read("cursor", "super-annual", "BR").last_success_at, old);
assert.equal(read("cursor", "ultra-monthly", "MO").currency_code, "USD");
assert.equal(read("gemini", "pro-annual", "JP").price_value, 30000);
assert.equal(read("gemini", "pro-monthly", "JP").price_value, 3000);
assert.equal(read("claude", "pro-monthly", "JP").status, "stale");
assert.equal(read("claude", "pro-monthly", "JP").updated_at, old);
assert.equal(read("chatgpt", "plus-annual", "US").price_value, 200);
assert.equal(audit.auditOfficialPrices(db).issues.length, 0);
db.close();

// Read-only CLI must not mutate DB or snapshot; --apply must save a valid SQLite backup.
const cli = fileURLToPath(new URL("./audit-official-prices.mjs", import.meta.url));
const report = join(dir, "report.json"), snapshot = join(dir, "public.json");
const run = (extra = []) => { const res = spawnSync(process.execPath, [cli, "--db", dbPath, "--report", report, "--snapshot", snapshot, ...extra], { encoding: "utf8" }); assert.equal(res.status, 0, res.stdout + res.stderr); };
const before = new Database(dbPath, { readonly: true });
const raw = before.prepare("SELECT * FROM official_prices ORDER BY id").all(); before.close();
run();
let check = new Database(dbPath, { readonly: true }); assert.deepEqual(check.prepare("SELECT * FROM official_prices ORDER BY id").all(), raw); check.close();
const evidencePath = join(dir, "evidence.json"); writeFileSync(evidencePath, JSON.stringify(evidence));
run(["--apply", "--evidence", evidencePath]);
const published = JSON.parse(readFileSync(snapshot, "utf8"));
assert.ok((published.regionPricesByPlanId["cursor__super-annual"] || []).every((row) => row.status !== "invalid"));
const receipt = JSON.parse(readFileSync(report, "utf8"));
check = new Database(receipt.backup, { readonly: true }); assert.equal(check.prepare("SELECT COUNT(*) n FROM official_prices").get().n, raw.length); check.close();
console.log("PASS full pricing audit: current evidence, cross-currency annual repair, wrong-period quarantine, failure retains history, ChatGPT annual units, read-only CLI and backed-up snapshot publication");
