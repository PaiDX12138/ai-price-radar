#!/usr/bin/env node
/**
 * After collect: revalidate Next memory + hit public read paths.
 * Env:
 *   PREWARM_BASE_URL / NEXT_PUBLIC_SITE_URL (default http://localhost:3000)
 *   COLLECTOR_REVALIDATE_SECRET (optional)
 */
const base = (
  process.env.PREWARM_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");

const secret = process.env.COLLECTOR_REVALIDATE_SECRET?.trim();

async function main() {
  const headers = { accept: "application/json" };
  if (secret) headers["x-revalidate-secret"] = secret;

  const revalidateUrl = `${base}/api/catalog/revalidate`;
  console.log(`[prewarm] POST ${revalidateUrl}`);
  try {
    const res = await fetch(revalidateUrl, { method: "POST", headers });
    const body = await res.text();
    console.log(`[prewarm] revalidate HTTP ${res.status} ${body.slice(0, 240)}`);
  } catch (error) {
    console.warn(
      `[prewarm] revalidate skipped (is next running?): ${error instanceof Error ? error.message : error}`,
    );
  }

  for (const path of ["/api/catalog", "/", "/channels"]) {
    const url = `${base}${path}`;
    try {
      const res = await fetch(url, { method: "GET", redirect: "follow" });
      const cc = res.headers.get("cache-control") || "";
      console.log(`[prewarm] GET ${path} → ${res.status} cache-control=${cc || "(none)"}`);
    } catch (error) {
      console.warn(`[prewarm] GET ${path} failed: ${error instanceof Error ? error.message : error}`);
    }
  }
}

main().catch((error) => {
  console.error("[prewarm]", error instanceof Error ? error.message : error);
  process.exit(1);
});
