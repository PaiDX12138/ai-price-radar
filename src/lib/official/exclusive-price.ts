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

function roundMoney(value: number, currencyCode: string, exponent?: number): number {
  const code = String(currencyCode || "").toUpperCase();
  const zeroDec = ZERO_DECIMAL.has(code);
  const places =
    exponent != null && Number.isInteger(exponent)
      ? Math.max(0, exponent)
      : zeroDec
        ? 0
        : 2;
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

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
 * 官网定价统一按「不含税」展示：
 * - inclusive + 有税率 → 拆成不含税金额并重算折合 CNY
 * - exclusive / 无税率 → 原样金额，标签仍标不含税
 */
export function toDisplayRegionPrice(row: OfficialRegionPrice): OfficialRegionPrice {
  const list =
    row.listPriceValue != null && Number.isFinite(row.listPriceValue) && row.listPriceValue > 0
      ? row.listPriceValue
      : row.priceValue;
  const taxPercent =
    row.taxPercent != null && Number.isFinite(row.taxPercent) && row.taxPercent > 0
      ? row.taxPercent
      : null;

  if (
    row.taxMode === "inclusive" &&
    taxPercent != null &&
    list != null &&
    Number.isFinite(list) &&
    list > 0
  ) {
    const exclusive = roundMoney(list / (1 + taxPercent / 100), row.currencyCode);
    if (!Number.isFinite(exclusive) || exclusive <= 0) {
      return { ...row, taxMode: "exclusive" };
    }
    const ratio = exclusive / list;
    const cnyRaw = row.cnyPrice * ratio;
    const cnyPrice =
      row.fxRateToCny != null && Number.isFinite(row.fxRateToCny) && row.fxRateToCny > 0
        ? Math.round(exclusive * row.fxRateToCny * 100) / 100
        : Math.round(cnyRaw * 100) / 100;
    return {
      ...row,
      priceValue: exclusive,
      priceText: formatLocalPrice(exclusive, row.currencyCode),
      cnyPrice,
      taxMode: "exclusive",
    };
  }

  return {
    ...row,
    taxMode: "exclusive",
  };
}

/** @deprecated 使用 toDisplayRegionPrice */
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
