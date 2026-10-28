import type { CurrencyMeta, OfficialTaxMode } from "@/lib/official/types";

const META: Record<string, CurrencyMeta> = {
  USD: { code: "USD", symbol: "$", label: "美元" },
  CNY: { code: "CNY", symbol: "¥", label: "人民币" },
  PHP: { code: "PHP", symbol: "₱", label: "菲律宾比索" },
  TRY: { code: "TRY", symbol: "₺", label: "土耳其里拉" },
  EGP: { code: "EGP", symbol: "E£", label: "埃及镑" },
  JPY: { code: "JPY", symbol: "¥", label: "日元" },
  HKD: { code: "HKD", symbol: "HK$", label: "港币" },
  SGD: { code: "SGD", symbol: "S$", label: "新加坡元" },
  INR: { code: "INR", symbol: "₹", label: "印度卢比" },
  BRL: { code: "BRL", symbol: "R$", label: "巴西雷亚尔" },
  ARS: { code: "ARS", symbol: "AR$", label: "阿根廷比索" },
  NGN: { code: "NGN", symbol: "₦", label: "尼日利亚奈拉" },
  PKR: { code: "PKR", symbol: "Rs", label: "巴基斯坦卢比" },
  EUR: { code: "EUR", symbol: "€", label: "欧元" },
  GBP: { code: "GBP", symbol: "£", label: "英镑" },
};

export function getCurrencyMeta(code: string | null | undefined): CurrencyMeta {
  const key = String(code || "").toUpperCase();
  return (
    META[key] || {
      code: key || "—",
      symbol: key || "—",
      label: key || "未知货币",
    }
  );
}

export {
  displayCountryLabel,
  flagCdnCode,
  flagCdnUrl,
} from "@/lib/official/country-display";

export function channelLabel(channel: string): string {
  if (channel === "ios_store") return "App Store";
  if (channel === "web_direct") return "官网直购";
  return channel || "—";
}

export type TaxBandKind = "含税" | "不含税";

/**
 * 税口径说明。官网定价 AI 套餐统一按不含税展示（含税源价已在展示层拆税）。
 */
export function taxNote(row?: {
  taxMode?: OfficialTaxMode | null;
  taxPercent?: number | null;
}): string {
  if (row?.taxMode === "exclusive") return "不含税；结账可能另计销售税 / GST";
  if (row?.taxMode === "inclusive") return "原始标价含税；缺少可靠税率时不擅自拆税";
  return "来源未明确税口径，按原始标价展示；与美区税前价的差额并非保证优惠";
}

/**
 * 仅展示已确认的官网税口径；App Store 和未知税口径不显示标签。
 */
export function taxBandLabel(row?: {
  taxMode?: OfficialTaxMode | null;
  taxPercent?: number | null;
  channel?: string | null;
  countryCode?: string | null;
}): TaxBandKind | null {
  if (row?.channel === "ios_store") return null;
  return row?.taxMode === "exclusive" ? "不含税" : row?.taxMode === "inclusive" ? "含税" : null;
}
