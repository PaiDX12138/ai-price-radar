/** Shared collector helpers (card-shop only). */

export const BROWSER_UA =
  process.env.COLLECTOR_UA ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

export function cleanText(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/,/g, "").replace(/[￥¥$]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function statusFromStock(stockCount) {
  if (stockCount === null || stockCount === undefined) return "in_stock";
  if (stockCount <= 0) return "out_of_stock";
  if (stockCount <= 5) return "low_stock";
  return "in_stock";
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function compact(list) {
  return (list || []).filter(Boolean).map((x) => String(x).trim()).filter(Boolean);
}

export function localized(value) {
  if (value == null) return "";
  if (typeof value === "string") return cleanText(value);
  if (typeof value === "object") {
    return cleanText(value["zh-CN"] || value.zh || value["zh-Hans"] || value.en || Object.values(value)[0]);
  }
  return cleanText(value);
}

export function absolutize(url, baseUrl) {
  const raw = String(url || "").trim();
  if (!raw) return String(baseUrl || "").replace(/\/$/, "");
  try {
    return new URL(raw, baseUrl).href;
  } catch {
    return raw;
  }
}

export function hostOf(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * @param {string} url
 * @param {{ timeoutMs?: number, fetchImpl?: typeof fetch, headers?: Record<string,string> }} [opts]
 */
export async function fetchJson(url, opts = {}) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  if (!fetchImpl) throw new Error("fetch is unavailable");
  const timeoutMs = opts.timeoutMs ?? Number(process.env.COLLECTOR_TIMEOUT_MS || 20000);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      signal: ctrl.signal,
      headers: {
        accept: "application/json,text/plain,*/*",
        "user-agent": BROWSER_UA,
        ...(opts.headers || {}),
      },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON from ${url}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} url
 * @param {{ timeoutMs?: number, fetchImpl?: typeof fetch }} [opts]
 */
export async function fetchText(url, opts = {}) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  if (!fetchImpl) throw new Error("fetch is unavailable");
  const timeoutMs = opts.timeoutMs ?? Number(process.env.COLLECTOR_TIMEOUT_MS || 25000);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      signal: ctrl.signal,
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent": BROWSER_UA,
      },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export function kindToPlatform(kind) {
  const map = {
    kami: "kami",
    dujiao: "dujiao",
    shopApi: "liandong",
    shop16688: "shop16688",
    getgptApi: "getgpt",
    ikunloveApi: "ikunlove",
    xiaoheiwan: "xiaoheiwan",
    publicProductsApi: "public",
    shopUserProductsApi: "public",
    opensoraHtml: "public",
    makerichHtml: "public",
    beibeiHtml: "public",
    unicornHtml: "public",
    mooncakeCatalog: "public",
    blackcatWholesale: "public",
    genericHtml: "public",
  };
  return map[kind] || "public";
}
