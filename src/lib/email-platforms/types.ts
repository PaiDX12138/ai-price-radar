/** 邮箱接码：按邮箱类型比平台价（非地区价）。 */

export type EmailQuoteUnit = "per_activation";

export type EmailQuoteStatus = "in_stock" | "low_stock" | "out_of_stock" | "unsupported";

export type EmailTypeConfig = {
  id: string;
  label: string;
  catalogSlug: string;
  domains: string[];
  summary: string;
  tags: string[];
};

export type EmailPlatformConfig = {
  id: string;
  name: string;
  url: string;
  region: string;
  note: string;
};

export type EmailQuoteSeed = {
  typeId: string;
  platformId: string;
  price: number | null;
  currency: "CNY" | "USD";
  unit: EmailQuoteUnit;
  status: EmailQuoteStatus;
  priceNote?: string;
  sourceUrl?: string;
};

export type EmailPlatformQuote = {
  typeId: string;
  platformId: string;
  platformName: string;
  platformUrl: string;
  price: number | null;
  currency: "CNY" | "USD";
  /** 折算人民币（无价或 unsupported 为 null） */
  cnyPrice: number | null;
  /** 统一展示用美元价（CNY 源按日更汇率反推） */
  usdPrice: number | null;
  fxUsdToCny: number | null;
  fxDate: string | null;
  unit: EmailQuoteUnit;
  status: EmailQuoteStatus;
  priceNote: string | null;
  sourceUrl: string | null;
  /** 美元价文本，如 $0.0385 */
  priceText: string | null;
};

export type EmailTypeCard = {
  id: string;
  detailId: string;
  label: string;
  catalogSlug: string;
  summary: string;
  tags: string[];
  /** 有货最低（按 CNY） */
  lowest: EmailPlatformQuote | null;
  platformCount: number;
  quoteCount: number;
  updatedAt: string | null;
  fxUsdToCny: number;
  fxDate: string | null;
};

export type EmailPlatformSnapshot = {
  generatedAt: string;
  capturedAt: string;
  fxUsdToCny: number;
  fxNote: string;
  types: EmailTypeConfig[];
  platforms: EmailPlatformConfig[];
  quotes: EmailPlatformQuote[];
};
