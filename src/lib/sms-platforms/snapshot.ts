import "server-only";

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildSmsPlatformsSnapshotFromConfig } from "@/lib/sms-platforms/build-snapshot";
import type { SmsPlatformSnapshot } from "@/lib/sms-platforms/types";

const TTL_MS =
  (Number(process.env.SMS_PLATFORMS_CACHE_TTL_SECONDS) || 60) * 1000;

let cache: {
  at: number;
  data: SmsPlatformSnapshot | null;
  mtimeMs: number;
  source: string;
} | null = null;

/** Wall clock without Date.now (Next prerender IO). */
function snapshotNowMs(): number {
  return Math.floor(performance.timeOrigin + performance.now());
}

export function resolveSmsPlatformsSnapshotPath(): string {
  return join(process.cwd(), "data", "sms-platforms", "latest.json");
}

export function clearSmsPlatformsSnapshotCache() {
  cache = null;
}

/**
 * 优先读采集快照 data/sms-platforms/latest.json；
 * 无文件则回退 config 种子。
 */
export function loadSmsPlatformsSnapshot(): SmsPlatformSnapshot | null {
  const now = snapshotNowMs();
  const path = resolveSmsPlatformsSnapshotPath();

  if (existsSync(path)) {
    let mtimeMs = 0;
    try {
      mtimeMs = statSync(path).mtimeMs;
    } catch {
      mtimeMs = 0;
    }
    if (
      cache &&
      cache.source === "file" &&
      cache.mtimeMs === mtimeMs &&
      now - cache.at < TTL_MS
    ) {
      return cache.data;
    }
    try {
      const data = JSON.parse(readFileSync(path, "utf8")) as SmsPlatformSnapshot;
      cache = { at: now, data, mtimeMs, source: "file" };
      return data;
    } catch {
      /* fall through */
    }
  }

  try {
    const data = buildSmsPlatformsSnapshotFromConfig();
    if (
      cache &&
      cache.source === "config" &&
      now - cache.at < TTL_MS &&
      cache.data?.capturedAt === data.capturedAt
    ) {
      return cache.data;
    }
    cache = { at: now, data, mtimeMs: 0, source: "config" };
    return data;
  } catch {
    cache = { at: now, data: null, mtimeMs: 0, source: "config" };
    return null;
  }
}
