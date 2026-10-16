import "server-only";

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
  OfficialPlanSummary,
  OfficialRegionPrice,
} from "@/lib/official/types";

/**
 * Worker / migrate 写出的官方价快照（由 data/official-prices.sqlite 导出）。
 * 前台只读此 JSON，与卡网 data/catalog/public.json 同一模式，
 * 不在 Next 进程里打开原生 SQLite。
 */
export type OfficialSnapshot = {
  generatedAt: string;
  source: string;
  regionCount: number;
  fxDate: string | null;
  summaries: OfficialPlanSummary[];
  regionPricesByPlanId: Record<string, OfficialRegionPrice[]>;
};

const SNAPSHOT_REL = join("data", "official-prices", "latest.json");

type MemoryEntry = {
  snapshot: OfficialSnapshot;
  loadedAtMs: number;
  mtimeMs: number;
};

let memory: MemoryEntry | null = null;

export function resolveOfficialSnapshotPath(): string {
  return process.env.OFFICIAL_SNAPSHOT_PATH || join(process.cwd(), SNAPSHOT_REL);
}

/** Clamp OFFICIAL_CACHE_TTL_SECONDS into 30–900 (default 300). */
export function getOfficialCacheTtlSeconds(): number {
  const raw = Number(process.env.OFFICIAL_CACHE_TTL_SECONDS ?? 300);
  if (!Number.isFinite(raw)) return 300;
  return Math.min(900, Math.max(30, Math.trunc(raw)));
}

function isValidSnapshot(value: unknown): value is OfficialSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as OfficialSnapshot;
  return (
    typeof v.generatedAt === "string" &&
    Array.isArray(v.summaries) &&
    !!v.regionPricesByPlanId &&
    typeof v.regionPricesByPlanId === "object"
  );
}

/**
 * 读取快照：文件 mtime 变化立即重读；否则在 TTL 内复用内存副本。
 * 读失败 / 缺文件时返回上一份好数据（若有），绝不缓存「空结果」。
 */
export function loadOfficialSnapshot(): OfficialSnapshot | null {
  const path = resolveOfficialSnapshotPath();
  if (!existsSync(path)) return memory?.snapshot ?? null;

  let mtimeMs = 0;
  try {
    mtimeMs = statSync(path).mtimeMs;
  } catch {
    return memory?.snapshot ?? null;
  }

  // Wall clock without Date.now (Next prerender IO).
  const now = Math.floor(performance.timeOrigin + performance.now());
  const ttlMs = getOfficialCacheTtlSeconds() * 1000;
  if (memory && memory.mtimeMs === mtimeMs && now - memory.loadedAtMs < ttlMs) {
    return memory.snapshot;
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!isValidSnapshot(parsed)) {
      throw new Error(`Invalid official snapshot at ${path}`);
    }
    memory = { snapshot: parsed, loadedAtMs: now, mtimeMs };
    return parsed;
  } catch (err) {
    console.warn(
      "[official] read snapshot failed:",
      err instanceof Error ? err.message : err,
    );
    return memory?.snapshot ?? null;
  }
}

export function clearOfficialSnapshotCache() {
  memory = null;
}
