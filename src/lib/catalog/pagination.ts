import type { PlatformTabId } from "@/lib/catalog/types";

export const CATALOG_PAGE_SIZE = 24;
/** 商品详情报价卡分页（与首页同尺寸） */
export const OFFERS_PAGE_SIZE = 24;
/** 官网定价详情：地区报价分页 */
/** 宽屏一行 5 卡，页容量取 5 的倍数，避免末行缺格。 */
export const OFFICIAL_REGIONS_PAGE_SIZE = 25;
/** 官网定价列表：标准套餐分页 */
export const OFFICIAL_PLANS_PAGE_SIZE = 24;

export function hrefForCatalog(
  basePath: string,
  opts: { platform: PlatformTabId; page?: number; type?: string; q?: string },
): string {
  const params = new URLSearchParams();
  if (opts.platform !== "all") params.set("platform", opts.platform);
  if (opts.type) params.set("type", opts.type);
  if (opts.q) params.set("q", opts.q);
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function pageWindow(page: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  if (page <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (page >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }
  const sorted: number[] = [...pages].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const out: Array<number | "ellipsis"> = [];
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i]!;
    if (i > 0 && n - sorted[i - 1]! > 1) out.push("ellipsis");
    out.push(n);
  }
  return out;
}

export function parseCatalogPage(value: string | undefined, totalPages: number): number {
  const n = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  if (totalPages < 1) return 1;
  return Math.min(n, totalPages);
}
