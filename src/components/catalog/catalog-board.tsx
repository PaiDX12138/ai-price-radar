import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { CatalogPagination } from "@/components/catalog/catalog-pagination";
import { CATALOG_PAGE_SIZE, parseCatalogPage } from "@/lib/catalog/pagination";
import { CatalogNavState } from "@/components/catalog/catalog-nav-state";
import { CatalogFilterChrome } from "@/components/catalog/catalog-filter-chrome";
import { ProductCard } from "@/components/catalog/product-card";
import { ShopIndexedCard } from "@/components/catalog/shop-indexed-card";
import { ShopSubmitDialog } from "@/components/catalog/shop-submit-dialog";
import { getIndexedShopCount } from "@/lib/catalog/shop-count";
import {
  filterProductSummaries,
  getCatalogMeta,
  getPlatformTabs,
  listDeliveryTypes,
  parsePlatformTab,
  type PlatformId,
  type PlatformTabId,
} from "@/lib/catalog";
import { BRAND_NAME_EN, BRAND_NAME_ZH } from "@/lib/brand";

type CatalogBoardProps = {
  platformParam?: string;
  pageParam?: string;
  typeParam?: string;
  qParam?: string;
  basePath: string;
  title?: string;
};

export async function CatalogBoard({
  platformParam,
  pageParam,
  typeParam,
  qParam,
  basePath,
  title = BRAND_NAME_ZH,
}: CatalogBoardProps) {
  // Request-time boundary before catalog TTL clock
  await connection();
  const platform: PlatformTabId = parsePlatformTab(platformParam);
  const deliveryTypes = listDeliveryTypes(platform);
  const type =
    typeParam && deliveryTypes.includes(typeParam) ? typeParam : undefined;
  const q = qParam?.trim() || undefined;
  const meta = getCatalogMeta();
  const demo = meta.isDemo;
  const shopCount = getIndexedShopCount();

  const productPlatforms: PlatformId[] = [
    "chatgpt",
    "claude",
    "cursor",
    "grok",
    "kiro",
    "gemini",
    "email",
    "sms",
    "other",
  ];
  const deliveryTypesByPlatform = Object.fromEntries(
    productPlatforms.map((id) => [id, listDeliveryTypes(id)]),
  ) as Partial<Record<PlatformTabId, string[]>>;

  const filtered = filterProductSummaries(platform, { type, q });
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / CATALOG_PAGE_SIZE));
  const page = parseCatalogPage(pageParam, totalPages);
  const start = (page - 1) * CATALOG_PAGE_SIZE;
  const products = filtered.slice(start, start + CATALOG_PAGE_SIZE);

  return (
    <div className="mx-auto w-full max-w-[var(--apr-content-max)] px-4 pb-8 pt-4 lg:px-6">
      <CatalogNavState />
      <div className="mb-3">
        {/* 标题与收录申请同一行垂直居中；副标题/徽章不参与该行对齐 */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-2xl font-bold leading-none tracking-[-0.03em] text-foreground sm:text-[1.75rem]">
              {title}
            </h1>
            <span className="hidden h-4 w-px shrink-0 bg-border sm:block" aria-hidden />
            <p className="hidden shrink-0 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground sm:block">
              {BRAND_NAME_EN}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <ShopIndexedCard count={shopCount} className="shrink-0" />
            <ShopSubmitDialog
              className="shrink-0"
              deliveryTypesByPlatform={deliveryTypesByPlatform}
            />
          </div>
        </div>
        <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground sm:hidden">
          {BRAND_NAME_EN}
        </p>
        {(meta.degraded || demo) && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {meta.degraded ? (
              <Badge variant="outline" className="text-muted-foreground">
                快照降级
              </Badge>
            ) : null}
            {demo ? (
              <Badge
                variant="outline"
                className="border-[color-mix(in_oklab,var(--apr-amber)_35%,var(--border))] bg-[var(--apr-amber-soft)] text-[var(--apr-amber)]"
              >
                示例数据，非真实报价
              </Badge>
            ) : null}
          </div>
        )}
      </div>

      <CatalogFilterChrome
        tabs={getPlatformTabs()}
        active={platform}
        basePath={basePath}
        deliveryTypes={deliveryTypes}
      />

      {products.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {demo
            ? totalItems === 0
              ? "没有符合筛选的示例商品"
              : "该平台暂无示例商品"
            : totalItems === 0
              ? "没有符合筛选的商品"
              : "该平台暂无报价"}
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.slug} product={product} q={q} />
            ))}
          </div>
          <CatalogPagination
            basePath={basePath}
            platform={platform}
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            type={type}
            q={q}
          />
        </>
      )}
    </div>
  );
}
