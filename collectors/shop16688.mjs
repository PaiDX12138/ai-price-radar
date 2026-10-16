/**
 * 16688 平台采集器（已探针）。
 * POST {base}/shopApi/shop/detail  { shop_no }
 * POST {base}/shopApi/goods/list   { shop_no }
 * 详情深链：{base}/goods/{goods_no}
 */
import { classifyTitle } from "./classify.mjs";
import { sanitizeShopDisplayName } from "./sanitize-shop-name.mjs";
import { BROWSER_UA, cleanText, compact, delay, numberOrNull } from "./util.mjs";

const DEFAULT_BASE = "https://www.16688.com.cn";
const DEFAULT_SHOP_DELAY_MS = Number(process.env.COLLECTOR_SHOP_DELAY_MS || 0);

/**
 * 16688 库存语义（已探针）：
 * - stock_available_quantity ≥ 0：真实件数
 * - stock_available_quantity === -1：平台「有货未计件」（代充/现做常见），不是缺货
 * - stock_available_status：high / low / in / out …
 */
function statusFrom16688(item) {
  const raw = String(item?.stock_available_status || "").toLowerCase().trim();
  const qtyRaw = numberOrNull(item?.stock_available_quantity);
  // -1 = 未披露数量，不当成 0 库存
  const qty = qtyRaw !== null && qtyRaw < 0 ? null : qtyRaw;

  if (raw === "out" || raw === "sold_out" || raw === "empty") {
    return { status: "out_of_stock", stockCount: qty ?? 0 };
  }
  if (raw === "low" || raw === "soon" || raw === "limited") {
    return { status: "low_stock", stockCount: qty };
  }
  if (raw === "high" || raw === "in" || raw === "available" || raw === "ok") {
    if (qty !== null && qty <= 0) return { status: "out_of_stock", stockCount: 0 };
    if (qty !== null && qty <= 5) return { status: "low_stock", stockCount: qty };
    return { status: "in_stock", stockCount: qty };
  }
  if (qty !== null) {
    if (qty <= 0) return { status: "out_of_stock", stockCount: 0 };
    if (qty <= 5) return { status: "low_stock", stockCount: qty };
    return { status: "in_stock", stockCount: qty };
  }
  // 无 status、qty=-1/空：在售列表里的商品默认有货、件数未知
  return { status: "in_stock", stockCount: null };
}

/**
 * @param {string} url
 * @param {object} body
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number, referer?: string }} [opts]
 */
async function postJson(url, body, opts = {}) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  if (!fetchImpl) throw new Error("fetch is unavailable");
  const timeoutMs = opts.timeoutMs ?? Number(process.env.COLLECTOR_TIMEOUT_MS || 20000);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        accept: "application/json, text/plain, */*",
        "content-type": "application/json",
        "user-agent": BROWSER_UA,
        origin: new URL(url).origin,
        referer: opts.referer || new URL(url).origin + "/",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`16688 non-json HTTP ${res.status}: ${text.slice(0, 160)}`);
    }
    if (!res.ok) throw new Error(`16688 HTTP ${res.status}: ${text.slice(0, 160)}`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {{ id: string, baseUrl?: string, shopNo?: string, shopToken?: string, name?: string }} source
 * @param {{ fetchImpl?: typeof fetch, shopDelayMs?: number }} [options]
 */
export async function collectShop16688(source, options = {}) {
  const base = String(source.baseUrl || DEFAULT_BASE).replace(/\/$/, "");
  const shopNo = String(source.shopNo || source.shopToken || "").trim();
  if (!shopNo) {
    return { ok: false, sourceId: source.id, error: "missing shopNo", offers: [] };
  }

  const capturedAt = new Date().toISOString();
  const referer = `${base}/shop/${encodeURIComponent(shopNo)}`;

  try {
    if (options.shopDelayMs || DEFAULT_SHOP_DELAY_MS) {
      await delay(options.shopDelayMs ?? DEFAULT_SHOP_DELAY_MS);
    }

    const shopPayload = await postJson(
      `${base}/shopApi/shop/detail`,
      { shop_no: shopNo },
      { fetchImpl: options.fetchImpl, referer },
    );
    if (Number(shopPayload?.code) !== 1) {
      const error = cleanText(shopPayload?.msg || "shop detail failed");
      const banned = /封禁/.test(error);
      return {
        ok: false,
        sourceId: source.id,
        error,
        offers: [],
        ...(banned
          ? {
              withdrawDisplay: true,
              withdrawReason: error,
              displayState: "banned",
            }
          : {}),
      };
    }

    const shopName = sanitizeShopDisplayName(
      cleanText(shopPayload?.data?.name || source.name || shopNo),
    );

    const goodsPayload = await postJson(
      `${base}/shopApi/goods/list`,
      { shop_no: shopNo },
      { fetchImpl: options.fetchImpl, referer },
    );
    if (Number(goodsPayload?.code) !== 1) {
      return {
        ok: false,
        sourceId: source.id,
        error: cleanText(goodsPayload?.msg || "goods list failed"),
        offers: [],
        meta: { shopName },
      };
    }

    const list = Array.isArray(goodsPayload?.data?.list) ? goodsPayload.data.list : [];
    /** @type {any[]} */
    const offers = [];

    for (const item of list) {
      const title = cleanText(item?.name);
      const price = numberOrNull(item?.price);
      const goodsNo = cleanText(item?.goods_no);
      if (!title || price === null || !goodsNo) continue;

      const { status, stockCount } = statusFrom16688(item);
      const { productSlug, warranty } = classifyTitle(title, { price });
      // 已探针：1=自动发货；2/3=人工发货（代充/现做常见，qty 多为 -1）
      const dm = Number(item?.delivery_method);
      const delivery = dm === 1 ? "自动发货" : dm === 2 || dm === 3 ? "人工发货" : null;
      // 无计件库存的人工发货：卡片直接展示「人工发货」，不写「有货」
      const stockLabel =
        stockCount === null && delivery === "人工发货" ? "人工发货" : null;

      offers.push({
        id: `${source.id}-${goodsNo}`,
        productSlug: productSlug || "other-unclassified",
        sourceId: source.id,
        sourceTitle: title,
        price,
        listedPrice: price,
        status,
        stockCount,
        ...(stockLabel ? { stockLabel } : {}),
        url: `${base}/goods/${encodeURIComponent(goodsNo)}`,
        tags: compact([
          cleanText(item?.goods_category_no),
          delivery,
          warranty ? "质保" : null,
          "16688",
        ]),
        capturedAt,
        collectorKind: "shop16688",
        warranty: Boolean(warranty),
        meta: {
          shopNo,
          goodsNo,
          shopName,
          deliveryMethod: Number.isFinite(dm) ? dm : null,
        },
      });
    }

    return {
      ok: true,
      sourceId: source.id,
      offers,
      meta: {
        shopName,
        shopNo,
        baseUrl: base,
        offerCount: offers.length,
      },
    };
  } catch (err) {
    return {
      ok: false,
      sourceId: source.id,
      error: err instanceof Error ? err.message : String(err),
      offers: [],
    };
  }
}
