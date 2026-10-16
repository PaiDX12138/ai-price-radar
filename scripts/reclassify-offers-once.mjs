#!/usr/bin/env node
/**
 * 独立进程按当前磁盘上的 collectors/classify.mjs 重标报价。
 * 供 persist.writeCatalogSnapshot 调用，避开长驻 worker 的 ESM 模块缓存。
 *
 * 用法: node scripts/reclassify-offers-once.mjs <in.json> <out.json>
 * in:  Offer[]
 * out: { products: Product[], offers: Offer[] }
 */
import { readFileSync, writeFileSync } from "node:fs";
import { classifyTitle, LEGACY_PRODUCT_SLUG_MAP, seedProducts } from "../collectors/classify.mjs";

const inPath = process.argv[2];
const outPath = process.argv[3];
if (!inPath || !outPath) {
  console.error("usage: node scripts/reclassify-offers-once.mjs <in.json> <out.json>");
  process.exit(2);
}

const raw = JSON.parse(readFileSync(inPath, "utf8"));
const offersIn = Array.isArray(raw) ? raw : [];
const products = seedProducts();
const seedSlugs = new Set(products.map((p) => p.slug));

const offers = offersIn
  .map((offer) => {
    if (!offer || typeof offer !== "object") return null;
    const title = offer.sourceTitle || "";
    const { productSlug, warranty } = classifyTitle(title, { price: offer.price });
    const resolved = productSlug ? LEGACY_PRODUCT_SLUG_MAP[productSlug] || productSlug : null;
    const next = {
      ...offer,
      productSlug: resolved || "other-unclassified",
      warranty: warranty ?? offer.warranty,
    };
    delete next.goodsKey;
    delete next.classified;
    return next;
  })
  .filter((o) => o && seedSlugs.has(o.productSlug));

writeFileSync(outPath, `${JSON.stringify({ products, offers })}\n`, "utf8");
console.log(
  JSON.stringify({
    ok: true,
    productSeeds: products.length,
    offersIn: offersIn.length,
    offersOut: offers.length,
    gemini: products.filter((p) => p.platform === "gemini").map((p) => p.slug),
  }),
);
