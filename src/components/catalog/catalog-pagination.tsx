"use client";

import type { MouseEvent } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  hrefForCatalog,
  pageWindow,
} from "@/lib/catalog/pagination";
import type { PlatformTabId } from "@/lib/catalog";

export {
  CATALOG_PAGE_SIZE,
  OFFERS_PAGE_SIZE,
  hrefForCatalog,
  parseCatalogPage,
  pageWindow,
} from "@/lib/catalog/pagination";

type CatalogPaginationProps = {
  basePath: string;
  platform: PlatformTabId;
  page: number;
  totalPages: number;
  totalItems: number;
  type?: string;
  q?: string;
};

type ListPaginationProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  /** e.g. 个商品 / 条报价 */
  itemLabel?: string;
  hrefForPage: (page: number) => string;
  onPageClick?: (page: number, event: MouseEvent<HTMLAnchorElement>) => void;
};

/** Shared chrome with homepage catalog pagination. */
export function ListPagination({
  page,
  totalPages,
  totalItems,
  itemLabel = "个商品",
  hrefForPage,
  onPageClick,
}: ListPaginationProps) {
  if (totalPages <= 1) return null;

  const items = pageWindow(page, totalPages);
  const bind = (p: number) =>
    onPageClick
      ? {
          href: hrefForPage(p),
          onClick: (event: MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
            onPageClick(p, event);
          },
        }
      : { href: hrefForPage(p) };

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      <p className="text-xs text-muted-foreground">
        共 {totalItems} {itemLabel} · 第 {page}/{totalPages} 页
      </p>

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            {page > 1 ? (
              <PaginationPrevious {...bind(page - 1)} />
            ) : (
              <PaginationPrevious
                href={hrefForPage(1)}
                aria-disabled
                className="pointer-events-none opacity-40"
              />
            )}
          </PaginationItem>
          {items.map((item, idx) =>
            item === "ellipsis" ? (
              <PaginationItem key={`e-${idx}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationLink {...bind(item)} isActive={item === page}>
                  {item}
                </PaginationLink>
              </PaginationItem>
            )
          )}
          <PaginationItem>
            {page < totalPages ? (
              <PaginationNext {...bind(page + 1)} />
            ) : (
              <PaginationNext
                href={hrefForPage(totalPages)}
                aria-disabled
                className="pointer-events-none opacity-40"
              />
            )}
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

export function CatalogPagination({
  basePath,
  platform,
  page,
  totalPages,
  totalItems,
  type,
  q,
}: CatalogPaginationProps) {
  return (
    <ListPagination
      page={page}
      totalPages={totalPages}
      totalItems={totalItems}
      itemLabel="个商品"
      hrefForPage={(p) => hrefForCatalog(basePath, { platform, page: p, type, q })}
    />
  );
}

type OfficialListPaginationProps = {
  platform: PlatformTabId;
  page: number;
  totalPages: number;
  totalItems: number;
  q?: string;
};

function hrefForOfficialList(opts: {
  platform: PlatformTabId;
  q?: string;
  page?: number;
}): string {
  const params = new URLSearchParams();
  if (opts.platform !== "all") params.set("platform", opts.platform);
  if (opts.q) params.set("q", opts.q);
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  const qs = params.toString();
  return qs ? `/official?${qs}` : "/official";
}

/** 官网定价列表分页（可序列化 props，供 Server Component 使用）。 */
export function OfficialListPagination({
  platform,
  page,
  totalPages,
  totalItems,
  q,
}: OfficialListPaginationProps) {
  return (
    <ListPagination
      page={page}
      totalPages={totalPages}
      totalItems={totalItems}
      itemLabel="个标准套餐"
      hrefForPage={(p) => hrefForOfficialList({ platform, q, page: p })}
    />
  );
}

type OfficialDetailPaginationProps = {
  planId: string;
  page: number;
  totalPages: number;
  totalItems: number;
  /** 渠道筛选（web_direct / ios_store），翻页时保留 */
  channel?: string | null;
  /** 地区搜索词，翻页时保留 */
  q?: string;
  /** 客户端翻页时传入，避免整页导航 */
  onPageClick?: (page: number) => void;
};

/** 官网定价详情地区表分页。 */
export function OfficialDetailPagination({
  planId,
  page,
  totalPages,
  totalItems,
  channel,
  q,
  onPageClick,
}: OfficialDetailPaginationProps) {
  const base = `/official/${encodeURIComponent(planId)}`;
  return (
    <ListPagination
      page={page}
      totalPages={totalPages}
      totalItems={totalItems}
      itemLabel="条地区报价"
      hrefForPage={(p) => {
        const params = new URLSearchParams();
        if (channel) params.set("channel", channel);
        if (q?.trim()) params.set("q", q.trim());
        if (p > 1) params.set("page", String(p));
        const qs = params.toString();
        return qs ? `${base}?${qs}` : base;
      }}
      onPageClick={
        onPageClick
          ? (p, event) => {
              event.preventDefault();
              onPageClick(p);
            }
          : undefined
      }
    />
  );
}
