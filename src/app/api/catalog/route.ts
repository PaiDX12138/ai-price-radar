import { connection, NextResponse } from "next/server";
import { getCatalogMeta, listProducts } from "@/lib/catalog";
import {
  getCatalogCacheTtlSeconds,
  loadPersistedCatalogEntry,
} from "@/lib/catalog/store";

/** s-maxage in 60–300; aligns with process TTL when possible. */
function catalogSMaxAgeSeconds(): number {
  const ttl = getCatalogCacheTtlSeconds();
  return Math.min(300, Math.max(60, ttl));
}

function withCatalogCache(response: NextResponse): NextResponse {
  const sMaxAge = catalogSMaxAgeSeconds();
  response.headers.set(
    "Cache-Control",
    `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=60`,
  );
  return response;
}

/**
 * Public catalog meta/snapshot summary.
 * Read-only from on-disk explorer snapshot (+ process TTL). No shop HTTP.
 */
export async function GET() {
  await connection();
  const entry = loadPersistedCatalogEntry();
  const meta = getCatalogMeta();
  const ttlSeconds = getCatalogCacheTtlSeconds();
  const sMaxAge = catalogSMaxAgeSeconds();

  if (!entry) {
    return withCatalogCache(
      NextResponse.json({
        ok: true,
        isDemo: true,
        degraded: false,
        generatedAt: null,
        mode: "demo",
        ttlSeconds,
        sMaxAge,
        cacheHit: false,
        productCount: listProducts().length,
        offerCount: null,
        path: null,
        note: "No persisted snapshot; UI falls back to demo. Collect with pnpm collect:shopapi.",
      }),
    );
  }

  return withCatalogCache(
    NextResponse.json({
      ok: true,
      isDemo: false,
      degraded: entry.degraded,
      generatedAt: entry.snapshot.generatedAt,
      mode: entry.snapshot.mode,
      ttlSeconds: entry.ttlSeconds,
      sMaxAge,
      cacheHit: entry.cacheHit,
      productCount: entry.snapshot.products.length,
      offerCount: entry.snapshot.offers.length,
      stats: entry.snapshot.stats ?? null,
      path: entry.path,
      meta,
    }),
  );
}
