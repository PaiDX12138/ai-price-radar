#!/usr/bin/env node
/**
 * Reclassify offers from data/raw/*.json into catalog public/latest.
 * Does not hit live ShopApi. Keeps empty-snapshot guard via writeCatalogSnapshot.
 * Merges shops.listed_at into sources when shops.sqlite is present.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { seedProducts } from "../collectors/classify.mjs";
import {
  loadCatalogSnapshot,
  RAW_DIR,
  reclassifyOffer,
  writeCatalogSnapshot,
} from "../collectors/persist.mjs";
import { sanitizeShopDisplayName, looksLikeAgentCodeName } from "../collectors/sanitize-shop-name.mjs";
import {
  DEFAULT_SHOPS_DB_PATH,
  listShops,
  openShopsDb,
  shopRowToCollectTarget,
} from "../collectors/shops-db.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function platformOf(source, sourceId) {
  const p = String(source?.platform || "").toLowerCase();
  if (p) return p;
  const id = String(sourceId || "").toLowerCase();
  if (id.startsWith("yunmao-")) return "yunmao";
  if (id.startsWith("qxvx-")) return "qxvx";
  if (id.startsWith("16688-") || id.startsWith("shop16688-")) return "shop16688";
  if (id.startsWith("kami-")) return "kami";
  if (id.startsWith("dujiao-")) return "dujiao";
  if (id.startsWith("liandong-")) return "liandong";
  const kind = String(source?.collectorKind || source?.kind || "").toLowerCase();
  if (kind === "shop16688") return "shop16688";
  if (kind === "kami") return "kami";
  if (kind === "dujiao") return "dujiao";
  return "liandong";
}

function loadListedAtByShopId() {
  /** @type {Map<string, string>} */
  const map = new Map();
  const dbPath = process.env.SHOPS_DB_PATH || DEFAULT_SHOPS_DB_PATH;
  if (!existsSync(dbPath)) return map;
  try {
    const db = openShopsDb(dbPath, { readonly: true });
    for (const row of listShops(db)) {
      const shop = shopRowToCollectTarget(row);
      if (shop.id && shop.listedAt) map.set(shop.id, shop.listedAt);
    }
    try {
      db.close();
    } catch {
      /* ignore */
    }
  } catch (err) {
    console.warn("[rebuild] shops.sqlite listed_at skip:", err?.message || err);
  }
  return map;
}

function loadRawEntries() {
  if (!existsSync(RAW_DIR)) return [];
  const out = [];
  for (const name of readdirSync(RAW_DIR)) {
    if (!name.endsWith(".json")) continue;
    const path = join(RAW_DIR, name);
    try {
      const payload = JSON.parse(readFileSync(path, "utf8"));
      const sourceId =
        payload?.source?.id ||
        payload?.sourceId ||
        name.replace(/\.json$/i, "");
      const offers = Array.isArray(payload?.offers)
        ? payload.offers
        : Array.isArray(payload?.result?.offers)
          ? payload.result.offers
          : [];
      out.push({ sourceId, payload, offers, path });
    } catch {
      /* skip */
    }
  }
  return out;
}

async function main() {
  const previous = loadCatalogSnapshot();
  const prevListed = new Map(
    (previous?.sources || [])
      .filter((s) => s?.id && s?.listedAt)
      .map((s) => [s.id, s.listedAt]),
  );
  const dbListed = loadListedAtByShopId();
  const rawEntries = loadRawEntries();
  const products = seedProducts();
  const seedSlugs = new Set(products.map((p) => p.slug));

  /** @type {Map<string, any[]>} */
  const offersBy = new Map();
  /** @type {Map<string, any>} */
  const metaBy = new Map();

  for (const entry of rawEntries) {
    const src = entry.payload.source || {};
    const shopInfo = entry.payload.result?.shopInfo || {};
    const token = src.shopToken || entry.sourceId.replace(/^liandong-|^yunmao-/, "");
    let name = shopInfo.name || src.name || entry.sourceId;
    if (looksLikeAgentCodeName(name) || looksLikeAgentCodeName(shopInfo.name)) {
      const prefer = looksLikeAgentCodeName(src.name) ? null : src.name;
      name = sanitizeShopDisplayName(prefer || shopInfo.name || src.name, token);
    } else {
      name = sanitizeShopDisplayName(name, token);
    }
    const platform = platformOf(src, entry.sourceId);
    const collectorKind =
      src.collectorKind ||
      src.kind ||
      (platform === "shop16688"
        ? "shop16688"
        : platform === "kami"
          ? "kami"
          : platform === "dujiao"
            ? "dujiao"
            : "shopApi");
    let host = shopInfo.host || "";
    if (!host && src.baseUrl) {
      try {
        host = new URL(src.baseUrl).host;
      } catch {
        host = "";
      }
    }
    const listedAt =
      dbListed.get(entry.sourceId) ||
      src.listedAt ||
      prevListed.get(entry.sourceId) ||
      undefined;
    metaBy.set(entry.sourceId, {
      id: entry.sourceId,
      name: entry.payload.result?.meta?.shopName || name,
      platform,
      collectorKind,
      host,
      ...(listedAt ? { listedAt: String(listedAt) } : {}),
    });

    const nextOffers = [];
    for (const offer of entry.offers) {
      const re = reclassifyOffer({
        ...offer,
        sourceId: entry.sourceId,
        collectorKind: offer.collectorKind || collectorKind,
        lastSeenAt: offer.lastSeenAt || offer.capturedAt || entry.payload.capturedAt || null,
      });
      nextOffers.push(re);
    }
    offersBy.set(entry.sourceId, nextOffers);
  }

  const allOffers = [];
  for (const list of offersBy.values()) allOffers.push(...list);
  const publicOffers = allOffers
    .filter((o) => seedSlugs.has(o.productSlug))
    .map(({ goodsKey, classified, ...rest }) => rest);

  const sources = [...metaBy.entries()]
    .filter(([sid]) => (offersBy.get(sid) || []).some((o) => seedSlugs.has(o.productSlug)))
    .map(([, meta]) => meta);

  const successSources = sources.length;
  const snapshot = {
    generatedAt: new Date().toISOString(),
    mode: previous?.mode || "live",
    isDemo: false,
    runId: `reclassify-${Date.now()}`,
    stats: {
      sourcesAttempted: rawEntries.length,
      sourcesSuccess: successSources,
      sourcesFailed: 0,
      offersRaw: allOffers.length,
      offersClassified: publicOffers.length,
      reclassifiedFromRaw: true,
    },
    sources,
    products,
    offers: publicOffers,
    crawlRuns: previous?.crawlRuns || [],
  };

  const path = await writeCatalogSnapshot(snapshot);
  const grokSlugs = [
    "grok-account",
    "grok-plus",
    "grok-premium",
    "grok-super",
    "grok-ultra",
    "grok-service",
    "x-twitter-premium",
    "x-twitter-premium-plus",
  ];
  const kiroSlugs = [
    "kiro-free-account",
    "kiro-pro",
    "kiro-pro-plus",
    "kiro-pro-max",
    "kiro-power",
    "kiro-quota-recharge",
    "kiro-mirror",
    "kiro-service",
  ];
  const claudeSlugs = [
    "claude-account",
    "claude-kyc",
    "claude-pro-month",
    "claude-max-5x",
    "claude-max-20x",
    "claude-team-premium",
    "claude-team-standard",
    "claude-mirror",
    "claude-service",
  ];
  const geminiSlugs = [
    "gemini-year",
    "gemini-recharge",
    "gemini-ultra",
    "gemini-pro",
    "gemini-mirror",
    "gemini-service",
  ];
  const emailSlugs = [
    "gmail-account",
    "outlook-account",
    "icloud-email",
    "education-email",
    "email-account",
  ];
  const smsSlugs = [
    "sms-openai",
    "sms-paypal",
    "sms-google",
    "sms-generic",
    "sms-kyc",
  ];
  const otherSlugs = [
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
  ];
  const grokCounts = Object.fromEntries(
    grokSlugs.map((slug) => [slug, publicOffers.filter((o) => o.productSlug === slug).length]),
  );
  const kiroCounts = Object.fromEntries(
    kiroSlugs.map((slug) => [slug, publicOffers.filter((o) => o.productSlug === slug).length]),
  );
  const claudeCounts = Object.fromEntries(
    claudeSlugs.map((slug) => [slug, publicOffers.filter((o) => o.productSlug === slug).length]),
  );
  const geminiCounts = Object.fromEntries(
    geminiSlugs.map((slug) => [slug, publicOffers.filter((o) => o.productSlug === slug).length]),
  );
  const emailCounts = Object.fromEntries(
    emailSlugs.map((slug) => [slug, publicOffers.filter((o) => o.productSlug === slug).length]),
  );
  const smsCounts = Object.fromEntries(
    smsSlugs.map((slug) => [slug, publicOffers.filter((o) => o.productSlug === slug).length]),
  );
  const otherCounts = Object.fromEntries(
    otherSlugs.map((slug) => [slug, publicOffers.filter((o) => o.productSlug === slug).length]),
  );
  const withListed = sources.filter((s) => s.listedAt).length;
  console.log(
    JSON.stringify(
      {
        path,
        sources: sources.length,
        sourcesWithListedAt: withListed,
        offers: publicOffers.length,
        grok: grokCounts,
        kiro: kiroCounts,
        claude: claudeCounts,
        gemini: geminiCounts,
        email: emailCounts,
        sms: smsCounts,
        other: otherCounts,
        products: {
          grok: products.filter((p) => p.platform === "grok").map((p) => p.slug),
          kiro: products.filter((p) => p.platform === "kiro").map((p) => p.slug),
          claude: products.filter((p) => p.platform === "claude").map((p) => p.slug),
          gemini: products.filter((p) => p.platform === "gemini").map((p) => p.slug),
          email: products.filter((p) => p.platform === "email").map((p) => p.slug),
          sms: products.filter((p) => p.platform === "sms").map((p) => p.slug),
          other: products.filter((p) => p.platform === "other").map((p) => p.slug),
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
