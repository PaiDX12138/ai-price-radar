/** sessionStorage keys for catalog → product → back restore */

export const CATALOG_RETURN_PATH_KEY = "apr:catalog:returnPath";
export const CATALOG_SCROLL_KEY = "apr:catalog:scroll";

export type CatalogScrollState = {
  path: string;
  y: number;
};

export function catalogLocationKey(
  pathname: string,
  search: string,
): string {
  const q = search.startsWith("?") ? search : search ? `?${search}` : "";
  return `${pathname}${q}`;
}

export function rememberCatalogLeave(path: string, scrollY: number): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CATALOG_RETURN_PATH_KEY, path);
    sessionStorage.setItem(
      CATALOG_SCROLL_KEY,
      JSON.stringify({ path, y: Math.max(0, Math.round(scrollY)) } satisfies CatalogScrollState),
    );
  } catch {
    /* private mode / quota */
  }
}

export function peekCatalogReturnPath(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const path = sessionStorage.getItem(CATALOG_RETURN_PATH_KEY);
    return path && path.startsWith("/") ? path : null;
  } catch {
    return null;
  }
}

export function peekCatalogScroll(): CatalogScrollState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CATALOG_SCROLL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CatalogScrollState;
    if (
      typeof parsed?.path !== "string" ||
      !parsed.path.startsWith("/") ||
      typeof parsed.y !== "number" ||
      !Number.isFinite(parsed.y)
    ) {
      return null;
    }
    return { path: parsed.path, y: Math.max(0, parsed.y) };
  } catch {
    return null;
  }
}

export function clearCatalogScroll(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(CATALOG_SCROLL_KEY);
  } catch {
    /* ignore */
  }
}
