"use client";

import { useLayoutEffect } from "react";
import {
  catalogLocationKey,
  clearCatalogScroll,
  peekCatalogScroll,
  rememberCatalogLeave,
} from "@/lib/catalog/nav-state";

/**
 * On catalog list pages: remember scroll when opening a product,
 * and restore Tab/筛选 URL + scrollY when coming back.
 */
export function CatalogNavState() {
  useLayoutEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    const path = catalogLocationKey(
      window.location.pathname,
      window.location.search,
    );
    const saved = peekCatalogScroll();
    let raf = 0;
    let t0 = 0;
    let t1 = 0;
    if (saved && saved.path === path) {
      const y = saved.y;
      const restore = () => {
        window.scrollTo(0, y);
      };
      restore();
      raf = requestAnimationFrame(restore);
      t0 = window.setTimeout(restore, 0);
      t1 = window.setTimeout(restore, 80);
      clearCatalogScroll();
    }

    const stashLeave = () => {
      rememberCatalogLeave(
        catalogLocationKey(window.location.pathname, window.location.search),
        window.scrollY,
      );
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href^="/products/"]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      stashLeave();
    };

    // Keyboard activation (Enter) does not fire pointerdown
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href^="/products/"]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      stashLeave();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClick, true);
      if (raf) cancelAnimationFrame(raf);
      if (t0) window.clearTimeout(t0);
      if (t1) window.clearTimeout(t1);
    };
  }, []);

  return null;
}
