/**
 * 地区展示名与国旗代码（flagcdn ISO 3166-1 alpha-2）。
 * 国旗必须与 countryCode 一一对应，不可串旗。
 */

/** 中国港澳台：对外展示名（库内/快照旧名也会被纠正）。 */
const DISPLAY_LABEL_OVERRIDE: Record<string, string> = {
  TW: "中国台湾",
  HK: "中国香港",
  MO: "中国澳门",
};

/**
 * flagcdn 个别别名（ISO 码 → CDN 路径）。
 * 绝大多数直接用小写 ISO；此处仅列例外。
 */
const FLAG_CDN_ALIAS: Record<string, string> = {
  // 英国：ISO 为 GB；部分数据源写 UK，统一指向 gb 旗
  UK: "gb",
};

/** 展示用地区名。 */
export function displayCountryLabel(
  countryCode: string | null | undefined,
  fallbackLabel?: string | null,
): string {
  const code = String(countryCode || "").trim().toUpperCase();
  if (code && DISPLAY_LABEL_OVERRIDE[code]) return DISPLAY_LABEL_OVERRIDE[code];
  const fb = String(fallbackLabel || "").trim();
  if (fb) {
    // 兜底纠正旧快照里的「台湾」等短名
    if (code === "TW" && (fb === "台湾" || fb === "臺灣")) return "中国台湾";
    if (code === "HK" && (fb === "香港" || fb.toLowerCase() === "hong kong"))
      return "中国香港";
    if (
      code === "MO" &&
      (fb === "澳门" || fb === "澳門" || fb.toLowerCase().startsWith("macao"))
    )
      return "中国澳门";
    return fb;
  }
  return code || "—";
}

/** flagcdn 路径用小写代码（保证 TW→tw、HK→hk、MO→mo、GB→gb）。 */
export function flagCdnCode(countryCode: string): string {
  const raw = String(countryCode || "").trim().toUpperCase();
  if (!raw) return "un";
  if (FLAG_CDN_ALIAS[raw]) return FLAG_CDN_ALIAS[raw];
  return raw.toLowerCase();
}

export function flagCdnUrl(countryCode: string, width = 40): string {
  return `https://flagcdn.com/w${width}/${flagCdnCode(countryCode)}.png`;
}
