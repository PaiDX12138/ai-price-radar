/**
 * 独角数卡采集器。
 * GET {base}/api/v1/public/products
 */
import { classifyTitle } from "./classify.mjs";
import {
  cleanText,
  compact,
  fetchJson,
  localized,
  numberOrNull,
  statusFromStock,
} from "./util.mjs";

/**
 * @param {{ id: string, baseUrl: string, name?: string }} source
 * @param {{ fetchImpl?: typeof fetch }} [options]
 */
export async function collectDujiao(source, options = {}) {
  const base = String(source.baseUrl || "").replace(/\/$/, "");
  if (!base) {
    return { ok: false, sourceId: source.id, error: "missing baseUrl", offers: [] };
  }
  const capturedAt = new Date().toISOString();

  try {
    const payload = await fetchJson(`${base}/api/v1/public/products`, {
      fetchImpl: options.fetchImpl,
    });
    const products = Array.isArray(payload?.data) ? payload.data : [];
    /** @type {any[]} */
    const offers = [];

    for (const product of products) {
      const productTitle = localized(product.title) || cleanText(product.slug);
      const skus = Array.isArray(product.skus) && product.skus.length ? product.skus : [null];

      skus.forEach((sku, index) => {
        const skuTitle = localized(sku?.title || sku?.name || sku?.label || sku?.spec);
        const title = cleanText(
          skuTitle && skuTitle !== productTitle
            ? `${productTitle} / ${skuTitle}`
            : skus.length > 1 && sku
              ? `${productTitle} / 规格${index + 1}`
              : productTitle,
        );
        const price = numberOrNull(sku?.price_amount ?? product.price_amount);
        if (!title || price === null) return;

        const stockCount = numberOrNull(
          sku?.auto_stock_available ??
            sku?.manual_stock_available ??
            product.auto_stock_available ??
            product.manual_stock_available,
        );
        const isSoldOut = Boolean(sku?.is_sold_out ?? product.is_sold_out);
        const stockStatus = String(sku?.stock_status || product.stock_status || "");
        const status =
          isSoldOut || stockStatus === "out_of_stock" ? "out_of_stock" : statusFromStock(stockCount);
        const { productSlug, warranty } = classifyTitle(title, { price });
        const categoryName = localized(product.category?.name);

        offers.push({
          id: `${source.id}-${product.id ?? product.slug}-${index}`,
          productSlug: productSlug || "other-unclassified",
          sourceId: source.id,
          sourceTitle: title,
          price,
          listedPrice: price,
          status,
          stockCount,
          url: `${base}/products/${encodeURIComponent(String(product.slug || product.id))}`,
          tags: compact([
            categoryName,
            product.fulfillment_type === "auto" ? "自动发货" : null,
            product.fulfillment_type === "manual" ? "人工处理" : null,
            "dujiao",
          ]),
          capturedAt,
          warranty,
          classified: Boolean(productSlug),
        });
      });
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
