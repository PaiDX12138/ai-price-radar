/** Match billing period from the product identifier, never from raw foreign-currency magnitudes. */
export function appStoreBillingPeriod(offerName) {
  const name = String(offerName || "").toLowerCase();
  if (name.startsWith("com.google.gemini.")) {
    if (/(?:^|\.)y(?:\.|$)/.test(name)) return "annual";
    if (/(?:^|\.)m(?:\.|$)/.test(name)) return "monthly";
  }
  if (/(?:^|[._-])(?:yearly|annually|annual|year|1y|12m|p1y)(?:$|[._-])/.test(name)) return "annual";
  if (/(?:^|[._-])(?:monthly|month|1m|p1m)(?:$|[._-])/.test(name)) return "monthly";
  return null;
}

export function appStoreItemBillingPeriod(item) {
  const identifier = appStoreBillingPeriod(item.offerName);
  if (identifier) return identifier;
  const label = String(item.name || "").toLowerCase();
  if (/\b(?:annual|annually|yearly)\b|年付|年度/.test(label)) return "annual";
  if (/\bmonthly\b|月付|月度/.test(label)) return "monthly";
  return null;
}

export function pickAppStoreItem(items, plan, currencyCode, rates) {
  const target = Number(plan.us_list_usd);
  const perUsd = currencyCode === "USD" ? 1 : rates?.[currencyCode];
  if (!Number.isFinite(perUsd) || perUsd <= 0) return null;
  const valid = (item) => {
    if (!Number.isFinite(item.priceValue) || item.priceValue <= 0) return false;
    const period = appStoreItemBillingPeriod(item);
    // Unknown period is unverified, never infer "annual" because foreign-currency digits are big.
    return period != null && period === plan.billing_period;
  };
  const choose = (candidates) => candidates.filter(valid).sort((a, b) => {
    const explicit = (appStoreItemBillingPeriod(a) ? 0 : 1) - (appStoreItemBillingPeriod(b) ? 0 : 1);
    if (explicit) return explicit;
    return Math.abs(a.priceValue / perUsd - target) - Math.abs(b.priceValue / perUsd - target);
  })[0] || null;
  const matches = (text) => { plan.pattern.lastIndex = 0; return plan.pattern.test(text); };
  return choose(items.filter((item) => matches(item.offerName))) || choose(items.filter((item) => matches(item.name)));
}

export function hasOppositeBillingEvidence(row, items, plan) {
  const known = appStoreBillingPeriod(row.source_offer_id);
  if (known && known !== plan.billing_period) return true;
  return items.some((item) => {
    plan.pattern.lastIndex = 0;
    const byOffer = plan.pattern.test(item.offerName);
    plan.pattern.lastIndex = 0;
    const byName = plan.pattern.test(item.name);
    const period = appStoreItemBillingPeriod(item);
    return (byOffer || byName) && period && period !== plan.billing_period && Math.abs(item.priceValue - row.price_value) < 0.005;
  });
}
