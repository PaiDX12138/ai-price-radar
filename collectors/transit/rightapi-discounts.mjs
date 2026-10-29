/** Right Code: compare effective credit cost to its same-model, same-tier reference. */
const amount = value => value === null || value === undefined || value === "" || typeof value === "boolean"
  ? null : Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const positive = value => typeof value === "number" && Number.isFinite(value) && value > 0;

export function rightApiOfferDiscount(offer, { recharge, fx, sourceUrl, observedAt }) {
  if (!positive(recharge?.ratioCnyPerCredit)) return null;
  const model = offer.rawOffer, reference = offer.basePrice?.prices;
  const currency = offer.basePrice?.officialCurrency;
  const effective = offer.effectivePrice;
  if (!reference || !effective || !["USD", "CNY"].includes(currency)) return null;
  // Spec/parameter-dependent prices require a matched request specification, not a guessed default.
  if (reference.param_rules?.length || effective.param_rules?.length) return null;
  const metric = offer.priceKind === "fixed" ? "request" : "input";
  const field = metric === "request" ? "request_price" : "input_price";
  let referencePrice = amount(reference[field]);
  const creditPrice = metric === "request" ? offer.fixedPrice : offer.inputPrice;
  if (!positive(referencePrice) || amount(creditPrice) === null) return null;
  let tier = null;
  if (reference.tiers?.length || effective.tiers?.length) {
    if (!Array.isArray(reference.tiers) || !Array.isArray(effective.tiers)) return null;
    const matches = reference.tiers.filter(base => effective.tiers.some(sale =>
      base.max_context_length === sale.max_context_length && base.max_output_length === sale.max_output_length
      && amount(sale[field]) === creditPrice && positive(amount(base[field]))));
    if (matches.length !== 1) return null;
    referencePrice = amount(matches[0][field]);
    tier = { maxContextLength: matches[0].max_context_length, maxOutputLength: matches[0].max_output_length };
  }
  // The displayed root price must still match the current period when a period is active.
  for (const period of effective.sourceTimePeriods ?? []) {
    if (period.is_active && amount(period[field]) !== null) {
      const matching = (effective.time_periods ?? []).find(row => row.label === period.label
        && row.start_time === period.start_time && row.end_time === period.end_time);
      if (matching && amount(matching[field]) !== creditPrice) return null;
    }
  }
  const rate = currency === "CNY" ? 1 : positive(fx?.usdToCny) ? fx.usdToCny : null;
  if (!rate) return null;
  const paidCny = creditPrice * recharge.ratioCnyPerCredit;
  const ratio = paidCny / (referencePrice * rate);
  if (!Number.isFinite(ratio) || ratio < 0) return null;
  return { ratio, source: "calculated", basis: "station_reference", details: {
    sourceUrl, metric, groupKey: offer.groupKey, observedAt, tier,
    reference: { input: referencePrice, currency, unit: offer.priceUnit, kind: "station_listed_reference", sourceUrl },
    conversion: { paidCnyPerCredit: recharge.ratioCnyPerCredit, usdToCny: rate,
      fxDate: currency === "USD" ? fx.date : null, sourceUrl: currency === "USD" ? fx.sourceUrl : recharge.sourceUrl },
    paidCny, formula: "effective_credit_price * cny_per_credit / (matched_reference_price * reference_currency_to_cny)",
    excludes: ["personal_promotions", "invoice_fees", "other_context_tiers", "other_time_periods", "other_image_specifications"],
  } };
}
