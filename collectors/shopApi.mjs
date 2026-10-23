/**
 * ShopApi collector (链动 / 云猫 / QXVX). Lean Phase-1 port of verified POST shapes.
 * Failure of one shop must not mark other shops' offers out of stock.
 *
 * 链动域名 failover（以 Shop/info code===1 为准）:
 *   https://wzyp.cn → https://www.ldxp.cn → https://pay.ldxp.cn
 * 禁止把 CSV「对接码」当 shopToken。
 */
import { classifyTitle } from "./classify.mjs";
import { sanitizeShopDisplayName } from "./sanitize-shop-name.mjs";

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 10;
const DEFAULT_PAGE_DELAY_MS = Number(process.env.COLLECTOR_PAGE_DELAY_MS || 800);
const DEFAULT_SHOP_DELAY_MS = Number(process.env.COLLECTOR_SHOP_DELAY_MS || 0);

/** 链动主流域名顺序（调研：wzyp 约 268 家；pay.ldxp 常报店铺链接不存在） */
export const LIANDONG_BASE_FAILOVER = [
  "https://wzyp.cn",
  "https://www.ldxp.cn",
  "https://pay.ldxp.cn",
];

const BROWSER_UA =
  process.env.COLLECTOR_UA ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

function cleanText(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function statusFromStock(stockCount) {
  if (stockCount === null || stockCount === undefined) return "in_stock";
  if (stockCount <= 0) return "out_of_stock";
  if (stockCount <= 5) return "low_stock";
  return "in_stock";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 同一 host 两次请求的最小间隔（链动默认 1500ms，其余 0），所有 shopApi 请求共用。 */
const LIANDONG_HOST_GAP_MS = Number(process.env.COLLECTOR_LIANDONG_HOST_GAP_MS || 1500);
const OTHER_HOST_GAP_MS = Number(process.env.COLLECTOR_HOST_GAP_MS || 0);
/** @type {Map<string, Promise<void>>} */
const hostQueue = new Map();

/**
 * 按 host 串行限速；详情补抓等其他请求也应先 await 这里，避免叠加触发 WAF。
 * @param {string} url
 */
export function throttleHost(url) {
  const host = hostOf(url);
  if (!host) return Promise.resolve();
  const gap = /(^|\.)(wzyp\.cn|ldxp\.cn)$/i.test(host) ? LIANDONG_HOST_GAP_MS : OTHER_HOST_GAP_MS;
  if (gap <= 0) return Promise.resolve();
  const prev = hostQueue.get(host) || Promise.resolve();
  const next = prev.then(() => delay(gap));
  hostQueue.set(host, next);
  return prev;
}

/** 链动 WAF：403 禁止访问页、arg1= 挑战页、频率提示。 */
export function isWafError(error) {
  const msg = String(error instanceof Error ? error.message : error || "");
  return (
    /Non-JSON response/i.test(msg) ||
    /arg1=/i.test(msg) ||
    /\b403\b/.test(msg) ||
    /访问频率|频率过快|人机|验证码|禁止访问|forbidden/i.test(msg)
  );
}

/**
 * 商家封禁（Shop/info code≠1）。应移出比价展示，但店铺保留并继续采集。
 * @param {unknown} error
 */
export function isShopBannedError(error) {
  return /封禁/.test(String(error instanceof Error ? error.message : error || ""));
}

/**
 * Shop/info.data.custom_status：营业中=1；0（及非 1）=打样，前端弹「店铺已打样：{msg}」。
 * 打样时 goodsList 仍可能返回商品，不得当在售写入目录。
 * @param {Record<string, unknown> | null | undefined} shopInfo
 * @returns {{ open: boolean, kind: 'open' | 'dayang', reason: string | null, customStatus: number | null, customStatusMsg: string }}
 */
export function shopDisplayStateFromInfo(shopInfo) {
  const raw = shopInfo?.custom_status;
  const customStatus =
    raw === null || raw === undefined || raw === "" ? null : Number(raw);
  const customStatusMsg = cleanText(shopInfo?.custom_status_msg || "");
  if (customStatus === 1) {
    return {
      open: true,
      kind: "open",
      reason: null,
      customStatus,
      customStatusMsg,
    };
  }
  const label = customStatusMsg || "其他";
  return {
    open: false,
    kind: "dayang",
    reason: `店铺已打样：${label}`,
    customStatus: Number.isFinite(customStatus) ? customStatus : 0,
    customStatusMsg,
  };
}

function hostOf(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}

function isLiandongSource(source) {
  if (String(source?.platform || "").toLowerCase() === "liandong") return true;
  const host = hostOf(source?.baseUrl || "");
  return /(^|\.)(wzyp\.cn|ldxp\.cn)$/i.test(host);
}

/**
 * Build base URL candidates for a source (liandong gets failover list).
 * @param {{ platform?: string, baseUrl?: string }} source
 * @returns {string[]}
 */
export function resolveBaseCandidates(source) {
  const preferred = String(source?.baseUrl || "")
    .trim()
    .replace(/\/$/, "");
  if (!isLiandongSource(source)) {
    return preferred ? [preferred] : [];
  }
  const ordered = [];
  const seen = new Set();
  const push = (u) => {
    const base = String(u || "")
      .trim()
      .replace(/\/$/, "");
    if (!base || seen.has(base)) return;
    seen.add(base);
    ordered.push(base);
  };
  push(preferred);
  for (const b of LIANDONG_BASE_FAILOVER) push(b);
  return ordered;
}

/**
 * @param {string} url
 * @param {object} body
 * @param {{ referer?: string, origin?: string, timeoutMs?: number, fetchImpl?: typeof fetch }} [opts]
 */
export async function postJson(url, body, opts = {}) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  if (!fetchImpl) throw new Error("fetch is unavailable");
  await throttleHost(url);
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const origin =
    opts.origin ||
    (() => {
      try {
        return new URL(url).origin;
      } catch {
        return undefined;
      }
    })();
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/plain, */*",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "user-agent": BROWSER_UA,
        ...(origin ? { origin } : {}),
        ...(opts.referer ? { referer: opts.referer } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Non-JSON response HTTP ${res.status}: ${text.slice(0, 160)}`);
    }
    if (res.status === 403) {
      const msg = cleanText(json?.msg || json?.message || "HTTP 403");
      const err = new Error(msg);
      err.code = 403;
      throw err;
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probe Shop/info across failover bases; returns first code===1.
 * @param {string} token
 * @param {string[]} bases
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
 */
export async function resolveWorkingBase(token, bases, opts = {}) {
  /** @type {{ base: string, error: string }[]} */
  const failures = [];
  for (const base of bases) {
    const referer = `${base}/shop/${encodeURIComponent(token)}`;
    try {
      const infoPayload = await postJson(
        `${base}/shopApi/Shop/info`,
        { token, category_key: "" },
        { referer, origin: base, fetchImpl: opts.fetchImpl, timeoutMs: opts.timeoutMs },
      );
      if (infoPayload?.code === 1 && infoPayload.data) {
        return { ok: true, base, infoPayload, failures };
      }
      failures.push({
        base,
        error: cleanText(infoPayload?.msg || infoPayload?.message || `code=${infoPayload?.code}`),
      });
    } catch (error) {
      failures.push({
        base,
        error: error instanceof Error ? error.message : String(error),
      });
      // 被 WAF 拦时换域名只会多打几次，直接停
      if (isWafError(error)) break;
    }
  }
  return {
    ok: false,
    base: null,
    infoPayload: null,
    failures,
    waf: failures.some((f) => isWafError(f.error)),
    error: failures.map((f) => `${hostOf(f.base) || f.base}:${f.error}`).join(" | ") || "No working base",
  };
}

/**
 * Collect one ShopApi source.
 * Pass `fetchImpl` from proxy-pool channel for 链动; omit for direct (host gap still applies).
 * @param {{ id: string, name?: string, platform?: string, baseUrl: string, shopToken: string }} source
 * @param {{ pageDelayMs?: number, maxPages?: number, pageSize?: number, fetchImpl?: typeof fetch, samplePrice?: boolean, shopDelayMs?: number }} [options]
 */
export async function collectShopApi(source, options = {}) {
  const token = String(source.shopToken || "").trim();
  const bases = resolveBaseCandidates(source);
  if (!token || !bases.length) {
    return {
      ok: false,
      sourceId: source.id,
      error: "Missing baseUrl or shopToken",
      offers: [],
      shopInfo: null,
      resolvedBase: null,
    };
  }

  const pageDelayMs = options.pageDelayMs ?? DEFAULT_PAGE_DELAY_MS;
  const shopDelayMs = options.shopDelayMs ?? DEFAULT_SHOP_DELAY_MS;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const capturedAt = new Date().toISOString();
  const fetchImpl = options.fetchImpl;

  if (shopDelayMs > 0) await delay(shopDelayMs);

  try {
    const resolved = await resolveWorkingBase(token, bases, { fetchImpl });
    if (!resolved.ok || !resolved.base || !resolved.infoPayload) {
      const error = cleanText(resolved.error || "Shop info unavailable");
      const banned = isShopBannedError(error);
      return {
        ok: false,
        sourceId: source.id,
        error,
        offers: [],
        shopInfo: null,
        resolvedBase: null,
        failoverFailures: resolved.failures,
        ...(banned
          ? {
              withdrawDisplay: true,
              withdrawReason: error,
              displayState: "banned",
            }
          : {}),
      };
    }

    const base = resolved.base;
    const shopInfo = resolved.infoPayload.data;
    const storeName = sanitizeShopDisplayName(shopInfo.nickname || source.name || source.id, source.shopToken || source.id);
    const referer = `${base}/shop/${encodeURIComponent(token)}`;
    const sourceUrl = shopInfo.link || referer;
    const display = shopDisplayStateFromInfo(shopInfo);

    // 打样：info 仍 code===1 且 goodsList 有货，但买家端不可下单 → 清空展示、保留店铺继续采
    if (!display.open) {
      return {
        ok: true,
        sourceId: source.id,
        error: null,
        offers: [],
        resolvedBase: base,
        withdrawDisplay: true,
        withdrawReason: display.reason,
        displayState: display.kind,
        shopInfo: {
          name: storeName,
          link: sourceUrl,
          nickname: shopInfo.nickname || null,
          host: new URL(base).host,
          customStatus: display.customStatus,
          customStatusMsg: display.customStatusMsg,
          displayState: display.kind,
        },
      };
    }

    await delay(pageDelayMs);
    const categoriesPayload = await postJson(
      `${base}/shopApi/Shop/categoryList`,
      { token, goods_type: "card", category_key: "" },
      { referer: sourceUrl, origin: base, fetchImpl },
    );
    if (categoriesPayload?.code !== 1 || !Array.isArray(categoriesPayload.data)) throw new Error("Category list incomplete");
    const categories = Array.isArray(categoriesPayload?.data) ? categoriesPayload.data : [];
    const selected = categories.filter((c) => Number(c.goods_count || 0) > 0 && Number(c.id) !== 0);
    const categoryIds = selected.length
      ? selected.map((c) => Number(c.id))
      : categories.some((c) => Number(c.id) === 0)
        ? [0]
        : [0];

    /** @type {any[]} */
    const offers = [];
    const seen = new Set();

    let collectionComplete = true;
    for (const categoryId of categoryIds) {
      let ended = false;
      for (let page = 1; page <= maxPages; page += 1) {
        await delay(pageDelayMs);
        const listPayload = await postJson(
          `${base}/shopApi/Shop/goodsList`,
          {
            token,
            keywords: "",
            category_id: categoryId,
            goods_type: "card",
            current: page,
            pageSize,
          },
          { referer: sourceUrl, origin: base, fetchImpl },
        );
        if (listPayload?.code !== 1 || !Array.isArray(listPayload?.data?.list)) {
          collectionComplete = false;
          break;
        }
        const items = listPayload.data.list;
        if (!items.length) { ended = true; break; }

        for (const item of items) {
          const title = cleanText(item.name);
          const listedPrice = numberOrNull(item.price ?? item.real_price);
          if (!title || listedPrice === null) continue;

          const goodsKey = item.goods_key ? String(item.goods_key) : "";
          const itemUrl = item.link || (goodsKey ? `${base}/item/${goodsKey}` : sourceUrl);
          const dedupeKey = goodsKey || itemUrl;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);

          const stockCount = numberOrNull(item.extend?.stock_count);
          const disabled = Number(item.status ?? 1) !== 1;
          const status = disabled ? "out_of_stock" : statusFromStock(stockCount);
          const { productSlug, warranty } = classifyTitle(title, { price: listedPrice });
          const categoryName = cleanText(item.category?.name || "");

          offers.push({
            id: `${source.id}-${goodsKey || offers.length}`,
            productSlug: productSlug || "other-unclassified",
            sourceId: source.id,
            sourceTitle: title,
            price: listedPrice,
            listedPrice,
            status,
            lifecycle: disabled ? "delisted" : "active",
            lifecycleReason: disabled ? "explicit_listing_status" : null,
            lastVerifiedAt: capturedAt,
            stockCount: disabled ? 0 : stockCount,
            url: itemUrl,
            tags: [categoryName, item.goods_type === "card" ? "card" : null, "shopApi"].filter(Boolean),
            capturedAt,
            warranty,
            goodsKey: goodsKey || null,
            classified: Boolean(productSlug),
          });
        }

        if (items.length < pageSize) { ended = true; break; }
      }
      if (!ended) collectionComplete = false;
    }

    return {
      ok: true,
      collectionComplete,
      sourceId: source.id,
      error: null,
      offers,
      resolvedBase: base,
      withdrawDisplay: false,
      displayState: "open",
      shopInfo: {
        name: storeName,
        link: sourceUrl,
        nickname: shopInfo.nickname || null,
        host: new URL(base).host,
        customStatus: display.customStatus,
        customStatusMsg: display.customStatusMsg,
        displayState: "open",
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const banned = isShopBannedError(msg);
    return {
      ok: false,
      sourceId: source.id,
      error: msg,
      offers: [],
      shopInfo: null,
      resolvedBase: null,
      ...(banned
        ? {
            withdrawDisplay: true,
            withdrawReason: msg,
            displayState: "banned",
          }
        : {}),
    };
  }
}
