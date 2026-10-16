import regions from "../../../config/official-prices/regions.json";

const byCountry = new Map<string, string>();

for (const row of regions as Array<{ countryCode?: string; storefrontId?: string | null }>) {
  const code = row.countryCode?.trim().toUpperCase();
  const id = row.storefrontId?.trim();
  if (code && id) byCountry.set(code, id);
}

/** Apple Storefront 数字编号（无则 null）。 */
export function storefrontIdForCountry(countryCode: string | null | undefined): string | null {
  if (!countryCode) return null;
  return byCountry.get(countryCode.trim().toUpperCase()) ?? null;
}
