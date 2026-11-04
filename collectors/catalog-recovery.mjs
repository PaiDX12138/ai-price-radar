import { classifyTitle, seedProducts } from "./classify.mjs";
import { reclassifyOffer } from "./persist.mjs";

/** Offline, additive repair only: never replace a newer fact or resurrect a delisted item. */
export function recoverCatalogOther(snapshot, rawEntries) {
  const products = seedProducts();
  const slugs = new Set(products.map(product => product.slug));
  const publicOffer = offer => {
    const next = reclassifyOffer(offer);
    delete next.goodsKey;
    delete next.classified;
    return next;
  };
  let remapped = 0;
  const offers = snapshot.offers.map(offer => {
    if (slugs.has(offer.productSlug) && classifyTitle(offer.sourceTitle, { price: offer.price }).productSlug) return offer;
    const next = publicOffer(offer);
    if (next.productSlug !== offer.productSlug || next.warranty !== offer.warranty) remapped++;
    return next;
  });
  const sources = [...snapshot.sources];
  const sourceIds = new Set(sources.map(source => source.id));
  const ids = new Set(offers.map(offer => offer.id));
  let recovered = 0;
  for (const entry of rawEntries.values()) {
    for (const offer of entry.offers) {
      if (!offer?.id || ids.has(offer.id) || offer.sourceId !== entry.sourceId) continue;
      if (!offer.sourceTitle?.trim() || !Number.isFinite(offer.price) || offer.price < 0) continue;
      if (!Number.isFinite(Date.parse(offer.capturedAt)) || offer.lifecycle === "delisted") continue;
      // This repair is only for formerly dropped, unresolved titles, not unrelated products.
      if (classifyTitle(offer.sourceTitle, { price: offer.price }).productSlug) continue;
      if (!sourceIds.has(entry.sourceId)) {
        if (!entry.sourceMeta) continue;
        sources.push(entry.sourceMeta);
        sourceIds.add(entry.sourceId);
      }
      offers.push(publicOffer(offer));
      ids.add(offer.id);
      recovered++;
    }
  }
  return {
    snapshot: { ...snapshot, products, sources, offers,
      stats: { ...snapshot.stats, offersClassified: offers.length } },
    remapped, recovered,
  };
}
