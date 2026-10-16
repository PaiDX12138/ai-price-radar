/**
 * HTML / 专用目录类采集器（改版易失效；失败只记 crawl，不改旧报价）。
 * mooncakeCatalog / blackcatWholesale / genericHtml / unicornHtml / opensora / makerich / beibei
 */
import { classifyTitle } from "./classify.mjs";
import {
  absolutize,
  cleanText,
  compact,
  fetchText,
  numberOrNull,
  statusFromStock,
} from "./util.mjs";

function pushOffer(offers, source, fields, capturedAt) {
  const title = cleanText(fields.title);
  const price = numberOrNull(fields.price);
  if (!title || price === null) return;
  const { productSlug, warranty } = classifyTitle(title, { price });
  offers.push({
    id: fields.id || `${source.id}-${offers.length}`,
    productSlug: productSlug || "other-unclassified",
    sourceId: source.id,
    sourceTitle: title,
    price,
    listedPrice: price,
    status: fields.status || "in_stock",
    stockCount: fields.stockCount ?? null,
    url: fields.url || source.sourceUrl || source.baseUrl,
    tags: compact([...(fields.tags || []), source.collectorKind || source.kind]),
    capturedAt,
    warranty,
    classified: Boolean(productSlug),
  });
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

/** Mooncake: catalog.js 内商品数组 */
export async function collectMooncakeCatalog(source, options = {}) {
  return wrap(source, async () => {
    const base = String(source.baseUrl || "").replace(/\/$/, "");
    const js = await fetchText(`${base}/mooncake-official-media/catalog.js`, {
      fetchImpl: options.fetchImpl,
    });
    const capturedAt = new Date().toISOString();
    /** @type {any[]} */
    const offers = [];
    // 宽松匹配 name/title + price 字段
    const blockRe =
      /\{\s*(?:[^{}]*?(?:name|title)\s*:\s*["']([^"']+)["'][^{}]*?price\s*:\s*([0-9.]+)|[^{}]*?price\s*:\s*([0-9.]+)[^{}]*?(?:name|title)\s*:\s*["']([^"']+)["'])[^{}]*\}/gi;
    let m;
    let i = 0;
    while ((m = blockRe.exec(js))) {
      const title = m[1] || m[4];
      const price = m[2] || m[3];
      pushOffer(
        offers,
        source,
        {
          id: `${source.id}-mc-${i++}`,
          title,
          price,
          url: base,
          tags: ["mooncake"],
        },
        capturedAt,
      );
    }
    return offers;
  });
}

/** BlackCat 批发页：从 HTML/内嵌 JSON 抽 name+price */
export async function collectBlackcatWholesale(source, options = {}) {
  return wrap(source, async () => {
    const pageUrl = source.sourceUrl || `${String(source.baseUrl || "").replace(/\/$/, "")}/blackcat`;
    const html = await fetchText(pageUrl, { fetchImpl: options.fetchImpl });
    const capturedAt = new Date().toISOString();
    /** @type {any[]} */
    const offers = [];
    const re =
      /"(?:name|title|product_name)"\s*:\s*"([^"]+)"[\s\S]{0,240}"(?:price|sale_price|wholesale_price)"\s*:\s*([0-9.]+)/gi;
    let m;
    let i = 0;
    const seen = new Set();
    while ((m = re.exec(html))) {
      const key = `${m[1]}|${m[2]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pushOffer(
        offers,
        source,
        {
          id: `${source.id}-bc-${i++}`,
          title: m[1],
          price: m[2],
          url: pageUrl,
          tags: ["blackcat"],
        },
        capturedAt,
      );
    }
    return offers;
  });
}

/**
 * 通用 HTML：标题邻近价格/库存（宽松；失败则空结果 ok=false 由上层记 run）
 */
export async function collectGenericHtml(source, options = {}) {
  return wrap(source, async () => {
    const pageUrl = source.sourceUrl || source.baseUrl;
    const html = await fetchText(pageUrl, { fetchImpl: options.fetchImpl });
    const capturedAt = new Date().toISOString();
    /** @type {any[]} */
    const offers = [];
    const cardRe =
      /<(?:div|li|article|section)[^>]{0,200}(?:class|id)=["'][^"']*(?:product|goods|card|item)[^"']*["'][^>]*>[\s\S]{0,1200}?<\/(?:div|li|article|section)>/gi;
    const blocks = html.match(cardRe) || [html];
    let i = 0;
    const seen = new Set();
    for (const body of blocks.slice(0, 200)) {
      const title =
        cleanText(body.match(/<(?:h[1-6]|a)[^>]*>([\s\S]*?)<\/(?:h[1-6]|a)>/i)?.[1]) ||
        cleanText(body.match(/title=["']([^"']+)["']/i)?.[1]);
      const price =
        numberOrNull(body.match(/(?:￥|¥|CNY\s*)\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1]) ??
        numberOrNull(body.match(/价格[:：]\s*([0-9]+(?:\.[0-9]+)?)/)?.[1]);
      if (!title || price === null) continue;
      const stockCount = numberOrNull(body.match(/库存[:：]\s*(\d+)/)?.[1]);
      const soldOut = /售罄|缺货|无货|已售完/.test(body);
      const href = body.match(/href=["']([^"']+)["']/i)?.[1];
      const key = `${title}|${price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pushOffer(
        offers,
        source,
        {
          id: `${source.id}-html-${i++}`,
          title,
          price,
          stockCount,
          status: soldOut ? "out_of_stock" : statusFromStock(stockCount),
          url: absolutize(href, source.baseUrl),
          tags: ["html"],
        },
        capturedAt,
      );
    }
    if (!offers.length) throw new Error("genericHtml: no product cards parsed");
    return offers;
  });
}

export async function collectUnicornHtml(source, options = {}) {
  return collectGenericHtml(source, options);
}

export async function collectOpensoraHtml(source, options = {}) {
  return wrap(source, async () => {
    const pageUrl = source.sourceUrl || source.baseUrl;
    const html = await fetchText(pageUrl, { fetchImpl: options.fetchImpl });
    const capturedAt = new Date().toISOString();
    /** @type {any[]} */
    const offers = [];
    const re =
      /alt=["']([^"']+)["'][\s\S]{0,400}?(?:￥|¥)\s*([0-9]+(?:\.[0-9]+)?)[\s\S]{0,200}?库存[:：]\s*(\d+)[\s\S]{0,300}?href=["']([^"']*\/buy\/\d+[^"']*)["']/gi;
    let m;
    let i = 0;
    while ((m = re.exec(html))) {
      pushOffer(
        offers,
        source,
        {
          id: `${source.id}-os-${i++}`,
          title: m[1],
          price: m[2],
          stockCount: numberOrNull(m[3]),
          status: statusFromStock(numberOrNull(m[3])),
          url: absolutize(m[4], source.baseUrl),
          tags: ["opensora"],
        },
        capturedAt,
      );
    }
    if (!offers.length) {
      const fallback = await collectGenericHtml(source, options);
      if (!fallback.ok) throw new Error(fallback.error || "opensoraHtml empty");
      return fallback.offers;
    }
    return offers;
  });
}

export async function collectMakerichHtml(source, options = {}) {
  return collectGenericHtml(source, options);
}

export async function collectBeibeiHtml(source, options = {}) {
  return collectGenericHtml(source, options);
}
