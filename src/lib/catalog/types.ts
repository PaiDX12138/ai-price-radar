export type PlatformId =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "grok"
  | "cursor"
  | "kiro"
  | "email"
  | "sms"
  | "other";

export type OfferStatus = "in_stock" | "low_stock" | "out_of_stock";

export type CollectorKind =
  | "kami"
  | "dujiao"
  | "shopApi"
  | "shop16688"
  | "publicProductsApi"
  | "getgptApi"
  | "ikunloveApi"
  | "xiaoheiwan"
  | "shopUserProductsApi"
  | "mooncakeCatalog"
  | "blackcatWholesale"
  | "opensoraHtml"
  | "makerichHtml"
  | "beibeiHtml"
  | "unicornHtml"
  | "genericHtml";

export type SourcePlatform =
  | "liandong"
  | "yunmao"
  | "qxvx"
  | "shop16688"
  | "kami"
  | "dujiao"
  | "public"
  | "getgpt"
  | "ikunlove"
  | "xiaoheiwan";

export type Source = {
  id: string;
  name: string;
  platform: SourcePlatform;
  collectorKind: CollectorKind;
  host: string;
  /** 本站首次收录时间（ISO）；来自 shops.listed_at */
  listedAt?: string;
  /** 最近一轮采集结果；failed 时报价沿用上次成功数据 */
  collectStatus?: "ok" | "failed";
  collectError?: string;
  lastAttemptAt?: string;
};

export type Offer = {
  id: string;
  productSlug: string;
  sourceId: string;
  sourceTitle: string;
  price: number;
  listedPrice?: number | null;
  status: OfferStatus;
  stockCount: number | null;
  /** 非计件库存文案（如 Kami「非常多」「充足」）；有数字件数时可不填 */
  stockLabel?: string | null;
  url: string;
  tags: string[];
  capturedAt: string;
  /** 采集器类型（shopApi / shop16688 / kami …） */
  collectorKind?: string;
  /** 最后一次在成功采集里看到这条报价的时间；采集失败时保持旧值 */
  lastSeenAt?: string | null;
  lifecycle?: "active" | "pending" | "delisted";
  lifecycleReason?: string | null;
  missingSince?: string | null;
  lastVerifiedAt?: string | null;
  delistedAt?: string | null;
  warranty: boolean;
};

export type Product = {
  slug: string;
  name: string;
  platform: PlatformId;
  deliveryType: string;
  summary?: string;
};

export type ProductSummary = Product & {
  /** Overall in-stock lowest (any warranty flag). */
  lowestPrice: number | null;
  /** In-stock lowest among non-warranty offers. */
  nonWarrantyLowestPrice: number | null;
  /** In-stock lowest among warranty offers; null if none. */
  warrantyLowestPrice: number | null;
  inStockCount: number;
  outStockCount: number;
  channelCount: number;
  lowestSourceName: string | null;
  lowestSourceTitle: string | null;
  /** Lowest in-stock offer url; null when no priced offer. */
  lowestSourceUrl: string | null;
  /** Lowest offer's card-shop platform (liandong / shop16688 / …). */
  lowestSourcePlatform: string | null;
  lowestSourceHost: string | null;
  updatedAt: string | null;
};

export type OfferWithSource = Offer & { source: Source };

export type PlatformTabId = "all" | PlatformId;
