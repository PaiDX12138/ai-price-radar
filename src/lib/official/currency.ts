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
export function taxNote(_row?: {
  taxMode?: OfficialTaxMode | null;
  taxPercent?: number | null;
}): string {
  return "展示为不含税价；结账时部分地区可能另计销售税 / GST";
}

/**
 * 卡片/色带短税标。官网定价 AI 套餐统一标「不含税」。
 */
export function taxBandLabel(_row?: {
  taxMode?: OfficialTaxMode | null;
  taxPercent?: number | null;
  channel?: string | null;
  countryCode?: string | null;
}): TaxBandKind {
  return "不含税";
}
