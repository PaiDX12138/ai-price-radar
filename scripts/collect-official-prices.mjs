#!/usr/bin/env node
/**
 * Collect / refresh official regional prices.
 * Channels:
 *   ios_store   — App Store public page
 *   web_direct  — chatgpt.com pricing config / Claude FX 本地币
 *
 *   pnpm collect:official -- --mode=fx_only
 *   pnpm collect:official -- --mode=full
 *   pnpm collect:official -- --mode=full --channels=ios   # ios | web
 *   pnpm collect:official -- --mode=full --write-seed
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvLocal } from "./load-env-local.mjs";
import {
  fetchAppStoreOffers,
  mapWithConcurrency,
} from "../collectors/official-appstore.mjs";
import {
  CHATGPT_WEB_PLAN_MAP,
  extractChatgptWebOffer,
  fetchChatgptWebPricing,
  formatChatgptWebPrice,
} from "../collectors/official-chatgpt-web.mjs";
import {
  CLAUDE_WEB_SOURCE_URL,
  claudeUsdToLocal,
  formatClaudeWebPrice,
  isClaudeWebCountry,
} from "../collectors/official-claude-web.mjs";
import {
  CURSOR_WEB_SOURCE_URL,
  GROK_WEB_SOURCE_URL,
  X_PREMIUM_WEB_SOURCE_URL,
  formatCursorWebPrice,
} from "../collectors/official-cursor-web.mjs";
import {
  KIRO_WEB_SOURCE_URL,
  formatKiroWebPrice,
  isKiroWebCountry,
  kiroUsdToLocal,
} from "../collectors/official-kiro-web.mjs";
import { usdListToLocal } from "../collectors/official-usd-fx-web.mjs";
import {
  closeOfficialDb,
  convertToCny,
  getFx,
  insertCollectRun,
  listEnabledApps,
  listEnabledRegions,
  listPlansForApp,
  markScheduleDone,
  migrateOfficialPrices,
  openOfficialDb,
  rateToCny,
  refreshAllCny,
  resolveOfficialDbPath,
  upsertFx,
  upsertPrice,
  writeOfficialPricesSnapshot,
} from "../collectors/official-prices-db.mjs";

loadEnvLocal();

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEED_PATH = join(root, "config", "official-prices", "seed-prices.chatgpt.json");
const FETCH_CONCURRENCY = 3;
const IOS_GAP_MS = 250;
const IOS_BLOCKED_LIMIT = 5;
/** chatgpt.com：低并发 + 间隔，连续 403/429 立即停手（不绕过） */
const WEB_CONCURRENCY = 3;
const WEB_GAP_MS = 250;
const WEB_BLOCKED_LIMIT = 3;
const FX_TIMEOUT_MS = 20_000;

function parseArgs(argv) {
  const out = {
    mode: "fx_only",
    db: null,
    writeSeed: false,
    help: false,
    channels: new Set(["ios", "web"]),
  };
  const setChannels = (raw) => {
    const picked = String(raw || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s === "ios" || s === "web");
    if (picked.length) out.channels = new Set(picked);
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--write-seed") out.writeSeed = true;
    else if (arg === "--mode") out.mode = argv[++i] || "fx_only";
    else if (arg?.startsWith("--mode=")) out.mode = arg.slice(7);
    else if (arg === "--fx-only") out.mode = "fx_only";
    else if (arg === "--all" || arg === "--full") out.mode = "full";
    else if (arg === "--db") out.db = argv[++i] || null;
    else if (arg?.startsWith("--db=")) out.db = arg.slice(5);
    else if (arg === "--channels") setChannels(argv[++i]);
    else if (arg?.startsWith("--channels=")) setChannels(arg.slice(11));
  }
  if (out.mode !== "fx_only" && out.mode !== "full") out.mode = "fx_only";
  return out;
}

/**
 * USD-based rates for every currency (open.er-api, Frankfurter as fallback),
 * merged over previously stored rates so a partial source never drops currencies.
 * @param {Record<string, number>} existing
 */
async function fetchFxRates(existing = {}) {
  const sources = [
    {
      name: "open.er-api",
      url: "https://open.er-api.com/v6/latest/USD",
      read: (json) =>
        json?.result === "success"
          ? {
              rates: json.rates,
              date: new Date((json.time_last_update_unix || Date.now() / 1000) * 1000)
                .toISOString()
                .slice(0, 10),
            }
          : null,
    },
    {
      name: "frankfurter",
      url: "https://api.frankfurter.dev/v1/latest?base=USD",
      read: (json) => (json?.rates ? { rates: json.rates, date: String(json.date) } : null),
    },
  ];
  for (const source of sources) {
    try {
      const res = await fetch(source.url, { signal: AbortSignal.timeout(FX_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = source.read(await res.json());
      if (!parsed?.rates?.CNY) throw new Error("missing CNY");
      return {
        rates: { ...existing, ...parsed.rates, USD: 1 },
        date: parsed.date,
        source: source.name,
        sourceUrl: source.url,
      };
    } catch (err) {
      console.warn(`[collect:official] FX ${source.name} failed:`, err?.message || err);
    }
  }
  return null;
}

async function refreshFx(db) {
  const existing = getFx(db);
  const fx = await fetchFxRates(existing?.rates || {});
  if (fx) {
    upsertFx(db, fx);
    return fx;
  }
  if (existing) {
    console.warn("[collect:official] using stored FX rates");
    return existing;
  }
  return null;
}

async function runFxOnly(db) {
  const startedAt = new Date().toISOString();
  const fx = await refreshFx(db);
  if (!fx) {
    insertCollectRun(db, {
      mode: "fx_only",
      status: "failed",
      message: "no FX source",
      startedAt,
      finishedAt: new Date().toISOString(),
    });
    return { ok: false };
  }
  const n = refreshAllCny(db, fx.rates, fx.date);
  markScheduleDone(db, "fx_only");
  insertCollectRun(db, {
    mode: "fx_only",
    status: "success",
    successCount: n,
    message: `refreshed ${n} rows fx=${fx.date} (${fx.source})`,
    startedAt,
    finishedAt: new Date().toISOString(),
  });
  writeOfficialPricesSnapshot(db);
  console.log(`[collect:official] fx_only ok rows=${n} date=${fx.date} source=${fx.source}`);
  return { ok: true };
}

function compilePattern(raw) {
  try {
    return raw ? new RegExp(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Match App Store addOn by offerName, else by display name.
 * When multiple name hits (e.g. two "X Premium"), pick closest to us_list_usd.
 * Reject single hits that clearly belong to the other billing period (月/年同名).
 * @param {Array<{ name: string, offerName: string, priceValue: number, priceText: string }>} items
 * @param {{ pattern: RegExp, us_list_usd?: number | null, billing_period?: string }} plan
 */
function pickAppStoreItem(items, plan) {
  const byOffer = items.filter((it) => plan.pattern.test(it.offerName));
  const pickedOffer = pickFromCandidates(byOffer, plan);
  if (pickedOffer) return pickedOffer;

  const byName = items.filter((it) => plan.pattern.test(it.name));
  return pickFromCandidates(byName, plan);
}

/**
 * @param {Array<{ priceValue: number }>} candidates
 * @param {{ us_list_usd?: number | null, billing_period?: string }} plan
 */
function pickFromCandidates(candidates, plan) {
  if (!candidates.length) return null;
  if (candidates.length > 1) return closestByUsList(candidates, plan);
  const only = candidates[0];
  return fitsBillingPeriod(only.priceValue, plan) ? only : null;
}

/**
 * @param {Array<{ priceValue: number }>} items
 * @param {{ us_list_usd?: number | null, billing_period?: string }} plan
 */
function closestByUsList(items, plan) {
  const target = Number(plan.us_list_usd);
  if (!Number.isFinite(target) || target <= 0) return items[0];
  const ranked = [...items].sort(
    (a, b) => Math.abs(a.priceValue - target) - Math.abs(b.priceValue - target),
  );
  return ranked.find((it) => fitsBillingPeriod(it.priceValue, plan)) ?? null;
}

/**
 * @param {number} priceValue
 * @param {{ us_list_usd?: number | null, billing_period?: string }} plan
 */
function fitsBillingPeriod(priceValue, plan) {
  const target = Number(plan.us_list_usd);
  if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(priceValue)) return true;
  const period = String(plan.billing_period || "");
  // 年付标价通常 ≫ 月付；单名命中时避免把 $30 月付当成 $300 年付
  if (period === "annual" && priceValue < target * 0.45) return false;
  if (period === "monthly" && priceValue > target * 4) return false;
  // 无 billing_period 时：偏离目标超过 55% 则视为不匹配（多候选排序后过滤）
  if (!period && Math.abs(priceValue - target) / target > 0.55) return false;
  return true;
}

/**
 * iOS App Store pass (one request per storefront).
 * @param {import('better-sqlite3').Database} db
 * @param {{ rates: Record<string, number>, date: string }} fx
 * @param {string} now
 */
async function collectIos(db, fx, now) {
  const regions = listEnabledRegions(db).filter((r) => r.storefront_id);
  const deleteRow = db.prepare(
    `DELETE FROM official_prices WHERE plan_id = ? AND region_id = ? AND channel = 'ios_store'`,
  );
  const markStale = db.prepare(
    `UPDATE official_prices SET status = 'stale', updated_at = ?
     WHERE plan_id = ? AND region_id = ? AND channel = 'ios_store' AND status = 'available'`,
  );

  let matched = 0;
  let failedRegions = 0;
  let unavailableRegions = 0;
  let aborted = false;
  /** @type {Set<string>} */
  const unmatchedOffers = new Set();

  for (const app of listEnabledApps(db)) {
    const plans = listPlansForApp(db, app.id)
      .map((p) => ({ ...p, pattern: compilePattern(p.offer_pattern) }))
      .filter((p) => p.pattern);
    let blockedStreak = 0;

    await mapWithConcurrency(
      regions,
      FETCH_CONCURRENCY,
      async (region) => {
        if (aborted) {
          failedRegions += 1;
          for (const plan of plans) markStale.run(now, plan.id, region.id);
          return;
        }
        const page = await fetchAppStoreOffers({
          appStoreId: app.app_store_id,
          appStoreSlug: app.app_store_slug,
          storefrontId: region.storefront_id,
        });

        if (page.unavailable) {
          unavailableRegions += 1;
          blockedStreak = 0;
          for (const plan of plans) deleteRow.run(plan.id, region.id);
          return;
        }
        if (!page.ok || page.storefront?.cc !== region.country_code) {
          failedRegions += 1;
          const is403 = /HTTP 403/.test(String(page.error || ""));
          if (is403) {
            blockedStreak += 1;
            if (blockedStreak >= IOS_BLOCKED_LIMIT) {
              aborted = true;
              console.warn(
                `[collect:official] ios ${page.error}: rate limited ${blockedStreak}x, stop (no bypass)`,
              );
            }
          } else {
            blockedStreak = 0;
          }
          for (const plan of plans) markStale.run(now, plan.id, region.id);
          console.warn(
            `[collect:official] ${app.slug}/${region.country_code} failed: ${
              page.ok ? `storefront mismatch ${page.storefront?.cc}` : page.error
            }`,
          );
          return;
        }
        blockedStreak = 0;

        const items = page.items || [];
        const sourceUrl = `https://apps.apple.com/${region.country_code.toLowerCase()}/app/${app.app_store_slug}/id${app.app_store_id}`;
        const fxRate = rateToCny(region.currency_code, fx.rates);
        for (const plan of plans) {
          const item = pickAppStoreItem(items, plan);
          const cny = item ? convertToCny(item.priceValue, region.currency_code, fx.rates) : null;
          if (!item || cny == null || fxRate == null) {
            // Not sold in this storefront (or no FX) → drop instead of keeping a guessed price
            deleteRow.run(plan.id, region.id);
            continue;
          }
          upsertPrice(db, {
            planId: plan.id,
            regionId: region.id,
            channel: "ios_store",
            priceText: item.priceText,
            priceValue: item.priceValue,
            currencyCode: region.currency_code,
            cnyPrice: cny,
            fxRateToCny: fxRate,
            fxDate: fx.date,
            sourceUrl,
            status: "available",
            lastSuccessAt: now,
            updatedAt: now,
          });
          matched += 1;
        }
        for (const it of items) {
          // 额度包等非订阅 SKU 不告警
          // 额度包 / 纯存储 SKU 不告警
          if (/usage_credits|credit|\d+\s*GB/i.test(it.offerName || it.name)) continue;
          if (!plans.some((p) => p.pattern.test(it.offerName) || p.pattern.test(it.name))) {
            unmatchedOffers.add(`${app.slug}:${it.offerName || it.name}`);
          }
        }
      },
      IOS_GAP_MS,
    );
  }

  if (unmatchedOffers.size) {
    console.log(
      `[collect:official] unmatched offers: ${[...unmatchedOffers].sort().join(", ")}`,
    );
  }
  return {
    matched,
    regions: regions.length,
    failed: failedRegions,
    unavailable: unavailableRegions,
    aborted,
  };
}

/**
 * chatgpt.com web pass (anonymous pricing config, one request per country).
 * 价格口径：官网标价原样（currency_config.amount + taxMode）；失败只标 stale，不清空旧价。
 * @param {import('better-sqlite3').Database} db
 * @param {{ rates: Record<string, number>, date: string }} fx
 * @param {string} now
 */
async function collectWeb(db, fx, now) {
  const regions = listEnabledRegions(db);
  const deleteRow = db.prepare(
    `DELETE FROM official_prices WHERE plan_id = ? AND region_id = ? AND channel = 'web_direct'`,
  );
  const markStale = db.prepare(
    `UPDATE official_prices SET status = 'stale', updated_at = ?
     WHERE plan_id = ? AND region_id = ? AND channel = 'web_direct' AND status = 'available'`,
  );

  let matched = 0;
  let failedRegions = 0;
  let unavailableRegions = 0;
  let blockedStreak = 0;
  let aborted = false;

  // Claude / Cursor / Grok / X / Kiro / Gemini：无公开国别 API → USD 标价 × FX 本地币
  matched += collectClaudeWebFx(db, fx, now);
  matched += collectUsdListAppWebFx(db, fx, now, {
    appSlug: "cursor",
    sourceUrl: CURSOR_WEB_SOURCE_URL,
  });
  matched += collectUsdListAppWebFx(db, fx, now, {
    appSlug: "grok",
    sourceUrl: GROK_WEB_SOURCE_URL,
  });
  matched += collectUsdListAppWebFx(db, fx, now, {
    appSlug: "x",
    sourceUrl: X_PREMIUM_WEB_SOURCE_URL,
  });
  matched += collectKiroWebFx(db, fx, now);
  matched += collectUsdListAppWebFx(db, fx, now, {
    appSlug: "gemini",
    sourceUrl: "https://one.google.com/about/google-ai-plans/",
  });

  for (const app of listEnabledApps(db)) {
    if (app.slug !== "chatgpt") continue;
    const plans = listPlansForApp(db, app.id).filter((p) => CHATGPT_WEB_PLAN_MAP[p.slug]);

    await mapWithConcurrency(
      regions,
      WEB_CONCURRENCY,
      async (region) => {
        const stale = () => {
          for (const plan of plans) markStale.run(now, plan.id, region.id);
        };
        if (aborted) {
          failedRegions += 1;
          stale();
          return;
        }

        const page = await fetchChatgptWebPricing(region.country_code);
        if (page.blocked) {
          blockedStreak += 1;
          if (blockedStreak >= WEB_BLOCKED_LIMIT) {
            aborted = true;
            console.warn(
              `[collect:official] web ${page.status}: rate limited ${blockedStreak}x in a row, stop (no bypass)`,
            );
          }
          failedRegions += 1;
          stale();
          return;
        }
        blockedStreak = 0;

        if (page.unavailable) {
          // ChatGPT 不在该国开放 → 没有官网价，删掉旧的官网行（iOS 行不动）
          unavailableRegions += 1;
          for (const plan of plans) deleteRow.run(plan.id, region.id);
          return;
        }
        if (!page.ok) {
          failedRegions += 1;
          stale();
          console.warn(`[collect:official] web/${region.country_code} failed: ${page.error}`);
          return;
        }

        for (const plan of plans) {
          const offer = extractChatgptWebOffer(page.config, plan.slug);
          // 官网标价原样：currency_config 的 amount（用户开通页看到的数）。
          // inclusive = 标价已含税（如 NZ NZ$40）；exclusive = 标价未含税（结账再加税）。
          // 不拆税、不加税；税口径留给 taxMode 标签。
          const displayValue = offer?.listValue ?? null;
          const cny =
            displayValue != null
              ? convertToCny(displayValue, offer.currencyCode, fx.rates)
              : null;
          const fxRate = offer ? rateToCny(offer.currencyCode, fx.rates) : null;
          if (!offer || displayValue == null || cny == null || fxRate == null) {
            deleteRow.run(plan.id, region.id);
            continue;
          }
          upsertPrice(db, {
            planId: plan.id,
            regionId: region.id,
            channel: "web_direct",
            priceText: formatChatgptWebPrice(
              displayValue,
              offer.currencyCode,
              offer.exponent,
            ),
            priceValue: displayValue,
            listPriceValue: displayValue,
            taxMode: offer.taxMode,
            taxPercent: offer.taxPercent,
            currencyCode: offer.currencyCode,
            cnyPrice: cny,
            fxRateToCny: fxRate,
            fxDate: fx.date,
            sourceUrl: page.url,
            status: "available",
            lastSuccessAt: now,
            updatedAt: now,
          });
          matched += 1;
        }
      },
      WEB_GAP_MS,
    );
  }

  return {
    matched,
    regions: regions.length,
    failed: failedRegions,
    unavailable: unavailableRegions,
    aborted,
  };
}

/**
 * Claude 官网：支持国 × USD 标价 FX 本地币（未含结账税）。
 * @returns {number} matched rows
 */
function collectClaudeWebFx(db, fx, now) {
  const app = db.prepare(`SELECT * FROM official_apps WHERE slug = 'claude' AND enabled = 1`).get();
  if (!app) return 0;
  const plans = listPlansForApp(db, app.id).filter(
    (p) => p.us_list_usd != null && Number(p.us_list_usd) > 0,
  );
  if (!plans.length) return 0;

  const regions = listEnabledRegions(db);
  const deleteRow = db.prepare(
    `DELETE FROM official_prices WHERE plan_id = ? AND region_id = ? AND channel = 'web_direct'`,
  );

  let matched = 0;
  const tx = db.transaction(() => {
    for (const region of regions) {
      const supported = isClaudeWebCountry(region.country_code);
      for (const plan of plans) {
        if (!supported) {
          deleteRow.run(plan.id, region.id);
          continue;
        }
        const local = claudeUsdToLocal(plan.us_list_usd, region.currency_code, fx.rates);
        const fxRate = rateToCny(region.currency_code, fx.rates);
        const cny =
          local != null && fxRate != null
            ? convertToCny(local, region.currency_code, fx.rates)
            : null;
        if (local == null || cny == null || fxRate == null) {
          deleteRow.run(plan.id, region.id);
          continue;
        }
        upsertPrice(db, {
          planId: plan.id,
          regionId: region.id,
          channel: "web_direct",
          priceText: formatClaudeWebPrice(local, region.currency_code),
          priceValue: local,
          listPriceValue: plan.us_list_usd,
          taxMode: "exclusive",
          taxPercent: null,
          currencyCode: region.currency_code,
          cnyPrice: cny,
          fxRateToCny: fxRate,
          fxDate: fx.date,
          sourceUrl: CLAUDE_WEB_SOURCE_URL,
          status: "available",
          lastSuccessAt: now,
          updatedAt: now,
        });
        matched += 1;
      }
    }
  });
  tx();
  console.log(`[collect:official] claude web fx matched=${matched}`);
  return matched;
}

/**
 * Kiro 官网：定价页支持国 × USD 月付标价 FX（无年付、无 App Store）。
 * @returns {number} matched rows
 */
function collectKiroWebFx(db, fx, now) {
  const app = db.prepare(`SELECT * FROM official_apps WHERE slug = 'kiro' AND enabled = 1`).get();
  if (!app) return 0;
  const plans = listPlansForApp(db, app.id).filter(
    (p) => p.us_list_usd != null && Number(p.us_list_usd) > 0,
  );
  if (!plans.length) return 0;

  const regions = listEnabledRegions(db);
  const deleteRow = db.prepare(
    `DELETE FROM official_prices WHERE plan_id = ? AND region_id = ? AND channel = 'web_direct'`,
  );

  let matched = 0;
  const tx = db.transaction(() => {
    for (const region of regions) {
      const supported = isKiroWebCountry(region.country_code);
      for (const plan of plans) {
        if (!supported) {
          deleteRow.run(plan.id, region.id);
          continue;
        }
        const local = kiroUsdToLocal(plan.us_list_usd, region.currency_code, fx.rates);
        const fxRate = rateToCny(region.currency_code, fx.rates);
        const cny =
          local != null && fxRate != null
            ? convertToCny(local, region.currency_code, fx.rates)
            : null;
        if (local == null || cny == null || fxRate == null) {
          deleteRow.run(plan.id, region.id);
          continue;
        }
        upsertPrice(db, {
          planId: plan.id,
          regionId: region.id,
          channel: "web_direct",
          priceText: formatKiroWebPrice(local, region.currency_code),
          priceValue: local,
          listPriceValue: plan.us_list_usd,
          taxMode: "exclusive",
          taxPercent: null,
          currencyCode: region.currency_code,
          cnyPrice: cny,
          fxRateToCny: fxRate,
          fxDate: fx.date,
          sourceUrl: KIRO_WEB_SOURCE_URL,
          status: "available",
          lastSuccessAt: now,
          updatedAt: now,
        });
        matched += 1;
      }
    }
  });
  tx();
  console.log(`[collect:official] kiro web fx matched=${matched}`);
  return matched;
}

/**
 * 官网 USD 标价 × FX 全地区（税前）。地区码为公开参数（regions.json）。
 * @param {{ appSlug: string, sourceUrl: string }} opts
 * @returns {number} matched rows
 */
function collectUsdListAppWebFx(db, fx, now, opts) {
  const app = db
    .prepare(`SELECT * FROM official_apps WHERE slug = ? AND enabled = 1`)
    .get(opts.appSlug);
  if (!app) return 0;
  const plans = listPlansForApp(db, app.id).filter((p) => {
    if (p.us_list_usd == null || Number(p.us_list_usd) <= 0) return false;
    return !String(p.family || "").includes("legacy");
  });
  if (!plans.length) return 0;

  const regions = listEnabledRegions(db);
  const deleteRow = db.prepare(
    `DELETE FROM official_prices WHERE plan_id = ? AND region_id = ? AND channel = 'web_direct'`,
  );

  let matched = 0;
  const tx = db.transaction(() => {
    for (const region of regions) {
      for (const plan of plans) {
        const local = usdListToLocal(plan.us_list_usd, region.currency_code, fx.rates);
        const fxRate = rateToCny(region.currency_code, fx.rates);
        const cny =
          local != null && fxRate != null
            ? convertToCny(local, region.currency_code, fx.rates)
            : null;
        if (local == null || cny == null || fxRate == null) {
          deleteRow.run(plan.id, region.id);
          continue;
        }
        upsertPrice(db, {
          planId: plan.id,
          regionId: region.id,
          channel: "web_direct",
          priceText: formatCursorWebPrice(local, region.currency_code),
          priceValue: local,
          listPriceValue: plan.us_list_usd,
          taxMode: "exclusive",
          taxPercent: null,
          currencyCode: region.currency_code,
          cnyPrice: cny,
          fxRateToCny: fxRate,
          fxDate: fx.date,
          sourceUrl: opts.sourceUrl,
          status: "available",
          lastSuccessAt: now,
          updatedAt: now,
        });
        matched += 1;
      }
    }
  });
  tx();
  console.log(`[collect:official] ${opts.appSlug} web fx matched=${matched}`);
  return matched;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {Set<string>} channels  ios | web
 */
async function runFull(db, channels) {
  const startedAt = new Date().toISOString();
  const fx = await refreshFx(db);
  if (!fx) {
    console.error("[collect:official] no FX rates; abort full run");
    return { ok: false };
  }

  const now = new Date().toISOString();
  const ios = channels.has("ios") ? await collectIos(db, fx, now) : null;
  const web = channels.has("web") ? await collectWeb(db, fx, now) : null;

  refreshAllCny(db, fx.rates, fx.date);
  markScheduleDone(db, "full");

  const matched =
    (ios?.matched ?? 0) +
    (web?.matched ?? 0);
  const failed = (ios?.failed ?? 0) + (web?.failed ?? 0);
  const status = matched > 0 ? (failed > 0 ? "partial_success" : "success") : "failed";
  const parts = [];
  if (ios) {
    parts.push(
      `ios matched=${ios.matched} regions=${ios.regions} failed=${ios.failed} noApp=${ios.unavailable}`,
    );
  }
  if (web) {
    parts.push(
      `web matched=${web.matched} regions=${web.regions} failed=${web.failed} unavailable=${web.unavailable}${
        web.aborted ? " ABORTED" : ""
      }`,
    );
  }
  const message = parts.join(" | ");
  insertCollectRun(db, {
    mode: "full",
    status,
    successCount: matched,
    failureCount: failed,
    message,
    startedAt,
    finishedAt: new Date().toISOString(),
  });
  writeOfficialPricesSnapshot(db);
  console.log(`[collect:official] full ${status} ${message}`);
  return { ok: matched > 0 };
}

/** Rewrite the offline seed from real collected rows (bootstrap without network). */
function writeSeedFromDb(db) {
  const fx = getFx(db);
  const prices = db
    .prepare(
      `SELECT p.slug AS planSlug, r.country_code AS countryCode, pr.price_text AS priceText, pr.price_value AS priceValue
       FROM official_prices pr
       JOIN official_plans p ON p.id = pr.plan_id
       JOIN official_apps a ON a.id = p.app_id
       JOIN official_regions r ON r.id = pr.region_id
       WHERE a.slug = 'chatgpt' AND pr.status = 'available'
       ORDER BY p.sort_order, r.priority`,
    )
    .all();
  writeFileSync(
    SEED_PATH,
    `${JSON.stringify(
      { fxDate: fx?.date || null, rates: fx?.rates || {}, channel: "ios_store", prices },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(`[collect:official] seed rewritten rows=${prices.length} → ${SEED_PATH}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      "Usage: pnpm collect:official -- --mode=fx_only|full [--channels=ios,web] [--write-seed] [--db path]",
    );
    process.exit(0);
  }

  const db = openOfficialDb(resolveOfficialDbPath(args.db));
  try {
    migrateOfficialPrices(db);
    const result =
      args.mode === "fx_only" ? await runFxOnly(db) : await runFull(db, args.channels);
    if (result.ok && args.writeSeed) writeSeedFromDb(db);
    process.exitCode = result.ok ? 0 : 1;
  } finally {
    closeOfficialDb();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
