/** Verify public base recharge semantics, not a model-group multiplier or FX rate. */
export function parsePackyRecharge(documentHtml, status, { sourceUrl, statusUrl, observedAt }) {
  const text = documentHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/\s+/g, " ");
  const sentence = text.match(/([\d]+(?:\.[\d]+)?)\s*元人民币\s*(?:等同于|等于|可兑换|兑换)\s*([\d]+(?:\.[\d]+)?)\s*美元额度/);
  const paid = Number(sentence?.[1]), credits = Number(sentence?.[2]);
  const price = status?.price;
  if (!sentence || !Number.isFinite(paid) || paid <= 0 || !Number.isFinite(credits) || credits <= 0) throw new Error("unrecognized_public_recharge_semantics");
  const ratioCnyPerCredit = paid / credits;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0 || Math.abs(price - ratioCnyPerCredit) > Math.max(1e-8, ratioCnyPerCredit * 1e-6)) throw new Error("recharge_document_status_mismatch");
  return { ratioCnyPerCredit, creditsPerCny: 1 / ratioCnyPerCredit, sourceUrl, statusUrl, observedAt, scope: "public_base", evidence: sentence[0], excludes: ["personal_topup_promotions", "channel_fees"], creditUnit: "station_display_usd", paidCurrency: "CNY" };
}
