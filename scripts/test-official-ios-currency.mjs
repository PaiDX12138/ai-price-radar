import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import { explicitPriceCurrency } from "../collectors/official-price-currency.mjs";
import { fetchAppStoreOffers, parseAddOns } from "../collectors/official-appstore.mjs";

const dir = mkdtempSync(join(tmpdir(), "radar-ios-currency-"));
process.env.OFFICIAL_SNAPSHOT_PATH = join(dir, "snapshot.json");
const api = await import("../collectors/official-prices-db.mjs");
const addOn = (price = "USD 259.99") => ({ name: "X Ultra", price,
  buyParams: "offerName=x.ai.cursor.xpass.ultra.monthly&price=259990" });
assert.equal(explicitPriceCurrency("USD\u00a0259.99"), "USD");
assert.equal(explicitPriceCurrency("MOP 259.99"), "MOP");
assert.equal(explicitPriceCurrency("$259.99"), null);
assert.equal(explicitPriceCurrency("HK$259.99"), null);
assert.equal(parseAddOns([addOn()])[0].priceValue, 259.99);
assert.equal(parseAddOns([addOn()])[0].currencyCode, "USD");

// Exercise the real HTTP adapter without network. Explicit currency needs no lookup.
const realFetch = globalThis.fetch;
let calls = [];
let text = "USD 259.99";
let lookupCurrency = "HKD";
globalThis.fetch = async (url) => {
  calls.push(String(url));
  if (String(url).includes("itunes.apple.com")) {
    return Response.json({ results: lookupCurrency ? [{ currency: lookupCurrency }] : [] });
  }
  return Response.json({ storePlatformData: { "product-dv": { meta: { storefront: { cc: "MO", id: "143515" } } } }, pageData: { addOns: [addOn(text)] } });
};
try {
  const options = { appStoreId: "6767085653", appStoreSlug: "cursor", storefrontId: "143515" };
  assert.equal((await fetchAppStoreOffers(options)).currencyCode, "USD");
  assert.equal(calls.length, 1);
  text = "$259.99";
  assert.equal((await fetchAppStoreOffers(options)).currencyCode, "HKD");
  assert.ok(calls.at(-1).endsWith("country=mo"));
  lookupCurrency = null;
  assert.equal((await fetchAppStoreOffers(options)).currencyCode, null, "unknown billing currency must not fall back to MOP");
} finally { globalThis.fetch = realFetch; }

// Reproduce the exact production bug: USD 259.99 stored as MOP and ranked below US.
const path = join(dir, "prices.sqlite");
let db = api.openOfficialDb(path);
api.migrateOfficialPrices(db);
const plan = db.prepare("SELECT p.id FROM official_plans p JOIN official_apps a ON a.id=p.app_id WHERE a.slug='cursor' AND p.slug='ultra-monthly'").get();
const mo = db.prepare("SELECT id FROM official_regions WHERE country_code='MO'").get();
const us = db.prepare("SELECT id FROM official_regions WHERE country_code='US'").get();
db.exec("DELETE FROM official_prices WHERE plan_id IN (SELECT id FROM official_plans WHERE app_id=(SELECT id FROM official_apps WHERE slug='cursor'))");
const rates = { USD: 1, CNY: 6.67745, MOP: 8.07724 };
api.upsertFx(db, { rates, date: "2026-10-27", source: "test" });
const old = "2026-10-01T00:00:00Z";
const add = (regionId, channel, value, currencyCode, priceText, status = "available") => api.upsertPrice(db, {
  planId: plan.id, regionId, channel, priceValue: value, currencyCode, priceText, status,
  cnyPrice: api.convertToCny(value, currencyCode, rates), fxRateToCny: api.rateToCny(currencyCode, rates),
  fxDate: "2026-10-27", sourceUrl: "test", lastSuccessAt: old, updatedAt: old,
});
add(mo.id, "ios_store", 259.99, "MOP", "USD 259.99", "stale");
add(mo.id, "web_direct", 1615.45, "MOP", "MOP 1,615.45");
add(us.id, "web_direct", 200, "USD", "$200");
const cursorSummary = () => api.listPlanSummaries(db).find((s) => s.id === "cursor__ultra-monthly");
assert.equal(cursorSummary().lowest.countryCode, "MO");
const webBefore = db.prepare("SELECT * FROM official_prices WHERE channel='web_direct' ORDER BY id").all();
assert.equal(api.repairIosPriceCurrencies(db), 1);
const iosSql = "SELECT * FROM official_prices WHERE channel='ios_store' AND plan_id=? AND region_id=?";
let row = db.prepare(iosSql).get(plan.id, mo.id);
assert.equal(row.currency_code, "USD");
assert.equal(row.price_value, 259.99);
assert.equal(row.cny_price, 1736.07);
assert.equal(row.status, "stale");
assert.equal(row.updated_at, old);
assert.equal(row.last_success_at, old);
assert.deepEqual(db.prepare("SELECT * FROM official_prices WHERE channel='web_direct' ORDER BY id").all(), webBefore);
assert.equal(api.repairIosPriceCurrencies(db), 0, "repair is idempotent");
assert.equal(cursorSummary().lowest.countryCode, "US");
const backupName = readdirSync(dir).find((name) => name.includes("before-ios-currency"));
assert.ok(backupName, "repair must back up persistent DB");
const backup = new Database(join(dir, backupName), { readonly: true });
assert.equal(backup.prepare(iosSql).get(plan.id, mo.id).currency_code, "MOP");
backup.close();
// Reintroduce the old error to exercise automatic repair on collector startup as well.
db.prepare("UPDATE official_prices SET currency_code='MOP',cny_price=214.91 WHERE id=?").run(row.id);
api.closeOfficialDb();

// Actual collector CLI -> SQLite -> snapshot, with only the stale MO iOS row selected.
const mock = join(dir, "fetch.mjs");
writeFileSync(mock, `globalThis.fetch = async (url) => {
  if (!String(url).includes('apps.apple.com')) throw new Error('unexpected request ' + url);
  return Response.json(${JSON.stringify({ storePlatformData: { "product-dv": { meta: { storefront: { cc: "MO", id: "143515" } } } }, pageData: { addOns: [addOn()] } })});
};`);
const result = spawnSync(process.execPath, ["--import", pathToFileURL(mock).href,
  resolve("scripts/collect-official-prices.mjs"), "--mode=stale", "--channels=ios", "--db", path], { encoding: "utf8", env: process.env });
assert.equal(result.status, 0, result.stdout + result.stderr);
assert.match(result.stdout, /repaired 1 iOS currency mismatches/);
db = new Database(path, { readonly: true });
row = db.prepare(iosSql).get(plan.id, mo.id);
assert.equal(row.currency_code, "USD");
assert.equal(row.cny_price, 1736.07);
assert.equal(row.status, "available");
assert.deepEqual(db.prepare("SELECT * FROM official_prices WHERE channel='web_direct' ORDER BY id").all(), webBefore);
db.close();
const snapshot = JSON.parse(readFileSync(process.env.OFFICIAL_SNAPSHOT_PATH, "utf8"));
const summary = snapshot.summaries.find((s) => s.id === "cursor__ultra-monthly");
assert.equal(summary.lowest.countryCode, "US");
const published = snapshot.regionPricesByPlanId[summary.id].find((r) => r.channel === "ios_store");
assert.equal(published.currencyCode, "USD");
assert.equal(published.cnyPrice, 1736.07);
console.log("PASS iOS currency: Apple adapter, ambiguous-symbol lookup, no currency guessing, legacy repair/backup, preserved history/web data, CLI collection and snapshot ranking");
