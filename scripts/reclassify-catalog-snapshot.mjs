#!/usr/bin/env node
/** Reclassify existing snapshots offline; preserve all stock/price/lifecycle timestamps. */
import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reclassifyOffers } from "../collectors/persist.mjs";
import { seedProducts } from "../collectors/classify.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const index = args.indexOf("--snapshot");
if (index >= 0 && (!args[index + 1] || args[index + 1].startsWith("--"))) {
  throw new Error("--snapshot requires a JSON path");
}
const paths = index >= 0 ? [resolve(args[index + 1])] : ["public", "latest"].map((name) => join(root, "data", "catalog", `${name}.json`));
const products = seedProducts();
const slugs = new Set(products.map((product) => product.slug));
const results = [];
for (const path of paths) {
  if (!existsSync(path)) throw new Error(`Snapshot missing: ${path}`);
  const originalText = readFileSync(path, "utf8");
  const snapshot = JSON.parse(originalText);
  if (!Array.isArray(snapshot.offers) || !Array.isArray(snapshot.sources) || !Array.isArray(snapshot.products)) {
    throw new Error(`Invalid catalog snapshot: ${path}`);
  }
  const moves = {};
  let changed = 0;
  const offers = reclassifyOffers(snapshot.offers).map((offer, i) => {
    const old = snapshot.offers[i];
    if (old.productSlug !== offer.productSlug || old.warranty !== offer.warranty) changed++;
    if (old.productSlug !== offer.productSlug) {
      const key = `${old.productSlug} -> ${offer.productSlug}`;
      moves[key] = (moves[key] || 0) + 1;
    }
    const publicOffer = { ...offer };
    delete publicOffer.classified;
    return publicOffer;
  });
  let backup = null;
  if (apply && changed) {
    if (readFileSync(path, "utf8") !== originalText) {
      throw new Error(`Snapshot changed during classification; retry instead of overwriting newer offers: ${path}`);
    }
    const stamp = `${Date.now()}-${process.pid}`;
    backup = `${path}.before-reclassify-${stamp}.json`;
    copyFileSync(path, backup);
    const temp = `${path}.${stamp}.tmp`;
    writeFileSync(temp, `${JSON.stringify({
      ...snapshot,
      // This is a classification refresh, NOT a new shop-price confirmation.
      reclassifiedAt: new Date().toISOString(),
      products,
      offers,
      stats: { ...snapshot.stats, offersClassified: offers.filter((offer) => slugs.has(offer.productSlug)).length },
    }, null, 2)}\n`);
    renameSync(temp, path);
  }
  results.push({ path, offers: offers.length, changed, moves, backup });
}
console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", results }, null, 2));
