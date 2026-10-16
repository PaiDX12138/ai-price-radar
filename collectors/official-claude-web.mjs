/**
 * Claude 官网直购地区价（公开口径）。
 * 配置：config/official-prices/claude-web-countries.json（ISO2）
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const COUNTRIES_PATH = join(
  root,
  "config",
  "official-prices",
  "claude-web-countries.json",
);

export const CLAUDE_WEB_SOURCE_URL = "https://claude.com/pricing";

/** @type {Set<string> | null} */
let cachedCountries = null;

export function loadClaudeWebCountries() {
  if (cachedCountries) return cachedCountries;
  const raw = JSON.parse(readFileSync(COUNTRIES_PATH, "utf8"));
  cachedCountries = new Set(
    (Array.isArray(raw) ? raw : []).map((c) => String(c).toUpperCase()),
  );
  return cachedCountries;
}

export function isClaudeWebCountry(countryCode) {
  return loadClaudeWebCountries().has(String(countryCode || "").toUpperCase());
}

/**
 * USD list → 本地币金额（rates 为 per-USD，与库内一致）。
 * @param {number} usd
 * @param {string} currencyCode
 * @param {Record<string, number>} rates
 */
export function claudeUsdToLocal(usd, currencyCode, rates) {
  const cc = String(currencyCode || "USD").toUpperCase();
  if (!Number.isFinite(usd) || usd <= 0) return null;
  if (cc === "USD") return roundMoney(usd, cc);
  const perUsd = rates[cc];
  if (!Number.isFinite(perUsd) || perUsd <= 0) return null;
  return roundMoney(usd * perUsd, cc);
}

/**
 * @param {number} value
 * @param {string} currencyCode
 */
export function roundMoney(value, currencyCode) {
  const cc = String(currencyCode || "USD").toUpperCase();
  // 零小数货币
  if (["JPY", "KRW", "VND", "IDR", "CLP", "ISK", "HUF"].includes(cc)) {
    return Math.round(value);
  }
  if (["CAD", "AUD", "CHF", "SGD", "HKD", "NZD"].includes(cc)) {
    // NZ 参考站 Max 用两位（173.91）；Pro 也有 34.78 → 保留两位更稳
    return Math.round(value * 100) / 100;
  }
  return Math.round(value * 100) / 100;
}

/**
 * @param {number} value
 * @param {string} currencyCode
 */
export function formatClaudeWebPrice(value, currencyCode) {
  const cc = String(currencyCode || "USD").toUpperCase();
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const ints = ["JPY", "KRW", "VND", "IDR", "CLP", "ISK", "HUF"];
  const body = ints.includes(cc)
    ? Math.round(n).toLocaleString("en-US")
    : n.toLocaleString("en-US", {
        minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
        maximumFractionDigits: 2,
      });
  if (cc === "USD") return `$${body}`;
  if (cc === "EUR") return `€${body}`;
  if (cc === "GBP") return `£${body}`;
  if (cc === "JPY") return `¥${body}`;
  if (cc === "CNY") return `¥${body}`;
  return `${cc} ${body}`;
}
