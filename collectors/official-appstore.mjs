/**
 * Apple App Store public product page → in-app purchase prices.
 *
 * Storefront is chosen only by `x-apple-store-front: {id},29` (path stays /us/);
 * Apple echoes the served storefront in storePlatformData["product-dv"].meta and
 * falls back to US for unknown ids. Apps not sold in a storefront answer a plist.
 * IAP list lives in pageData.addOns: buyParams carries offerName and price in
 * 1/1000 of the local currency.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TIMEOUT_MS = 20_000;
const ATTEMPTS = 3;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {{ appStoreId: string, appStoreSlug?: string, storefrontId: string | number }} opts
 * @returns {Promise<{
 *   ok: boolean,
 *   unavailable?: boolean,
 *   status: number,
 *   storefront?: { cc: string, id: string } | null,
 *   items?: Array<{ name: string, offerName: string, priceText: string, priceValue: number }>,
 *   error?: string,
 *   url: string,
 * }>}
 */
export async function fetchAppStoreOffers({ appStoreId, appStoreSlug = "app", storefrontId }) {
  const url = `https://apps.apple.com/us/app/${appStoreSlug}/id${appStoreId}`;
  let lastError = "";
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": UA,
          "accept-language": "en-US,en;q=0.9",
          "x-apple-store-front": `${storefrontId},29`,
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status === 429 || res.status >= 500) {
        lastError = `HTTP ${res.status}`;
        await sleep(1000 * attempt);
        continue;
      }
      const text = await res.text();
      if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}`, url };
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return {
          ok: false,
          unavailable: /<plist/i.test(text),
          status: res.status,
          error: "non-JSON response",
          url,
        };
      }
      const storefront = data?.storePlatformData?.["product-dv"]?.meta?.storefront ?? null;
      const addOns = Array.isArray(data?.pageData?.addOns) ? data.pageData.addOns : [];
      return {
        ok: true,
        status: res.status,
        storefront: storefront
          ? { cc: String(storefront.cc || "").toUpperCase(), id: String(storefront.id || "") }
          : null,
        items: parseAddOns(addOns),
        url,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      await sleep(1000 * attempt);
    }
  }
  return { ok: false, status: 0, error: lastError || "fetch failed", url };
}

/** @param {any[]} addOns */
export function parseAddOns(addOns) {
  /** @type {Array<{ name: string, offerName: string, priceText: string, priceValue: number }>} */
  const out = [];
  for (const a of addOns) {
    const q = new URLSearchParams(String(a?.buyParams || ""));
    const offerName = q.get("offerName");
    const milli = Number(q.get("price"));
    if (!offerName || !Number.isFinite(milli) || milli <= 0) continue;
    out.push({
      name: String(a?.name || "").trim(),
      offerName,
      priceText: String(a?.price || "").replace(/\s+/g, " ").trim(),
      priceValue: milli / 1000,
    });
  }
  return out;
}

/**
 * Storefront currency from the public iTunes lookup API.
 * @param {string} appStoreId
 * @param {string} countryCode
 */
export async function fetchStorefrontCurrency(appStoreId, countryCode) {
  const url = `https://itunes.apple.com/lookup?id=${appStoreId}&country=${countryCode.toLowerCase()}`;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const currency = json?.results?.[0]?.currency;
      return typeof currency === "string" && currency ? currency.toUpperCase() : null;
    } catch {
      await sleep(800 * attempt);
    }
  }
  return null;
}

/**
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<R>} fn
 * @param {number} [gapMs] per-worker pause between requests
 * @returns {Promise<R[]>}
 */
export async function mapWithConcurrency(items, limit, fn, gapMs = 150) {
  /** @type {R[]} */
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i], i);
      if (gapMs > 0) await sleep(gapMs);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
