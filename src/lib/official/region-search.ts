import { displayCountryLabel } from "@/lib/official/country-display";
import { storefrontIdForCountry } from "@/lib/official/storefront-id";
import type { OfficialRegionPrice } from "@/lib/official/types";

const enRegionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

/** 英文地区名（如 Philippines）；无则退回国家码。 */
export function englishCountryName(countryCode: string): string {
  const code = String(countryCode || "").trim().toUpperCase();
  if (!code) return "";
  try {
    return enRegionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** 匹配中文名 / 英文名 / 国家码 / Storefront 编号。 */
export function matchRegionQuery(
  row: OfficialRegionPrice,
  rawQuery: string,
): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const storefront =
    row.storefrontId?.trim() || storefrontIdForCountry(row.countryCode) || "";
  const code = row.countryCode.toUpperCase();
  const aliases =
    code === "TW"
      ? ["台湾", "臺灣", "taiwan"]
      : code === "HK"
        ? ["香港", "hong kong"]
        : code === "MO"
          ? ["澳门", "澳門", "macau", "macao"]
          : [];
  const hay = [
    row.countryLabel,
    displayCountryLabel(row.countryCode, row.countryLabel),
    row.countryCode,
    englishCountryName(row.countryCode),
    storefront,
    ...aliases,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

/** 详情页渠道 Tab 文案（与卡网筛选栏口径一致）。 */
export function regionChannelTabLabel(channel: string | null): string {
  if (!channel) return "全部";
  if (channel === "web_direct") return "官网定价";
  if (channel === "ios_store") return "iOS Store";
  return channel;
}
