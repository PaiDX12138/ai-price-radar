/**
 * Kiro 官网直购地区价（公开口径）。
 *
 * kiro.dev/pricing 仅展示美区 USD 月付标价（税前）；无 ChatGPT 式公开国别 JSON，
 * 也无官方 App Store 订阅（IDE 走官网/Stripe）。支持国名单见定价页 FAQ。
 * 本采集器：支持国 = USD × 即期 FX 本地币（tax=exclusive）。
 *
 * 证据：Pro $20 / Pro+ $40 / Pro Max $100 / Power $200（per user / month）
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatUsdFxPrice, usdListToLocal } from "./official-usd-fx-web.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const COUNTRIES_PATH = join(
  root,
  "config",
  "official-prices",
  "kiro-web-countries.json",
);

export const KIRO_WEB_SOURCE_URL = "https://kiro.dev/pricing/";

/** @type {Set<string> | null} */
let cachedCountries = null;

export function loadKiroWebCountries() {
  if (cachedCountries) return cachedCountries;
  const raw = JSON.parse(readFileSync(COUNTRIES_PATH, "utf8"));
  cachedCountries = new Set(
    (Array.isArray(raw) ? raw : []).map((c) => String(c).toUpperCase()),
  );
  return cachedCountries;
}

export function isKiroWebCountry(countryCode) {
  return loadKiroWebCountries().has(String(countryCode || "").toUpperCase());
}

export const kiroUsdToLocal = usdListToLocal;
export const formatKiroWebPrice = formatUsdFxPrice;
