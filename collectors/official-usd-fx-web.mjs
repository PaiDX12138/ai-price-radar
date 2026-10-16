/**
 * 通用：美区 USD 标价 × 即期 FX → 本地币（无公开国别 API 时的官网口径）。
 * Cursor / Grok(X Subscription) / X Premium 共用。
 */

/**
 * @param {number} usd
 * @param {string} currencyCode
 * @param {Record<string, number>} rates
 */
export function usdListToLocal(usd, currencyCode, rates) {
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
  if (["JPY", "KRW", "VND", "IDR", "CLP", "ISK", "HUF"].includes(cc)) {
    return Math.round(value);
  }
  return Math.round(value * 100) / 100;
}

/**
 * @param {number} value
 * @param {string} currencyCode
 */
export function formatUsdFxPrice(value, currencyCode) {
  const cc = String(currencyCode || "USD").toUpperCase();
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: cc,
      maximumFractionDigits: ["JPY", "KRW", "VND", "IDR", "CLP", "ISK", "HUF"].includes(cc)
        ? 0
        : 2,
    }).format(n);
  } catch {
    return `${cc} ${n}`;
  }
}
