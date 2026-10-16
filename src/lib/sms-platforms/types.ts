/** 短信接码：按业务类型比平台价（非国家）。 */

export type SmsQuoteUnit = "per_activation";

export type SmsQuoteStatus = "in_stock" | "low_stock" | "out_of_stock" | "unsupported";

export type SmsTypeConfig = {
  id: string;
  label: string;
  catalogSlug: string;
  serviceCodes: string[];
  summary: string;
  tags: string[];
};

export type SmsPlatformConfig = {
  id: string;
  name: string;
  url: string;
  region: string;
  note: string;
};

export type SmsQuoteSeed = {
  typeId: string;
  platformId: string;
  price: number | null;
  currency: "CNY" | "USD";
  unit: SmsQuoteUnit;
  status: SmsQuoteStatus;
  priceNote?: string;
  sourceUrl?: string;
};

export type SmsPlatformQuote = {
  typeId: string;
  platformId: string;
  platformName: string;
  platformUrl: string;
  price: number | null;
  currency: "CNY" | "USD";
  cnyPrice: number | null;
  usdPrice: number | null;
  fxUsdToCny: number | null;
  fxDate: string | null;
  unit: SmsQuoteUnit;
  status: SmsQuoteStatus;
  priceNote: string | null;
  sourceUrl: string | null;
  priceText: string | null;
};

export type SmsTypeCard = {
  id: string;
  detailId: string;
  label: string;
  catalogSlug: string;
  summary: string;
  tags: string[];
  lowest: SmsPlatformQuote | null;
  platformCount: number;
  quoteCount: number;
  updatedAt: string | null;
  fxUsdToCny: number;
  fxDate: string | null;
};

export type SmsPlatformSnapshot = {
  generatedAt: string;
  capturedAt: string;
  fxUsdToCny: number;
  fxNote: string;
  types: SmsTypeConfig[];
  platforms: SmsPlatformConfig[];
  quotes: SmsPlatformQuote[];
};
