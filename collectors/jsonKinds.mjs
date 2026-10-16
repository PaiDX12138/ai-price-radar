/**
 * 其余公开 JSON 类卡网采集器（对照 参考站 collect-prices 入口）。
 * getgptApi / ikunloveApi / publicProductsApi / xiaoheiwan / shopUserProductsApi
 */
import { classifyTitle } from "./classify.mjs";
import {
  absolutize,
  cleanText,
  compact,
  delay,
  fetchJson,
  hostOf,
  numberOrNull,
  statusFromStock,
} from "./util.mjs";

/**
 * publicProductsApi 原站链接（对照 参考站 `publicProductUrl`）。
 * catcard.uk 是首页抽屉购卡：无 /products/:id 路由，点卡片才 `showProductDetail(id)`。
 * 用 `/#product-{id}` 标识商品；再加 `#:~:text=` 文本片段，Chromium 可滚到对应卡片标题。
 */
function publicProductUrl(base, product, title) {
  const rawLink = product.url || product.link || product.purchase_url || product.purchaseUrl;
  if (rawLink) return absolutize(rawLink, base);

  const id = product.id ?? product.slug ?? product.key;
  const host = hostOf(base);

  if (host === "catcard.uk" && id != null && String(id)) {
    const hash = `product-${encodeURIComponent(String(id))}`;
    const tip = cleanText(title).slice(0, 48);
    if (tip) {
      return `${base}/#${hash}:~:text=${encodeURIComponent(tip)}`;
    }
    return `${base}/#${hash}`;
  }

  if (typeof product.slug === "string" && product.slug) {
    return absolutize(
      product.slug.includes("/") ? product.slug : `/products/${product.slug}`,
      base,
    );
  }

  // 禁止臆造 /products/{numericId}（catcard 等站会 Cannot GET）
  return absolutize("/", base);
}

function toOffer(source, fields, capturedAt) {
  const title = cleanText(fields.title);
  const price = numberOrNull(fields.price);
  if (!title || price === null) return null;
  const { productSlug, warranty } = classifyTitle(title, { price });
  return {
    id: fields.id || `${source.id}-${offersIdSafe(title)}-${price}`,
    productSlug: productSlug || "other-unclassified",
    sourceId: source.id,
    sourceTitle: title,
    price,
    listedPrice: numberOrNull(fields.listedPrice) ?? price,
    status: fields.status || "in_stock",
    stockCount: fields.stockCount ?? null,
    url: fields.url || source.baseUrl,
    tags: compact([...(fields.tags || []), source.collectorKind || source.kind]),
    capturedAt,
    warranty,
    classified: Boolean(productSlug),
  };
}

function offersIdSafe(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "")
    .slice(0, 24);
}

function wrap(source, runner) {
  return runner()
    .then((offers) => ({ ok: true, sourceId: source.id, error: null, offers }))
    .catch((error) => ({
      ok: false,
      sourceId: source.id,
      error: error instanceof Error ? error.message : String(error),
      offers: [],
    }));
}

export async function collectGetgptApi(source, options = {}) {
  return wrap(source, async () => {
    const base = String(source.baseUrl || "https://getgpt.pro").replace(/\/$/, "");
    const payload = await fetchJson("https://gpt.how2cs.cn/api/order/prices", {
      fetchImpl: options.fetchImpl,
    });
    const capturedAt = new Date().toISOString();
    const products = [
      { title: "ChatGPT Plus 充值", price: payload.gptplus_amount ?? payload.amount, path: "/plus-price" },
      { title: "ChatGPT Pro 充值", price: payload.gptpro_amount, path: "/gptpro" },
      { title: "ChatGPT Pro Lite 充值", price: payload.gptprolite_amount, path: "/gptpro" },
      { title: "ChatGPT Team / Business 充值", price: payload.team_amount, path: "/price" },
      { title: "Claude 充值", price: payload.claude_amount, path: "/" },
    ];
    return products
      .map((p) =>
        toOffer(
          source,
          {
            title: p.title,
            price: p.price,
            status: "in_stock",
            stockCount: null,
            url: absolutize(p.path, base),
            tags: ["官方接口"],
          },
          capturedAt,
        ),
      )
      .filter(Boolean);
  });
}

export async function collectIkunloveApi(source, options = {}) {
  return wrap(source, async () => {
    const base = String(source.baseUrl || "").replace(/\/$/, "");
    const payload = await fetchJson(`${base}/api/shop/products`, { fetchImpl: options.fetchImpl });
    const products = Array.isArray(payload?.data?.products) ? payload.data.products : [];
    const capturedAt = new Date().toISOString();
    const offers = [];
    for (const product of products) {
      const cents = numberOrNull(product.priceCents);
      const offer = toOffer(
        source,
        {
          id: `${source.id}-${product.id ?? offers.length}`,
          title: product.title,
          price: cents === null ? null : cents / 100,
          stockCount: numberOrNull(product.stockCount),
          status:
            product.isDeleted === true || product.isActive === false
              ? "out_of_stock"
              : statusFromStock(numberOrNull(product.stockCount)),
          url: absolutize(
            product.purchaseGuideUrl || product.consolePath || product.tutorialPath || "/",
            base,
          ),
          tags: [product.category, product.badge],
        },
        capturedAt,
      );
      if (offer) offers.push(offer);
    }
    return offers;
  });
}

export async function collectPublicProductsApi(source, options = {}) {
  return wrap(source, async () => {
    const base = String(source.baseUrl || "").replace(/\/$/, "");
    const payload = await fetchJson(`${base}/api/products`, { fetchImpl: options.fetchImpl });
    const products = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.products)
        ? payload.products
        : Array.isArray(payload?.data?.products)
          ? payload.data.products
          : [];
    const capturedAt = new Date().toISOString();
    return products
      .map((product, i) => {
        const title =
          product.display_name ||
          product.displayName ||
          product.name ||
          product.productName ||
          product.title;
        const price = product.price_cny ?? product.priceCny ?? product.price ?? product.amount;
        const stockCount = numberOrNull(product.stock ?? product.stock_count ?? product.stockCount);
        const hidden =
          product.is_hidden === true || product.hidden === true || product.isVisible === false;
        const disabled = hidden || Number(product.status ?? 1) === 0;
        return toOffer(
          source,
          {
            id: `${source.id}-${product.id ?? product.slug ?? i}`,
            title,
            price,
            stockCount,
            status: disabled ? "out_of_stock" : statusFromStock(stockCount),
            url: publicProductUrl(base, product, title),
            tags: [
              product.project_title || product.projectTitle || product.project,
              product.group_name || product.groupName,
              product.delivery_label || product.deliveryLabel,
            ],
          },
          capturedAt,
        );
      })
      .filter(Boolean);
  });
}

export async function collectXiaoheiwan(source, options = {}) {
  return wrap(source, async () => {
    const base = String(source.baseUrl || "").replace(/\/$/, "");
    const products = await fetchJson(`${base}/api/products`, { fetchImpl: options.fetchImpl });
    const items = Array.isArray(products) ? products : [];
    const capturedAt = new Date().toISOString();
    return items
      .map((item, i) => {
        const stockCount = numberOrNull(item.stock ?? item.stock_count ?? item.count);
        const active = String(item.status || "").toLowerCase() === "active";
        return toOffer(
          source,
          {
            id: `${source.id}-${item.id ?? item.sku ?? i}`,
            title: item.name,
            price: item.price ?? item.original_price,
            stockCount,
            status: active ? statusFromStock(stockCount) : "out_of_stock",
            url: `${base}/purchase`,
            tags: [item.sku, "官方接口"],
          },
          capturedAt,
        );
      })
      .filter(Boolean);
  });
}

export async function collectShopUserProductsApi(source, options = {}) {
  return wrap(source, async () => {
    const base = String(source.baseUrl || "").replace(/\/$/, "");
    const maxPages = options.maxPages ?? 10;
    const pageDelayMs = options.pageDelayMs ?? Number(process.env.COLLECTOR_PAGE_DELAY_MS || 400);
    const capturedAt = new Date().toISOString();
    /** @type {any[]} */
    const offers = [];

    for (let page = 1; page <= maxPages; page += 1) {
      if (page > 1 && pageDelayMs > 0) await delay(pageDelayMs);
      const payload = await fetchJson(
        `${base}/shop/user/products?page=${page}&size=100&productName=`,
        { fetchImpl: options.fetchImpl },
      );
      const records = Array.isArray(payload?.data?.records) ? payload.data.records : [];
      if (!records.length) break;

      for (const product of records) {
        const stockCount = numberOrNull(product.stock);
        const hidden = Number(product.isVisible ?? 1) !== 1 || Number(product.status ?? 1) !== 1;
        const offer = toOffer(
          source,
          {
            id: `${source.id}-${product.id}`,
            title: product.productName || product.name || product.title,
            price: product.price ?? product.salePrice,
            stockCount,
            status: hidden ? "out_of_stock" : statusFromStock(stockCount),
            url: `${base}/product/${encodeURIComponent(String(product.id))}`,
            tags: [product.category, product.cardType, product.isHot ? "热门" : null],
          },
          capturedAt,
        );
        if (offer) offers.push(offer);
      }
      if (records.length < 100) break;
    }
    return offers;
  });
}
