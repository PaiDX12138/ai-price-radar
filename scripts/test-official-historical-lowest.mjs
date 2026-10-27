import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

// Isolated DB/snapshot only. No real price requests or project data writes.
const dir = mkdtempSync(join(tmpdir(), "radar-history-lowest-"));
process.env.OFFICIAL_SNAPSHOT_PATH = join(dir, "snapshot.json");
const api = await import("../collectors/official-prices-db.mjs");
const db = api.openOfficialDb(":memory:");
try {
  // Run the actual frontend query modules without Next's server-only boundary.
  for (const name of ["exclusive-price", "snapshot", "promos", "queries"]) {
    const path = new URL(`../src/lib/official/${name}.ts`, import.meta.url);
    const source = readFileSync(path, "utf8")
      .replace(/import "server-only";/g, "")
      .replace(/@\/lib\/official\/([^"\n]+)/g, "./$1.mjs");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
      fileName: fileURLToPath(path),
    });
    writeFileSync(join(dir, `${name}.mjs`), outputText);
  }
  const frontend = await import(pathToFileURL(join(dir, "queries.mjs")).href);
  const sorting = await import(pathToFileURL(join(dir, "exclusive-price.mjs")).href);
  db.exec(`
    INSERT INTO official_apps(id,slug,display_name,provider,catalog_platform)
      VALUES(1,'chatgpt','ChatGPT','OpenAI','chatgpt');
    INSERT INTO official_plans(id,app_id,slug,label,billing_period,us_list_usd,catalog_slug)
      VALUES(1,1,'plus-monthly','ChatGPT Plus','monthly',20,'chatgpt-plus');
    INSERT INTO official_regions(id,country_code,country_label,currency_code)
      VALUES(1,'PH','菲律宾','PHP'),(2,'US','美国','USD'),(3,'EG','埃及','EGP');
  `);
  const old = "2026-10-01T00:00:00.000Z";
  const add = (regionId, status, value, currencyCode, tax = null) => api.upsertPrice(db, {
    planId: 1, regionId, channel: "web_direct", priceValue: value,
    priceText: `${currencyCode} ${value}`, currencyCode, cnyPrice: value,
    fxRateToCny: 1, fxDate: "2026-10-01", status,
    sourceUrl: "test", lastSuccessAt: old, updatedAt: old,
    listPriceValue: value, taxMode: tax ? "inclusive" : "exclusive", taxPercent: tax,
  });
  add(1, "stale", 1100, "PHP", 12);
  add(2, "available", 20, "USD");
  add(3, "estimated", 1, "EGP");
  api.refreshAllCny(db, { USD: 1, CNY: 7, PHP: 56, EGP: 50 }, "2026-10-23");

  let summary = api.listPlanSummaries(db)[0];
  assert.equal(summary.lowest.countryCode, "PH", "history must compete with available price");
  assert.equal(summary.lowest.status, "stale");
  assert.equal(summary.sampleCount, 3);
  assert.equal(summary.quoteCount, 3);
  assert.equal(summary.channelCounts.web_direct, 3);
  const publish = () => { api.writeOfficialPricesSnapshot(db); frontend.clearOfficialCache(); };
  publish();
  const display = frontend.getOfficialPlanSummaryById("chatgpt__plus-monthly");
  assert.equal(display.lowest.countryCode, "PH");
  assert.equal(display.lowest.cnyPrice, 122.77, "history uses same tax/FX display rules");
  assert.equal(display.lowest.lastSuccessAt, old);
  const regions = frontend.listOfficialRegionPrices(display.id);
  assert.deepEqual(regions.map((r) => r.countryCode), ["PH", "US", "EG"]);
  assert.equal(frontend.listOfficialProductCards()[0].monthly.lowest.countryCode, "PH");
  assert.equal(frontend.getOfficialLowestQuoteBySlug("chatgpt-plus").row.countryCode, "PH");

  // Deployment must also work with pre-existing snapshots whose summaries excluded history.
  const legacy = JSON.parse(readFileSync(process.env.OFFICIAL_SNAPSHOT_PATH, "utf8"));
  legacy.summaries[0].sampleCount = 1;
  legacy.summaries[0].quoteCount = 1;
  legacy.summaries[0].channelCounts = { web_direct: 1 };
  legacy.summaries[0].lowest = regions.find((r) => r.countryCode === "US");
  writeFileSync(process.env.OFFICIAL_SNAPSHOT_PATH, JSON.stringify(legacy));
  frontend.clearOfficialCache();
  const repaired = frontend.getOfficialPlanSummaryById(display.id);
  assert.equal(repaired.lowest.countryCode, "PH");
  assert.equal(repaired.sampleCount, 3);
  assert.equal(repaired.quoteCount, 3);
  assert.equal(repaired.channelCounts.web_direct, 3);

  // Changing only FX must update and rerank history without claiming a fresh price fetch.
  api.refreshAllCny(db, { USD: 1, CNY: 7, PHP: 28, EGP: 50 }, "2026-10-24");
  summary = api.listPlanSummaries(db)[0];
  assert.equal(summary.lowest.countryCode, "US");
  const history = db.prepare("SELECT * FROM official_prices WHERE region_id=1").get();
  assert.equal(history.status, "stale");
  assert.equal(history.cny_price, 275);
  assert.equal(history.last_success_at, old);
  assert.equal(history.fx_date, "2026-10-24");
  publish();
  assert.equal(frontend.getOfficialPlanSummaryById(display.id).lowest.countryCode, "US");
  db.exec("DELETE FROM official_prices WHERE region_id=2");
  assert.equal(api.listPlanSummaries(db)[0].lowest.countryCode, "PH", "history beats cheaper estimates");
  publish();
  assert.equal(frontend.getOfficialPlanSummaryById(display.id).lowest.countryCode, "PH");
  db.exec("DELETE FROM official_prices WHERE region_id=1");
  publish();
  assert.equal(frontend.getOfficialPlanSummaryById(display.id).lowest.countryCode, "EG", "estimate-only fallback");
  const a = { ...regions[0], status: "stale", cnyPrice: 100 };
  const b = { ...regions[1], status: "available", cnyPrice: 100 };
  assert.ok(sorting.sortByDisplayCny(b, a) < 0, "prefer current when prices tie");
  assert.deepEqual(sorting.officialComparisonPool([{ ...a, status: "unavailable" }]), []);
  console.log("PASS historical lowest: DB/snapshot/UI queries, FX reranking, legacy summaries, tax, counts, status preservation and estimated fallback");
} finally {
  db.close();
  rmSync(dir, { recursive: true, force: true });
}
