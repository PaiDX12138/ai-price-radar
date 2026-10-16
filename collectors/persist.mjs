/**
 * Persist catalog snapshot + crawl runs under data/ (gitignored).
 * Explorer public snapshot: data/catalog/public.json (+ latest.json alias).
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyTitle, LEGACY_PRODUCT_SLUG_MAP, seedProducts } from "./classify.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const RECLASSIFY_SCRIPT = join(root, "scripts", "reclassify-offers-once.mjs");
export const DATA_DIR = join(root, "data");
export const CATALOG_PATH = join(DATA_DIR, "catalog", "latest.json");
export const PUBLIC_SNAPSHOT_PATH = join(DATA_DIR, "catalog", "public.json");
export const CRAWL_RUNS_PATH = join(DATA_DIR, "crawl_runs.jsonl");
export const RAW_DIR = join(DATA_DIR, "raw");

/**
 * 写目录前按当前 classify 规则重标 productSlug。
 * 避免 worker/collect 合并旧 raw 时沿用过期档位（如 Kiro 仍挂 Claude/GPT）。
 * @param {any} offer
 * @param {{ classifyTitle: Function, LEGACY_PRODUCT_SLUG_MAP: Record<string, string> }} [classify]
 */
export function reclassifyOffer(offer, classify) {
  if (!offer || typeof offer !== "object") return offer;
  const title = offer.sourceTitle || "";
  const classifyFn = classify?.classifyTitle || classifyTitle;
  const legacyMap = classify?.LEGACY_PRODUCT_SLUG_MAP || LEGACY_PRODUCT_SLUG_MAP;
  const { productSlug, warranty } = classifyFn(title, { price: offer.price });
  const resolved = productSlug ? legacyMap[productSlug] || productSlug : null;
  return {
    ...offer,
    productSlug: resolved || "other-unclassified",
    warranty: warranty ?? offer.warranty,
    classified: Boolean(resolved),
  };
}

/** @param {any[]} offers */
export function reclassifyOffers(offers, classify) {
  if (!Array.isArray(offers)) return [];
  return offers.map((o) => reclassifyOffer(o, classify));
}

/**
 * 子进程加载磁盘上最新 classify.mjs（彻底避开长驻进程 ESM 缓存）。
 * Node 的 `import(url?t=)` 热更新不可靠，旧 worker 会继续用内存里的旧 seed。
 * @param {any[]} offers
 * @returns {{ products: any[], offers: any[] }}
 */
export function reclassifyOffersInFreshProcess(offers) {
  ensureParent(join(DATA_DIR, "catalog", ".keep"));
  const stamp = `${process.pid}-${Date.now()}`;
  const inPath = join(DATA_DIR, `reclassify-in-${stamp}.json`);
  const outPath = join(DATA_DIR, `reclassify-out-${stamp}.json`);
  try {
    writeFileSync(inPath, `${JSON.stringify(Array.isArray(offers) ? offers : [])}\n`, "utf8");
    const stdout = execFileSync(process.execPath, [RECLASSIFY_SCRIPT, inPath, outPath], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: process.env,
    });
    const summary = String(stdout || "").trim();
    if (summary) {
      try {
        const meta = JSON.parse(summary.split("\n").filter(Boolean).pop());
        console.log(
          `[persist] fresh-classify seeds=${meta.productSeeds} offers=${meta.offersIn}->${meta.offersOut}`,
        );
      } catch {
        /* ignore non-json banner */
      }
    }
    const parsed = JSON.parse(readFileSync(outPath, "utf8"));
    if (!parsed || !Array.isArray(parsed.products) || !Array.isArray(parsed.offers)) {
      throw new Error("reclassify-offers-once returned invalid payload");
    }
    return { products: parsed.products, offers: parsed.offers };
  } finally {
    for (const p of [inPath, outPath]) {
      try {
        if (existsSync(p)) unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  }
}

function ensureParent(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

/**
 * Write aggregate explorer snapshot (must include generatedAt).
 * Empty-batch guard: sourcesSuccess===0 or offers.length===0 never overwrite existing.
 *
 * 写入前强制子进程热加载磁盘 classify：
 * - products / offers 一律按最新规则，旧 worker 内存无法盖掉新档位
 * @param {object} snapshot
 * @returns {Promise<string>}
 */
export async function writeCatalogSnapshot(snapshot) {
  if (!snapshot || typeof snapshot.generatedAt !== "string" || !snapshot.generatedAt) {
    throw new Error("writeCatalogSnapshot requires snapshot.generatedAt");
  }
  const { products, offers } = reclassifyOffersInFreshProcess(
    Array.isArray(snapshot.offers) ? snapshot.offers : [],
  );

  const sourcesSuccess = snapshot?.stats?.sourcesSuccess;
  const offersLen = offers.length;
  const empty = sourcesSuccess === 0 || offersLen === 0;
  const existing = existsSync(PUBLIC_SNAPSHOT_PATH) || existsSync(CATALOG_PATH);
  if (empty && existing) {
    console.warn(
      `[persist] skip catalog overwrite: sourcesSuccess=${sourcesSuccess} offers=${offersLen} (keeping existing public/latest)`,
    );
    return existsSync(PUBLIC_SNAPSHOT_PATH) ? PUBLIC_SNAPSHOT_PATH : CATALOG_PATH;
  }

  const normalized = {
    ...snapshot,
    products,
    offers,
    stats: {
      ...(snapshot.stats && typeof snapshot.stats === "object" ? snapshot.stats : {}),
      offersClassified: offersLen,
      productSeeds: products.length,
    },
  };

  const body = `${JSON.stringify(normalized, null, 2)}\n`;
  ensureParent(CATALOG_PATH);
  writeFileSync(CATALOG_PATH, body, "utf8");
  ensureParent(PUBLIC_SNAPSHOT_PATH);
  writeFileSync(PUBLIC_SNAPSHOT_PATH, body, "utf8");
  return PUBLIC_SNAPSHOT_PATH;
}

/**
 * @param {object} run
 */
export function appendCrawlRun(run) {
  ensureParent(CRAWL_RUNS_PATH);
  appendFileSync(CRAWL_RUNS_PATH, `${JSON.stringify(run)}\n`, "utf8");
  return CRAWL_RUNS_PATH;
}

/**
 * @param {string} sourceId
 * @param {object} payload
 */
/**
 * Fill per-offer fields the catalog relies on (mutates in place):
 * collectorKind (from source) and lastSeenAt (last time this offer was seen in a successful fetch).
 * @param {any[]} offers
 * @param {{ collectorKind?: string|null, seenAt?: string|null }} ctx
 */
export function stampOffers(offers, ctx = {}) {
  if (!Array.isArray(offers)) return offers;
  for (const offer of offers) {
    if (!offer || typeof offer !== "object") continue;
    if (!offer.collectorKind && ctx.collectorKind) offer.collectorKind = String(ctx.collectorKind);
    if (!offer.lastSeenAt) offer.lastSeenAt = ctx.seenAt || offer.capturedAt || null;
  }
  return offers;
}

/**
 * @param {string} sourceId
 * @param {object} payload
 * @param {{ force?: boolean }} [opts] force=true：允许空/失败覆盖（打样/封禁撤展）
 */
export function writeRawSource(sourceId, payload, opts = {}) {
  stampOffers(payload?.offers, {
    collectorKind: payload?.source?.collectorKind || payload?.source?.kind || null,
    seenAt: payload?.result?.ok === true ? payload?.capturedAt || null : null,
  });
  mkdirSync(RAW_DIR, { recursive: true });
  const safe = String(sourceId || "unknown").replace(/[^\w.-]+/g, "_");
  const path = join(RAW_DIR, `${safe}.json`);
  const newOffers = Array.isArray(payload?.offers) ? payload.offers.length : 0;
  const newOk = payload?.result?.ok === true;
  const empty = !newOk || newOffers === 0;
  const force =
    opts.force === true ||
    payload?.result?.withdrawDisplay === true ||
    payload?.result?.forceWrite === true;
  if (empty && !force && existsSync(path)) {
    try {
      const prev = JSON.parse(readFileSync(path, "utf8"));
      const prevOffers = Array.isArray(prev?.offers) ? prev.offers.length : 0;
      if (prevOffers > 0) {
        console.warn(
          `[persist] skip raw overwrite: ${safe} newOffers=${newOffers} ok=${newOk} (keeping ${prevOffers} existing offers)`,
        );
        return path;
      }
    } catch {
      /* corrupt existing — allow overwrite */
    }
  }
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return path;
}

export function loadCatalogSnapshot() {
  const path = existsSync(PUBLIC_SNAPSHOT_PATH) ? PUBLIC_SNAPSHOT_PATH : CATALOG_PATH;
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Load last-good per sourceId from data/raw/*.json (ok + offers>0).
 * Skips fixture-* files.
 * @returns {Map<string, { sourceId: string, sourceMeta: object|null, offers: any[], capturedAt: string|null }>}
 */
export function loadRawLastGoodBySourceId() {
  /** @type {Map<string, { sourceId: string, sourceMeta: object|null, offers: any[], capturedAt: string|null }>} */
  const map = new Map();
  if (!existsSync(RAW_DIR)) return map;
  for (const name of readdirSync(RAW_DIR)) {
    if (!name.endsWith(".json")) continue;
    if (name.startsWith("fixture-")) continue;
    const filePath = join(RAW_DIR, name);
    try {
      const payload = JSON.parse(readFileSync(filePath, "utf8"));
      const offers = Array.isArray(payload?.offers) ? payload.offers : [];
      const ok = payload?.result?.ok === true;
      if (!ok || offers.length === 0) continue;
      const sourceId = String(
        payload?.source?.id || offers[0]?.sourceId || name.replace(/\.json$/, ""),
      );
      if (!sourceId) continue;
      const prev = map.get(sourceId);
      const capturedAt = payload?.capturedAt || offers[0]?.capturedAt || null;
      if (prev && prev.capturedAt && capturedAt && prev.capturedAt > capturedAt) continue;
      const src = payload?.source || {};
      const shopInfo = payload?.result?.shopInfo || {};
      const meta = payload?.result?.meta || {};
      const platform = resolveRawPlatform(src, meta);
      const collectorKind =
        src.collectorKind ||
        src.kind ||
        (platform === "shop16688" ? "shop16688" : "shopApi");
      stampOffers(offers, { collectorKind });
      map.set(sourceId, {
        sourceId,
        sourceMeta: {
          id: sourceId,
          name:
            shopInfo.name ||
            shopInfo.nickname ||
            meta.shopName ||
            src.name ||
            sourceId,
          platform,
          collectorKind,
          host:
            shopInfo.host ||
            (src.baseUrl ? safeHost(src.baseUrl) : "") ||
            (meta.baseUrl ? safeHost(meta.baseUrl) : ""),
          ...(src.listedAt ? { listedAt: String(src.listedAt) } : {}),
        },
        offers,
        capturedAt,
      });
    } catch {
      /* skip corrupt raw */
    }
  }
  return map;
}

/**
 * Merge catalog by sourceId: batch success overlays last-good (previous catalog + raw).
 * Failed/empty shops keep previous/raw data — never wipe the whole table.
 * withdrawSourceIds：打样/封禁等主动撤展，删除该店全部报价（店仍保留、继续采集）。
 *
 * @param {{
 *   previous: object|null,
 *   rawLastGood: Map<string, { sourceId: string, sourceMeta: object|null, offers: any[], capturedAt: string|null }>,
 *   batchSuccess: Array<{ sourceId: string, sourceMeta: object, offers: any[] }>,
 *   withdrawSourceIds?: string[],
 * }} input
 * @returns {{ offers: any[], sources: any[], retainedSourceIds: string[], overlaySourceIds: string[], withdrawnSourceIds: string[] }}
 */
export function mergeCatalogBySourceId(input) {
  const previous = input?.previous || null;
  const rawLastGood = input?.rawLastGood || new Map();
  const batchSuccess = Array.isArray(input?.batchSuccess) ? input.batchSuccess : [];
  const withdrawnSourceIds = [
    ...new Set(
      (Array.isArray(input?.withdrawSourceIds) ? input.withdrawSourceIds : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean),
    ),
  ];
  const withdrawSet = new Set(withdrawnSourceIds);

  /** @type {Map<string, any[]>} */
  const offersBy = new Map();
  /** @type {Map<string, any>} */
  const metaBy = new Map();
  /** @type {string[]} */
  const retainedSourceIds = [];
  /** @type {string[]} */
  const overlaySourceIds = [];

  // 1) previous catalog
  if (previous && Array.isArray(previous.offers) && previous.offers.length > 0) {
    for (const offer of previous.offers) {
      const sid = offer?.sourceId;
      if (!sid || withdrawSet.has(sid)) continue;
      if (!offersBy.has(sid)) offersBy.set(sid, []);
      offersBy.get(sid).push(offer);
    }
    if (Array.isArray(previous.sources)) {
      for (const src of previous.sources) {
        if (src?.id && !withdrawSet.has(src.id)) metaBy.set(src.id, src);
      }
    }
  }

  // 2) fill gaps from raw last-good
  for (const [sid, entry] of rawLastGood.entries()) {
    if (withdrawSet.has(sid)) continue;
    if (offersBy.has(sid) && (offersBy.get(sid) || []).length > 0) continue;
    offersBy.set(sid, entry.offers);
    if (entry.sourceMeta) metaBy.set(sid, entry.sourceMeta);
  }

  // 3) overlay this batch successes (non-empty only)
  for (const item of batchSuccess) {
    if (!item?.sourceId || withdrawSet.has(item.sourceId)) continue;
    if (!Array.isArray(item.offers) || item.offers.length === 0) continue;
    offersBy.set(item.sourceId, item.offers);
    if (item.sourceMeta) metaBy.set(item.sourceId, item.sourceMeta);
    overlaySourceIds.push(item.sourceId);
  }

  // 4) explicit withdraw (打样 / 封禁)
  for (const sid of withdrawSet) {
    offersBy.delete(sid);
    metaBy.delete(sid);
  }

  for (const sid of offersBy.keys()) {
    if (!overlaySourceIds.includes(sid)) retainedSourceIds.push(sid);
  }

  const offers = [];
  for (const list of offersBy.values()) {
    for (const offer of list) offers.push(reclassifyOffer(offer));
  }
  const sources = [...metaBy.entries()]
    .filter(([sid]) => offersBy.has(sid) && (offersBy.get(sid) || []).length > 0)
    .map(([, meta]) => meta);

  return { offers, sources, retainedSourceIds, overlaySourceIds, withdrawnSourceIds };
}

function safeHost(baseUrl) {
  try {
    return new URL(baseUrl).host;
  } catch {
    return String(baseUrl || "");
  }
}

/** Infer platform from raw source payload (shopApi / 16688 / kami…). */
function resolveRawPlatform(src, meta = {}) {
  const p = String(src?.platform || meta?.platform || "").toLowerCase();
  if (p) return p;
  const kind = String(src?.collectorKind || src?.kind || "").toLowerCase();
  if (kind === "shop16688") return "shop16688";
  if (kind === "kami") return "kami";
  if (kind === "dujiao") return "dujiao";
  if (kind === "getgptapi") return "getgpt";
  if (kind === "ikunloveapi") return "ikunlove";
  if (kind === "xiaoheiwan") return "xiaoheiwan";
  const id = String(src?.id || "").toLowerCase();
  if (id.startsWith("16688-") || id.startsWith("shop16688-")) return "shop16688";
  if (id.startsWith("yunmao-")) return "yunmao";
  if (id.startsWith("qxvx-")) return "qxvx";
  if (id.startsWith("liandong-")) return "liandong";
  if (id.startsWith("kami-")) return "kami";
  if (id.startsWith("dujiao-")) return "dujiao";
  const host = String(src?.baseUrl || meta?.baseUrl || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "");
  if (host.includes("16688.com.cn")) return "shop16688";
  if (host.includes("catfk.com")) return "yunmao";
  if (host.includes("qxvx.cn")) return "qxvx";
  if (/(ldxp|wzyp)\.cn/.test(host)) return "liandong";
  return kind === "shopapi" ? "liandong" : "public";
}
