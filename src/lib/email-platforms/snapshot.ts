import "server-only";

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildEmailPlatformsSnapshotFromConfig } from "@/lib/email-platforms/build-snapshot";
import type { EmailPlatformSnapshot } from "@/lib/email-platforms/types";

const TTL_MS =
  (Number(process.env.EMAIL_PLATFORMS_CACHE_TTL_SECONDS) || 60) * 1000;

let cache: {
  at: number;
  data: EmailPlatformSnapshot | null;
  mtimeMs: number;
  source: string;
} | null = null;

/** Wall clock without Date.now (Next prerender IO). */
function snapshotNowMs(): number {
  return Math.floor(performance.timeOrigin + performance.now());
}

export function resolveEmailPlatformsSnapshotPath(): string {
  return join(process.cwd(), "data", "email-platforms", "latest.json");
}

export function clearEmailPlatformsSnapshotCache() {
  cache = null;
}

/** 优先读采集快照；无则回退 config 种子。 */
export function loadEmailPlatformsSnapshot(): EmailPlatformSnapshot | null {
  const now = snapshotNowMs();
  const path = resolveEmailPlatformsSnapshotPath();

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
      const data = JSON.parse(readFileSync(path, "utf8")) as EmailPlatformSnapshot;
      cache = { at: now, data, mtimeMs, source: "file" };
      return data;
    } catch {
      /* fall through */
    }
  }

  try {
    const data = buildEmailPlatformsSnapshotFromConfig();
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
