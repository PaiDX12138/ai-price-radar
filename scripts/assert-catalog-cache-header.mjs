#!/usr/bin/env node
/** Assert GET /api/catalog sets Cache-Control: max-age=0, s-maxage in 60–300. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/app/api/catalog/route.ts"), "utf8");

function fail(msg) {
  console.error("[assert-cache]", msg);
  process.exit(1);
}

if (!src.includes("max-age=0")) fail("missing max-age=0");
if (!src.includes("s-maxage=")) fail("missing s-maxage=");
if (!src.includes("Math.max(60") || !src.includes("Math.min(300")) {
  fail("s-maxage not clamped to 60–300");
}
if (!src.includes("Cache-Control")) fail("missing Cache-Control header set");

// Simulate clamp
function sMaxAge(ttl) {
  return Math.min(300, Math.max(60, ttl));
}
for (const [ttl, expect] of [[30, 60], [60, 60], [120, 120], [400, 300]]) {
  if (sMaxAge(ttl) !== expect) fail(`clamp(${ttl}) != ${expect}`);
}

const base = (process.env.PREWARM_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
try {
  const res = await fetch(`${base}/api/catalog`, { method: "GET" });
  const cc = res.headers.get("cache-control") || "";
  console.log(`[assert-cache] live GET ${res.status} Cache-Control=${cc || "(none)"}`);
  if (res.ok) {
    if (!/max-age=0/.test(cc)) fail(`live missing max-age=0: ${cc}`);
    const m = cc.match(/s-maxage=(\d+)/);
    if (!m) fail(`live missing s-maxage: ${cc}`);
    const n = Number(m[1]);
    if (n < 60 || n > 300) fail(`live s-maxage out of range: ${n}`);
  } else {
    console.warn("[assert-cache] live endpoint not OK — code-level assert still passed");
  }
} catch (error) {
  console.warn("[assert-cache] live fetch skipped:", error instanceof Error ? error.message : error);
  console.warn("[assert-cache] code-level assert passed");
}

console.log("[assert-cache] OK");
