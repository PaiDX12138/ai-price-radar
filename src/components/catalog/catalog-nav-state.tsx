"use client";

import { useLayoutEffect } from "react";
import {
  catalogLocationKey,
  clearCatalogScroll,
  peekCatalogScroll,
  rememberCatalogLeave,
} from "@/lib/catalog/nav-state";

/** 卡网商品详情 / 官网定价详情（含邮箱、接码） */
function isListDetailLeaveAnchor(anchor: HTMLAnchorElement): boolean {
  const href = anchor.getAttribute("href") || "";
  return (
    href.startsWith("/products/") ||
    // /official/{id}，不含 /official 列表本身
    /^\/official\/[^/?#]+/.test(href)
  );
}

/**
 * On catalog / official list pages: remember scroll when opening a detail,
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
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!isListDetailLeaveAnchor(anchor)) return;
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
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!isListDetailLeaveAnchor(anchor)) return;
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