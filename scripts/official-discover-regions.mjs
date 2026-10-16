#!/usr/bin/env node
/**
 * Discover every Apple storefront that sells the official app → regions.json.
 *
 *   pnpm official:regions
 *
 * Scans storefront ids, keeps ids Apple echoes back in meta.storefront (unknown ids
 * fall back to US; storefronts without the app answer a plist), then resolves each
 * storefront's currency via the iTunes lookup API.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchAppStoreOffers,
  fetchStorefrontCurrency,
  mapWithConcurrency,
} from "../collectors/official-appstore.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_DIR = join(root, "config", "official-prices");
const OUT = join(CONFIG_DIR, "regions.json");

const FIRST_ID = 143441;
const LAST_ID = 143640;
const LABEL_OVERRIDES = { HK: "香港", MO: "澳门", TW: "台湾" };

const apps = JSON.parse(readFileSync(join(CONFIG_DIR, "apps.json"), "utf8"));
const app = apps.find((a) => a.enabled !== false);
if (!app) {
  console.error("[official:regions] no enabled app in apps.json");
  process.exit(1);
}

const zh = new Intl.DisplayNames(["zh-Hans"], { type: "region" });
const ids = Array.from({ length: LAST_ID - FIRST_ID + 1 }, (_, i) => FIRST_ID + i);

/** @type {Map<string, string>} cc → storefront id */
const found = new Map();
let unavailable = 0;
await mapWithConcurrency(ids, 4, async (id) => {
  const page = await fetchAppStoreOffers({
    appStoreId: app.appStoreId,
    appStoreSlug: app.appStoreSlug,
    storefrontId: id,
  });
  if (page.unavailable) unavailable += 1;
  const sf = page.storefront;
  if (page.ok && sf?.cc && sf.id === String(id)) found.set(sf.cc, sf.id);
});
console.log(`[official:regions] storefronts with app: ${found.size} (no app: ${unavailable})`);

const codes = [...found.keys()].sort((a, b) => (a === "US" ? -1 : b === "US" ? 1 : a.localeCompare(b)));
const currencies = await mapWithConcurrency(
  codes,
  6,
  (cc) => fetchStorefrontCurrency(app.appStoreId, cc),
  80,
);

const regions = [];
codes.forEach((cc, i) => {
  const currencyCode = currencies[i];
  if (!currencyCode) {
    console.warn(`[official:regions] skip ${cc}: currency unknown`);
    return;
  }
  regions.push({
    countryCode: cc,
    countryLabel: LABEL_OVERRIDES[cc] || zh.of(cc) || cc,
    currencyCode,
    storefrontId: found.get(cc),
    enabled: true,
    priority: (regions.length + 1) * 10,
  });
});

// 保留只存在于官网渠道的地区（storefrontId = null，由 pnpm official:regions:web 维护）
let previous = [];
try {
  previous = JSON.parse(readFileSync(OUT, "utf8"));
} catch {
  // first run
}
const iosCodes = new Set(regions.map((r) => r.countryCode));
const webOnly = previous.filter((r) => !r.storefrontId && !iosCodes.has(r.countryCode));
const merged = [...regions, ...webOnly].sort((a, b) =>
  a.countryCode === "US" ? -1 : b.countryCode === "US" ? 1 : a.countryCode.localeCompare(b.countryCode),
);
merged.forEach((r, i) => {
  r.priority = (i + 1) * 10;
});

writeFileSync(OUT, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
console.log(
  `[official:regions] wrote ${merged.length} regions (ios ${regions.length} + web-only ${webOnly.length}) → ${OUT}`,
);
