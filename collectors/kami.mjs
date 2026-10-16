/**
 * Kami / 异次元类自动发货采集器。
 * GET {base}/user/api/index/commodity?limit=100&page=n
 *
 * stock 字段可能是数字，也可能是文案：非常多 / 充足 / 一般 / 即将售罄 / 已售罄；
 * 另有 stock_state：0 售罄 · 1 紧张 · 2 一般 · 3 充足 · 4 非常多。
 */
import { classifyTitle } from "./classify.mjs";
import {
  cleanText,
  compact,
  delay,
  fetchJson,
  numberOrNull,
  statusFromStock,
} from "./util.mjs";

/** 部分站用超大数字表示「无限/非常多」 */
const ABUNDANT_STOCK_THRESHOLD = 999_999;

/**
 * @param {unknown} stock
 * @param {unknown} [stockState]
 * @returns {{ stockCount: number | null, status: string, stockLabel: string | null }}
 */
export function kamiInventoryFromStock(stock, stockState) {
  const text = cleanText(stock);
  const state = numberOrNull(stockState);
  const numeric = numberOrNull(stock);

  // 文案优先（避免「已售罄」被 Number 成 NaN 后误判）
  if (text) {
    if (/已售罄|^售罄$|缺货|无货|卖完/.test(text)) {
      return { stockCount: 0, status: "out_of_stock", stockLabel: null };
    }
    if (/即将售罄|库存紧张|库存较少|不多|较少/.test(text)) {
      return { stockCount: null, status: "low_stock", stockLabel: text };
    }
    if (/非常多|很多|充足|充裕|海量|大量/.test(text)) {
      return { stockCount: null, status: "in_stock", stockLabel: text };
    }
    if (/^一般$|正常|有货/.test(text)) {
      return { stockCount: null, status: "in_stock", stockLabel: text };
    }
  }

  if (numeric !== null) {
    if (numeric <= 0) {
      return { stockCount: 0, status: "out_of_stock", stockLabel: null };
    }
    // 哨兵大数 → 按「非常多」展示，不把 10000000 甩到卡片上
    if (numeric >= ABUNDANT_STOCK_THRESHOLD) {
      return { stockCount: null, status: "in_stock", stockLabel: "非常多" };
    }
    return {
      stockCount: numeric,
      status: statusFromStock(numeric),
      stockLabel: null,
    };
  }

  // 仅有 stock_state
  if (state !== null) {
    if (state <= 0) return { stockCount: 0, status: "out_of_stock", stockLabel: null };
    if (state === 1) return { stockCount: null, status: "low_stock", stockLabel: "即将售罄" };
    if (state === 2) return { stockCount: null, status: "in_stock", stockLabel: "一般" };
    if (state === 3) return { stockCount: null, status: "in_stock", stockLabel: "充足" };
    if (state >= 4) return { stockCount: null, status: "in_stock", stockLabel: "非常多" };
  }

  return { stockCount: null, status: "in_stock", stockLabel: null };
}

function kamiCommodityUrl(base, id) {
  const b = String(base || "").replace(/\/$/, "");
  return `${b}/?cid=${encodeURIComponent(String(id))}`;
}

/**
 * @param {{ id: string, baseUrl: string, name?: string }} source
 * @param {{ maxPages?: number, pageDelayMs?: number, fetchImpl?: typeof fetch }} [options]
 */
export async function collectKami(source, options = {}) {
  const base = String(source.baseUrl || "").replace(/\/$/, "");
  if (!base) {
    return { ok: false, sourceId: source.id, error: "missing baseUrl", offers: [] };
  }
  const maxPages = options.maxPages ?? 10;
  const pageDelayMs = options.pageDelayMs ?? Number(process.env.COLLECTOR_PAGE_DELAY_MS || 400);
  const capturedAt = new Date().toISOString();
  /** @type {any[]} */
  const offers = [];

  try {
    for (let page = 1; page <= maxPages; page += 1) {
      if (page > 1 && pageDelayMs > 0) await delay(pageDelayMs);
      const payload = await fetchJson(
        `${base}/user/api/index/commodity?limit=100&page=${page}`,
        { fetchImpl: options.fetchImpl },
      );
      const items = Array.isArray(payload?.data) ? payload.data : [];
      if (!items.length) break;

      for (const item of items) {
        const title = cleanText(item.name);
        const price = numberOrNull(item.user_price ?? item.price);
        if (!title || price === null) continue;

        const inventory = kamiInventoryFromStock(item.stock, item.stock_state);
        const hidden = Number(item.hide || 0) !== 0;
        const disabled = Number(item.status ?? 1) !== 1 || hidden;
        const status = disabled ? "out_of_stock" : inventory.status;
        const { productSlug, warranty } = classifyTitle(title, { price });
        const categoryName = cleanText(item.category?.name || "");
        const stockCount =
          disabled && inventory.stockCount === null ? 0 : inventory.stockCount;

        offers.push({
          id: `${source.id}-${item.id ?? offers.length}`,
          productSlug: productSlug || "other-unclassified",
          sourceId: source.id,
          sourceTitle: title,
          price,
          listedPrice: price,
          status,
          stockCount,
          ...(inventory.stockLabel && !disabled
            ? { stockLabel: inventory.stockLabel }
            : {}),
          url: kamiCommodityUrl(base, item.id),
          tags: compact([
            categoryName,
            item.delivery_way === 0 ? "自动发货" : null,
            "kami",
          ]),
          capturedAt,
          warranty,
          classified: Boolean(productSlug),
        });
      }

      if (items.length < 100) break;
    }

    return { ok: true, sourceId: source.id, error: null, offers };
  } catch (error) {
    return {
      ok: false,
      sourceId: source.id,
      error: error instanceof Error ? error.message : String(error),
      offers: [],
    };
  }
}
