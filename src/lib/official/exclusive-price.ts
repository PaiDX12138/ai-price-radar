import type { OfficialRegionPrice } from "@/lib/official/types";

/** 零小数币种（与 ISO 4217 常见集对齐）。 */
const ZERO_DECIMAL = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

/**
 * 标准本地币展示：窄符号优先，大额少小数，避免 `TZS 422,881.36` 过长。
 */
export function formatLocalPrice(
  value: number,
  currencyCode: string,
  exponent?: number,
): string {
  const code = String(currencyCode || "").toUpperCase();
  if (!code || !Number.isFinite(value)) return "—";

  const zeroDec = ZERO_DECIMAL.has(code);
  let maxFrac =
    exponent != null
      ? exponent
      : zeroDec
        ? 0
        : Math.abs(value) >= 10_000
          ? 0
          : Math.abs(value) >= 100
            ? 2
            : 2;
  const minFrac = zeroDec || maxFrac === 0 ? 0 : Math.min(2, maxFrac);

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: minFrac,
      maximumFractionDigits: maxFrac,
    })
      .format(value)
      .replace(/\u00a0/g, " ")
      .trim();
  } catch {
    const n = value.toLocaleString("en-US", {
      minimumFractionDigits: minFrac,
      maximumFractionDigits: maxFrac,
    });
    return `${code} ${n}`;
  }
}

/**
 * 展示口径 = 官网 / App Store 标价原样（用户去该区开通时页面上看到的金额）。
 * 不再做「拆税成不含税」；税口径由 `taxMode` 标签（含税 / 不含税）说明。
 *
 * 历史名 `toExclusiveRegionPrice` 保留为透传，避免旧 import 炸掉。
 */
export function toDisplayRegionPrice(row: OfficialRegionPrice): OfficialRegionPrice {
  return row;
}

/** @deprecated 使用 toDisplayRegionPrice；已不再拆税。 */
export function toExclusiveRegionPrice(row: OfficialRegionPrice): OfficialRegionPrice {
  return toDisplayRegionPrice(row);
}

/** 按折算 CNY 升序（有货优先），用于最低价排序。 */
export function sortByDisplayCny(
  a: OfficialRegionPrice,
  b: OfficialRegionPrice,
): number {
  const statusRank = (s: string) =>
    s === "available" ? 0 : s === "estimated" ? 1 : 2;
  const ds = statusRank(a.status) - statusRank(b.status);
  if (ds) return ds;
  if (a.cnyPrice !== b.cnyPrice) return a.cnyPrice - b.cnyPrice;
  const ch =
    (a.channel === "web_direct" ? 0 : 1) - (b.channel === "web_direct" ? 0 : 1);
  return ch;
}

/** @deprecated 使用 sortByDisplayCny */
export const sortByExclusiveCny = sortByDisplayCny;
