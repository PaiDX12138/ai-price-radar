export type OfficialBillingPeriod = "monthly" | "annual";

/** 官网渠道标价的税口径：inclusive = 标价已含税；exclusive = 标价未含税。 */
export type OfficialTaxMode = "inclusive" | "exclusive";

export type OfficialLowestRow = {
  priceBasis?: "observed" | "usd_reference";
  sourceOfferId?: string | null;
  countryCode: string;
  countryLabel: string;
  currencyCode: string;
  /** 展示用原币文本（官网 / 商店标价原样） */
  priceText: string | null;
  priceValue: number | null;
  cnyPrice: number;
  fxRateToCny: number | null;
  fxDate: string | null;
  sourceUrl: string | null;
  status: string;
  channel: string;
  /** 官网渠道：接口原始标价（未折税前） */
  listPriceValue?: number | null;
  taxMode?: OfficialTaxMode | null;
  taxPercent?: number | null;
  updatedAt: string | null;
  lastSuccessAt: string | null;
};

export type OfficialPlanSummary = {
  id: string;
  planSlug: string;
  family: string;
  catalogSlug: string | null;
  label: string;
  billingPeriod: OfficialBillingPeriod;
  appSlug: string;
  appName: string;
  provider: string;
  catalogPlatform: string;
  /** 覆盖地区数（按国家去重） */
  sampleCount: number;
  /** 报价条数（同一国家官网 + iOS 算两条） */
  quoteCount?: number;
  /** 各渠道报价条数，如 { web_direct: 232, ios_store: 169 } */
  channelCounts?: Record<string, number>;
  usListUsd: number | null;
  /**
   * 可选：无折扣时的美区 MSRP（USD）。
   * 有值且当前美区实采 / usListUsd 低于它时自动出优惠角标（FX 套餐促销用）。
   */
  regularUsd?: number | null;
  /** 美区实采原价文本（如 $19.99），无美区样本时为 null */
  usPriceText: string | null;
  /** 美区实采 USD 数值（优先官网）；用于自动折扣判断 */
  usLiveUsd?: number | null;
  usCny: number | null;
  savePct: number | null;
  lowest: OfficialLowestRow;
  updatedAt: string | null;
};

/** 公开价目相对基准自动算出的优惠（非邀请码首月）。 */
export type OfficialPromo = {
  percent: number;
  label: string;
};

/** 列表卡：同一产品族合并月付/年付。 */
export type OfficialProductCard = {
  id: string;
  family: string;
  label: string;
  catalogSlug: string | null;
  appSlug: string;
  appName: string;
  provider: string;
  catalogPlatform: string;
  monthly: OfficialPlanSummary | null;
  annual: OfficialPlanSummary | null;
  /** 详情默认进月付，无月付则年付 */
  detailId: string;
  /** 覆盖地区数 */
  sampleCount: number;
  /** 报价条数 */
  quoteCount: number;
  updatedAt: string | null;
  /** 官网公开价目自带折扣时展示在标题旁 */
  promo: OfficialPromo | null;
};

export type CurrencyMeta = {
  code: string;
  symbol: string;
  label: string;
};

/** One regional quote row on plan detail. */
export type OfficialRegionPrice = {
  priceBasis?: "observed" | "usd_reference";
  sourceOfferId?: string | null;
  id: string;
  countryCode: string;
  countryLabel: string;
  currencyCode: string;
  /** Apple Storefront 数字编号（无 iOS 店面时为 null） */
  storefrontId?: string | null;
  priceText: string | null;
  priceValue: number | null;
  cnyPrice: number;
  fxRateToCny: number | null;
  fxDate: string | null;
  sourceUrl: string | null;
  status: string;
  channel: string;
  listPriceValue?: number | null;
  taxMode?: OfficialTaxMode | null;
  taxPercent?: number | null;
  updatedAt: string | null;
  lastSuccessAt: string | null;
};
