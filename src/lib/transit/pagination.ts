export const TRANSIT_GROUPS_PAGE_SIZE = 12;
export const TRANSIT_SITES_PAGE_SIZE = 12;

function paginateTransitItems<T>(items: readonly T[], requestedPage: string | null, pageSize: number) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const parsed = requestedPage && /^\d+$/.test(requestedPage) ? Number(requestedPage) : 1;
  const page = Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, totalPages) : 1;
  const offset = (page - 1) * pageSize;
  return { page, totalPages, totalItems, items: items.slice(offset, offset + pageSize) };
}

/** Slice only after filtering; neither pagination changes the upstream ordering. */
export function paginateTransitGroups<T>(groups: readonly T[], requestedPage: string | null) {
  return paginateTransitItems(groups, requestedPage, TRANSIT_GROUPS_PAGE_SIZE);
}

export function paginateTransitSites<T>(sites: readonly T[], requestedPage: string | null) {
  return paginateTransitItems(sites, requestedPage, TRANSIT_SITES_PAGE_SIZE);
}

export function transitSitePageHref(currentSearch: string, page: number) {
  return transitGroupPageHref("/api-transit", currentSearch, page);
}

export function transitGroupPageHref(basePath: string, currentSearch: string, page: number) {
  const params = new URLSearchParams(currentSearch);
  if (page > 1) params.set("page", String(page));
  else params.delete("page");
  const search = params.toString();
  return search ? `${basePath}?${search}` : basePath;
}
