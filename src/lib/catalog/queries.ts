import { demoOffers, demoProducts, demoSources, platformTabs } from "@/data/demo/catalog";
import { loadPersistedCatalogEntry } from "@/lib/catalog/store";
import type {
  Offer,
  OfferStatus,
  OfferWithSource,
  PlatformTabId,
  Product,
  ProductSummary,
  Source,
} from "@/lib/catalog/types";

type SourcePlatformId = Source["platform"];

const SOURCE_PLATFORM_LABEL: Record<SourcePlatformId, string> = {
  liandong: "联动小铺",
  yunmao: "云猫发卡",
  qxvx: "QXVX",
  shop16688: "16688",
  kami: "Kami",
  dujiao: "独角数卡",
  public: "Public / HTML",
  getgpt: "GetGPT",
  ikunlove: "iKunLove",
  xiaoheiwan: "小黑丸",
};

const SOURCE_PLATFORM_ORDER: SourcePlatformId[] = [
  "liandong",
  "yunmao",
  "qxvx",
  "shop16688",
  "kami",
  "dujiao",
  "getgpt",
  "ikunlove",
  "xiaoheiwan",
  "public",
];

function resolveSourcePlatformId(platform: string | undefined, host?: string): SourcePlatformId {
  if (platform && platform in SOURCE_PLATFORM_LABEL) return platform as SourcePlatformId;
  const h = (host ?? "").replace(/^www\./i, "");
  if (/(^|\.)(ldxp|wzyp)\.cn$/i.test(h)) return "liandong";
  if (/(^|\.)catfk\.com$/i.test(h)) return "yunmao";
  if (/(^|\.)qxvx\.cn$/i.test(h)) return "qxvx";
  if (/(^|\.)16688\.com\.cn$/i.test(h)) return "shop16688";
  if (/xiaoheiwan/i.test(h)) return "xiaoheiwan";
  if (/getgpt/i.test(h)) return "getgpt";
  if (/ikunlove/i.test(h)) return "ikunlove";
  return "public";
}

type CatalogBundle = {
  sources: Source[];
  products: Product[];
  offers: Offer[];
  isDemo: boolean;
  generatedAt: string | null;
  mode: string | null;
  degraded: boolean;
};


/** Align with 参考站 productType; legacy「周边辅助」→「辅助服务」. */
function normalizeDeliveryType(value: string | undefined): string {
  const t = value?.trim() ?? "";
  if (t === "周边服务" || t === "周边辅助") return "辅助服务";
  return t;
}

function normalizeProduct<T extends { deliveryType: string; name?: string }>(product: T): T {
  const deliveryType = normalizeDeliveryType(product.deliveryType) || product.deliveryType;
  let name = product.name;
  if (name?.includes("周边辅助")) name = name.replaceAll("周边辅助", "周边与自助服务");
  if (name?.includes("周边服务")) name = name.replaceAll("周边服务", "周边与自助服务");
  if (deliveryType === product.deliveryType && name === product.name) return product;
  return { ...product, deliveryType, ...(name !== undefined ? { name } : {}) };
}

/** 旧 slug 兼容（Grok 改名 / Kiro 拆档） */
const LEGACY_OFFER_SLUG: Record<string, string> = {
  "super-grok": "grok-premium",
  "super-grok-heavy": "grok-ultra",
  "kiro-account": "kiro-free-account",
  "kiro-pro-account": "kiro-pro",
  "sms-verification": "sms-generic",
  "openai-phone-verification": "sms-openai",
  "paypal-phone-verification": "sms-paypal",
  "google-phone-verification": "sms-google",
  "phone-verification": "sms-generic",
  "identity-verification": "sms-kyc",
};

function normalizeOfferSlug(slug: string): string {
  return LEGACY_OFFER_SLUG[slug] || slug;
}

function resolveCatalog(): CatalogBundle {
  const entry = loadPersistedCatalogEntry();
  if (entry) {
    return {
      sources: entry.snapshot.sources,
      products: entry.snapshot.products.map(normalizeProduct),
      offers: entry.snapshot.offers.map((offer) => {
        const productSlug = normalizeOfferSlug(offer.productSlug);
        return productSlug === offer.productSlug ? offer : { ...offer, productSlug };
      }),
      isDemo: false,
      generatedAt: entry.snapshot.generatedAt,
      mode: entry.snapshot.mode,
      degraded: entry.degraded,
    };
  }
  return {
    sources: demoSources,
    products: demoProducts.map(normalizeProduct),
    offers: demoOffers,
    isDemo: true,
    generatedAt: null,
    mode: "demo",
    degraded: false,
  };
}

function sourceById(sources: Source[], id: string): Source | undefined {
  return sources.find((source) => source.id === id);
}

/** True when reading in-repo demo catalog (no persisted snapshot). */
export function isDemoCatalog(): boolean {
  return resolveCatalog().isDemo;
}

export function getCatalogMeta(): {
  isDemo: boolean;
  generatedAt: string | null;
  mode: string | null;
  degraded: boolean;
} {
  const catalog = resolveCatalog();
  return {
    isDemo: catalog.isDemo,
    generatedAt: catalog.generatedAt,
    mode: catalog.mode,
    degraded: catalog.degraded,
  };
}

/** 目录快照中已收录的卡网店铺数（catalog.sources）。 */
export function getIndexedShopCount(): number {
  return resolveCatalog().sources.length;
}

export function getPlatformTabs() {
  return platformTabs;
}

export function parsePlatformTab(value: string | undefined): PlatformTabId {
  const allowed = new Set(platformTabs.map((tab) => tab.id));
  if (value && allowed.has(value as PlatformTabId)) return value as PlatformTabId;
  return "all";
}

export function listProducts(): Product[] {
  return resolveCatalog().products;
}

export function getProduct(slug: string): Product | undefined {
  return resolveCatalog().products.find((product) => product.slug === slug);
}

function sortProductSummaries(
  summaries: ProductSummary[],
  platform: PlatformTabId,
): ProductSummary[] {
  const bySlugOrder = (order: readonly string[]) => {
    const rank = new Map<string, number>(order.map((slug, i) => [slug, i]));
    return summaries.sort((a, b) => {
      const ra = rank.get(a.slug) ?? 1000;
      const rb = rank.get(b.slug) ?? 1000;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name, "zh-CN");
    });
  };

  if (platform === "claude") return bySlugOrder(CLAUDE_PRODUCT_ORDER);
  if (platform === "cursor") return bySlugOrder(CURSOR_PRODUCT_ORDER);
  if (platform === "kiro") return bySlugOrder(KIRO_PRODUCT_ORDER);
  if (platform === "grok") return bySlugOrder(GROK_PRODUCT_ORDER);
  if (platform === "gemini") return bySlugOrder(GEMINI_PRODUCT_ORDER);
  if (platform === "email") return bySlugOrder(EMAIL_PRODUCT_ORDER);
  if (platform === "sms") return bySlugOrder(SMS_PRODUCT_ORDER);
  if (platform === "other") return bySlugOrder(OTHER_PRODUCT_ORDER);

  return summaries.sort((a, b) => {
    if (a.lowestPrice === null && b.lowestPrice === null) return a.name.localeCompare(b.name);
    if (a.lowestPrice === null) return 1;
    if (b.lowestPrice === null) return -1;
    return a.lowestPrice - b.lowestPrice;
  });
}

export function listProductSummaries(platform: PlatformTabId = "all"): ProductSummary[] {
  const catalog = resolveCatalog();
  const products =
    platform === "all"
      ? catalog.products
      : catalog.products.filter((product) => product.platform === platform);

  const summaries = products.map((product) => summarizeProduct(product, catalog));
  return sortProductSummaries(summaries, platform);
}

/** ChatGPT 类型顺序 */
const CHATGPT_DELIVERY_TYPE_ORDER = [
  "成品账号",
  "订阅/会员",
  "额度充值",
  "辅助服务",
  "中转服务",
] as const;

/** Claude：成品账号 → 接码/验证 → 订阅/会员 → 中转服务 → 辅助服务 */
const CLAUDE_DELIVERY_TYPE_ORDER = [
  "成品账号",
  "接码/验证",
  "订阅/会员",
  "中转服务",
  "辅助服务",
] as const;

/** Cursor：成品账号 → 订阅/会员 → 辅助服务 */
const CURSOR_DELIVERY_TYPE_ORDER = ["成品账号", "订阅/会员", "辅助服务"] as const;

/** Kiro：成品账号 → 订阅/会员 → 额度充值 → 中转服务 → 辅助服务 */
const KIRO_DELIVERY_TYPE_ORDER = [
  "成品账号",
  "订阅/会员",
  "额度充值",
  "中转服务",
  "辅助服务",
] as const;

/** Grok：成品账号 → 订阅/会员 → 辅助服务（对齐 Cursor） */
const GROK_DELIVERY_TYPE_ORDER = ["成品账号", "订阅/会员", "辅助服务"] as const;

/** Gemini：成品账号 → 充值/开通 → 订阅/会员 → 中转 → 辅助 */
const GEMINI_DELIVERY_TYPE_ORDER = [
  "成品账号",
  "充值/开通",
  "订阅/会员",
  "中转服务",
  "辅助服务",
] as const;

/** Gemini 渠道固定顺序：年卡 → 充值 → Ultra → 兜底 → 中转 → 辅助 */
const GEMINI_PRODUCT_ORDER = [
  "gemini-year",
  "gemini-recharge",
  "gemini-ultra",
  "gemini-pro",
  "gemini-mirror",
  "gemini-service",
] as const;

/** 邮箱：对照参考站 — Gmail → Outlook → iCloud → 教育 → 其他 */
const EMAIL_PRODUCT_ORDER = [
  "gmail-account",
  "outlook-account",
  "icloud-email",
  "education-email",
  "email-account",
] as const;

/** 邮箱板块类型（目前统一 邮箱/账号） */
const EMAIL_DELIVERY_TYPE_ORDER = ["邮箱/账号"] as const;

/** 接码：对照参考站 — OpenAI → PayPal → Google → 通用 → KYC */
const SMS_PRODUCT_ORDER = [
  "sms-openai",
  "sms-paypal",
  "sms-google",
  "sms-generic",
  "sms-kyc",
] as const;

/** 接码板块类型（统一 接码/验证） */
const SMS_DELIVERY_TYPE_ORDER = ["接码/验证"] as const;

/** 其他：对照参考站（无 Cursor/Kiro/Windsurf/X） */
const OTHER_PRODUCT_ORDER = [
  "perplexity-account",
  "suno-account",
  "muse-ai-account",
  "dreamina-account",
  "duolingo-super",
  "apple-id-account",
  "telegram-account",
  "telegram-premium",
  "virtual-card",
  "gift-card",
  "other-product",
] as const;

const OTHER_DELIVERY_TYPE_ORDER = [
  "工具账号",
  "订阅/会员",
  "虚拟卡",
  "礼品卡",
  "其他",
] as const;

/** Claude 渠道固定顺序：普号 → KYC → 订阅档 → 中转 → 辅助 */
const CLAUDE_PRODUCT_ORDER = [
  "claude-account",
  "claude-kyc",
  "claude-pro-month",
  "claude-max-5x",
  "claude-max-20x",
  "claude-team-premium",
  "claude-team-standard",
  "claude-mirror",
  "claude-service",
] as const;

/** Cursor 渠道固定顺序：普号 → Plus → Pro → Pro+ → Ultra → 辅助 */
const CURSOR_PRODUCT_ORDER = [
  "cursor-free-account",
  "cursor-plus",
  "cursor-pro",
  "cursor-pro-plus",
  "cursor-ultra",
  "cursor-service",
] as const;

/** Kiro 渠道固定顺序：Free → Pro → Pro+ → Pro Max → Power → 额度 → 中转 → 辅助 */
const KIRO_PRODUCT_ORDER = [
  "kiro-free-account",
  "kiro-pro",
  "kiro-pro-plus",
  "kiro-pro-max",
  "kiro-power",
  "kiro-quota-recharge",
  "kiro-mirror",
  "kiro-service",
] as const;

/** Grok 渠道固定顺序：Grok 档位全部在前，X 订阅档排在后面 */
const GROK_PRODUCT_ORDER = [
  "grok-account",
  "grok-plus",
  "grok-premium",
  "grok-super",
  "grok-ultra",
  "grok-service",
  "x-twitter-premium",
  "x-twitter-premium-plus",
] as const;

/** Distinct deliveryType values for the active platform tab. */
export function listDeliveryTypes(platform: PlatformTabId = "all"): string[] {
  const catalog = resolveCatalog();
  const products =
    platform === "all"
      ? catalog.products
      : catalog.products.filter((product) => product.platform === platform);
  const set = new Set<string>();
  for (const product of products) {
    const t = normalizeDeliveryType(product.deliveryType?.trim()) || product.deliveryType?.trim();
    if (t) set.add(t);
  }
  if (platform === "chatgpt") {
    const ordered = CHATGPT_DELIVERY_TYPE_ORDER.filter((t) => set.has(t));
    const rest = [...set].filter(
      (t) => !CHATGPT_DELIVERY_TYPE_ORDER.includes(t as (typeof CHATGPT_DELIVERY_TYPE_ORDER)[number]),
    );
    return [...ordered, ...rest.sort((a, b) => a.localeCompare(b, "zh-CN"))];
  }
  if (platform === "claude") {
    const ordered = CLAUDE_DELIVERY_TYPE_ORDER.filter((t) => set.has(t));
    const rest = [...set].filter(
      (t) => !CLAUDE_DELIVERY_TYPE_ORDER.includes(t as (typeof CLAUDE_DELIVERY_TYPE_ORDER)[number]),
    );
    return [...ordered, ...rest.sort((a, b) => a.localeCompare(b, "zh-CN"))];
  }
  if (platform === "cursor") {
    const ordered = CURSOR_DELIVERY_TYPE_ORDER.filter((t) => set.has(t));
    const rest = [...set].filter(
      (t) => !CURSOR_DELIVERY_TYPE_ORDER.includes(t as (typeof CURSOR_DELIVERY_TYPE_ORDER)[number]),
    );
    return [...ordered, ...rest.sort((a, b) => a.localeCompare(b, "zh-CN"))];
  }
  if (platform === "kiro") {
    const ordered = KIRO_DELIVERY_TYPE_ORDER.filter((t) => set.has(t));
    const rest = [...set].filter(
      (t) => !KIRO_DELIVERY_TYPE_ORDER.includes(t as (typeof KIRO_DELIVERY_TYPE_ORDER)[number]),
    );
    return [...ordered, ...rest.sort((a, b) => a.localeCompare(b, "zh-CN"))];
  }
  if (platform === "grok") {
    const ordered = GROK_DELIVERY_TYPE_ORDER.filter((t) => set.has(t));
    const rest = [...set].filter(
      (t) => !GROK_DELIVERY_TYPE_ORDER.includes(t as (typeof GROK_DELIVERY_TYPE_ORDER)[number]),
    );
    return [...ordered, ...rest.sort((a, b) => a.localeCompare(b, "zh-CN"))];
  }
  if (platform === "gemini") {
    const ordered = GEMINI_DELIVERY_TYPE_ORDER.filter((t) => set.has(t));
    const rest = [...set].filter(
      (t) => !GEMINI_DELIVERY_TYPE_ORDER.includes(t as (typeof GEMINI_DELIVERY_TYPE_ORDER)[number]),
    );
    return [...ordered, ...rest.sort((a, b) => a.localeCompare(b, "zh-CN"))];
  }
  if (platform === "email") {
    const ordered = EMAIL_DELIVERY_TYPE_ORDER.filter((t) => set.has(t));
    const rest = [...set].filter(
      (t) => !EMAIL_DELIVERY_TYPE_ORDER.includes(t as (typeof EMAIL_DELIVERY_TYPE_ORDER)[number]),
    );
    return [...ordered, ...rest.sort((a, b) => a.localeCompare(b, "zh-CN"))];
  }
  if (platform === "sms") {
    const ordered = SMS_DELIVERY_TYPE_ORDER.filter((t) => set.has(t));
    const rest = [...set].filter(
      (t) => !SMS_DELIVERY_TYPE_ORDER.includes(t as (typeof SMS_DELIVERY_TYPE_ORDER)[number]),
    );
    return [...ordered, ...rest.sort((a, b) => a.localeCompare(b, "zh-CN"))];
  }
  if (platform === "other") {
    const ordered = OTHER_DELIVERY_TYPE_ORDER.filter((t) => set.has(t));
    const rest = [...set].filter(
      (t) => !OTHER_DELIVERY_TYPE_ORDER.includes(t as (typeof OTHER_DELIVERY_TYPE_ORDER)[number]),
    );
    return [...ordered, ...rest.sort((a, b) => a.localeCompare(b, "zh-CN"))];
  }
  return [...set].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

/**
 * Offer / source text match for catalog search (e.g. 「菲」→ 菲区充值标题).
 * @param {import('./types').Offer} offer
 * @param {import('./types').Source | undefined} source
 * @param {string} needle lower-cased
 */
function offerMatchesSearch(offer: Offer, source: Source | undefined, needle: string): boolean {
  const parts = [
    offer.sourceTitle,
    ...(Array.isArray(offer.tags) ? offer.tags : []),
    source?.name ?? "",
    source?.host ?? "",
  ];
  return parts.join("\n").toLowerCase().includes(needle);
}

function productMetaMatchesSearch(product: Product, needle: string): boolean {
  return [product.name, product.summary ?? "", product.slug, product.deliveryType]
    .join("\n")
    .toLowerCase()
    .includes(needle);
}

/**
 * platform → type → q; caller paginates.
 * `q` 同时匹配：商品名/筛选类型名，以及报价标题（如「菲区」），命中报价时卡片价=匹配报价最低价。
 */
export function filterProductSummaries(
  platform: PlatformTabId,
  opts: { type?: string; q?: string } = {},
): ProductSummary[] {
  const type = opts.type?.trim();
  const needle = opts.q?.trim().toLowerCase();

  // 无关键词：沿用全量摘要
  if (!needle) {
    let products = listProductSummaries(platform);
    if (type) {
      products = products.filter((product) => product.deliveryType === type);
    }
    return products;
  }

  const catalog = resolveCatalog();
  const baseProducts =
    platform === "all"
      ? catalog.products
      : catalog.products.filter((product) => product.platform === platform);

  /** @type {ProductSummary[]} */
  const out: ProductSummary[] = [];

  for (const product of baseProducts) {
    if (type && product.deliveryType !== type) continue;

    const metaHit = productMetaMatchesSearch(product, needle);
    const productOffers = catalog.offers.filter((o) => o.productSlug === product.slug);
    const matchedOffers = productOffers.filter((o) => {
      const source = sourceById(catalog.sources, o.sourceId);
      return offerMatchesSearch(o, source, needle);
    });

    if (!metaHit && matchedOffers.length === 0) continue;

    // 有报价标题命中 → 用匹配子集重算最低价 / 渠道数；仅类型名命中则保留全量价
    if (matchedOffers.length > 0) {
      out.push(summarizeProduct(product, catalog, matchedOffers));
    } else {
      out.push(summarizeProduct(product, catalog));
    }
  }

  // 保持与 listProductSummaries 相同的平台排序（按 slug 名即可近似；再走一遍排序函数）
  return sortProductSummaries(out, platform);
}

export function getOffersForProduct(slug: string): OfferWithSource[] {
  const catalog = resolveCatalog();
  return catalog.offers
    .filter((offer) => offer.productSlug === slug)
    .map((offer) => {
      const source = sourceById(catalog.sources, offer.sourceId);
      if (!source) return null;
      return { ...offer, source };
    })
    .filter((offer): offer is OfferWithSource => Boolean(offer))
    .sort((a, b) => {
      const rank = (status: OfferStatus) => (status === "out_of_stock" ? 1 : 0);
      const byStock = rank(a.status) - rank(b.status);
      if (byStock !== 0) return byStock;
      return a.price - b.price;
    });
}

/**
 * 全站已接入卡网平台（来自 catalog.sources），供各 AI 板块商品详情筛选共用。
 * ChatGPT / Claude / Gemini … 同一套选项，不因当前商品只有云猫报价就藏掉链动。
 */
export function listIntegratedSourcePlatforms(): Array<{
  id: SourcePlatformId;
  label: string;
}> {
  const catalog = resolveCatalog();
  const present = new Set<SourcePlatformId>();
  for (const source of catalog.sources) {
    present.add(resolveSourcePlatformId(source.platform, source.host));
  }
  const ordered = SOURCE_PLATFORM_ORDER.filter((id) => present.has(id));
  const rest = [...present]
    .filter((id) => !SOURCE_PLATFORM_ORDER.includes(id))
    .sort((a, b) => SOURCE_PLATFORM_LABEL[a].localeCompare(SOURCE_PLATFORM_LABEL[b], "zh-CN"));
  return [...ordered, ...rest].map((id) => ({ id, label: SOURCE_PLATFORM_LABEL[id] }));
}

/**
 * @param offersOverride 若传入（如搜索命中的报价子集），用该子集算最低价与渠道数
 */
export function summarizeProduct(
  product: Product,
  catalog: CatalogBundle = resolveCatalog(),
  offersOverride?: Offer[],
): ProductSummary {
  const offers =
    offersOverride ??
    catalog.offers.filter((offer) => offer.productSlug === product.slug);
  const inStock = offers.filter((offer) => offer.status !== "out_of_stock");
  const outStock = offers.filter((offer) => offer.status === "out_of_stock");
  const priced = inStock.filter((offer) => Number.isFinite(offer.price));
  const warrantyPriced = priced.filter((offer) => offer.warranty);
  const nonWarrantyPriced = priced.filter((offer) => !offer.warranty);

  const lowest = priced.slice().sort((a, b) => a.price - b.price)[0] ?? null;
  const warrantyLowest = warrantyPriced.slice().sort((a, b) => a.price - b.price)[0] ?? null;
  const nonWarrantyLowest =
    nonWarrantyPriced.slice().sort((a, b) => a.price - b.price)[0] ?? null;
  const updatedAt = offers.map((offer) => offer.capturedAt).sort().at(-1) ?? null;
  const lowestSource = lowest ? sourceById(catalog.sources, lowest.sourceId) : null;

  return {
    ...product,
    lowestPrice: lowest?.price ?? null,
    nonWarrantyLowestPrice: nonWarrantyLowest?.price ?? null,
    warrantyLowestPrice: warrantyLowest?.price ?? null,
    inStockCount: inStock.length,
    outStockCount: outStock.length,
    channelCount: offers.length,
    lowestSourceName: lowestSource?.name ?? null,
    lowestSourceTitle: lowest?.sourceTitle ?? null,
    lowestSourceUrl: lowest?.url ?? null,
    lowestSourcePlatform: lowestSource?.platform ?? null,
    lowestSourceHost: lowestSource?.host ?? null,
    updatedAt,
  };
}
