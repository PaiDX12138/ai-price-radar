export const TRANSIT_GROUPS_PAGE_SIZE = 12;

/** Paginate the existing group cards after filtering, without changing their contents. */
export function paginateTransitGroups<T>(groups: readonly T[], requestedPage: string | null) {
  const totalItems = groups.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / TRANSIT_GROUPS_PAGE_SIZE));
  const parsed = requestedPage && /^\d+$/.test(requestedPage) ? Number(requestedPage) : 1;
  const page = Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, totalPages) : 1;
  const offset = (page - 1) * TRANSIT_GROUPS_PAGE_SIZE;
  return { page, totalPages, totalItems, items: groups.slice(offset, offset + TRANSIT_GROUPS_PAGE_SIZE) };
}

export function transitGroupPageHref(basePath: string, currentSearch: string, page: number) {
  const params = new URLSearchParams(currentSearch);
  if (page > 1) params.set("page", String(page));
  else params.delete("page");
  const search = params.toString();
  return search ? `${basePath}?${search}` : basePath;
}
