/** Published USD list, not an independently observed local checkout price. */
export function usdReferenceQuote(usd, fx) {
  if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(fx?.rates?.CNY) || fx.rates.CNY <= 0) return null;
  return {
    priceText: `USD ${usd.toFixed(2)}`, priceValue: usd, listPriceValue: usd,
    currencyCode: "USD", cnyPrice: Math.round(usd * fx.rates.CNY * 100) / 100,
    fxRateToCny: fx.rates.CNY, fxDate: fx.date,
    taxMode: "exclusive", taxPercent: null, priceBasis: "usd_reference",
  };
}

export const USD_REFERENCE_APPS = ["claude", "cursor", "grok", "x", "kiro", "gemini"];

/** Current public Cursor/Grok pages do not confirm the configured annual lists. */
export function usdReferenceStatus(appSlug, billingPeriod) {
  return billingPeriod === "annual" && ["cursor", "grok"].includes(appSlug) ? "estimated" : "available";
}
