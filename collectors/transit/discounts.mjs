/** Ratios are fractions of the stated reference: 0.72 means 7.2折, NOT 72% off. */
const positive = value => typeof value === "number" && Number.isFinite(value) && value > 0;
const ratioValue = value => typeof value === "number" && Number.isFinite(value) && value >= 0;
const https = value => typeof value === "string" && value.startsWith("https://");

export function resolveTransitDiscount({ reported, stationFormula, offer, reference, conversion, observedAt }) {
  if (reported && ratioValue(reported.ratio) && https(reported.sourceUrl)) {
    return { ratio: reported.ratio, source: "station_reported", basis: reported.basis ?? "station_reference", details: { ...reported, observedAt } };
  }
  if (stationFormula && ratioValue(stationFormula.ratio) && https(stationFormula.sourceUrl)) {
    return { ratio: stationFormula.ratio, source: "station_formula", basis: "station_reference", details: { ...stationFormula, observedAt } };
  }
  // A numeric price alone is insufficient: billing unit, reference and paid conversion must match.
  if (!offer || offer.priceKind !== "token" || offer.priceUnit !== "M Token" || offer.modality !== "text"
    || !ratioValue(offer.inputPrice) || offer.tiers?.length || offer.effectivePrice?.peakRules?.enabled
    || !reference || reference.currency !== "USD" || reference.unit !== "M Token"
    || !positive(reference.input) || reference.variablePricing || !https(reference.sourceUrl)) return null;
  let paidInputUsd;
  if (offer.currency === "USD") paidInputUsd = offer.inputPrice;
  else if (offer.currency === "CREDIT" && positive(conversion?.paidCnyPerCredit) && positive(conversion?.usdToCny) && https(conversion?.sourceUrl))
    paidInputUsd = offer.inputPrice * conversion.paidCnyPerCredit / conversion.usdToCny;
  else return null;
  const ratio = paidInputUsd / reference.input;
  if (!ratioValue(paidInputUsd) || !ratioValue(ratio)) return null;
  return {
    ratio, source: "calculated",
    basis: reference.kind === "official" ? "official_input_price" : "public_reference_input_price",
    details: { metric: "input", formula: "paid_input_usd_per_million / reference_input_usd_per_million", paidInputUsd, reference, conversion: offer.currency === "CREDIT" ? conversion : null, sourceUrl: reference.sourceUrl, observedAt },
  };
}

/** Narrow parser for the observed Packy public bundle. Never evaluate downloaded JavaScript. */
export function parsePackyDiscountPolicy(script) {
  const found = script.match(/([\w$]+)=([0-9]+(?:\.[0-9]+)?),([\w$]+)=(\["deepseek"[^\]\n]{0,1000}\]),([\w$]+)=/);
  if (!found || !/discountRate:/.test(script)) throw new Error("unrecognized_packy_discount_policy");
  const [, constant, value, , list, predicate] = found;
  const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const formula = new RegExp(`${escape(predicate)}\\([^)]*\\.model_name\\)\\?1:${escape(constant)},[\\w$]+=[\\w$]+\\*[\\w$]+/[\\w$]+`);
  const foreignUsdToCny = Number(value), domesticPrefixes = JSON.parse(list);
  if (!formula.test(script) || !positive(foreignUsdToCny) || !Array.isArray(domesticPrefixes) || domesticPrefixes.some(prefix => typeof prefix !== "string" || !prefix)) throw new Error("invalid_packy_discount_policy");
  return { foreignUsdToCny, domesticPrefixes };
}

export function packyOfferDiscount(offer, { status, policy, policySourceUrl, policyHash, reference, conversionSourceUrl, observedAt }) {
  const paidCnyPerCredit = status?.price;
  let stationFormula;
  if (policy && positive(paidCnyPerCredit) && ratioValue(offer.effectivePrice?.groupRate)) {
    const domestic = policy.domesticPrefixes.some(prefix => offer.rawModel.toLowerCase().startsWith(prefix));
    const referenceExchangeRate = domestic ? 1 : policy.foreignUsdToCny;
    stationFormula = {
      ratio: paidCnyPerCredit * offer.effectivePrice.groupRate / referenceExchangeRate,
      formula: "paid_cny_per_credit * effective_group_rate / reference_exchange_rate",
      paidCnyPerCredit, effectiveGroupRate: offer.effectivePrice.groupRate, referenceExchangeRate,
      referenceKind: domestic ? "station_cny_model_baseline" : "station_usd_model_baseline",
      groupKey: offer.groupKey, sourceUrl: policySourceUrl, policyHash, metric: "base_billing",
      excludes: ["peak_pricing", "tiered_pricing", "personal_recharge_promotions"],
    };
  }
  return resolveTransitDiscount({ stationFormula, offer, reference, observedAt,
    conversion: { paidCnyPerCredit, usdToCny: status?.usd_exchange_rate, sourceUrl: conversionSourceUrl, basis: "station_public_recharge_and_display_fx" },
  });
}
