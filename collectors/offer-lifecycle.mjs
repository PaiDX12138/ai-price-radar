/** Only complete successful lists can establish absence; never delete historical evidence. */
export function reconcileOffers(previous, incoming, { complete = false, at = new Date().toISOString() } = {}) {
  const key = (offer) => offer.id || offer.url;
  const next = new Map(incoming.map((offer) => [key(offer), { ...offer, lifecycle: offer.lifecycle || "active" }]));
  for (const old of previous) {
    if (next.has(key(old))) continue;
    next.set(key(old), complete && old.lifecycle !== "delisted" ? { ...old, lifecycle: "pending", lifecycleReason: "missing_from_complete_list", missingSince: old.missingSince || at } : old);
  }
  return [...next.values()];
}

/** Bounded public-detail checks for missing ShopApi goods; network failures are not delisting. */
export async function verifyMissingShopApiOffers(previous, result, { fetchImpl = fetch, limit = 3 } = {}) {
  if (!result.ok || result.collectionComplete !== true || !result.resolvedBase || result.withdrawDisplay) return;
  const seen = new Set(result.offers.map((offer) => offer.id));
  const base = new URL(result.resolvedBase);
  const candidates = previous.filter((offer) => !seen.has(offer.id) && offer.lifecycle !== "delisted")
    .sort((a, b) => String(a.lastVerifiedAt || "").localeCompare(String(b.lastVerifiedAt || ""))).slice(0, limit);
  for (const old of candidates) {
    let url;
    try { url = new URL(old.url); } catch { continue; }
    const goodsKey = url.pathname.match(/^\/item\/([a-zA-Z0-9_-]+)$/)?.[1];
    if (url.origin !== base.origin || !goodsKey) continue;
    const at = new Date().toISOString();
    let lifecycle = "pending", reason = "detail_unconfirmed";
    try {
      const response = await fetchImpl(new URL("/shopApi/Shop/goodsInfo", base), {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
        headers: { "Content-Type": "application/json", Origin: base.origin, Referer: old.url },
        body: JSON.stringify({ goods_key: goodsKey }),
      });
      if (response.ok) {
        const body = await response.json();
        if (body.code === 0 && /商品(?:未上架|已下架|不存在|已删除)/.test(String(body.msg || ""))) { lifecycle = "delisted"; reason = String(body.msg); }
      }
    } catch { /* Timeout, authentication and WAF failures are inconclusive. */ }
    result.offers.push({ ...old, lifecycle, lifecycleReason: reason, lastVerifiedAt: at, ...(lifecycle === "delisted" ? { delistedAt: at } : {}) });
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}
