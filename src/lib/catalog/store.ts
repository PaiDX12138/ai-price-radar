import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Offer, Product, Source } from "@/lib/catalog/types";

export type CatalogSnapshot = {
  generatedAt: string;
  mode: "live" | "fixture" | string;
  isDemo: false;
  runId?: string;
  stats?: {
    sourcesAttempted?: number;
    sourcesSuccess?: number;
    sourcesFailed?: number;
    offersRaw?: number;
    offersClassified?: number;
  };
  sources: Source[];
  products: Product[];
  offers: Offer[];
};

export type CatalogLoadResult = {
  snapshot: CatalogSnapshot;
  /** True when serving last-good after a bad/missing disk read. */
  degraded: boolean;
  cacheHit: boolean;
  ttlSeconds: number;
  /** Absolute path that was read (or attempted). */
  path: string;
};

const PUBLIC_REL = join("data", "catalog", "public.json");
const LATEST_REL = join("data", "catalog", "latest.json");

const TTL_MIN = 30;
const TTL_MAX = 300;
const TTL_DEFAULT = 60;

type MemoryEntry = {
  snapshot: CatalogSnapshot;
  loadedAtMs: number;
  /** Disk mtime when snapshot was read; change → invalidate even inside TTL. */
  diskMtimeMs: number;
  degraded: boolean;
  path: string;
};

let memory: MemoryEntry | null = null;

function resolvePath(rel: string): string {
  return join(process.cwd(), rel);
}

/** Clamp env CATALOG_CACHE_TTL_SECONDS into 30–300 (default 60). */
export function getCatalogCacheTtlSeconds(): number {
  const raw = Number(process.env.CATALOG_CACHE_TTL_SECONDS ?? TTL_DEFAULT);
  if (!Number.isFinite(raw)) return TTL_DEFAULT;
  return Math.min(TTL_MAX, Math.max(TTL_MIN, Math.trunc(raw)));
}

function isValidSnapshot(parsed: unknown): parsed is CatalogSnapshot {
  if (!parsed || typeof parsed !== "object") return false;
  const value = parsed as CatalogSnapshot;
  if (typeof value.generatedAt !== "string" || !value.generatedAt) return false;
  if (!Array.isArray(value.offers) || value.offers.length === 0) return false;
  if (!Array.isArray(value.products) || !Array.isArray(value.sources)) return false;
  return true;
}

function candidatePaths(): string[] {
  return [resolvePath(PUBLIC_REL), resolvePath(LATEST_REL)];
}

function readSnapshotFile(path: string): CatalogSnapshot {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!isValidSnapshot(parsed)) {
    throw new Error(`Invalid catalog snapshot at ${path}`);
  }
  return { ...parsed, isDemo: false };
}

/**
 * Read explorer public snapshot (public.json → latest.json).
 * Process memory TTL 30–300s; on disk error/invalid, return last-good + degraded.
 * Never contacts shop HTTP.
 */

/** Wall clock without Date.now (Next prerender IO). */
function catalogNowMs(): number {
  return Math.floor(performance.timeOrigin + performance.now());
}
export function loadPersistedCatalogEntry(): CatalogLoadResult | null {
  const ttlSeconds = getCatalogCacheTtlSeconds();
  const now = catalogNowMs();

  const paths = candidatePaths().filter((path) => existsSync(path));
  const primaryPath = paths[0] || memory?.path || "";
  let diskMtimeMs = 0;
  if (primaryPath && existsSync(primaryPath)) {
    try {
      diskMtimeMs = statSync(primaryPath).mtimeMs;
    } catch {
      diskMtimeMs = 0;
    }
  }

  // TTL hit only when disk mtime unchanged — catalog rebuild must show up immediately
  if (
    memory &&
    memory.path === primaryPath &&
    memory.diskMtimeMs === diskMtimeMs &&
    diskMtimeMs > 0 &&
    now - memory.loadedAtMs < ttlSeconds * 1000
  ) {
    return {
      snapshot: memory.snapshot,
      degraded: memory.degraded,
      cacheHit: true,
      ttlSeconds,
      path: memory.path,
    };
  }

  if (!paths.length) {
    if (memory) {
      memory = { ...memory, loadedAtMs: now, degraded: true };
      return {
        snapshot: memory.snapshot,
        degraded: true,
        cacheHit: true,
        ttlSeconds,
        path: memory.path,
      };
    }
    return null;
  }

  let lastError: unknown = null;
  for (const path of paths) {
    try {
      const st = statSync(path);
      const snapshot = readSnapshotFile(path);
      memory = {
        snapshot,
        loadedAtMs: now,
        diskMtimeMs: st.mtimeMs,
        degraded: false,
        path,
      };
      return {
        snapshot,
        degraded: false,
        cacheHit: false,
        ttlSeconds,
        path,
      };
    } catch (error) {
      lastError = error;
    }
  }

  if (memory) {
    memory = { ...memory, loadedAtMs: now, degraded: true };
    return {
      snapshot: memory.snapshot,
      degraded: true,
      cacheHit: true,
      ttlSeconds,
      path: memory.path,
    };
  }

  void lastError;
  return null;
}

/** Snapshot only; null → demo fallback. */
export function loadPersistedCatalog(): CatalogSnapshot | null {
  return loadPersistedCatalogEntry()?.snapshot ?? null;
}

export function persistedCatalogPath(): string {
  const publicPath = resolvePath(PUBLIC_REL);
  if (existsSync(publicPath)) return publicPath;
  return resolvePath(LATEST_REL);
}

/** Test helper: clear process memory (not for production pages). */
export function resetCatalogMemoryCache(): void {
  memory = null;
}
