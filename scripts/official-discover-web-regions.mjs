#!/usr/bin/env node
/**
 * Discover every country that chatgpt.com sells to → regions.json (web-only regions).
 *
 *   pnpm official:regions:web
 *
 * Probes the anonymous pricing config for each ISO country code. 200 + matching
 * country_code = supported; 404 = ChatGPT not offered there (CN / RU / IR …).
 * Existing regions (including Apple storefront data) are kept untouched; countries
 * that only exist on the web channel are appended with storefrontId = null.
 * Stops without writing when the host starts rate limiting (403 / 429).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mapWithConcurrency } from "../collectors/official-appstore.mjs";
import { fetchChatgptWebPricing } from "../collectors/official-chatgpt-web.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "config", "official-prices", "regions.json");
const LABEL_OVERRIDES = { HK: "香港", MO: "澳门", TW: "台湾" };

const ISO_CODES =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW".split(
    " ",
  );

const zh = new Intl.DisplayNames(["zh-Hans"], { type: "region" });
const existing = JSON.parse(readFileSync(OUT, "utf8"));
const known = new Map(existing.map((r) => [r.countryCode, r]));

/** @type {Map<string, string>} cc → web currency */
const supported = new Map();
let unavailable = 0;
let failed = 0;
let blockedStreak = 0;
let aborted = false;

await mapWithConcurrency(
  ISO_CODES,
  3,
  async (cc) => {
    if (aborted) return;
    const page = await fetchChatgptWebPricing(cc);
    if (page.blocked) {
      blockedStreak += 1;
      if (blockedStreak >= 3) aborted = true;
      return;
    }
    blockedStreak = 0;
    if (page.unavailable) {
      unavailable += 1;
      return;
    }
    if (!page.ok) {
      failed += 1;
      console.warn(`[official:regions:web] ${cc} failed: ${page.error}`);
      return;
    }
    const currency = String(page.config?.currency_config?.symbol_code || "").toUpperCase();
    if (currency) supported.set(cc, currency);
  },
  250,
);

if (aborted) {
  console.error("[official:regions:web] rate limited (403/429); nothing written");
  process.exit(1);
}
console.log(
  `[official:regions:web] supported=${supported.size} unavailable=${unavailable} failed=${failed}`,
);

const added = [];
const merged = [...existing];
for (const [cc, currencyCode] of supported) {
  if (known.has(cc)) continue;
  merged.push({
    countryCode: cc,
    countryLabel: LABEL_OVERRIDES[cc] || zh.of(cc) || cc,
    currencyCode,
    storefrontId: null,
    enabled: true,
    priority: 0,
  });
  added.push(cc);
}

merged.sort((a, b) =>
  a.countryCode === "US" ? -1 : b.countryCode === "US" ? 1 : a.countryCode.localeCompare(b.countryCode),
);
merged.forEach((r, i) => {
  r.priority = (i + 1) * 10;
});

writeFileSync(OUT, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
console.log(
  `[official:regions:web] wrote ${merged.length} regions (+${added.length} web-only: ${added.sort().join(",") || "none"}) → ${OUT}`,
);
