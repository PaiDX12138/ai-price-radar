/**
 * SQLite shop archive (source of truth for shop registry).
 * Offers stay in data/raw + catalog JSON — this DB is shops only.
 *
 * listed_at: set once on INSERT, never overwritten by upsert.
 */
import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const DEFAULT_SHOPS_DB_PATH = join(root, "data", "shops.sqlite");

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  collector_kind TEXT NOT NULL,
  base_url TEXT,
  shop_url TEXT,
  shop_token TEXT,
  shop_no TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  submitted_by TEXT NOT NULL DEFAULT 'seed',
  source TEXT NOT NULL DEFAULT 'self',
  listed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_probe_at TEXT,
  last_probe_ok INTEGER,
  last_error TEXT,
  disabled_reason TEXT,
  note TEXT,
  meta_json TEXT,
  next_collect_at TEXT,
  fail_count INTEGER NOT NULL DEFAULT 0,
  lease_owner TEXT,
  lease_until TEXT,
  last_collect_at TEXT,
  last_collect_ok INTEGER,
  channel_index INTEGER
);

CREATE INDEX IF NOT EXISTS idx_shops_kind_enabled ON shops(collector_kind, enabled);
CREATE INDEX IF NOT EXISTS idx_shops_platform ON shops(platform);
CREATE INDEX IF NOT EXISTS idx_shops_listed_at ON shops(listed_at);

CREATE TABLE IF NOT EXISTS shop_probe_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id TEXT,
  input_url TEXT NOT NULL,
  ok INTEGER NOT NULL,
  detected_kind TEXT,
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shop_probe_runs_input_url
  ON shop_probe_runs(input_url, ok);
`;

/** Success → next collect in 30 minutes. */
export const COLLECT_SUCCESS_INTERVAL_MS = 30 * 60 * 1000;
/** Lease held while a worker collects one shop. */
export const COLLECT_LEASE_MS = 10 * 60 * 1000;
/** Fail backoff ladder (capped at last). */
export const COLLECT_FAIL_BACKOFF_MS = [
  5 * 60 * 1000,
  15 * 60 * 1000,
  30 * 60 * 1000,
  60 * 60 * 1000,
  2 * 60 * 60 * 1000,
  6 * 60 * 60 * 1000,
];

const SCHEDULE_COLS = [
  "next_collect_at",
  "fail_count",
  "lease_owner",
  "lease_until",
  "last_collect_at",
  "last_collect_ok",
  "channel_index",
];

/**
 * Stable non-negative hash for channel affinity.
 * @param {string} id
 */
export function hashShopId(id) {
  let h = 0;
  const s = String(id || "");
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * @param {number} failCount
 */
export function collectFailBackoffMs(failCount) {
  const n = Math.max(1, Math.trunc(Number(failCount) || 1));
  const idx = Math.min(n - 1, COLLECT_FAIL_BACKOFF_MS.length - 1);
  return COLLECT_FAIL_BACKOFF_MS[idx];
}

/**
 * @param {number} [ms]
 */
function isoAfter(ms = 0) {
  return new Date(Date.now() + ms).toISOString();
}

/** Shop origin: self = 自有发现, user = 用户提交, import = 批量导入 */
export const SHOP_SOURCES = ["self", "user", "import"];

/**
 * @param {unknown} value
 */
function normalizeShopSource(value) {
  const v = String(value || "").trim().toLowerCase();
  // 兼容旧库残留别名
  if (v === "mirror") return "import";
  return SHOP_SOURCES.includes(v) ? v : null;
}

/**
 * Bring older shops.sqlite files up to the current schema:
 * adds `source`, and drops NOT NULL from `base_url` (unsupported shops may have no URL).
 * @param {import('better-sqlite3').Database} db
 */
function migrateShopsSchema(db) {
  const cols = db.prepare("PRAGMA table_info(shops)").all();
  const baseUrl = cols.find((c) => c.name === "base_url");
  if (baseUrl && baseUrl.notnull) {
    const names = cols.map((c) => c.name).join(", ");
    db.transaction(() => {
      db.exec("ALTER TABLE shops RENAME TO shops_old");
      db.exec(SCHEMA_SQL);
      db.exec(`INSERT INTO shops (${names}) SELECT ${names} FROM shops_old`);
      db.exec("DROP TABLE shops_old");
    })();
  }
  const after = db.prepare("PRAGMA table_info(shops)").all();
  const names = new Set(after.map((c) => c.name));
  if (!names.has("source")) {
    db.exec("ALTER TABLE shops ADD COLUMN source TEXT NOT NULL DEFAULT 'self'");
  }
  for (const col of SCHEDULE_COLS) {
    if (names.has(col)) continue;
    if (col === "fail_count") {
      db.exec("ALTER TABLE shops ADD COLUMN fail_count INTEGER NOT NULL DEFAULT 0");
    } else if (col === "channel_index" || col === "last_collect_ok") {
      db.exec(`ALTER TABLE shops ADD COLUMN ${col} INTEGER`);
    } else {
      db.exec(`ALTER TABLE shops ADD COLUMN ${col} TEXT`);
    }
  }
  // Indexes that require schedule columns (created only after ADD COLUMN).
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_shops_collect_due ON shops(enabled, status, next_collect_at)",
  );
  db.exec("CREATE INDEX IF NOT EXISTS idx_shops_lease_until ON shops(lease_until)");

  // Backfill next_collect_at; stagger by hash so startup does not spike.
  const due = db
    .prepare(
      `SELECT id, listed_at FROM shops
       WHERE next_collect_at IS NULL OR next_collect_at = ''`,
    )
    .all();
  if (due.length) {
    const upd = db.prepare(
      `UPDATE shops SET next_collect_at = @next WHERE id = @id`,
    );
    const now = Date.now();
    const tx = db.transaction(() => {
      for (const row of due) {
        const stagger = hashShopId(row.id) % (5 * 60 * 1000);
        const base = row.listed_at ? Date.parse(String(row.listed_at)) : NaN;
        const t = Number.isFinite(base) ? Math.min(base, now) : now;
        upd.run({ id: row.id, next: new Date(t + stagger).toISOString() });
      }
    });
    tx();
  }
}

/** @type {import('better-sqlite3').Database | null} */
let cachedDb = null;
/** @type {string | null} */
let cachedPath = null;

/**
 * @param {string} [dbPath]
 */
export function resolveShopsDbPath(dbPath) {
  return dbPath || process.env.SHOPS_DB_PATH || DEFAULT_SHOPS_DB_PATH;
}

/**
 * @param {string} [dbPath]
 * @param {{ readonly?: boolean }} [opts]
 */
export function openShopsDb(dbPath, opts = {}) {
  const path = resolveShopsDbPath(dbPath);
  if (cachedDb && cachedPath === path && !opts.readonly) {
    return cachedDb;
  }
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { readonly: Boolean(opts.readonly) && existsSync(path) });
  if (!opts.readonly) {
    db.pragma("journal_mode = WAL");
    db.exec(SCHEMA_SQL);
    migrateShopsSchema(db);
  }
  if (!opts.readonly) {
    cachedDb = db;
    cachedPath = path;
  }
  return db;
}

/**
 * @param {string} [dbPath]
 */
export function shopsDbExists(dbPath) {
  return existsSync(resolveShopsDbPath(dbPath));
}

/**
 * Fail-fast helper for collect CLIs.
 * @param {string} [dbPath]
 */
export function requireShopsDb(dbPath) {
  const path = resolveShopsDbPath(dbPath);
  if (!existsSync(path)) {
    throw new Error(
      `Missing shops DB at ${path}. Run: pnpm shops:migrate`,
    );
  }
  return openShopsDb(path);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} id
 */
export function getShop(db, id) {
  return db.prepare("SELECT * FROM shops WHERE id = ?").get(id) || null;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{
 *   collectorKind?: string,
 *   platform?: string,
 *   enabled?: boolean,
 *   excludeKinds?: string[],
 * }} [filter]
 */
export function listShops(db, filter = {}) {
  const clauses = [];
  const params = [];
  if (filter.collectorKind) {
    clauses.push("collector_kind = ?");
    params.push(filter.collectorKind);
  }
  if (filter.platform) {
    clauses.push("platform = ?");
    params.push(filter.platform);
  }
  if (filter.enabled === true) {
    clauses.push("enabled = 1");
  } else if (filter.enabled === false) {
    clauses.push("enabled = 0");
  }
  if (Array.isArray(filter.excludeKinds) && filter.excludeKinds.length) {
    clauses.push(`collector_kind NOT IN (${filter.excludeKinds.map(() => "?").join(",")})`);
    params.push(...filter.excludeKinds);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db.prepare(`SELECT * FROM shops ${where} ORDER BY listed_at ASC, id ASC`).all(...params);
}

/**
 * Map DB row → collector target shape used by collect scripts.
 * @param {Record<string, unknown>} row
 */
export function shopRowToCollectTarget(row) {
  const kind = String(row.collector_kind || "");
  return {
    id: String(row.id),
    name: String(row.name || row.id),
    platform: String(row.platform || ""),
    collectorKind: kind,
    kind,
    baseUrl: String(row.base_url || ""),
    sourceUrl: row.shop_url ? String(row.shop_url) : String(row.base_url || ""),
    shopUrl: row.shop_url ? String(row.shop_url) : null,
    shopToken: row.shop_token ? String(row.shop_token) : undefined,
    shopNo: row.shop_no ? String(row.shop_no) : undefined,
    enabled: Number(row.enabled) === 1,
    status: String(row.status || "active"),
    listedAt: String(row.listed_at || ""),
    submittedBy: String(row.submitted_by || "seed"),
    source: String(row.source || "self"),
    note: row.note ? String(row.note) : undefined,
    disabledReason: row.disabled_reason ? String(row.disabled_reason) : undefined,
    nextCollectAt: row.next_collect_at ? String(row.next_collect_at) : null,
    failCount: Number(row.fail_count) || 0,
    channelIndex:
      row.channel_index === null || row.channel_index === undefined
        ? null
        : Number(row.channel_index),
    host: (() => {
      try {
        return new URL(String(row.base_url || row.shop_url || "")).host;
      } catch {
        return "";
      }
    })(),
  };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {object} shop
 * @param {{ forceRefreshMeta?: boolean }} [opts]
 * @returns {{ action: 'inserted'|'skipped'|'updated', id: string, listedAt: string }}
 */
export function insertShop(db, shop, opts = {}) {
  const now = new Date().toISOString();
  const id = String(shop.id || "").trim();
  if (!id) throw new Error("insertShop requires id");

  const existing = getShop(db, id);
  if (existing) {
    if (opts.forceRefreshMeta) {
      db.prepare(
        `UPDATE shops SET
          name = @name,
          platform = @platform,
          collector_kind = @collector_kind,
          base_url = @base_url,
          shop_url = @shop_url,
          shop_token = @shop_token,
          shop_no = @shop_no,
          enabled = @enabled,
          status = @status,
          submitted_by = COALESCE(submitted_by, @submitted_by),
          source = @source,
          updated_at = @updated_at,
          disabled_reason = @disabled_reason,
          note = @note,
          meta_json = @meta_json
        WHERE id = @id`,
      ).run({
        id,
        name: String(shop.name || existing.name),
        platform: String(shop.platform || existing.platform),
        collector_kind: String(shop.collector_kind || shop.collectorKind || existing.collector_kind),
        base_url: shop.base_url || shop.baseUrl || existing.base_url || null,
        shop_url: shop.shop_url ?? shop.shopUrl ?? existing.shop_url,
        shop_token: shop.shop_token ?? shop.shopToken ?? existing.shop_token,
        shop_no: shop.shop_no ?? shop.shopNo ?? existing.shop_no,
        enabled: shop.enabled === false || shop.enabled === 0 ? 0 : 1,
        status: String(shop.status || existing.status || "active"),
        submitted_by: String(shop.submitted_by || shop.submittedBy || existing.submitted_by || "seed"),
        source: normalizeShopSource(shop.source) || existing.source || "self",
        updated_at: now,
        disabled_reason: shop.disabled_reason ?? shop.disabledReason ?? existing.disabled_reason,
        note: shop.note ?? existing.note,
        meta_json:
          shop.meta_json ??
          (shop.meta ? JSON.stringify(shop.meta) : existing.meta_json),
      });
      return { action: "updated", id, listedAt: String(existing.listed_at) };
    }
    return { action: "skipped", id, listedAt: String(existing.listed_at) };
  }

  const listedAt = String(shop.listed_at || shop.listedAt || now);
  const metaJson =
    shop.meta_json ??
    (shop.meta ? JSON.stringify(shop.meta) : null);

  const stagger = hashShopId(id) % (5 * 60 * 1000);
  const nextCollectAt = String(
    shop.next_collect_at || shop.nextCollectAt || new Date(Date.now() + stagger).toISOString(),
  );

  db.prepare(
    `INSERT INTO shops (
      id, name, platform, collector_kind, base_url, shop_url, shop_token, shop_no,
      enabled, status, submitted_by, source, listed_at, updated_at,
      last_probe_at, last_probe_ok, last_error, disabled_reason, note, meta_json,
      next_collect_at, fail_count, channel_index
    ) VALUES (
      @id, @name, @platform, @collector_kind, @base_url, @shop_url, @shop_token, @shop_no,
      @enabled, @status, @submitted_by, @source, @listed_at, @updated_at,
      @last_probe_at, @last_probe_ok, @last_error, @disabled_reason, @note, @meta_json,
      @next_collect_at, @fail_count, @channel_index
    )`,
  ).run({
    id,
    name: String(shop.name || id),
    platform: String(shop.platform || ""),
    collector_kind: String(shop.collector_kind || shop.collectorKind || ""),
    base_url: shop.base_url || shop.baseUrl || null,
    shop_url: shop.shop_url ?? shop.shopUrl ?? null,
    shop_token: shop.shop_token ?? shop.shopToken ?? null,
    shop_no: shop.shop_no ?? shop.shopNo ?? null,
    enabled: shop.enabled === false || shop.enabled === 0 ? 0 : 1,
    status: String(shop.status || (shop.enabled === false ? "disabled" : "active")),
    submitted_by: String(shop.submitted_by || shop.submittedBy || "seed"),
    source: normalizeShopSource(shop.source) || "self",
    listed_at: listedAt,
    updated_at: String(shop.updated_at || shop.updatedAt || now),
    last_probe_at: shop.last_probe_at ?? shop.lastProbeAt ?? null,
    last_probe_ok:
      shop.last_probe_ok === undefined && shop.lastProbeOk === undefined
        ? null
        : Number(shop.last_probe_ok ?? shop.lastProbeOk) ? 1 : 0,
    last_error: shop.last_error ?? shop.lastError ?? null,
    disabled_reason: shop.disabled_reason ?? shop.disabledReason ?? null,
    note: shop.note ?? null,
    meta_json: metaJson,
    next_collect_at: nextCollectAt,
    fail_count: Number(shop.fail_count ?? shop.failCount ?? 0) || 0,
    channel_index:
      shop.channel_index != null || shop.channelIndex != null
        ? Number(shop.channel_index ?? shop.channelIndex)
        : null,
  });

  return { action: "inserted", id, listedAt };
}

/**
 * Upsert without touching listed_at. Used after probe / collect health updates.
 * Inserts with listed_at=now when missing.
 * @param {import('better-sqlite3').Database} db
 * @param {object} shop
 */
export function upsertShop(db, shop) {
  const existing = getShop(db, String(shop.id || ""));
  if (!existing) {
    return insertShop(db, shop);
  }
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE shops SET
      name = COALESCE(@name, name),
      platform = COALESCE(@platform, platform),
      collector_kind = COALESCE(@collector_kind, collector_kind),
      base_url = COALESCE(@base_url, base_url),
      shop_url = COALESCE(@shop_url, shop_url),
      shop_token = COALESCE(@shop_token, shop_token),
      shop_no = COALESCE(@shop_no, shop_no),
      enabled = COALESCE(@enabled, enabled),
      status = COALESCE(@status, status),
      source = COALESCE(@source, source),
      updated_at = @updated_at,
      last_probe_at = COALESCE(@last_probe_at, last_probe_at),
      last_probe_ok = COALESCE(@last_probe_ok, last_probe_ok),
      last_error = @last_error,
      disabled_reason = COALESCE(@disabled_reason, disabled_reason),
      note = COALESCE(@note, note),
      meta_json = COALESCE(@meta_json, meta_json)
    WHERE id = @id`,
  ).run({
    id: existing.id,
    name: shop.name != null ? String(shop.name) : null,
    platform: shop.platform != null ? String(shop.platform) : null,
    collector_kind:
      shop.collector_kind != null || shop.collectorKind != null
        ? String(shop.collector_kind || shop.collectorKind)
        : null,
    base_url: shop.base_url != null || shop.baseUrl != null ? String(shop.base_url || shop.baseUrl) : null,
    shop_url: shop.shop_url != null || shop.shopUrl != null ? String(shop.shop_url || shop.shopUrl) : null,
    shop_token:
      shop.shop_token != null || shop.shopToken != null
        ? String(shop.shop_token || shop.shopToken)
        : null,
    shop_no: shop.shop_no != null || shop.shopNo != null ? String(shop.shop_no || shop.shopNo) : null,
    enabled:
      shop.enabled === undefined
        ? null
        : shop.enabled === false || shop.enabled === 0
          ? 0
          : 1,
    status: shop.status != null ? String(shop.status) : null,
    source: normalizeShopSource(shop.source),
    updated_at: now,
    last_probe_at: shop.last_probe_at ?? shop.lastProbeAt ?? null,
    last_probe_ok:
      shop.last_probe_ok === undefined && shop.lastProbeOk === undefined
        ? null
        : Number(shop.last_probe_ok ?? shop.lastProbeOk) ? 1 : 0,
    last_error:
      shop.last_error !== undefined || shop.lastError !== undefined
        ? (shop.last_error ?? shop.lastError)
        : null,
    disabled_reason:
      shop.disabled_reason != null || shop.disabledReason != null
        ? String(shop.disabled_reason || shop.disabledReason)
        : null,
    note: shop.note != null ? String(shop.note) : null,
    meta_json:
      shop.meta_json != null
        ? String(shop.meta_json)
        : shop.meta
          ? JSON.stringify(shop.meta)
          : null,
  });
  return { action: "updated", id: existing.id, listedAt: String(existing.listed_at) };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} shopId
 * @param {{ ok: boolean, error?: string | null, at?: string }} result
 */
/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} shopId
 * @param {{
 *   ok: boolean,
 *   error?: string | null,
 *   at?: string,
 *   displayState?: string | null,
 *   withdrawReason?: string | null,
 * }} result
 */
export function updateShopProbeHealth(db, shopId, result) {
  const at = result.at || new Date().toISOString();
  const displayState = String(result.displayState || "").trim();
  const resting = displayState === "dayang" ? 1 : 0;
  const error =
    result.ok && resting
      ? String(result.withdrawReason || "店铺已打样")
      : result.ok
        ? null
        : String(result.error || "probe failed");
  db.prepare(
    `UPDATE shops SET
      last_probe_at = @at,
      last_probe_ok = @ok,
      last_error = @error,
      updated_at = @at,
      status = CASE
        WHEN @resting = 1 AND enabled = 1 THEN 'resting'
        WHEN @ok = 1 AND enabled = 1 THEN 'active'
        WHEN @ok = 0 AND status = 'unsupported' THEN status
        WHEN @ok = 0 THEN 'probe_failed'
        ELSE status
      END
    WHERE id = @id`,
  ).run({
    id: shopId,
    at,
    ok: result.ok ? 1 : 0,
    resting,
    error,
  });
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ shopId?: string|null, inputUrl: string, ok: boolean, detectedKind?: string|null, error?: string|null }} run
 */
export function appendShopProbeRun(db, run) {
  const createdAt = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO shop_probe_runs (shop_id, input_url, ok, detected_kind, error, created_at)
       VALUES (@shop_id, @input_url, @ok, @detected_kind, @error, @created_at)`,
    )
    .run({
      shop_id: run.shopId || null,
      input_url: String(run.inputUrl || ""),
      ok: run.ok ? 1 : 0,
      detected_kind: run.detectedKind || null,
      error: run.error || null,
      created_at: createdAt,
    });
  return { id: Number(info.lastInsertRowid), createdAt };
}

/**
 * Find a prior successful submit/probe by normalized input URL.
 * @param {import('better-sqlite3').Database} db
 * @param {string} inputUrl
 * @param {{ detectedKind?: string }} [opts]
 * @returns {{ id: number, shop_id: string|null, input_url: string, detected_kind: string|null, created_at: string } | null}
 */
export function findSuccessfulProbeByInputUrl(db, inputUrl, opts = {}) {
  const url = String(inputUrl || "").trim();
  if (!url) return null;
  const kind = opts.detectedKind ? String(opts.detectedKind) : null;
  if (kind) {
    return (
      db
        .prepare(
          `SELECT id, shop_id, input_url, detected_kind, created_at
           FROM shop_probe_runs
           WHERE input_url = ? AND ok = 1 AND detected_kind = ?
           ORDER BY id DESC LIMIT 1`,
        )
        .get(url, kind) || null
    );
  }
  return (
    db
      .prepare(
        `SELECT id, shop_id, input_url, detected_kind, created_at
         FROM shop_probe_runs
         WHERE input_url = ? AND ok = 1
         ORDER BY id DESC LIMIT 1`,
      )
      .get(url) || null
  );
}

/**
 * Earliest capturedAt from raw file, or file mtime ISO.
 * @param {string} sourceId
 * @param {string} [rawDir]
 */
export function resolveListedAtFromRaw(sourceId, rawDir) {
  const dir = rawDir || join(root, "data", "raw");
  const safe = String(sourceId || "unknown").replace(/[^\w.-]+/g, "_");
  const path = join(dir, `${safe}.json`);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    let earliest = null;
    const offers = Array.isArray(raw?.offers) ? raw.offers : [];
    for (const o of offers) {
      const t = o?.capturedAt;
      if (typeof t === "string" && t && (!earliest || t < earliest)) earliest = t;
    }
    if (typeof raw?.capturedAt === "string" && raw.capturedAt) {
      if (!earliest || raw.capturedAt < earliest) earliest = raw.capturedAt;
    }
    if (earliest) return earliest;
  } catch {
    /* mtime */
  }
  try {
    return statSync(path).mtime.toISOString();
  } catch {
    return null;
  }
}

export function closeShopsDb() {
  if (cachedDb) {
    try {
      cachedDb.close();
    } catch {
      /* ignore */
    }
    cachedDb = null;
    cachedPath = null;
  }
}

/**
 * Mark a shop due for collect immediately (next worker tick / forced claim).
 * Does not steal an active lease.
 * @param {import('better-sqlite3').Database} db
 * @param {string} shopId
 * @param {{ nowIso?: string }} [opts]
 */
export function scheduleShopCollectNow(db, shopId, opts = {}) {
  const id = String(shopId || "").trim();
  if (!id) return { action: "missing", id: "" };
  const nowIso = opts.nowIso || new Date().toISOString();
  const info = db
    .prepare(
      `UPDATE shops SET
         next_collect_at = @now,
         updated_at = @now
       WHERE id = @id AND enabled = 1`,
    )
    .run({ id, now: nowIso });
  return {
    action: info.changes ? "scheduled" : "noop",
    id,
    nextCollectAt: nowIso,
  };
}

/**
 * Force-claim one shop if free (or lease expired). Used for immediate post-submit collect.
 * @param {import('better-sqlite3').Database} db
 * @param {{
 *   id: string,
 *   owner: string,
 *   channelCount?: number,
 *   leaseMs?: number,
 *   nowIso?: string,
 * }} opts
 * @returns {ReturnType<typeof shopRowToCollectTarget> | null}
 */
export function claimShopById(db, opts) {
  const id = String(opts?.id || "").trim();
  const owner = String(opts?.owner || "").trim();
  if (!id || !owner) throw new Error("claimShopById requires id and owner");
  const channelCount = Math.max(1, Math.trunc(Number(opts.channelCount) || 1));
  const leaseMs = Number(opts.leaseMs) > 0 ? Number(opts.leaseMs) : COLLECT_LEASE_MS;
  const nowIso = opts.nowIso || new Date().toISOString();
  const leaseUntil = new Date(Date.parse(nowIso) + leaseMs).toISOString();
  const channelIndex = hashShopId(id) % channelCount;

  const info = db
    .prepare(
      `UPDATE shops SET
         lease_owner = @owner,
         lease_until = @lease_until,
         channel_index = COALESCE(channel_index, @channel_index),
         next_collect_at = @now,
         updated_at = @now
       WHERE id = @id
         AND enabled = 1
         AND status != 'unsupported'
         AND (lease_until IS NULL OR lease_until < @now)`,
    )
    .run({
      id,
      owner,
      lease_until: leaseUntil,
      channel_index: channelIndex,
      now: nowIso,
    });
  if (info.changes !== 1) return null;
  const row = getShop(db, id);
  return row ? shopRowToCollectTarget(row) : null;
}

/**
 * Claim due shops for a worker tick (single-flight per shop via lease).
 * @param {import('better-sqlite3').Database} db
 * @param {{
 *   owner: string,
 *   limit?: number,
 *   channelCount?: number,
 *   leaseMs?: number,
 *   nowIso?: string,
 * }} opts
 * @returns {ReturnType<typeof shopRowToCollectTarget>[]}
 */
export function claimDueShops(db, opts) {
  const owner = String(opts?.owner || "").trim();
  if (!owner) throw new Error("claimDueShops requires owner");
  const limit = Math.max(1, Math.min(500, Number(opts.limit) || 64));
  const channelCount = Math.max(1, Math.trunc(Number(opts.channelCount) || 1));
  const leaseMs = Number(opts.leaseMs) > 0 ? Number(opts.leaseMs) : COLLECT_LEASE_MS;
  const nowIso = opts.nowIso || new Date().toISOString();
  const leaseUntil = new Date(Date.parse(nowIso) + leaseMs).toISOString();

  const selectIds = db.prepare(
    `SELECT id FROM shops
     WHERE enabled = 1
       AND status != 'unsupported'
       AND (next_collect_at IS NULL OR next_collect_at <= ?)
       AND (lease_until IS NULL OR lease_until < ?)
     ORDER BY next_collect_at ASC, id ASC
     LIMIT ?`,
  );
  const claimOne = db.prepare(
    `UPDATE shops SET
       lease_owner = @owner,
       lease_until = @lease_until,
       channel_index = COALESCE(channel_index, @channel_index),
       updated_at = @now
     WHERE id = @id
       AND enabled = 1
       AND (lease_until IS NULL OR lease_until < @now)
       AND (next_collect_at IS NULL OR next_collect_at <= @now)`,
  );
  const getRow = db.prepare("SELECT * FROM shops WHERE id = ?");

  /** @type {ReturnType<typeof shopRowToCollectTarget>[]} */
  const claimed = [];
  const tx = db.transaction(() => {
    const rows = selectIds.all(nowIso, nowIso, limit);
    for (const { id } of rows) {
      const channelIndex = hashShopId(id) % channelCount;
      const info = claimOne.run({
        id,
        owner,
        lease_until: leaseUntil,
        channel_index: channelIndex,
        now: nowIso,
      });
      if (info.changes !== 1) continue;
      const row = getRow.get(id);
      if (row) claimed.push(shopRowToCollectTarget(row));
    }
  });
  tx();
  return claimed;
}

/**
 * Mark collect finished: clear lease, set next_collect_at / fail_count.
 * @param {import('better-sqlite3').Database} db
 * @param {string} shopId
 * @param {{
 *   ok: boolean,
 *   error?: string | null,
 *   owner?: string | null,
 *   at?: string,
 *   successIntervalMs?: number,
 *   displayState?: string | null,
 *   withdrawReason?: string | null,
 * }} result
 */
export function completeShopCollect(db, shopId, result) {
  const id = String(shopId || "").trim();
  if (!id) throw new Error("completeShopCollect requires shopId");
  const at = result.at || new Date().toISOString();
  const row = getShop(db, id);
  if (!row) return { action: "missing", id };

  const prevFail = Number(row.fail_count) || 0;
  const ok = Boolean(result.ok);
  const failCount = ok ? 0 : prevFail + 1;
  const successMs =
    Number(result.successIntervalMs) > 0
      ? Number(result.successIntervalMs)
      : COLLECT_SUCCESS_INTERVAL_MS;
  const nextMs = ok ? successMs : collectFailBackoffMs(failCount);
  const nextCollectAt = new Date(Date.parse(at) + nextMs).toISOString();
  const displayState = String(result.displayState || "").trim();
  const resting = displayState === "dayang" ? 1 : 0;
  const note =
    ok && resting
      ? String(result.withdrawReason || "店铺已打样")
      : ok
        ? null
        : String(result.error || "collect failed");

  db.prepare(
    `UPDATE shops SET
      fail_count = @fail_count,
      next_collect_at = @next_collect_at,
      last_collect_at = @at,
      last_collect_ok = @ok,
      last_error = @error,
      lease_owner = NULL,
      lease_until = NULL,
      updated_at = @at,
      last_probe_at = @at,
      last_probe_ok = @ok,
      status = CASE
        WHEN @resting = 1 AND enabled = 1 THEN 'resting'
        WHEN @ok = 1 AND enabled = 1 THEN 'active'
        WHEN @ok = 0 AND status = 'unsupported' THEN status
        WHEN @ok = 0 THEN 'probe_failed'
        ELSE status
      END
    WHERE id = @id`,
  ).run({
    id,
    fail_count: failCount,
    next_collect_at: nextCollectAt,
    at,
    ok: ok ? 1 : 0,
    resting,
    error: note,
  });

  return { action: "completed", id, ok, failCount, nextCollectAt };
}

/**
 * Push next_collect_at for shops on a cooled channel (liandong affinity).
 * @param {import('better-sqlite3').Database} db
 * @param {{
 *   channelIndex: number,
 *   delayMs: number,
 *   platforms?: string[],
 *   nowIso?: string,
 * }} opts
 */
export function deferShopsOnChannel(db, opts) {
  const channelIndex = Number(opts.channelIndex);
  if (!Number.isFinite(channelIndex)) throw new Error("deferShopsOnChannel requires channelIndex");
  const delayMs = Math.max(0, Number(opts.delayMs) || 5 * 60 * 1000);
  const nowIso = opts.nowIso || new Date().toISOString();
  const next = new Date(Date.parse(nowIso) + delayMs).toISOString();
  const platforms = Array.isArray(opts.platforms) && opts.platforms.length
    ? opts.platforms
    : ["liandong"];
  const placeholders = platforms.map(() => "?").join(",");
  const info = db
    .prepare(
      `UPDATE shops SET
         next_collect_at = CASE
           WHEN next_collect_at IS NULL OR next_collect_at < ? THEN ?
           ELSE next_collect_at
         END,
         lease_owner = NULL,
         lease_until = NULL,
         updated_at = ?
       WHERE channel_index = ?
         AND enabled = 1
         AND platform IN (${placeholders})`,
    )
    .run(next, next, nowIso, channelIndex, ...platforms);
  return { changes: info.changes, nextCollectAt: next, channelIndex };
}
