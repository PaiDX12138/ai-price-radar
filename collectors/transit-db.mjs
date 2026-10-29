/**
 * API transit station storage.
 *
 * SQLite is the write-side source of truth. The Next app must not open this
 * database on page requests; exportTransitSnapshot() writes the read-side
 * JSON snapshot consumed by the frontend cache.
 */
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  copyFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPerformanceMonitor } from "../src/lib/transit/performance.mjs";
import { ZETA_SCHEMA_SQL, buildZetaPerformance } from "./transit/zetaapi-storage.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const DEFAULT_TRANSIT_DB_PATH = join(root, "data", "transit.sqlite");
export const TRANSIT_SNAPSHOT_PATH = join(root, "data", "transit", "latest.json");

export function resolveTransitSnapshotPath(override) {
  return override || process.env.TRANSIT_SNAPSHOT_PATH || TRANSIT_SNAPSHOT_PATH;
}

const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS transit_stations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  site_url TEXT NOT NULL,
  canonical_url TEXT,
  host TEXT NOT NULL,
  system TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual',
  collector_kind TEXT,
  status TEXT NOT NULL DEFAULT 'candidate',
  listed_at TEXT NOT NULL,
  description TEXT,
  docs_url TEXT,
  logo_url TEXT,
  logo_local_path TEXT,
  monitoring_url TEXT,
  source_fingerprint TEXT,
  last_source_generated_at TEXT,
  last_seen_at TEXT,
  last_collected_at TEXT,
  last_collect_ok INTEGER,
  risk_note TEXT,
  config_json TEXT,
  raw_meta_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transit_groups (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES transit_stations(id) ON DELETE CASCADE,
  group_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  recharge_ratio REAL,
  model_ratio REAL,
  completion_ratio REAL,
  cache_read_ratio REAL,
  cache_write_ratio REAL,
  pool_type TEXT,
  subscription TEXT,
  channel_type TEXT,
  disclosure TEXT,
  description TEXT,
  warning TEXT,
  third_party_allowed INTEGER,
  supported_protocols_json TEXT,
  endpoint_overrides_json TEXT,
  raw_group_json TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  observed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(station_id, group_key)
);

CREATE TABLE IF NOT EXISTS transit_offers (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES transit_groups(id) ON DELETE CASCADE,
  raw_model TEXT NOT NULL,
  standard_model TEXT,
  family TEXT,
  modality TEXT NOT NULL DEFAULT 'text',
  price_kind TEXT NOT NULL DEFAULT 'token',
  input_price REAL,
  output_price REAL,
  cache_read_price REAL,
  cache_write_price REAL,
  cache_creation_price REAL,
  fixed_price REAL,
  price_unit TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  composite_multiplier REAL,
  vendor_id INTEGER,
  vendor_name TEXT,
  quota_type INTEGER,
  billing_mode TEXT,
  model_price_min REAL,
  model_price_max REAL,
  image_ratio REAL,
  image_billing_json TEXT,
  tiers_json TEXT,
  supported_endpoint_types_json TEXT,
  base_price_json TEXT,
  effective_price_json TEXT,
  source_model_version TEXT,
  source_url TEXT,
  raw_offer_hash TEXT,
  raw_offer_json TEXT,
  observed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(group_id, raw_model, price_kind)
);

CREATE TABLE IF NOT EXISTS transit_offer_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_id TEXT NOT NULL REFERENCES transit_offers(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  raw_offer_hash TEXT NOT NULL,
  UNIQUE(offer_id, run_id, raw_offer_hash)
);

CREATE TABLE IF NOT EXISTS transit_collection_runs (
  run_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES transit_stations(id) ON DELETE CASCADE,
  collector_kind TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'pricing',
  status TEXT NOT NULL,
  http_status INTEGER,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  source_generated_at TEXT,
  offer_count INTEGER NOT NULL DEFAULT 0,
  raw_snapshot_path TEXT,
  error_code TEXT,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS transit_source_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id TEXT NOT NULL REFERENCES transit_stations(id) ON DELETE CASCADE,
  run_id TEXT,
  source_kind TEXT NOT NULL,
  source_url TEXT NOT NULL,
  http_status INTEGER,
  content_type TEXT,
  etag TEXT,
  last_modified TEXT,
  source_generated_at TEXT,
  captured_at TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  payload_path TEXT,
  payload_text TEXT NOT NULL,
  parse_status TEXT NOT NULL DEFAULT 'captured',
  error_code TEXT,
  error_message TEXT,
  UNIQUE(station_id, source_kind, payload_hash)
);

CREATE TABLE IF NOT EXISTS transit_collect_schedule (
  station_id TEXT PRIMARY KEY REFERENCES transit_stations(id),
  next_collect_at TEXT NOT NULL,
  fail_count INTEGER NOT NULL DEFAULT 0,
  lease_owner TEXT,
  lease_until TEXT,
  last_success_at TEXT,
  last_attempt_at TEXT,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_transit_due ON transit_collect_schedule(next_collect_at, lease_until);

CREATE TABLE IF NOT EXISTS transit_performance_schedule (
  station_id TEXT PRIMARY KEY REFERENCES transit_stations(id),
  next_collect_at TEXT NOT NULL,
  fail_count INTEGER NOT NULL DEFAULT 0,
  lease_owner TEXT,
  lease_until TEXT,
  last_success_at TEXT,
  last_attempt_at TEXT,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS transit_performance_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id TEXT NOT NULL REFERENCES transit_stations(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  group_key TEXT NOT NULL,
  bucket_at TEXT NOT NULL,
  avg_ttft_ms REAL,
  avg_latency_ms REAL,
  success_rate REAL,
  avg_tps REAL,
  has_data INTEGER NOT NULL DEFAULT 1,
  window_hours INTEGER NOT NULL DEFAULT 360,
  source_url TEXT NOT NULL,
  source_schema TEXT,
  observed_at TEXT NOT NULL,
  UNIQUE(station_id, model_name, group_key, bucket_at, window_hours)
);
CREATE INDEX IF NOT EXISTS idx_transit_perf_station_bucket
  ON transit_performance_observations(station_id, bucket_at DESC);
CREATE INDEX IF NOT EXISTS idx_transit_perf_group_bucket
  ON transit_performance_observations(station_id, group_key, bucket_at DESC);
CREATE INDEX IF NOT EXISTS idx_transit_perf_model_window_bucket
  ON transit_performance_observations(station_id, model_name, window_hours, bucket_at DESC);

${ZETA_SCHEMA_SQL}

`;

const INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_transit_stations_status_updated
  ON transit_stations(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_transit_stations_host
  ON transit_stations(host);
CREATE INDEX IF NOT EXISTS idx_transit_stations_collector_status
  ON transit_stations(collector_kind, status, last_collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_transit_stations_source_fingerprint
  ON transit_stations(source_fingerprint);
CREATE INDEX IF NOT EXISTS idx_transit_groups_station_status
  ON transit_groups(station_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_transit_offers_group_model
  ON transit_offers(group_id, standard_model, raw_model);
CREATE INDEX IF NOT EXISTS idx_transit_offers_family_modality
  ON transit_offers(family, modality, price_kind);
CREATE INDEX IF NOT EXISTS idx_transit_offers_vendor_model
  ON transit_offers(vendor_id, standard_model, raw_model);
CREATE INDEX IF NOT EXISTS idx_transit_offers_observed
  ON transit_offers(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_transit_offer_observations_offer_time
  ON transit_offer_observations(offer_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_transit_runs_station_time
  ON transit_collection_runs(station_id, finished_at DESC);
CREATE INDEX IF NOT EXISTS idx_transit_runs_status_time
  ON transit_collection_runs(status, finished_at DESC);
CREATE INDEX IF NOT EXISTS idx_transit_source_snapshots_station_time
  ON transit_source_snapshots(station_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_transit_source_snapshots_hash
  ON transit_source_snapshots(payload_hash);
`;

let cachedDb = null;
let cachedPath = null;

export function resolveTransitDbPath(override) {
  return override || process.env.TRANSIT_DB_PATH || DEFAULT_TRANSIT_DB_PATH;
}

export function openTransitDb(dbPath = resolveTransitDbPath()) {
  const path = resolveTransitDbPath(dbPath);
  if (cachedDb && cachedPath === path) return cachedDb;
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("busy_timeout = 5000");
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.exec(SCHEMA_SQL);
  // Per-site workers may start together after deployment; serialize additive migrations.
  db.transaction(() => ensureTransitColumns(db)).immediate();
  db.exec(INDEX_SQL);
  cachedDb = db;
  cachedPath = path;
  return db;
}

export function transitDbExists(dbPath = resolveTransitDbPath()) {
  return existsSync(dbPath);
}

export function closeTransitDb() {
  if (!cachedDb) return;
  try {
    cachedDb.close();
  } finally {
    cachedDb = null;
    cachedPath = null;
  }
}

function jsonOrNull(value) {
  return value == null ? null : JSON.stringify(value);
}

function payloadHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** Add fields introduced after the initial transit schema without rebuilding the DB. */
function ensureTransitColumns(db) {
  const columns = (table) => new Set(
    db.prepare(`PRAGMA table_info(${table})`).all().map((row) => String(row.name)),
  );
  const additions = {
    transit_performance_observations: {
      bucket_end_at: "TEXT",
      source_generated_at: "TEXT",
      resolution_seconds: "INTEGER",
      user_availability: "REAL",
      first_attempt_availability: "REAL",
      is_partial: "INTEGER NOT NULL DEFAULT 0",
    },
    transit_stations: {
      recharge_ratio: "REAL",
      recharge_details_json: "TEXT",
      canonical_url: "TEXT",
      collector_kind: "TEXT",
      description: "TEXT",
      docs_url: "TEXT",
      logo_url: "TEXT",
      logo_local_path: "TEXT",
      monitoring_url: "TEXT",
      source_fingerprint: "TEXT",
      last_source_generated_at: "TEXT",
      config_json: "TEXT",
    },
    transit_groups: {
      description: "TEXT",
      warning: "TEXT",
      third_party_allowed: "INTEGER",
      supported_protocols_json: "TEXT",
      endpoint_overrides_json: "TEXT",
      raw_group_json: "TEXT",
    },
    transit_offers: {
      cache_write_1h_price: "REAL",
      discount_ratio: "REAL",
      discount_source: "TEXT",
      discount_basis: "TEXT",
      discount_details_json: "TEXT",
      status: "TEXT NOT NULL DEFAULT 'active'",
      cache_creation_price: "REAL",
      vendor_id: "INTEGER",
      vendor_name: "TEXT",
      quota_type: "INTEGER",
      billing_mode: "TEXT",
      model_price_min: "REAL",
      model_price_max: "REAL",
      image_ratio: "REAL",
      image_billing_json: "TEXT",
      tiers_json: "TEXT",
      supported_endpoint_types_json: "TEXT",
      base_price_json: "TEXT",
      effective_price_json: "TEXT",
      source_model_version: "TEXT",
      raw_offer_json: "TEXT",
    },
  };
  for (const [table, fields] of Object.entries(additions)) {
    const existing = columns(table);
    for (const [name, type] of Object.entries(fields)) {
      if (existing.has(name)) continue;
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
    }
  }
}

function idForGroup(stationId, groupKey) {
  return `${stationId}:${groupKey}`;
}

function idForOffer(groupId, rawModel, priceKind) {
  return `${groupId}:${rawModel}:${priceKind}`;
}

/** Upsert station metadata without changing listed_at after first insert. */
export function upsertTransitStation(db, station) {
  const now = station.updatedAt || new Date().toISOString();
  const listedAt = station.listedAt || now;
  const id = String(station.id || "").trim();
  if (!id) throw new Error("transit station id is required");
  db.prepare(`
    INSERT INTO transit_stations
      (id, name, site_url, canonical_url, host, system, source_type, collector_kind, status, listed_at,
       description, docs_url, logo_url, logo_local_path, monitoring_url, source_fingerprint,
       last_source_generated_at, last_seen_at, last_collected_at, last_collect_ok, risk_note,
       config_json, raw_meta_json, recharge_ratio, recharge_details_json, updated_at)
    VALUES
      (@id, @name, @site_url, @canonical_url, @host, @system, @source_type, @collector_kind, @status, @listed_at,
       @description, @docs_url, @logo_url, @logo_local_path, @monitoring_url, @source_fingerprint,
       @last_source_generated_at, @last_seen_at, @last_collected_at, @last_collect_ok, @risk_note,
       @config_json, @raw_meta_json, @recharge_ratio, @recharge_details_json, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      site_url = excluded.site_url,
      canonical_url = COALESCE(excluded.canonical_url, transit_stations.canonical_url),
      host = excluded.host,
      system = excluded.system,
      source_type = excluded.source_type,
      collector_kind = COALESCE(excluded.collector_kind, transit_stations.collector_kind),
      status = CASE
        WHEN excluded.status = 'candidate'
          AND transit_stations.status IN ('published', 'paused', 'dead')
        THEN transit_stations.status
        ELSE excluded.status
      END,
      description = COALESCE(excluded.description, transit_stations.description),
      docs_url = COALESCE(excluded.docs_url, transit_stations.docs_url),
      logo_url = COALESCE(excluded.logo_url, transit_stations.logo_url),
      logo_local_path = COALESCE(excluded.logo_local_path, transit_stations.logo_local_path),
      monitoring_url = COALESCE(excluded.monitoring_url, transit_stations.monitoring_url),
      source_fingerprint = COALESCE(excluded.source_fingerprint, transit_stations.source_fingerprint),
      last_source_generated_at = COALESCE(excluded.last_source_generated_at, transit_stations.last_source_generated_at),
      last_seen_at = COALESCE(excluded.last_seen_at, transit_stations.last_seen_at),
      last_collected_at = COALESCE(excluded.last_collected_at, transit_stations.last_collected_at),
      last_collect_ok = COALESCE(excluded.last_collect_ok, transit_stations.last_collect_ok),
      risk_note = COALESCE(excluded.risk_note, transit_stations.risk_note),
      config_json = COALESCE(excluded.config_json, transit_stations.config_json),
      raw_meta_json = COALESCE(excluded.raw_meta_json, transit_stations.raw_meta_json),
      recharge_ratio = CASE WHEN @clear_recharge=1 THEN NULL ELSE COALESCE(excluded.recharge_ratio, transit_stations.recharge_ratio) END,
      recharge_details_json = CASE WHEN @clear_recharge=1 THEN NULL ELSE COALESCE(excluded.recharge_details_json, transit_stations.recharge_details_json) END,
      updated_at = excluded.updated_at
  `).run({
    id,
    name: String(station.name || id),
    site_url: String(station.siteUrl || ""),
    canonical_url: station.canonicalUrl || station.siteUrl || null,
    host: String(station.host || ""),
    system: String(station.system || "custom"),
    source_type: String(station.sourceType || "manual"),
    collector_kind: station.collectorKind || null,
    status: String(station.status || "candidate"),
    listed_at: listedAt,
    description: station.description || null,
    docs_url: station.docsUrl || null,
    logo_url: station.logoUrl || null,
    logo_local_path: station.logoLocalPath || null,
    monitoring_url: station.monitoringUrl || null,
    source_fingerprint: station.sourceFingerprint || null,
    last_source_generated_at: station.lastSourceGeneratedAt || null,
    last_seen_at: station.lastSeenAt || null,
    last_collected_at: station.lastCollectedAt || null,
    last_collect_ok: station.lastCollectOk == null ? null : station.lastCollectOk ? 1 : 0,
    risk_note: station.riskNote || null,
    config_json: jsonOrNull(station.config),
    raw_meta_json: jsonOrNull(station.rawMeta),
    recharge_ratio: station.recharge?.ratioCnyPerCredit ?? null,
    recharge_details_json: jsonOrNull(station.recharge),
    clear_recharge: station.recharge === null ? 1 : 0,
    updated_at: now,
  });
  return id;
}

/** Upsert current group and offer rows, while appending immutable observations. */
export function upsertTransitCollection(db, input) {
  const station = input.station;
  const run = input.run;
  const groups = Array.isArray(input.groups) ? input.groups : [];
  const offers = Array.isArray(input.offers) ? input.offers : [];
  const observedAt = input.observedAt || new Date().toISOString();
  const updatedAt = input.updatedAt || observedAt;
  let persistedOffers = 0;

  const tx = db.transaction(() => {
    upsertTransitStation(db, {
      ...station,
      lastSeenAt: run.status === "success" ? observedAt : null,
      lastCollectedAt: updatedAt,
      lastCollectOk: run.status === "success" ? true : run.status === "failed" ? false : null,
      updatedAt,
    });

    const groupIds = new Set();
    const upsertGroup = db.prepare(`
      INSERT INTO transit_groups
        (id, station_id, group_key, display_name, recharge_ratio, model_ratio, completion_ratio,
         cache_read_ratio, cache_write_ratio, pool_type, subscription, channel_type, disclosure,
         description, warning, third_party_allowed, supported_protocols_json,
         endpoint_overrides_json, raw_group_json, status, observed_at, updated_at)
      VALUES
        (@id, @station_id, @group_key, @display_name, @recharge_ratio, @model_ratio, @completion_ratio,
         @cache_read_ratio, @cache_write_ratio, @pool_type, @subscription, @channel_type, @disclosure,
         @description, @warning, @third_party_allowed, @supported_protocols_json,
         @endpoint_overrides_json, @raw_group_json, @status, @observed_at, @updated_at)
      ON CONFLICT(station_id, group_key) DO UPDATE SET
        display_name = excluded.display_name,
        recharge_ratio = excluded.recharge_ratio,
        model_ratio = excluded.model_ratio,
        completion_ratio = excluded.completion_ratio,
        cache_read_ratio = excluded.cache_read_ratio,
        cache_write_ratio = excluded.cache_write_ratio,
        pool_type = excluded.pool_type,
        subscription = excluded.subscription,
        channel_type = excluded.channel_type,
        disclosure = excluded.disclosure,
        description = COALESCE(excluded.description, transit_groups.description),
        warning = COALESCE(excluded.warning, transit_groups.warning),
        third_party_allowed = COALESCE(excluded.third_party_allowed, transit_groups.third_party_allowed),
        supported_protocols_json = COALESCE(excluded.supported_protocols_json, transit_groups.supported_protocols_json),
        endpoint_overrides_json = COALESCE(excluded.endpoint_overrides_json, transit_groups.endpoint_overrides_json),
        raw_group_json = COALESCE(excluded.raw_group_json, transit_groups.raw_group_json),
        status = excluded.status,
        observed_at = excluded.observed_at,
        updated_at = excluded.updated_at
    `);
    for (const group of groups) {
      const groupKey = String(group.groupKey || group.name || "default").trim();
      const id = idForGroup(station.id, groupKey);
      groupIds.add(id);
      upsertGroup.run({
        id,
        station_id: station.id,
        group_key: groupKey,
        display_name: String(group.displayName || group.name || groupKey),
        recharge_ratio: group.rechargeRatio ?? null,
        model_ratio: group.modelRatio ?? null,
        completion_ratio: group.completionRatio ?? null,
        cache_read_ratio: group.cacheReadRatio ?? null,
        cache_write_ratio: group.cacheWriteRatio ?? null,
        pool_type: group.poolType || null,
        subscription: group.subscription || null,
        channel_type: group.channelType || null,
        disclosure: group.disclosure || null,
        description: group.description || null,
        warning: group.warning || null,
        third_party_allowed: group.thirdPartyAllowed == null ? null : group.thirdPartyAllowed ? 1 : 0,
        supported_protocols_json: jsonOrNull(group.supportedProtocols),
        endpoint_overrides_json: jsonOrNull(group.endpointOverrides),
        raw_group_json: jsonOrNull(group.rawGroup || group.raw),
        status: String(group.status || "active"),
        observed_at: group.observedAt || observedAt,
        updated_at: updatedAt,
      });
    }

    const offerById = new Map();
    const upsertOffer = db.prepare(`
      INSERT INTO transit_offers
        (id, group_id, raw_model, standard_model, family, modality, price_kind,
         input_price, output_price, cache_read_price, cache_write_price, cache_write_1h_price, cache_creation_price, fixed_price,
         price_unit, currency, composite_multiplier, vendor_id, vendor_name, quota_type, billing_mode,
         model_price_min, model_price_max, image_ratio, image_billing_json, tiers_json,
         supported_endpoint_types_json, base_price_json, effective_price_json, source_model_version,
         source_url, raw_offer_hash, raw_offer_json, discount_ratio, discount_source, discount_basis, discount_details_json, observed_at, updated_at)
      VALUES
        (@id, @group_id, @raw_model, @standard_model, @family, @modality, @price_kind,
         @input_price, @output_price, @cache_read_price, @cache_write_price, @cache_write_1h_price, @cache_creation_price, @fixed_price,
         @price_unit, @currency, @composite_multiplier, @vendor_id, @vendor_name, @quota_type, @billing_mode,
         @model_price_min, @model_price_max, @image_ratio, @image_billing_json, @tiers_json,
         @supported_endpoint_types_json, @base_price_json, @effective_price_json, @source_model_version,
         @source_url, @raw_offer_hash, @raw_offer_json, @discount_ratio, @discount_source, @discount_basis, @discount_details_json, @observed_at, @updated_at)
      ON CONFLICT(group_id, raw_model, price_kind) DO UPDATE SET
        standard_model = excluded.standard_model,
        family = excluded.family,
        modality = excluded.modality,
        input_price = excluded.input_price,
        output_price = excluded.output_price,
        cache_read_price = excluded.cache_read_price,
        cache_write_price = excluded.cache_write_price,
        cache_write_1h_price = excluded.cache_write_1h_price,
        cache_creation_price = COALESCE(excluded.cache_creation_price, transit_offers.cache_creation_price),
        fixed_price = excluded.fixed_price,
        price_unit = excluded.price_unit,
        currency = excluded.currency,
        composite_multiplier = excluded.composite_multiplier,
        vendor_id = COALESCE(excluded.vendor_id, transit_offers.vendor_id),
        vendor_name = COALESCE(excluded.vendor_name, transit_offers.vendor_name),
        quota_type = COALESCE(excluded.quota_type, transit_offers.quota_type),
        billing_mode = COALESCE(excluded.billing_mode, transit_offers.billing_mode),
        model_price_min = COALESCE(excluded.model_price_min, transit_offers.model_price_min),
        model_price_max = COALESCE(excluded.model_price_max, transit_offers.model_price_max),
        image_ratio = COALESCE(excluded.image_ratio, transit_offers.image_ratio),
        image_billing_json = COALESCE(excluded.image_billing_json, transit_offers.image_billing_json),
        tiers_json = COALESCE(excluded.tiers_json, transit_offers.tiers_json),
        supported_endpoint_types_json = COALESCE(excluded.supported_endpoint_types_json, transit_offers.supported_endpoint_types_json),
        base_price_json = COALESCE(excluded.base_price_json, transit_offers.base_price_json),
        effective_price_json = COALESCE(excluded.effective_price_json, transit_offers.effective_price_json),
        source_model_version = COALESCE(excluded.source_model_version, transit_offers.source_model_version),
        source_url = excluded.source_url,
        raw_offer_hash = excluded.raw_offer_hash,
        raw_offer_json = COALESCE(excluded.raw_offer_json, transit_offers.raw_offer_json),
        discount_ratio = excluded.discount_ratio,
        discount_source = excluded.discount_source,
        discount_basis = excluded.discount_basis,
        discount_details_json = excluded.discount_details_json,
        observed_at = excluded.observed_at,
        updated_at = excluded.updated_at
    `);
    const insertObservation = db.prepare(`
      INSERT OR IGNORE INTO transit_offer_observations
        (offer_id, run_id, observed_at, payload_json, raw_offer_hash)
      VALUES (@offer_id, @run_id, @observed_at, @payload_json, @raw_offer_hash)
    `);
    for (const offer of offers) {
      const groupKey = String(offer.groupKey || offer.group || "default").trim();
      const groupId = idForGroup(station.id, groupKey);
      if (!groupIds.has(groupId)) continue;
      const rawModel = String(offer.rawModel || offer.model || "").trim();
      if (!rawModel) continue;
      const priceKind = String(offer.priceKind || (offer.modality && offer.modality !== "text" ? "fixed" : "token"));
      const id = idForOffer(groupId, rawModel, priceKind);
      const rawHash = String(offer.rawOfferHash || payloadHash(offer));
      upsertOffer.run({
        id,
        group_id: groupId,
        raw_model: rawModel,
        standard_model: offer.standardModel || null,
        family: offer.family || null,
        modality: offer.modality || "text",
        price_kind: priceKind,
        input_price: offer.inputPrice ?? null,
        output_price: offer.outputPrice ?? null,
        cache_read_price: offer.cacheReadPrice ?? null,
        cache_write_price: offer.cacheWritePrice ?? null,
        cache_write_1h_price: offer.cacheWrite1hPrice ?? null,
        cache_creation_price: offer.cacheCreationPrice ?? null,
        fixed_price: offer.fixedPrice ?? null,
        price_unit: offer.priceUnit || null,
        currency: offer.currency || "USD",
        composite_multiplier: offer.compositeMultiplier ?? null,
        discount_ratio: offer.discount?.ratio ?? null,
        discount_source: offer.discount?.source ?? null,
        discount_basis: offer.discount?.basis ?? null,
        discount_details_json: jsonOrNull(offer.discount?.details),
        vendor_id: offer.vendorId ?? null,
        vendor_name: offer.vendorName || null,
        quota_type: offer.quotaType ?? null,
        billing_mode: offer.billingMode || null,
        model_price_min: offer.modelPriceMin ?? null,
        model_price_max: offer.modelPriceMax ?? null,
        image_ratio: offer.imageRatio ?? null,
        image_billing_json: jsonOrNull(offer.imageBilling),
        tiers_json: jsonOrNull(offer.tiers),
        supported_endpoint_types_json: jsonOrNull(offer.supportedEndpointTypes),
        base_price_json: jsonOrNull(offer.basePrice),
        effective_price_json: jsonOrNull(offer.effectivePrice),
        source_model_version: offer.sourceModelVersion || null,
        source_url: offer.sourceUrl || null,
        raw_offer_hash: rawHash,
        raw_offer_json: JSON.stringify(offer.rawOffer || offer),
        observed_at: offer.observedAt || observedAt,
        updated_at: updatedAt,
      });
      offerById.set(id, offer);
      insertObservation.run({
        offer_id: id,
        run_id: run.runId,
        observed_at: offer.observedAt || observedAt,
        payload_json: JSON.stringify(offer),
        raw_offer_hash: rawHash,
      });
    }
    persistedOffers = offerById.size;

    // Only an explicitly complete, validated response can withdraw unseen rows.
    // Preserve their observations; failure/partial results never retire last-good.
    if (input.collectionComplete === true && run.status === "success" && offers.length > 0) {
      for (const row of db.prepare(`SELECT o.id FROM transit_offers o JOIN transit_groups g ON g.id=o.group_id WHERE g.station_id=?`).all(station.id)) {
        db.prepare("UPDATE transit_offers SET status=? WHERE id=?").run(offerById.has(row.id) ? "active" : "withdrawn", row.id);
      }
      for (const row of db.prepare("SELECT id FROM transit_groups WHERE station_id=?").all(station.id)) {
        if (!groupIds.has(row.id)) db.prepare("UPDATE transit_groups SET status='withdrawn' WHERE id=?").run(row.id);
      }
    }

    db.prepare(`
      INSERT INTO transit_collection_runs
        (run_id, station_id, collector_kind, stage, status, http_status, started_at, finished_at,
         source_generated_at, offer_count, raw_snapshot_path, error_code, error_message)
      VALUES
        (@run_id, @station_id, @collector_kind, @stage, @status, @http_status, @started_at, @finished_at,
         @source_generated_at, @offer_count, @raw_snapshot_path, @error_code, @error_message)
      ON CONFLICT(run_id) DO UPDATE SET
        status = excluded.status,
        http_status = excluded.http_status,
        finished_at = excluded.finished_at,
        source_generated_at = excluded.source_generated_at,
        offer_count = excluded.offer_count,
        raw_snapshot_path = excluded.raw_snapshot_path,
        error_code = excluded.error_code,
        error_message = excluded.error_message
    `).run({
      run_id: run.runId,
      station_id: station.id,
      collector_kind: String(run.collectorKind || "unknown"),
      stage: String(run.stage || "pricing"),
      status: String(run.status || "success"),
      http_status: run.httpStatus ?? null,
      started_at: run.startedAt || updatedAt,
      finished_at: run.finishedAt || updatedAt,
      source_generated_at: run.sourceGeneratedAt || null,
      offer_count: offerById.size,
      raw_snapshot_path: run.rawSnapshotPath || null,
      error_code: run.errorCode || null,
      error_message: run.errorMessage || null,
    });
  });
  tx();
  return { groups: groups.length, offers: persistedOffers };
}

/** Preserve the exact public response (JSON or HTML) for later re-parsing. */
export function recordTransitSourceSnapshot(db, snapshot) {
  const text = String(snapshot.payloadText ?? "");
  const hash = String(snapshot.payloadHash || createHash("sha256").update(text).digest("hex"));
  const result = db.prepare(`
    INSERT OR IGNORE INTO transit_source_snapshots
      (station_id, run_id, source_kind, source_url, http_status, content_type, etag, last_modified,
       source_generated_at, captured_at, payload_hash, payload_path, payload_text, parse_status,
       error_code, error_message)
    VALUES
      (@station_id, @run_id, @source_kind, @source_url, @http_status, @content_type, @etag, @last_modified,
       @source_generated_at, @captured_at, @payload_hash, @payload_path, @payload_text, @parse_status,
       @error_code, @error_message)
  `).run({
    station_id: snapshot.stationId,
    run_id: snapshot.runId || null,
    source_kind: String(snapshot.sourceKind || "unknown"),
    source_url: String(snapshot.sourceUrl || ""),
    http_status: snapshot.httpStatus ?? null,
    content_type: snapshot.contentType || null,
    etag: snapshot.etag || null,
    last_modified: snapshot.lastModified || null,
    source_generated_at: snapshot.sourceGeneratedAt || null,
    captured_at: snapshot.capturedAt || new Date().toISOString(),
    payload_hash: hash,
    payload_path: snapshot.payloadPath || null,
    payload_text: text,
    parse_status: String(snapshot.parseStatus || "captured"),
    error_code: snapshot.errorCode || null,
    error_message: snapshot.errorMessage || null,
  });
  return { inserted: result.changes === 1, payloadHash: hash };
}

export function upsertTransitPerformance(db, input) {
  const rows = Array.isArray(input.rows) ? input.rows : [];
  if (!rows.length) return 0;
  let written = 0;
  const stmt = db.prepare(`
    INSERT INTO transit_performance_observations
      (station_id, model_name, group_key, bucket_at, avg_ttft_ms, avg_latency_ms,
       success_rate, avg_tps, has_data, window_hours, source_url, source_schema, observed_at,
       bucket_end_at,source_generated_at,resolution_seconds,user_availability,first_attempt_availability,is_partial)
    VALUES (@station_id, @model_name, @group_key, @bucket_at, @avg_ttft_ms, @avg_latency_ms,
      @success_rate, @avg_tps, @has_data, @window_hours, @source_url, @source_schema, @observed_at,
      @bucket_end_at,@source_generated_at,@resolution_seconds,@user_availability,@first_attempt_availability,@is_partial)
    ON CONFLICT(station_id, model_name, group_key, bucket_at, window_hours) DO UPDATE SET
      avg_ttft_ms=excluded.avg_ttft_ms, avg_latency_ms=excluded.avg_latency_ms,
      success_rate=excluded.success_rate, avg_tps=excluded.avg_tps,
      has_data=excluded.has_data, source_url=excluded.source_url,
      source_schema=excluded.source_schema, observed_at=excluded.observed_at,
      bucket_end_at=excluded.bucket_end_at,source_generated_at=excluded.source_generated_at,
      resolution_seconds=excluded.resolution_seconds,user_availability=excluded.user_availability,
      first_attempt_availability=excluded.first_attempt_availability,is_partial=excluded.is_partial
    WHERE (transit_performance_observations.source_generated_at IS NULL
      OR excluded.source_generated_at>=transit_performance_observations.source_generated_at)
      AND (transit_performance_observations.is_partial=1 OR excluded.is_partial=0)
  `);
  const tx = db.transaction(() => {
    for (const row of rows) written += stmt.run({
      station_id: input.stationId,
      model_name: row.modelName,
      group_key: row.groupKey,
      bucket_at: row.bucketAt,
      avg_ttft_ms: row.avgTtftMs ?? null,
      avg_latency_ms: row.avgLatencyMs ?? null,
      success_rate: row.successRate ?? null,
      avg_tps: row.avgTps ?? null,
      has_data: row.hasData === false ? 0 : 1,
      window_hours: input.windowHours ?? 360,
      source_url: input.sourceUrl,
      source_schema: input.sourceSchema ?? null,
      observed_at: input.observedAt ?? new Date().toISOString(),
      bucket_end_at: row.bucketEndAt ?? null,
      source_generated_at: input.sourceGeneratedAt ?? null,
      resolution_seconds: row.resolutionSeconds ?? null,
      user_availability: row.userAvailability ?? null,
      first_attempt_availability: row.firstAttemptAvailability ?? null,
      is_partial: row.isPartial ? 1 : 0,
    }).changes;
  });
  tx();
  return written;
}

export function exportTransitSnapshot(db, outputPath = resolveTransitSnapshotPath()) {
  return db.transaction(() => {
  // Explicit public projection: never ship collector configs or raw payloads.
  const stations = db.prepare(`
    SELECT id,name,site_url,canonical_url,host,system,collector_kind,source_type,status,listed_at,
      description,docs_url,logo_url,logo_local_path,recharge_ratio,recharge_details_json,last_seen_at,last_collected_at,last_collect_ok,risk_note
    FROM transit_stations WHERE status = 'published'
    ORDER BY name COLLATE NOCASE, id
  `).all();
  for (const station of stations) {
    const raw = db.prepare("SELECT raw_meta_json FROM transit_stations WHERE id=?").get(station.id)?.raw_meta_json;
    try {
      const meta=JSON.parse(raw??"{}");
      if (meta.service && typeof meta.service.allowSignup === "boolean" && typeof meta.service.allowTopup === "boolean")
        station.service_state={allowSignup:meta.service.allowSignup,allowTopup:meta.service.allowTopup,observedAt:meta.service.observedAt};
      if(meta.groupOrigin === "synthetic_public_catalog") station.catalog_only=true;
      if(meta.currencyKind === "usd_cash") station.currency_kind="usd_cash";
    } catch { /* Never export raw collector metadata. */ }
  }
  const groups = db.prepare(`
    SELECT g.* FROM transit_groups g JOIN transit_stations s ON s.id=g.station_id
    WHERE g.status = 'active' AND s.status='published'
    ORDER BY g.station_id, g.display_name COLLATE NOCASE, g.id
  `).all();
  const offers = db.prepare(`
      SELECT o.* FROM transit_offers o JOIN transit_groups g ON g.id=o.group_id
      JOIN transit_stations s ON s.id=g.station_id
    WHERE o.status='active' AND g.status='active' AND s.status='published'
    ORDER BY o.group_id, o.standard_model COLLATE NOCASE, o.raw_model COLLATE NOCASE
  `).all();
  for (const g of groups) { delete g.raw_group_json; delete g.endpoint_overrides_json; }
  for (const o of offers) { delete o.raw_offer_json; delete o.base_price_json; }
  const performanceNow = Date.now();
  const performanceRows = db.prepare(`
    SELECT station_id,model_name,group_key,bucket_at,avg_ttft_ms,avg_latency_ms,
      success_rate,avg_tps,has_data,window_hours,source_url,source_schema,observed_at,
      bucket_end_at,source_generated_at,resolution_seconds,is_partial
    FROM transit_performance_observations
    WHERE station_id IN (SELECT id FROM transit_stations WHERE status='published')
      AND (window_hours=360 OR (window_hours=24 AND resolution_seconds=3600 AND is_partial=0)) AND bucket_at>=?
    ORDER BY station_id,bucket_at,model_name,group_key
  `).all(new Date(Math.floor(performanceNow/3600000)*3600000-359*3600000).toISOString());
  // Export only compact, pre-aggregated public series, never tens of thousands of raw rows.
  const performance = stations.map(s => {
    const capabilities = { ttft: s.collector_kind !== "rightapi_v1", latency: s.collector_kind !== "rightapi_v1", throughput: s.collector_kind !== "rightapi_v1" };
    const rows=performanceRows.filter(r=>r.station_id===s.id);
    const stationGroups=groups.filter(g=>g.station_id===s.id);
    const ownGroupIds=new Set(stationGroups.map(g=>g.id));
    const modelNames=[...new Set(offers.filter(o=>ownGroupIds.has(o.group_id)).map(o=>o.raw_model))];
    if (s.collector_kind === "zetaapi_v1") return buildZetaPerformance(db,s.id,modelNames,{now:performanceNow});
    const rowsByModel=new Map();
    for(const row of rows){const bucket=rowsByModel.get(row.model_name)??[];bucket.push(row);rowsByModel.set(row.model_name,bucket);}
    return {stationId:s.id,
      station:{...buildPerformanceMonitor(rows,{now:performanceNow}),capabilities,scope:{stationId:s.id,groupKey:null}},
      groups:Object.fromEntries(stationGroups.map(g=>[g.group_key,{...buildPerformanceMonitor(rows,{now:performanceNow,groupKey:g.group_key}),capabilities,scope:{stationId:s.id,groupKey:g.group_key}}])),
      models:Object.fromEntries(modelNames.map(modelName=>[modelName,{
        ...buildPerformanceMonitor(rowsByModel.get(modelName)??[],{now:performanceNow,modelName}),
        capabilities,
        scope:{stationId:s.id,groupKey:null,modelName},
      }])),
    };
  });
  const snapshot = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: "transit.sqlite",
    stations,
    groups,
    offers,
    performance,
    stats: {
      stationCount: stations.length,
      groupCount: groups.length,
      offerCount: offers.length,
    },
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  const tmp = `${outputPath}.tmp-${process.pid}`;
  if(existsSync(outputPath)) {
    try {
      const previous=JSON.parse(readFileSync(outputPath,"utf8"));
      if(JSON.stringify({...previous,generatedAt:null})===JSON.stringify({...snapshot,generatedAt:null})) return outputPath;
    } catch { /* replace corrupt snapshot from SQLite */ }
  }
  writeFileSync(tmp, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  if (existsSync(outputPath)) {
    try {
      const previous=JSON.parse(readFileSync(outputPath,"utf8"));
      if (previous.schemaVersion===1 && Array.isArray(previous.stations)) copyFileSync(outputPath,`${outputPath}.last-good`);
    } catch { /* retain existing last-good */ }
  }
  renameSync(tmp, outputPath);
  return outputPath;
  }).immediate();
}

export function loadTransitSnapshotFromDisk(path = resolveTransitSnapshotPath()) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}
