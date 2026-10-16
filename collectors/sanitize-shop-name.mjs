/**
 * Display-name helpers for catalog sources.
 * Never show 「对接码xxx」 as the shop title.
 */
export function sanitizeShopDisplayName(name, fallbackToken) {
  let n = String(name ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/对接码\s*[:：]?\s*[\w.\-]+/gi, " ")
    .replace(/🔥+/g, " ")
    .replace(/[\u3000\s]+/g, " ")
    .replace(/^[\s\-_|·.]+|[\s\-_|·.]+$/g, "")
    .trim();
  if (!n || n.length < 2) {
    const tok = String(fallbackToken || "").trim();
    return tok ? `店铺 ${tok}` : "未知店铺";
  }
  // bare sms#### after stripping 对接码 — still not a storefront name
  if (/^sms\d{2,}$/i.test(n)) {
    const tok = String(fallbackToken || "").trim();
    return tok ? `店铺 ${tok}` : n;
  }
  return n;
}

export function looksLikeAgentCodeName(name) {
  return /对接码/i.test(String(name || ""));
}
