"use client";

import { useSyncExternalStore } from "react";

const PAGE_CHANGE = "transit:detail-state-change";
const currentSearch = () => window.location.search.slice(1);
function subscribe(listener: () => void) {
  window.addEventListener(PAGE_CHANGE, listener);
  window.addEventListener("popstate", listener);
  return () => {
    window.removeEventListener(PAGE_CHANGE, listener);
    window.removeEventListener("popstate", listener);
  };
}

/** Read our local pagination update synchronously, not after the router transition.
 * Next still receives native history updates, and back/forward uses the real URL.
 */
export function useTransitPageSearch(serverSearch: string) {
  return useSyncExternalStore(subscribe, currentSearch, () => serverSearch);
}

export function navigateTransitGroupPage(href: string) {
  window.history.pushState(null, "", `${href}${window.location.hash}`);
  window.dispatchEvent(new Event(PAGE_CHANGE));
}

/** Client-only filter navigation for a detail view whose complete quote set is already loaded. */
export function navigateTransitFilter(href: string) {
  window.history.pushState(null, "", `${href}${window.location.hash}`);
  window.dispatchEvent(new Event(PAGE_CHANGE));
}
