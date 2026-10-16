/**
 * Shop homepage URL check + upsert helpers.
 * Detail-page: fetch title → classifyTitle → match platform/deliveryType（提交 API 使用）。
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyTitle, PRODUCT_SEED } from "./classify.mjs";
import { collectByKind } from "./dispatch.mjs";
import { collectShop16688 } from "./shop16688.mjs";
import { resolveWorkingBase, LIANDONG_BASE_FAILOVER } from "./shopApi.mjs";
import {
  appendShopProbeRun,
  insertShop,
  openShopsDb,
  scheduleShopCollectNow,
  updateShopProbeHealth,
  upsertShop,
} from "./shops-db.mjs";
import { kindToPlatform } from "./util.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const COLLECTORS_PATH = join(root, "config/collectors.json");

const TRACKING_PARAMS = new Set([
  "aff",
  "ref",
  "refer",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "spm",
  "from",
]);

/** Hosts that use ShopApi /shop/<token> even if not in collectors.json */
const SHOPAPI_EXTRA_HOSTS = new Set([
  "wzyp.cn",
  "www.wzyp.cn",
  "ldxp.cn",
  "www.ldxp.cn",
  "pay.ldxp.cn",
  "catfk.com",
  "www.catfk.com",
  "pay.qxvx.cn",
]);

/**
 * @param {string} rawUrl
 */
export function normalizeShopUrl(rawUrl) {
  let href = String(rawUrl || "").trim();
  if (!href) return null;
  if (!/^https?:\/\//i.test(href)) href = `https://${href}`;
  let u;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) {
      u.searchParams.delete(key);
    }
  }
  u.hash = "";
  // drop trailing slash except root
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "");
  }
  return u.href;
}

/**
 * @returns {Map<string, string>} host → kind
 */
export function loadHostKindMap() {
  /** @type {Map<string, string>} */
  const map = new Map();
  if (!existsSync(COLLECTORS_PATH)) return map;
  try {
    const doc = JSON.parse(readFileSync(COLLECTORS_PATH, "utf8"));
    for (const entry of doc.kinds || []) {
      const kind = String(entry.kind || "");
      for (const host of entry.hosts || []) {
        const h = String(host || "")
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//i, "")
          .replace(/\/$/, "");
        if (h) map.set(h, kind);
      }
    }
  } catch {
    /* ignore */
  }
  return map;
}

function stripWww(host) {
  return String(host || "")
    .toLowerCase()
    .replace(/^www\./, "");
}

/**
 * Detect platform/kind from URL without HTTP.
 * @param {string} url
 * @param {Map<string, string>} [hostKindMap]
 */
export function detectShopFromUrl(url, hostKindMap) {
  const normalized = normalizeShopUrl(url);
  if (!normalized) {
    return { ok: false, error: "invalid url", collectorKind: null };
  }
  const map = hostKindMap || loadHostKindMap();
  let u;
  try {
    u = new URL(normalized);
  } catch {
    return { ok: false, error: "invalid url", collectorKind: null };
  }
  const host = u.host.toLowerCase();
  const hostBare = stripWww(host);
  const shopMatch = u.pathname.match(/\/shop\/([^/?#]+)/i);
  const shopId = shopMatch ? decodeURIComponent(shopMatch[1]) : null;

  // 16688
  if (hostBare === "16688.com.cn" || host === "www.16688.com.cn") {
    if (!shopId) {
      return {
        ok: false,
        error: "16688 URL needs /shop/<shop_no>",
        collectorKind: "shop16688",
        platform: "shop16688",
        normalizedUrl: normalized,
      };
    }
    return {
      ok: true,
      collectorKind: "shop16688",
      platform: "shop16688",
      baseUrl: "https://www.16688.com.cn",
      shopUrl: `https://www.16688.com.cn/shop/${encodeURIComponent(shopId)}`,
      shopNo: shopId,
      id: `16688-${String(shopId).toLowerCase().replace(/[^\w.-]+/g, "-")}`,
      credentials: { shopNo: shopId },
      normalizedUrl: normalized,
    };
  }

  // ShopApi token shops
  const registeredKind = map.get(host) || map.get(hostBare) || map.get(`www.${hostBare}`);
  const isShopApiHost =
    registeredKind === "shopApi" ||
    SHOPAPI_EXTRA_HOSTS.has(host) ||
    SHOPAPI_EXTRA_HOSTS.has(hostBare) ||
    SHOPAPI_EXTRA_HOSTS.has(`www.${hostBare}`);

  if (isShopApiHost && shopId) {
    let platform = "liandong";
    if (/catfk/i.test(host)) platform = "yunmao";
    else if (/qxvx/i.test(host)) platform = "qxvx";
    const baseUrl = `${u.protocol}//${u.host}`;
    const safe = String(shopId)
      .toLowerCase()
      .replace(/[^\w.-]+/g, "_")
      .slice(0, 48);
    return {
      ok: true,
      collectorKind: "shopApi",
      platform,
      baseUrl,
      shopUrl: `${baseUrl}/shop/${encodeURIComponent(shopId)}`,
      shopToken: shopId,
      id: `${platform}-${safe}`,
      credentials: { token: shopId },
      normalizedUrl: normalized,
    };
  }

  // Whole-site kinds from collectors registry
  if (registeredKind && registeredKind !== "shopApi" && registeredKind !== "shop16688") {
    const baseUrl = `${u.protocol}//${u.host}`;
    const id = `${registeredKind}-${host.replace(/[^\w.-]+/g, "-")}`.toLowerCase();
    return {
      ok: true,
      collectorKind: registeredKind,
      platform: kindToPlatform(registeredKind),
      baseUrl,
      shopUrl: baseUrl,
      id,
      credentials: {},
      normalizedUrl: normalized,
    };
  }

  // /shop/token on unknown host → try as shopApi with that base
  if (shopId) {
    const baseUrl = `${u.protocol}//${u.host}`;
    const safe = String(shopId)
      .toLowerCase()
      .replace(/[^\w.-]+/g, "_")
      .slice(0, 48);
    return {
      ok: true,
      collectorKind: "shopApi",
      platform: "liandong",
      baseUrl,
      shopUrl: `${baseUrl}/shop/${encodeURIComponent(shopId)}`,
      shopToken: shopId,
      id: `liandong-${safe}`,
      credentials: { token: shopId },
      normalizedUrl: normalized,
      tentative: true,
    };
  }

  return {
    ok: false,
    error: "unsupported",
    collectorKind: null,
    platform: null,
    normalizedUrl: normalized,
    expectedHints: [
      "链动 / 云猫 / QXVX：粘贴带 /shop/令牌 的店铺首页",
      "16688：粘贴 /shop/店铺编号 首页",
      "异次元 / 独角 / 已登记独立站：粘贴站点首页",
      "其它站点：改选「其他」，选商品线与类型后贴详情链接",
    ],
  };
}

/**
 * Lightweight live probe after detect.
 * @param {ReturnType<typeof detectShopFromUrl>} detected
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
 */
export async function probeDetectedShop(detected, opts = {}) {
  if (!detected?.ok || !detected.collectorKind) {
    return {
      ok: false,
      error: detected?.error || "detect failed",
      collectorKind: detected?.collectorKind || null,
      platform: detected?.platform || null,
      expectedHints: detected?.expectedHints,
      detected,
    };
  }

  const timeoutMs = opts.timeoutMs ?? Number(process.env.SHOP_PROBE_TIMEOUT_MS || 12000);
  const fetchImpl = opts.fetchImpl;
  const kind = detected.collectorKind;

  try {
    if (kind === "shopApi") {
      const token = detected.shopToken;
      const bases = [detected.baseUrl, ...LIANDONG_BASE_FAILOVER].filter(
        (b, i, arr) => b && arr.indexOf(b) === i,
      );
      const resolved = await resolveWorkingBase(token, bases, { fetchImpl, timeoutMs });
      if (!resolved.ok) {
        return {
          ok: false,
          error: resolved.error || "Shop/info failed",
          collectorKind: kind,
          platform: detected.platform,
          credentials: detected.credentials,
          detected,
        };
      }
      const name = resolved.infoPayload?.data?.nickname || detected.id;
      // smoke: one-page collect optional — info success is enough
      return {
        ok: true,
        collectorKind: kind,
        platform: detected.platform,
        credentials: detected.credentials,
        name: String(name || detected.id),
        baseUrl: resolved.base || detected.baseUrl,
        shopUrl: detected.shopUrl,
        shopToken: token,
        id: detected.id,
        detected,
      };
    }

    if (kind === "shop16688") {
      const result = await collectShop16688(
        {
          id: detected.id,
          baseUrl: detected.baseUrl,
          shopNo: detected.shopNo,
          name: detected.id,
        },
        { fetchImpl, shopDelayMs: 0 },
      );
      if (!result.ok) {
        return {
          ok: false,
          error: result.error || "16688 probe failed",
          collectorKind: kind,
          platform: detected.platform,
          credentials: detected.credentials,
          detected,
        };
      }
      return {
        ok: true,
        collectorKind: kind,
        platform: detected.platform,
        credentials: detected.credentials,
        name: result.meta?.shopName || detected.id,
        baseUrl: detected.baseUrl,
        shopUrl: detected.shopUrl,
        shopNo: detected.shopNo,
        id: detected.id,
        offerCount: result.offers?.length || 0,
        detected,
      };
    }

    // Whole-site: run collector with tight page limit
    const result = await collectByKind(
      {
        id: detected.id,
        kind,
        collectorKind: kind,
        baseUrl: detected.baseUrl,
        name: detected.id,
        platform: detected.platform,
        sourceUrl: detected.shopUrl,
      },
      { fetchImpl, maxPages: 1, pageDelayMs: 0 },
    );
    if (!result.ok) {
      return {
        ok: false,
        error: result.error || "probe collect failed",
        collectorKind: kind,
        platform: detected.platform,
        credentials: detected.credentials,
        detected,
      };
    }
    const hasSignal = (result.offers?.length || 0) > 0 || result.ok;
    return {
      ok: hasSignal,
      error: hasSignal ? null : "empty catalog",
      collectorKind: kind,
      platform: detected.platform,
      credentials: detected.credentials,
      name: detected.id,
      baseUrl: detected.baseUrl,
      shopUrl: detected.shopUrl,
      id: detected.id,
      offerCount: result.offers?.length || 0,
      detected,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      collectorKind: kind,
      platform: detected.platform,
      credentials: detected.credentials,
      detected,
    };
  }
}

/**
 * Full homepage probe: normalize → detect → live check.
 * @param {string} url
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
 */
export async function probeShopUrl(url, opts = {}) {
  const detected = detectShopFromUrl(url);
  if (!detected.ok) {
    return {
      ok: false,
      error: detected.error || "unsupported",
      collectorKind: detected.collectorKind,
      platform: detected.platform,
      expectedHints: detected.expectedHints,
      normalizedUrl: detected.normalizedUrl,
      detected,
    };
  }
  const probed = await probeDetectedShop(detected, opts);
  return {
    ...probed,
    normalizedUrl: detected.normalizedUrl,
  };
}

/**
 * Insert/update shop from successful probe. Never overwrites listed_at.
 * @param {object} probeResult
 * @param {{ db?: import('better-sqlite3').Database, submittedBy?: string, inputUrl?: string }} [opts]
 */
export function upsertShopFromProbe(probeResult, opts = {}) {
  const db = opts.db || openShopsDb();
  const inputUrl = opts.inputUrl || probeResult.normalizedUrl || "";
  const now = new Date().toISOString();

  if (!probeResult?.ok || !probeResult.id) {
    appendShopProbeRun(db, {
      shopId: probeResult?.id || null,
      inputUrl,
      ok: false,
      detectedKind: probeResult?.collectorKind || null,
      error: probeResult?.error || "probe failed",
    });
    return { action: "rejected", error: probeResult?.error || "probe failed" };
  }

  const shop = {
    id: probeResult.id,
    name: probeResult.name || probeResult.id,
    platform: probeResult.platform || kindToPlatform(probeResult.collectorKind),
    collectorKind: probeResult.collectorKind,
    baseUrl: probeResult.baseUrl,
    shopUrl: probeResult.shopUrl,
    shopToken: probeResult.shopToken || probeResult.credentials?.token || null,
    shopNo: probeResult.shopNo || probeResult.credentials?.shopNo || null,
    enabled: true,
    status: "active",
    submittedBy: opts.submittedBy || "user",
    source: (opts.submittedBy || "user") === "user" ? "user" : "self",
    listedAt: now,
    lastProbeAt: now,
    lastProbeOk: true,
    lastError: null,
  };

  const existing = insertShop(db, shop);
  // insertShop skips if exists — still refresh health via upsertShop
  if (existing.action === "skipped" || existing.action === "updated") {
    upsertShop(db, {
      id: shop.id,
      name: shop.name,
      baseUrl: shop.baseUrl,
      shopUrl: shop.shopUrl,
      shopToken: shop.shopToken,
      shopNo: shop.shopNo,
      lastProbeAt: now,
      lastProbeOk: true,
      lastError: null,
      status: "active",
      enabled: true,
    });
  }
  // 新店：立刻排进采集队列（去掉入库时的随机 stagger）
  if (existing.action === "inserted") {
    scheduleShopCollectNow(db, shop.id, { nowIso: now });
  }
  updateShopProbeHealth(db, shop.id, { ok: true, at: now });
  appendShopProbeRun(db, {
    shopId: shop.id,
    inputUrl,
    ok: true,
    detectedKind: shop.collectorKind,
    error: null,
  });

  return {
    action: existing.action, // inserted | skipped | updated
    id: shop.id,
    listedAt: existing.listedAt,
  };
}

/**
 * 拉取详情页可见标题（HTML title / og:title / 常见 JSON 字段）。
 * @param {string} detailUrl
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
 * @returns {Promise<{ ok: boolean, title?: string, error?: string, code?: string }>}
 */
export async function fetchDetailPageTitle(detailUrl, opts = {}) {
  const normalized = normalizeShopUrl(detailUrl);
  if (!normalized) {
    return { ok: false, code: "invalid_url", error: "链接格式不对" };
  }

  // 明显是店铺首页 → 应走「店铺首页」方式
  try {
    const u = new URL(normalized);
    if (/\/shop\/[^/]+\/?$/i.test(u.pathname)) {
      return {
        ok: false,
        code: "looks_like_shop_home",
        error: "这更像店铺首页，请改选「店铺首页」再提交",
      };
    }
  } catch {
    /* ignore */
  }

  const timeoutMs = opts.timeoutMs ?? Number(process.env.SHOP_PROBE_TIMEOUT_MS || 12000);
  const fetchImpl = opts.fetchImpl || fetch;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchImpl(normalized, {
      method: "GET",
      redirect: "follow",
      signal: ac.signal,
      headers: {
        accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      },
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        code: "page_http_error",
        error: res.status === 404 ? "页面不存在或已下架" : `页面打不开（${res.status}）`,
      };
    }
    const title = extractTitleFromPageBody(text);
    if (!title) {
      return {
        ok: false,
        code: "title_not_found",
        error: "读不到商品标题，请确认是商品详情页且可公开访问",
      };
    }
    return { ok: true, title };
  } catch (err) {
    const aborted = err?.name === "AbortError";
    return {
      ok: false,
      code: aborted ? "page_timeout" : "page_unreachable",
      error: aborted ? "打开页面超时，请稍后重试" : "打不开这个链接，请检查是否可公开访问",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} html
 */
function extractTitleFromPageBody(html) {
  const raw = String(html || "");
  if (!raw) return null;

  // JSON API body
  try {
    const j = JSON.parse(raw);
    const candidates = [
      j?.data?.name,
      j?.data?.title,
      j?.data?.goods_name,
      j?.name,
      j?.title,
    ];
    for (const c of candidates) {
      const t = cleanPageTitle(c);
      if (t) return t;
    }
  } catch {
    /* not json */
  }

  const og =
    raw.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1] ||
    raw.match(/content=["']([^"']+)["']\s+property=["']og:title["']/i)?.[1];
  const fromOg = cleanPageTitle(og);
  if (fromOg) return fromOg;

  const docTitle = raw.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  const fromDoc = cleanPageTitle(docTitle);
  if (fromDoc) return fromDoc;

  // Embedded JSON snippets
  const nameHit =
    raw.match(/"goods_name"\s*:\s*"((?:\\.|[^"\\]){2,200})"/i)?.[1] ||
    raw.match(/"sourceTitle"\s*:\s*"((?:\\.|[^"\\]){2,200})"/i)?.[1] ||
    raw.match(/"product_name"\s*:\s*"((?:\\.|[^"\\]){2,200})"/i)?.[1] ||
    raw.match(/"title"\s*:\s*"((?:\\.|[^"\\]){4,200})"/i)?.[1];
  if (nameHit) {
    try {
      return cleanPageTitle(JSON.parse(`"${nameHit}"`));
    } catch {
      return cleanPageTitle(nameHit);
    }
  }
  return null;
}

function cleanPageTitle(value) {
  let t = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
  if (!t) return null;
  // drop common site suffixes
  t = t
    .replace(/\s*[-_|｜]\s*(闲鱼|淘宝|天猫|京东|拼多多|1688|联动小铺|云猫|发卡).*$/i, "")
    .replace(/\s*[-_|｜]\s*.{0,12}(商城|店铺|发卡网|自动发货)\s*$/i, "")
    .trim();
  if (t.length < 2) return null;
  // generic shell titles
  if (/^(首页|home|index|login|登录|商品详情|详情)$/i.test(t)) return null;
  return t.slice(0, 200);
}

/**
 * 用 classify 规则核对：标题归类后的 platform + deliveryType 是否匹配用户选择。
 *
 * @param {{ title: string, platform: string, deliveryType: string }} input
 */
export function verifyDetailOfferAgainstType(input) {
  const title = String(input?.title || "").trim();
  const platform = String(input?.platform || "").trim();
  const deliveryType = String(input?.deliveryType || "").trim();

  if (!title) {
    return {
      ok: false,
      code: "missing_title",
      productSlug: null,
      fieldHint: "还没读到商品标题",
      detail: "请确认链接指向具体商品详情页",
    };
  }

  const { productSlug } = classifyTitle(title);
  const resolved = productSlug ? LEGACY_OR_SEED(productSlug) : null;

  if (!productSlug || !resolved) {
    return {
      ok: false,
      code: "classify_none",
      productSlug: null,
      title,
      fieldHint: "标题对不上已知商品",
      detail: "可能缺关键词（如 Plus、成品号、质保），或链接不是商品页",
    };
  }

  if (platform && resolved.platform !== platform) {
    return {
      ok: false,
      code: "platform_mismatch",
      productSlug,
      productName: resolved.name,
      title,
      fieldHint: `标题更像「${platformLabel(resolved.platform)}」`,
      detail: `你选的是「${platformLabel(platform)}」，请改商品线或换一条对应链接`,
    };
  }

  if (deliveryType && resolved.deliveryType !== deliveryType) {
    return {
      ok: false,
      code: "type_mismatch",
      productSlug,
      productName: resolved.name,
      title,
      fieldHint: `标题更像「${resolved.deliveryType}」`,
      detail: `你选的是「${deliveryType}」，请改类型或换一条更贴切的详情链接`,
    };
  }

  return {
    ok: true,
    code: "matched",
    productSlug,
    productName: resolved.name,
    deliveryType: resolved.deliveryType,
    platform: resolved.platform,
    title,
  };
}

function LEGACY_OR_SEED(slug) {
  const mapped = String(slug || "");
  return PRODUCT_SEED.find((p) => p.slug === mapped) || null;
}

function platformLabel(id) {
  const map = {
    chatgpt: "ChatGPT",
    claude: "Claude",
    cursor: "Cursor",
    kiro: "Kiro",
    grok: "Grok",
    gemini: "Gemini",
    email: "邮箱",
    sms: "接码",
    other: "其他",
  };
  return map[id] || id;
}

/**
 * 首页检测失败 → 用户可读文案（避免「探针」等词）。
 * @param {object} probe
 */
export function friendlyHomepageFailure(probe) {
  const err = String(probe?.error || "");
  const hints = Array.isArray(probe?.expectedHints) ? probe.expectedHints : [];

  if (err === "invalid url" || /invalid url/i.test(err)) {
    return {
      code: "invalid_url",
      title: "链接无效",
      detail: "请粘贴完整的 https 店铺首页地址",
      fieldHint: "链接格式不对",
    };
  }
  if (/needs \/shop\//i.test(err) || /16688 URL needs/i.test(err)) {
    return {
      code: "need_shop_path",
      title: "需要店铺首页",
      detail: "16688 请用 /shop/店铺编号 这种首页链接",
      fieldHint: "缺少 /shop/… 路径",
    };
  }
  if (err === "unsupported" || /unsupported/i.test(err)) {
    return {
      code: "unsupported_shop",
      title: "暂不支持这种首页",
      detail: hints[0] || "可改用「其他」：选好商品线与类型后贴商品详情链接",
      fieldHint: "不像已支持的店铺首页",
    };
  }
  if (/403|forbidden|waf/i.test(err)) {
    return {
      code: "blocked",
      title: "暂时读不到店铺",
      detail: "对方可能限流了，请稍后再试或换一条可公开打开的首页",
      fieldHint: "店铺暂时无法访问",
    };
  }
  if (/timeout|abort/i.test(err)) {
    return {
      code: "timeout",
      title: "超时了",
      detail: "网络较慢或店铺无响应，请稍后重试",
      fieldHint: "打开超时",
    };
  }
  return {
    code: "check_failed",
    title: "未能收录",
    detail: hints[0] || "请确认链接可公开打开，且是店铺首页",
    fieldHint: "未通过检查",
  };
}

