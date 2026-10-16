import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { resetCatalogMemoryCache } from "@/lib/catalog/store";

/**
 * Clear process catalog memory + revalidate listing pages.
 * Called by collector prewarm (separate process). Optional:
 *   COLLECTOR_REVALIDATE_SECRET + header x-revalidate-secret
 */
export async function POST(request: Request) {
  const secret = process.env.COLLECTOR_REVALIDATE_SECRET?.trim();
  if (secret) {
    const header = request.headers.get("x-revalidate-secret")?.trim();
    const url = new URL(request.url);
    const query = url.searchParams.get("secret")?.trim();
    if (header !== secret && query !== secret) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  resetCatalogMemoryCache();
  revalidatePath("/");
  revalidatePath("/channels");
  revalidatePath("/products", "layout");

  return NextResponse.json({
    ok: true,
    revalidatedAt: new Date().toISOString(),
    paths: ["/", "/channels", "/products"],
  });
}
