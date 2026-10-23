import { staleRetryDue } from "./official-stale-retry.mjs";
/**
 * Official subscription regional prices (SQLite).
 * GPT-first; Worker writes, Next reads.
 */
import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_DIR = join(root, "config", "official-prices");

export const DEFAULT_OFFICIAL_DB_PATH = join(root, "data", "official-prices.sqlite");
/**
 * Next 前台只读此 JSON 快照（由 SQLite 导出），与卡网 data/catalog/public.json 同模式。
 * 可用 OFFICIAL_SNAPSHOT_PATH 覆盖（需与前台一致）。
 */
export const OFFICIAL_SNAPSHOT_PATH =
  process.env.OFFICIAL_SNAPSHOT_PATH ||
  join(root, "data", "official-prices", "latest.json");

/** @deprecated 保留兼容；FX 已改为「每天 06:00（Asia/Shanghai）+ 今日未更兜底」。 */
export const OFFICIAL_FX_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** Weekly full App Store scrape. */
export const OFFICIAL_FULL_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/** FX 日更时区 / 时刻（默认北京时间 06:00）。 */
export const OFFICIAL_SCHEDULE_TZ =
  process.env.OFFICIAL_SCHEDULE_TZ || "Asia/Shanghai";
export const OFFICIAL_FX_HOUR = Math.min(
  23,
  Math.max(0, Number(process.env.OFFICIAL_FX_HOUR ?? 6) || 6),
);

/**
 * @param {Date} [date]
 * @param {string} [timeZone]
 */
export function zonedClockParts(date = new Date(), timeZone = OFFICIAL_SCHEDULE_TZ) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  /** @type {Record<string, string>} */
  const parts = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/**
 * 指定时区日历日的本地时刻 → UTC ISO。
 * @param {string} dateKey YYYY-MM-DD
 * @param {number} hour
 * @param {number} [minute]
 * @param {string} [timeZone]
 */
export function zonedLocalToUtcIso(
  dateKey,
  hour,
  minute = 0,
  timeZone = OFFICIAL_SCHEDULE_TZ,
) {
  // Asia/Shanghai 无夏令时；其它区用偏移探测
  if (timeZone === "Asia/Shanghai" || timeZone === "Asia/Chongqing") {
    const hh = String(hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    return new Date(`${dateKey}T${hh}:${mm}:00+08:00`).toISOString();
  }
  // 通用：在目标日附近搜索「本地钟面」匹配的 UTC 瞬间
  const [y, m, d] = dateKey.split("-").map(Number);
  let guess = Date.UTC(y, m - 1, d, hour - 8, minute, 0); // 粗起点
  for (let i = 0; i < 48; i += 1) {
    const t = new Date(guess + i * 30 * 60 * 1000);
    const z = zonedClockParts(t, timeZone);
    if (z.dateKey === dateKey && z.hour === hour && z.minute === minute) {
      return t.toISOString();
    }
  }
  return new Date(`${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`).toISOString();
}

/** YYYY-MM-DD 日历加减（UTC 日历算术，避免 +36h 跨日跳天）。 */
function addCalendarDays(dateKey, days) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** 下一次 FX 日更时刻（今天未到 06:00 → 今天 06:00；否则明天 06:00）。 */
export function nextOfficialFxAtIso(from = new Date()) {
  const z = zonedClockParts(from);
  let dateKey = z.dateKey;
  if (z.hour > OFFICIAL_FX_HOUR || (z.hour === OFFICIAL_FX_HOUR && z.minute > 0)) {
    dateKey = addCalendarDays(z.dateKey, 1);
  }
  return zonedLocalToUtcIso(dateKey, OFFICIAL_FX_HOUR, 0);
}

/**
 * 今日（调度时区）是否已完成 FX 更新。
 * @param {import('better-sqlite3').Database} db
 * @param {string} [dateKey]
 */
export function hasOfficialFxUpdateOnDay(db, dateKey) {
  const day = dateKey || zonedClockParts().dateKey;
  const s = getSchedule(db);
  if (s.last_fx_at) {
    if (zonedClockParts(new Date(s.last_fx_at)).dateKey === day) return true;
  }
  try {
    const fx = db
      .prepare(`SELECT date FROM official_fx ORDER BY date DESC LIMIT 1`)
      .get();
    if (fx?.date === day) return true;
  } catch {
    /* no fx table yet */
  }
  return false;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS official_apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  app_store_id TEXT,
  app_store_slug TEXT,
  play_package_id TEXT,
  catalog_platform TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS official_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL REFERENCES official_apps(id),
  slug TEXT NOT NULL,
  family TEXT,
  label TEXT NOT NULL,
  catalog_slug TEXT,
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  us_list_usd REAL,
  regular_usd REAL,
  include_json TEXT,
  exclude_json TEXT,
  prefer_band_json TEXT,
  require_any_json TEXT,
  offer_pattern TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(app_id, slug)
);

CREATE TABLE IF NOT EXISTS official_regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  country_code TEXT NOT NULL UNIQUE,
  country_label TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  storefront_id TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS official_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES official_plans(id),
  region_id INTEGER NOT NULL REFERENCES official_regions(id),
  channel TEXT NOT NULL DEFAULT 'ios_store',
  price_text TEXT,
  price_value REAL,
  currency_code TEXT,
  cny_price REAL,
  fx_rate_to_cny REAL,
  fx_date TEXT,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  last_success_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(plan_id, region_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_official_prices_plan ON official_prices(plan_id, status);
CREATE INDEX IF NOT EXISTS idx_official_prices_cny ON official_prices(cny_price);

CREATE TABLE IF NOT EXISTS official_fx (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  base_currency TEXT NOT NULL DEFAULT 'USD',
  source TEXT,
  source_url TEXT,
  date TEXT NOT NULL,
  rates_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS official_collect_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS official_schedule (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_fx_at TEXT,
  next_full_at TEXT,
  last_fx_at TEXT,
  last_full_at TEXT
);
`;

/** @type {import('better-sqlite3').Database | null} */
let cachedDb = null;

export function resolveOfficialDbPath(override) {
  return (
    override ||
    process.env.OFFICIAL_DB_PATH ||
    DEFAULT_OFFICIAL_DB_PATH
  );
}

export function officialDbExists(dbPath = resolveOfficialDbPath()) {
  return existsSync(dbPath);
}

/**
 * @param {string} [dbPath]
 * @returns {import('better-sqlite3').Database}
 */
export function openOfficialDb(dbPath = resolveOfficialDbPath()) {
  if (cachedDb && !dbPath) return cachedDb;
  const path = resolveOfficialDbPath(dbPath);
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA_SQL);
  ensureOfficialPlanColumns(db);
  ensureOfficialAppColumns(db);
  ensureOfficialPriceColumns(db);
  if (!dbPath || path === resolveOfficialDbPath()) cachedDb = db;
  return db;
}

/**
 * 官网渠道：price_value 存「含税实付」，这里保留原始标价与税口径，便于对账。
 * @param {import('better-sqlite3').Database} db
 */
function ensureOfficialPriceColumns(db) {
  const cols = new Set(
    db.prepare(`PRAGMA table_info(official_prices)`).all().map((c) => c.name),
  );
  if (!cols.has("last_attempt_at")) db.exec(`ALTER TABLE official_prices ADD COLUMN last_attempt_at TEXT`);
  if (!cols.has("list_price_value")) {
    db.exec(`ALTER TABLE official_prices ADD COLUMN list_price_value REAL`);
  }
  if (!cols.has("tax_mode")) {
    db.exec(`ALTER TABLE official_prices ADD COLUMN tax_mode TEXT`);
  }
  if (!cols.has("tax_percent")) {
    db.exec(`ALTER TABLE official_prices ADD COLUMN tax_percent REAL`);
  }
}

/** @param {import('better-sqlite3').Database} db */
function ensureOfficialPlanColumns(db) {
  const cols = new Set(
    db.prepare(`PRAGMA table_info(official_plans)`).all().map((c) => c.name),
  );
  if (!cols.has("family")) {
    db.exec(`ALTER TABLE official_plans ADD COLUMN family TEXT`);
  }
  if (!cols.has("require_any_json")) {
    db.exec(`ALTER TABLE official_plans ADD COLUMN require_any_json TEXT`);
  }
  if (!cols.has("offer_pattern")) {
    db.exec(`ALTER TABLE official_plans ADD COLUMN offer_pattern TEXT`);
  }
  if (!cols.has("regular_usd")) {
    db.exec(`ALTER TABLE official_plans ADD COLUMN regular_usd REAL`);
  }
}

/** @param {import('better-sqlite3').Database} db */
function ensureOfficialAppColumns(db) {
  const cols = new Set(
    db.prepare(`PRAGMA table_info(official_apps)`).all().map((c) => c.name),
  );
  if (!cols.has("play_package_id")) {
    db.exec(`ALTER TABLE official_apps ADD COLUMN play_package_id TEXT`);
  }
}

export function closeOfficialDb() {
  if (cachedDb) {
    cachedDb.close();
    cachedDb = null;
  }
}

export function requireOfficialDb(dbPath) {
  const path = resolveOfficialDbPath(dbPath);
  if (!existsSync(path)) {
    throw new Error(
      `official-prices.sqlite missing at ${path}. Run: pnpm official:migrate`,
    );
  }
  return openOfficialDb(path);
}

function loadJson(name) {
  const path = join(CONFIG_DIR, name);
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * @param {number} value
 * @param {string} currencyCode
 * @param {Record<string, number>} rates  per-USD rates (USD=1, CNY=…)
 */
export function convertToCny(value, currencyCode, rates) {
  const cnyPerUsd = rates.CNY;
  if (!Number.isFinite(cnyPerUsd)) return null;
  if (currencyCode === "CNY") return round2(value);
  if (currencyCode === "USD") return round2(value * cnyPerUsd);
  const perUsd = rates[currencyCode];
  if (!Number.isFinite(perUsd) || perUsd <= 0) return null;
  return round2((value / perUsd) * cnyPerUsd);
}

export function rateToCny(currencyCode, rates) {
  const cnyPerUsd = rates.CNY;
  if (!Number.isFinite(cnyPerUsd)) return null;
  if (currencyCode === "CNY") return 1;
  if (currencyCode === "USD") return cnyPerUsd;
  const perUsd = rates[currencyCode];
  if (!Number.isFinite(perUsd) || perUsd <= 0) return null;
  return cnyPerUsd / perUsd;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Migrate schema + upsert apps/plans/regions + seed prices if empty.
 * @param {import('better-sqlite3').Database} db
 * @param {{ forceSeed?: boolean }} [opts]
 */
export function migrateOfficialPrices(db, opts = {}) {
  const now = new Date().toISOString();
  const apps = loadJson("apps.json");
  const plans = loadJson("plans.json");
  const regions = loadJson("regions.json");

  const upsertApp = db.prepare(`
    INSERT INTO official_apps (
      slug, display_name, provider, app_store_id, app_store_slug, play_package_id,
      catalog_platform, enabled, sort_order
    )
    VALUES (
      @slug, @displayName, @provider, @appStoreId, @appStoreSlug, @playPackageId,
      @catalogPlatform, @enabled, @sortOrder
    )
    ON CONFLICT(slug) DO UPDATE SET
      display_name = excluded.display_name,
      provider = excluded.provider,
      app_store_id = excluded.app_store_id,
      app_store_slug = excluded.app_store_slug,
      play_package_id = excluded.play_package_id,
      catalog_platform = excluded.catalog_platform,
      enabled = excluded.enabled,
      sort_order = excluded.sort_order
  `);

  const upsertRegion = db.prepare(`
    INSERT INTO official_regions (country_code, country_label, currency_code, storefront_id, enabled, priority)
    VALUES (@countryCode, @countryLabel, @currencyCode, @storefrontId, @enabled, @priority)
    ON CONFLICT(country_code) DO UPDATE SET
      country_label = excluded.country_label,
      currency_code = excluded.currency_code,
      storefront_id = excluded.storefront_id,
      enabled = excluded.enabled,
      priority = excluded.priority
  `);

  const getAppId = db.prepare(`SELECT id FROM official_apps WHERE slug = ?`);
  const upsertPlan = db.prepare(`
    INSERT INTO official_plans (
      app_id, slug, family, label, catalog_slug, billing_period, us_list_usd,
      regular_usd, offer_pattern, sort_order
    ) VALUES (
      @appId, @slug, @family, @label, @catalogSlug, @billingPeriod, @usListUsd,
      @regularUsd, @offerPattern, @sortOrder
    )
    ON CONFLICT(app_id, slug) DO UPDATE SET
      family = excluded.family,
      label = excluded.label,
      catalog_slug = excluded.catalog_slug,
      billing_period = excluded.billing_period,
      us_list_usd = excluded.us_list_usd,
      regular_usd = excluded.regular_usd,
      offer_pattern = excluded.offer_pattern,
      sort_order = excluded.sort_order
  `);

  const tx = db.transaction(() => {
    for (const app of apps) {
      upsertApp.run({
        slug: app.slug,
        displayName: app.displayName,
        provider: app.provider,
        appStoreId: app.appStoreId || null,
        appStoreSlug: app.appStoreSlug || null,
        playPackageId: app.playPackageId || null,
        catalogPlatform: app.catalogPlatform || app.slug,
        enabled: app.enabled === false ? 0 : 1,
        sortOrder: app.sortOrder ?? 0,
      });
    }
    for (const region of regions) {
      upsertRegion.run({
        countryCode: region.countryCode,
        countryLabel: region.countryLabel,
        currencyCode: region.currencyCode,
        storefrontId: region.storefrontId || null,
        enabled: region.enabled === false ? 0 : 1,
        priority: region.priority ?? 0,
      });
    }
    for (const plan of plans) {
      const app = getAppId.get(plan.appSlug);
      if (!app) continue;
      upsertPlan.run({
        appId: app.id,
        slug: plan.slug,
        family: plan.family || plan.slug.replace(/-(monthly|annual)$/, ""),
        label: plan.label,
        catalogSlug: plan.catalogSlug || null,
        billingPeriod: plan.billingPeriod || "monthly",
        usListUsd: plan.usListUsd ?? null,
        regularUsd: plan.regularUsd ?? null,
        offerPattern: plan.offerPattern || null,
        sortOrder: plan.sortOrder ?? 0,
      });
    }

    // Plans removed from config are dropped (prices cascade via plan_id)
    for (const app of apps) {
      const row = getAppId.get(app.slug);
      if (!row) continue;
      const keepSlugs = plans.filter((p) => p.appSlug === app.slug).map((p) => p.slug);
      if (!keepSlugs.length) continue;
      const marks = keepSlugs.map(() => "?").join(",");
      db.prepare(
        `DELETE FROM official_prices WHERE plan_id IN (
          SELECT id FROM official_plans WHERE app_id = ? AND slug NOT IN (${marks})
        )`,
      ).run(row.id, ...keepSlugs);
      db.prepare(
        `DELETE FROM official_plans WHERE app_id = ? AND slug NOT IN (${marks})`,
      ).run(row.id, ...keepSlugs);
    }

    // Regions removed from config (e.g. storefront no longer sells the app) are dropped
    const keep = regions.map((r) => r.countryCode);
    if (keep.length) {
      const marks = keep.map(() => "?").join(",");
      db.prepare(
        `DELETE FROM official_prices WHERE region_id IN (
          SELECT id FROM official_regions WHERE country_code NOT IN (${marks})
        )`,
      ).run(...keep);
      db.prepare(`DELETE FROM official_regions WHERE country_code NOT IN (${marks})`).run(...keep);
    }

    const schedule = db.prepare(`SELECT id FROM official_schedule WHERE id = 1`).get();
    if (!schedule) {
      db.prepare(`
        INSERT INTO official_schedule (id, next_fx_at, next_full_at)
        VALUES (1, ?, ?)
      `).run(
        nextOfficialFxAtIso(),
        new Date(Date.now() + OFFICIAL_FULL_INTERVAL_MS).toISOString(),
      );
    }
  });
  tx();

  for (const app of apps) {
    const appPriceCount =
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM official_prices pr
           JOIN official_plans p ON p.id = pr.plan_id
           JOIN official_apps a ON a.id = p.app_id
           WHERE a.slug = ?`,
        )
        .get(app.slug)?.n || 0;
    if (appPriceCount === 0 || opts.forceSeed) {
      seedAppPrices(db, app.slug, { now, replace: Boolean(opts.forceSeed) });
    }
  }

  const stats = {
    apps: apps.length,
    plans: plans.length,
    regions: regions.length,
    prices: db.prepare(`SELECT COUNT(*) AS n FROM official_prices`).get()?.n || 0,
  };
  writeOfficialPricesSnapshot(db);
  return stats;
}

/**
 * Write JSON snapshot for Next.js to read without native sqlite bindings.
 * @param {import('better-sqlite3').Database} db
 */
export function writeOfficialPricesSnapshot(db) {
  const summaries = listPlanSummaries(db, { platform: "all" });
  /** @type {Record<string, any[]>} */
  const regionPricesByPlanId = {};
  for (const summary of summaries) {
    regionPricesByPlanId[summary.id] = listRegionPricesForPlan(
      db,
      summary.appSlug,
      summary.planSlug,
    );
  }
  const regionCount =
    db.prepare(`SELECT COUNT(*) AS n FROM official_regions WHERE enabled = 1`).get()
      ?.n || 0;
  const fx = getFx(db);
  const payload = {
    generatedAt: new Date().toISOString(),
    source: "sqlite",
    regionCount,
    fxDate: fx?.date || null,
    summaries,
    regionPricesByPlanId,
  };
  mkdirSync(dirname(OFFICIAL_SNAPSHOT_PATH), { recursive: true });
  // 先写临时文件再 rename，前台不会读到写了一半的 JSON
  const tmp = `${OFFICIAL_SNAPSHOT_PATH}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  renameSync(tmp, OFFICIAL_SNAPSHOT_PATH);
  return OFFICIAL_SNAPSHOT_PATH;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} appSlug
 * @param {string} planSlug
 */
function listRegionPricesForPlan(db, appSlug, planSlug) {
  const rows = db
    .prepare(
      `
    SELECT
      pr.id,
      pr.price_text,
      pr.price_value,
      pr.currency_code,
      pr.cny_price,
      pr.fx_rate_to_cny,
      pr.fx_date,
      pr.source_url,
      pr.status,
      pr.channel,
      pr.list_price_value,
      pr.tax_mode,
      pr.tax_percent,
      pr.updated_at,
      pr.last_success_at,
      r.country_code,
      r.country_label,
      r.currency_code AS region_currency,
      r.storefront_id
    FROM official_prices pr
    JOIN official_plans p ON p.id = pr.plan_id
    JOIN official_apps a ON a.id = p.app_id
    JOIN official_regions r ON r.id = pr.region_id
    WHERE a.slug = ?
      AND p.slug = ?
      AND pr.status IN ('available', 'estimated', 'stale')
      AND pr.cny_price IS NOT NULL
    ORDER BY
      CASE pr.status
        WHEN 'available' THEN 0
        WHEN 'estimated' THEN 1
        ELSE 2
      END,
      pr.cny_price ASC,
      (pr.price_value * pr.fx_rate_to_cny) ASC,
      CASE pr.channel WHEN 'web_direct' THEN 0 ELSE 1 END,
      r.priority ASC
  `,
    )
    .all(appSlug, planSlug);
  return rows.map((row) => ({
    id: String(row.id),
    countryCode: row.country_code,
    countryLabel: row.country_label,
    currencyCode: row.currency_code || row.region_currency,
    storefrontId: row.storefront_id || null,
    priceText: row.price_text,
    priceValue: row.price_value,
    cnyPrice: row.cny_price,
    fxRateToCny: row.fx_rate_to_cny,
    fxDate: row.fx_date,
    sourceUrl: row.source_url,
    status: row.status,
    channel: row.channel,
    listPriceValue: row.list_price_value ?? null,
    taxMode: row.tax_mode ?? null,
    taxPercent: row.tax_percent ?? null,
    updatedAt: row.updated_at,
    lastSuccessAt: row.last_success_at,
  }));
}

/**
 * Seed prices for one app from `seed-prices.{slug}.json`.
 * Missing seed file → no-op (0).
 * @param {import('better-sqlite3').Database} db
 * @param {string} appSlug
 * @param {{ now?: string, replace?: boolean }} [opts]
 */
export function seedAppPrices(db, appSlug, opts = {}) {
  const now = opts.now || new Date().toISOString();
  const seedFile = `seed-prices.${appSlug}.json`;
  const seedPath = join(CONFIG_DIR, seedFile);
  if (!existsSync(seedPath)) return 0;

  const seed = loadJson(seedFile);
  const rates = seed.rates || getFx(db)?.rates || {};
  const fxDate = seed.fxDate || now.slice(0, 10);
  const channel = seed.channel || "ios_store";
  const seedSourceUrl = seed.sourceUrl || null;

  if (Object.keys(rates).length) {
    upsertFx(db, {
      date: fxDate,
      rates,
      source: "seed",
      sourceUrl: null,
      updatedAt: now,
    });
  }

  const planBySlug = new Map(
    db
      .prepare(
        `SELECT p.id, p.slug FROM official_plans p
         JOIN official_apps a ON a.id = p.app_id WHERE a.slug = ?`,
      )
      .all(appSlug)
      .map((r) => [r.slug, r.id]),
  );
  const regionByCode = new Map(
    db
      .prepare(`SELECT id, country_code, currency_code FROM official_regions`)
      .all()
      .map((r) => [r.country_code, r]),
  );

  const upsert = db.prepare(`
    INSERT INTO official_prices (
      plan_id, region_id, channel, price_text, price_value, currency_code,
      cny_price, fx_rate_to_cny, fx_date, source_url, status, last_success_at, updated_at
    ) VALUES (
      @planId, @regionId, @channel, @priceText, @priceValue, @currencyCode,
      @cnyPrice, @fxRateToCny, @fxDate, @sourceUrl, 'available', @now, @now
    )
    ON CONFLICT(plan_id, region_id, channel) DO UPDATE SET
      price_text = excluded.price_text,
      price_value = excluded.price_value,
      currency_code = excluded.currency_code,
      cny_price = excluded.cny_price,
      fx_rate_to_cny = excluded.fx_rate_to_cny,
      fx_date = excluded.fx_date,
      source_url = COALESCE(excluded.source_url, official_prices.source_url),
      status = 'available',
      last_success_at = excluded.last_success_at,
      updated_at = excluded.updated_at
  `);

  const app = db
    .prepare(`SELECT app_store_id, app_store_slug FROM official_apps WHERE slug = ?`)
    .get(appSlug);
  const appStoreId = app?.app_store_id || "";
  const appStoreSlug = app?.app_store_slug || appSlug;

  let n = 0;
  const tx = db.transaction(() => {
    if (opts.replace) {
      db.prepare(
        `DELETE FROM official_prices WHERE plan_id IN (
          SELECT p.id FROM official_plans p JOIN official_apps a ON a.id = p.app_id WHERE a.slug = ?
        )`,
      ).run(appSlug);
    }
    for (const row of seed.prices || []) {
      const planId = planBySlug.get(row.planSlug);
      const region = regionByCode.get(row.countryCode);
      if (!planId || !region) continue;
      const currency = region.currency_code;
      const cny = convertToCny(row.priceValue, currency, rates);
      const fxRate = rateToCny(currency, rates);
      if (cny == null || fxRate == null) continue;
      const cc = String(row.countryCode).toLowerCase();
      let sourceUrl = seedSourceUrl;
      if (!sourceUrl) {
        if (channel === "web_direct") {
          sourceUrl =
            appSlug === "claude"
              ? "https://claude.com/pricing"
              : appSlug === "cursor"
                ? "https://cursor.com/pricing"
                : appSlug === "grok"
                  ? "https://x.ai/pricing"
                  : appSlug === "x"
                    ? "https://help.x.com/en/using-x/x-premium"
                    : appSlug === "kiro"
                      ? "https://kiro.dev/pricing/"
                      : appSlug === "gemini"
                        ? "https://one.google.com/about/google-ai-plans/"
                        : "https://chatgpt.com/pricing";
        } else if (appStoreId) {
          sourceUrl = `https://apps.apple.com/${cc}/app/${appStoreSlug}/id${appStoreId}`;
        }
      }
      upsert.run({
        planId,
        regionId: region.id,
        channel,
        priceText: row.priceText,
        priceValue: row.priceValue,
        currencyCode: currency,
        cnyPrice: cny,
        fxRateToCny: fxRate,
        fxDate,
        sourceUrl,
        now,
      });
      n += 1;
    }
  });
  tx();
  return n;
}

/** @deprecated use seedAppPrices(db, 'chatgpt', opts) */
export function seedChatgptPrices(db, opts = {}) {
  return seedAppPrices(db, "chatgpt", opts);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ date: string, rates: Record<string, number>, source?: string, sourceUrl?: string | null, updatedAt?: string }} fx
 */
export function upsertFx(db, fx) {
  db.prepare(`
    INSERT INTO official_fx (id, base_currency, source, source_url, date, rates_json, updated_at)
    VALUES (1, 'USD', @source, @sourceUrl, @date, @ratesJson, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      source = excluded.source,
      source_url = excluded.source_url,
      date = excluded.date,
      rates_json = excluded.rates_json,
      updated_at = excluded.updated_at
  `).run({
    source: fx.source || "frankfurter",
    sourceUrl: fx.sourceUrl || null,
    date: fx.date,
    ratesJson: JSON.stringify(fx.rates),
    updatedAt: fx.updatedAt || new Date().toISOString(),
  });
}

export function getFx(db) {
  const row = db.prepare(`SELECT * FROM official_fx WHERE id = 1`).get();
  if (!row) return null;
  return {
    date: row.date,
    rates: JSON.parse(row.rates_json || "{}"),
    source: row.source,
    sourceUrl: row.source_url,
    updatedAt: row.updated_at,
  };
}

/**
 * Recalculate all cny_price from current FX.
 * @param {import('better-sqlite3').Database} db
 * @param {Record<string, number>} rates
 * @param {string} fxDate
 */
export function refreshAllCny(db, rates, fxDate) {
  const now = new Date().toISOString();
  const rows = db.prepare(`SELECT id, price_value, currency_code FROM official_prices`).all();
  const update = db.prepare(`
    UPDATE official_prices
    SET cny_price = @cny, fx_rate_to_cny = @fxRate, fx_date = @fxDate, updated_at = @now
    WHERE id = @id
  `);
  let n = 0;
  const tx = db.transaction(() => {
    for (const row of rows) {
      const cny = convertToCny(row.price_value, row.currency_code, rates);
      const fxRate = rateToCny(row.currency_code, rates);
      if (cny == null || fxRate == null) continue;
      update.run({ id: row.id, cny, fxRate, fxDate, now });
      n += 1;
    }
  });
  tx();
  return n;
}

export function getSchedule(db) {
  return (
    db.prepare(`SELECT * FROM official_schedule WHERE id = 1`).get() || {
      next_fx_at: null,
      next_full_at: null,
      last_fx_at: null,
      last_full_at: null,
    }
  );
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {'fx_only' | 'full'} mode
 */
export function markScheduleDone(db, mode) {
  const now = new Date().toISOString();
  const nextFx = nextOfficialFxAtIso(new Date(Date.now() + 60_000)); // 刚跑完 → 明天 06:00
  if (mode === "fx_only") {
    db.prepare(`
      UPDATE official_schedule SET
        last_fx_at = @now,
        next_fx_at = @next
      WHERE id = 1
    `).run({
      now,
      next: nextFx,
    });
  } else {
    db.prepare(`
      UPDATE official_schedule SET
        last_full_at = @now,
        next_full_at = @nextFull,
        last_fx_at = @now,
        next_fx_at = @nextFx
      WHERE id = 1
    `).run({
      now,
      nextFull: new Date(Date.now() + OFFICIAL_FULL_INTERVAL_MS).toISOString(),
      nextFx,
    });
  }
}

/**
 * 是否到期：
 * - full：按 next_full_at
 * - fx_only：每天 06:00（Asia/Shanghai）后，若「今日尚未 FX 更新」则到期（含漏跑兜底）
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {'fx_only' | 'full' | 'stale' | null}
 */
export function dueOfficialMode(db) {
  const s = getSchedule(db);
  const nowMs = Date.now();
  if (s.next_full_at && new Date(s.next_full_at).getTime() <= nowMs) return "full";

  const z = zonedClockParts(new Date());
  const pastFxHour =
    z.hour > OFFICIAL_FX_HOUR ||
    (z.hour === OFFICIAL_FX_HOUR && z.minute >= 0);

  // 主路径 + 兜底：已过今日 06:00，且今天还没成功日更 → 立刻 fx_only
  if (pastFxHour && !hasOfficialFxUpdateOnDay(db, z.dateKey)) {
    return "fx_only";
  }

  // 兼容旧 next_fx_at：到期且今日未更
  if (
    s.next_fx_at &&
    new Date(s.next_fx_at).getTime() <= nowMs &&
    !hasOfficialFxUpdateOnDay(db, z.dateKey)
  ) {
    return "fx_only";
  }

  return staleRetryDue(db) ? "stale" : null;
}

export function insertCollectRun(db, run) {
  db.prepare(`
    INSERT INTO official_collect_runs (mode, status, success_count, failure_count, message, started_at, finished_at)
    VALUES (@mode, @status, @successCount, @failureCount, @message, @startedAt, @finishedAt)
  `).run({
    mode: run.mode,
    status: run.status,
    successCount: run.successCount || 0,
    failureCount: run.failureCount || 0,
    message: run.message || null,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  });
}

/**
 * Upsert one collected price row.
 * @param {import('better-sqlite3').Database} db
 * @param {object} row
 */
export function upsertPrice(db, row) {
  const now = row.updatedAt || new Date().toISOString();
  db.prepare(`
    INSERT INTO official_prices (
      plan_id, region_id, channel, price_text, price_value, currency_code,
      cny_price, fx_rate_to_cny, fx_date, source_url, status, last_success_at, updated_at,
      list_price_value, tax_mode, tax_percent
    ) VALUES (
      @planId, @regionId, @channel, @priceText, @priceValue, @currencyCode,
      @cnyPrice, @fxRateToCny, @fxDate, @sourceUrl, @status, @lastSuccessAt, @now,
      @listPriceValue, @taxMode, @taxPercent
    )
    ON CONFLICT(plan_id, region_id, channel) DO UPDATE SET
      price_text = excluded.price_text,
      price_value = excluded.price_value,
      currency_code = excluded.currency_code,
      cny_price = excluded.cny_price,
      fx_rate_to_cny = excluded.fx_rate_to_cny,
      fx_date = excluded.fx_date,
      source_url = excluded.source_url,
      list_price_value = excluded.list_price_value,
      tax_mode = excluded.tax_mode,
      tax_percent = excluded.tax_percent,
      status = excluded.status,
      last_success_at = CASE
        WHEN excluded.status IN ('available', 'estimated') THEN excluded.last_success_at
        ELSE official_prices.last_success_at
      END,
      updated_at = excluded.updated_at
  `).run({
    planId: row.planId,
    regionId: row.regionId,
    channel: row.channel || "ios_store",
    priceText: row.priceText,
    priceValue: row.priceValue,
    currencyCode: row.currencyCode,
    cnyPrice: row.cnyPrice,
    fxRateToCny: row.fxRateToCny,
    fxDate: row.fxDate,
    sourceUrl: row.sourceUrl || null,
    status: row.status || "available",
    lastSuccessAt: row.lastSuccessAt || now,
    listPriceValue: row.listPriceValue ?? null,
    taxMode: row.taxMode ?? null,
    taxPercent: row.taxPercent ?? null,
    now,
  });
}

export function listEnabledApps(db) {
  return db
    .prepare(
      `SELECT * FROM official_apps WHERE enabled = 1 ORDER BY sort_order, id`,
    )
    .all();
}

export function listPlansForApp(db, appId) {
  return db
    .prepare(
      `SELECT * FROM official_plans WHERE app_id = ? ORDER BY sort_order, id`,
    )
    .all(appId);
}

export function listEnabledRegions(db) {
  return db
    .prepare(
      `SELECT * FROM official_regions WHERE enabled = 1 ORDER BY priority, id`,
    )
    .all();
}

/**
 * Plan summaries for UI (lowest available regional price).
 * @param {import('better-sqlite3').Database} db
 * @param {{ platform?: string, q?: string }} [opts]
 */
export function listPlanSummaries(db, opts = {}) {
  const platform = opts.platform && opts.platform !== "all" ? opts.platform : null;
  const needle = opts.q?.trim().toLowerCase() || "";

  const plans = db
    .prepare(
      `
    SELECT
      p.id AS plan_id,
      p.slug AS plan_slug,
      p.family,
      p.label,
      p.catalog_slug,
      p.billing_period,
      p.us_list_usd,
      p.regular_usd,
      p.sort_order,
      a.slug AS app_slug,
      a.display_name AS app_name,
      a.provider,
      a.catalog_platform
    FROM official_plans p
    JOIN official_apps a ON a.id = p.app_id
    WHERE a.enabled = 1
      AND (? IS NULL OR a.catalog_platform = ? OR a.slug = ?)
    ORDER BY a.sort_order, p.sort_order
  `,
    )
    .all(platform, platform, platform);

  const priceStmt = db.prepare(`
    SELECT
      pr.*,
      r.country_code,
      r.country_label,
      r.currency_code AS region_currency
    FROM official_prices pr
    JOIN official_regions r ON r.id = pr.region_id
    WHERE pr.plan_id = ?
      AND pr.status IN ('available', 'estimated', 'stale')
      AND pr.cny_price IS NOT NULL
    ORDER BY
      CASE pr.status
        WHEN 'available' THEN 0
        WHEN 'estimated' THEN 1
        ELSE 2
      END,
      pr.cny_price ASC,
      (pr.price_value * pr.fx_rate_to_cny) ASC,
      CASE pr.channel WHEN 'web_direct' THEN 0 ELSE 1 END,
      r.priority ASC
  `);

  const schedule = getSchedule(db);
  const summaries = [];
  for (const plan of plans) {
    const prices = priceStmt.all(plan.plan_id);
    if (!prices.length) continue;
    // 列表最低价只认实测 available；estimated 不抢最低价位
    const verified = prices.filter((p) => p.status === "available");
    const estimated = prices.filter((p) => p.status === "estimated");
    const pool = verified.length
      ? verified
      : estimated.length
        ? estimated
        : prices;
    // 跨渠道取最低：官网直购 + iOS 等所有渠道一起比，不能只看单一渠道
    const lowest = pool[0];
    // 美区基准优先取官网标价（官方 list price），没有再退到其它渠道
    const usRows = [...pool, ...prices].filter((p) => p.country_code === "US");
    const us = usRows.find((p) => p.channel === "web_direct") || usRows[0] || null;
    const usLiveUsd =
      us &&
      String(us.currency_code || us.region_currency || "").toUpperCase() === "USD" &&
      Number.isFinite(Number(us.price_value)) &&
      Number(us.price_value) > 0
        ? Number(us.price_value)
        : null;
    /** @type {Record<string, number>} */
    const channelCounts = {};
    for (const p of [...verified, ...estimated]) {
      channelCounts[p.channel] = (channelCounts[p.channel] || 0) + 1;
    }
    const usCny =
      us?.cny_price ??
      (plan.us_list_usd != null
        ? convertToCny(plan.us_list_usd, "USD", getFx(db)?.rates || { CNY: 6.7 })
        : null);

    const savePct =
      usCny && lowest.cny_price < usCny
        ? Math.round(((usCny - lowest.cny_price) / usCny) * 10000) / 100
        : lowest.country_code === "US"
          ? 0
          : null;

    const summary = {
      id: `${plan.app_slug}__${plan.plan_slug}`,
      planSlug: plan.plan_slug,
      family: plan.family || String(plan.plan_slug).replace(/-(monthly|annual)$/, ""),
      catalogSlug: plan.catalog_slug,
      label: plan.label,
      billingPeriod: plan.billing_period,
      appSlug: plan.app_slug,
      appName: plan.app_name,
      provider: plan.provider,
      catalogPlatform: plan.catalog_platform,
      // 地区数按国家去重；报价数含各渠道 available 行（同一国家多渠道各算一条）
      sampleCount: new Set([...verified, ...estimated].map((p) => p.country_code)).size ||
        new Set(pool.map((p) => p.country_code)).size,
      quoteCount: verified.length + estimated.length || pool.length,
      channelCounts,
      usListUsd: plan.us_list_usd,
      regularUsd: plan.regular_usd ?? null,
      usLiveUsd,
      usPriceText: us?.price_text ?? null,
      usCny,
      savePct,
      lowest: {
        countryCode: lowest.country_code,
        countryLabel: lowest.country_label,
        currencyCode: lowest.currency_code || lowest.region_currency,
        priceText: lowest.price_text,
        priceValue: lowest.price_value,
        cnyPrice: lowest.cny_price,
        fxRateToCny: lowest.fx_rate_to_cny,
        fxDate: lowest.fx_date,
        sourceUrl: lowest.source_url,
        status: lowest.status,
        channel: lowest.channel,
        listPriceValue: lowest.list_price_value ?? null,
        taxMode: lowest.tax_mode ?? null,
        taxPercent: lowest.tax_percent ?? null,
        updatedAt: lowest.updated_at,
        lastSuccessAt: lowest.last_success_at,
      },
      // 卡片「更新」= 原站采价 与 日更汇率取较新（FX 日更后不应仍显示十余小时前）
      updatedAt: [
        lowest.last_success_at,
        lowest.updated_at,
        schedule.last_fx_at,
      ]
        .filter(Boolean)
        .sort()
        .at(-1) || null,
    };

    if (needle) {
      const hay = [
        summary.label,
        summary.appName,
        summary.provider,
        summary.lowest.countryLabel,
        summary.lowest.countryCode,
        summary.lowest.priceText,
        summary.catalogSlug,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) continue;
    }
    summaries.push(summary);
  }

  // 保持配置顺序（Go → Plus → Pro 5x → 20x → 500），与参考站一致；不按价格重排
  return summaries;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} catalogSlug
 * @returns {number | null}
 */
export function getCnyByCatalogSlug(db, catalogSlug) {
  const row = db
    .prepare(
      `
    SELECT pr.cny_price
    FROM official_prices pr
    JOIN official_plans p ON p.id = pr.plan_id
    JOIN official_regions r ON r.id = pr.region_id
    WHERE p.catalog_slug = ?
      AND pr.status IN ('available', 'estimated', 'stale')
      AND pr.cny_price IS NOT NULL
    ORDER BY
      CASE r.country_code WHEN 'US' THEN 0 ELSE 1 END,
      CASE pr.channel WHEN 'web_direct' THEN 0 ELSE 1 END,
      CASE pr.status
        WHEN 'available' THEN 0
        WHEN 'estimated' THEN 1
        ELSE 2
      END,
      pr.cny_price ASC
    LIMIT 1
  `,
    )
    .get(catalogSlug);
  return row?.cny_price ?? null;
}
