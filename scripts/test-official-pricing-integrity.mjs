import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { pickAppStoreItem, appStoreBillingPeriod } from "../collectors/official-appstore-match.mjs";
import { usdReferenceQuote, USD_REFERENCE_APPS } from "../collectors/official-usd-reference.mjs";
const dir = mkdtempSync(join(tmpdir(), "radar-price-integrity-"));
process.env.OFFICIAL_SNAPSHOT_PATH = join(dir, "snapshot.json");
const api = await import("../collectors/official-prices-db.mjs");
const rates = { USD: 1, CNY: 7, EGP: 50, JPY: 150, CLP: 1000, KWD: 0.3, MOP: 8 };
let cases = 0;
for (const code of Object.keys(rates)) {
  const monthly = { name: "X Premium", offerName: "x.premium.monthly", priceValue: 30 * rates[code] };
  const annual = { name: "X Premium", offerName: "x.premium.yearly", priceValue: 300 * rates[code] };
  for (const [period, target, expected] of [["monthly", 30, monthly], ["annual", 300, annual]]) {
    const plan = { pattern: /^X Premium$/, us_list_usd: target, billing_period: period };
    assert.equal(pickAppStoreItem([annual, monthly], plan, code, rates), expected);
    assert.equal(pickAppStoreItem([{ ...monthly, offerName: "opaque.1" }, { ...annual, offerName: "opaque.2" }], plan, code, rates), null, "unproven billing period must not be guessed from a price");
    cases += 2;
  }
  assert.equal(pickAppStoreItem([monthly], { pattern: /^X Premium$/, us_list_usd: 300, billing_period: "annual" }, code, rates), null);
  cases++;
}
assert.equal(appStoreBillingPeriod("oai_chatgpt_plus_20000_1y"), "annual");
assert.equal(appStoreBillingPeriod("com.anthropic.claude.pro.monthly.ios"), "monthly");
assert.equal(pickAppStoreItem([{ name: "Regional", offerName: "regional.annual", priceValue: 20 }],
  { pattern: /^Regional$/, us_list_usd: 200, billing_period: "annual" }, "USD", rates).priceValue, 20, "explicit regional annual discount must not be rejected by price heuristics");
assert.equal(api.convertToCny(259.99, "USD", rates), 1819.93);
assert.equal(api.convertToCny(1000, "EGP", rates), 140);
assert.equal(api.convertToCny(30, "KWD", rates), 700);
for (const value of [NaN, Infinity, -1, 0]) assert.equal(api.convertToCny(value, "USD", rates), null);
assert.equal(api.rateToCny("USD", { CNY: -7 }), null);
assert.equal(api.convertToCny(20, "EGP", { CNY: 7, EGP: 0 }), null);

const db = api.openOfficialDb(":memory:");
const old = "2026-10-01T00:00:00Z";
db.exec("INSERT INTO official_regions(id,country_code,country_label,currency_code) VALUES(1,'EG','Egypt','EGP'),(2,'US','US','USD')");
api.upsertFx(db, { rates: { ...rates, EGP: 100 }, date: "2026-10-27", source: "test" });
for (const [i, slug] of USD_REFERENCE_APPS.entries()) {
  db.prepare("INSERT INTO official_apps(id,slug,display_name,provider,catalog_platform) VALUES(?,?,?,?,?)").run(i + 1, slug, slug, slug, slug);
  db.prepare("INSERT INTO official_plans(id,app_id,slug,label,us_list_usd) VALUES(?,?,'test-monthly','Test',20)").run(i + 1, i + 1);
  api.upsertPrice(db, { planId: i + 1, regionId: 1, channel: "web_direct", currencyCode: "EGP", priceValue: 1000,
    listPriceValue: 20, priceText: "EGP 1000", cnyPrice: 70, fxRateToCny: 0.07, fxDate: "2026-10-27", updatedAt: old, lastSuccessAt: old });
}
db.exec("UPDATE official_prices SET price_basis=NULL"); // actual pre-upgrade rows
assert.equal(api.repairUsdReferencePrices(db), 6);
for (const row of db.prepare("SELECT * FROM official_prices").all()) {
  assert.equal(row.currency_code, "USD"); assert.equal(row.price_value, 20); assert.equal(row.list_price_value, 20);
  assert.equal(row.cny_price, 140); assert.equal(row.price_basis, "usd_reference");
  assert.equal(row.updated_at, old); assert.equal(row.last_success_at, old);
}
assert.equal(api.repairUsdReferencePrices(db), 0);
const fxBefore = api.getFx(db);
api.seedAppPrices(db, "cursor");
assert.deepEqual(api.getFx(db), fxBefore, "old bootstrap seed must never overwrite newer FX");
api.refreshAllCny(db, { ...rates, EGP: 1000 }, "2026-10-28");
for (const row of db.prepare("SELECT * FROM official_prices").all()) assert.equal(row.cny_price, 140, "local FX drift must not invent a regional discount on USD reference prices");
assert.equal(usdReferenceQuote(20, { rates, date: "2026-10-27" }).currencyCode, "USD");
db.close();

for (const name of ["exclusive-price", "currency", "promos"]) {
  const source = readFileSync(new URL(`../src/lib/official/${name}.ts`, import.meta.url), "utf8").replace(/import "server-only";/g, "");
  writeFileSync(join(dir, `${name}.mjs`), ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
    .replaceAll("@/lib/official/country-display", pathToFileURL(join(dir, "country-display.mjs")).href));
}
writeFileSync(join(dir, "country-display.mjs"), "export const displayCountryLabel=()=>''; export const flagCdnCode=()=>'';export const flagCdnUrl=()=>'';");
const display = await import(pathToFileURL(join(dir, "exclusive-price.mjs")).href);
const currency = await import(pathToFileURL(join(dir, "currency.mjs")).href);
const promos = await import(pathToFileURL(join(dir, "promos.mjs")).href);
const base = { id: "one", countryCode: "US", currencyCode: "USD", channel: "web_direct", status: "available", priceValue: 20, cnyPrice: 140, fxRateToCny: 7 };
const tax = display.toDisplayRegionPrice({ ...base, priceValue: 120, listPriceValue: 120, cnyPrice: 840, taxMode: "inclusive", taxPercent: 20 });
assert.equal(tax.priceValue, 100); assert.equal(tax.cnyPrice, 700);
assert.equal(display.toDisplayRegionPrice(tax).priceValue, 100, "tax split is idempotent");
assert.equal(display.toDisplayRegionPrice({ ...base, channel: "ios_store", taxMode: null }).taxMode, null);
assert.equal(currency.taxBandLabel({ channel: "ios_store", taxMode: null }), "税况未知");
assert.ok(display.formatLocalPrice(1234.567, "KWD").includes("1,234.567"));
assert.ok(display.formatLocalPrice(10000.99, "USD").includes("10,000.99"));
assert.equal(display.officialComparisonPool([{ ...base, cnyPrice: -1 }]).length, 0);
const plan = { usListUsd: 200, usLiveUsd: 20 };
assert.equal(promos.resolvePlanPromo(plan, [{ ...base, status: "stale" }]), null);
assert.equal(promos.resolvePlanPromo(plan, [{ ...base, priceBasis: "usd_reference" }]), null);
assert.equal(promos.resolvePlanPromo(plan, []), null, "invalid/absent rows must not resurrect an old 90% promo via summary fallback");
assert.equal(promos.resolvePlanPromo(plan, [base]).percent, 90, "genuine current public discount must not be arbitrarily capped");
console.log(`PASS pricing integrity: ${cases} cross-currency/period cases, 6 non-ChatGPT web reference migrations, FX direction/seed retention, valid huge discounts, taxes/precision and promo provenance`);
