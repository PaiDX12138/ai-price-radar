/** Only explicit ISO codes are evidence of currency; a bare $ is ambiguous. */
const CURRENCIES = new Set(Intl.supportedValuesOf("currency"));

export function explicitPriceCurrency(priceText) {
  const codes = String(priceText || "").match(/\b[A-Z]{3}\b/g) || [];
  const known = [...new Set(codes.filter((code) => CURRENCIES.has(code)))];
  return known.length === 1 ? known[0] : null;
}
