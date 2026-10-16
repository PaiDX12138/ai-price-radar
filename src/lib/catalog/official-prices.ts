import { getPlatformTabs, getProduct } from "@/lib/catalog/queries";
import type { PlatformId, PlatformTabId } from "@/lib/catalog/types";
import {
  getOfficialCnyBySlug,
  getOfficialLowestQuoteBySlug,
} from "@/lib/official/queries";
import type { OfficialRegionPrice } from "@/lib/official/types";

export type OfficialCatalogQuote = {
  planId: string;
  row: OfficialRegionPrice;
  usCny: number | null;
  usListUsd: number | null;
  usPriceText: string | null;
  /** 最低地区折合 CNY */
  priceCny: number;
};

/**
 * 卡网商品 slug → 官网套餐 catalogSlug。
 * 正价代充 / 年卡成品等与标准订阅共用同一套官网地区价。
 */
export const OFFICIAL_QUOTE_SLUG_ALIASES: Record<string, string> = {
  "chatgpt-plus-recharge": "chatgpt-plus",
  /** Gemini Pro 充值/开通、年卡成品 → Google AI Pro */
  "gemini-recharge": "gemini-pro",
  "gemini-year": "gemini-pro",
  "gemini-quota-recharge": "gemini-pro",
};

export function resolveOfficialQuoteSlug(slug: string): string {
  return OFFICIAL_QUOTE_SLUG_ALIASES[slug] ?? slug;
}

/** Fallback US-list CNY when snapshot missing. FX snapshot date noted historically. */
export const OFFICIAL_PRICES_CNY: Record<string, number> = {
  "chatgpt-go": 54.19,
  "chatgpt-plus": 135.41,
  "chatgpt-plus-recharge": 135.41,
  "chatgpt-pro-5x": 677.39,
  "chatgpt-pro-20x": 1354.78,
  /** Pro $500 / ~50x */
  "chatgpt-pro-500": 3386.95,
  "claude-pro-month": 135.48,
  "claude-max-5x": 677.39,
  "claude-max-20x": 1354.78,
  "gemini-plus": 33.45,
  "gemini-pro": 133.99,
  "gemini-recharge": 133.99,
  "gemini-year": 133.99,
  "gemini-ultra": 670.23,
  /** Grok Plus $8 · 原 SuperGrok Lite */
  "grok-plus": 54.19,
  /** Grok Premium $30 · 原 SuperGrok（旧 slug super-grok） */
  "grok-premium": 203.22,
  "super-grok": 203.22,
  /** Grok Super $100 · 原 SuperGrok Plus */
  "grok-super": 677.39,
  /** Grok Ultra $200 · 原 SuperGrok Heavy（旧 slug super-grok-heavy） */
  "grok-ultra": 1354.78,
  "super-grok-heavy": 1354.78,
  /** Cursor Plus $8 */
  "cursor-plus": 54.19,
  /** Cursor Premium $30 · 卡网「Pro」对照 */
  "cursor-pro": 203.22,
  /** Cursor Super $100 · 卡网「Pro+」对照 */
  "cursor-pro-plus": 677.39,
  /** Cursor Ultra $200 */
  "cursor-ultra": 1354.78,
  /** X Premium ≈ $8（地区价浮动，取美区参考） */
  "x-twitter-premium": 54.19,
  /** X Premium+ ≈ $16 */
  "x-twitter-premium-plus": 108.38,
};

/** 卡网对照：官网真实最低地区价（含地区行，供 OfficialLowestStrip）。 */
export function getOfficialCatalogQuote(
  slug: string,
): OfficialCatalogQuote | null {
  const quoteSlug = resolveOfficialQuoteSlug(slug);
  const quote = getOfficialLowestQuoteBySlug(quoteSlug);
  if (quote) {
    return {
      planId: quote.planId,
      row: quote.row,
      usCny: quote.usCny,
      usListUsd: quote.usListUsd,
      usPriceText: quote.usPriceText,
      priceCny: quote.row.cnyPrice,
    };
  }
  // 无快照时仅有 CNY，不造假地区行
  return null;
}

export function getOfficialPriceCny(slug: string): number | null {
  const quote = getOfficialCatalogQuote(slug);
  if (quote) return quote.priceCny;
  const quoteSlug = resolveOfficialQuoteSlug(slug);
  const fromSnapshot = getOfficialCnyBySlug(quoteSlug);
  if (typeof fromSnapshot === "number" && Number.isFinite(fromSnapshot)) {
    return fromSnapshot;
  }
  const v = OFFICIAL_PRICES_CNY[slug] ?? OFFICIAL_PRICES_CNY[quoteSlug];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export type OfficialPriceRow = {
  slug: string;
  name: string;
  platform: PlatformId;
  deliveryType: string;
  priceCny: number;
};

/** 官网定价平台 Tab：与卡网页同序，不含「其他」；保留邮箱 / 接码。 */
export function getOfficialPlatformTabs() {
  return getPlatformTabs().filter((tab) => tab.id !== "other");
}

/** 当前平台下官网商品出现过的 deliveryType。 */
export function listOfficialDeliveryTypes(platform: PlatformTabId = "all"): string[] {
  const rows = listOfficialPriceRows().filter(
    (row) => platform === "all" || row.platform === platform,
  );
  const set = new Set<string>();
  for (const row of rows) {
    const t = row.deliveryType?.trim();
    if (t) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function filterOfficialPriceRows(opts: {
  platform?: PlatformTabId;
  type?: string;
  q?: string;
}): OfficialPriceRow[] {
  const platform = opts.platform ?? "all";
  const type = opts.type?.trim();
  const needle = opts.q?.trim().toLowerCase();
  return listOfficialPriceRows().filter((row) => {
    if (platform !== "all" && row.platform !== platform) return false;
    if (type && row.deliveryType !== type) return false;
    if (needle) {
      const hay = [row.name, row.deliveryType, row.slug].join("\n").toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

/** 有官网参考价的标准商品（按平台、名称排序）。 */
export function listOfficialPriceRows(): OfficialPriceRow[] {
  const rows: OfficialPriceRow[] = [];
  const seen = new Set<string>();
  for (const [slug, priceCny] of Object.entries(OFFICIAL_PRICES_CNY)) {
    if (!Number.isFinite(priceCny) || seen.has(slug)) continue;
    // 旧 slug 别名不单独展示
    if (slug === "super-grok" || slug === "super-grok-heavy") continue;
    const product = getProduct(slug);
    if (!product) continue;
    seen.add(slug);
    rows.push({
      slug,
      name: product.name,
      platform: product.platform,
      deliveryType: product.deliveryType,
      priceCny,
    });
  }
  const platformOrder: PlatformId[] = [
    "chatgpt",
    "claude",
    "cursor",
    "grok",
    "kiro",
    "gemini",
    "email",
    "sms",
    "other",
  ];
  const rank = new Map(platformOrder.map((p, i) => [p, i]));
  return rows.sort((a, b) => {
    const pa = rank.get(a.platform) ?? 99;
    const pb = rank.get(b.platform) ?? 99;
    if (pa !== pb) return pa - pb;
    return a.priceCny - b.priceCny || a.name.localeCompare(b.name, "zh-CN");
  });
}
