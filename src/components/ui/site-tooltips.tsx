"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

type HintPosition = Element | { contextElement: Element; getBoundingClientRect: () => DOMRect };
type Hint = { anchor: Element; text: string; position: HintPosition };
const HINT = "[data-tooltip]";
const RICH_TRIGGER = "[data-base-ui-tooltip-trigger]";
const POPUP = "[data-slot='tooltip-content']";
const OPEN_DELAY = 120;
const CLOSE_DELAY = 80;

/** One delegated plain-text tooltip for SSR pages, tables and dynamically added rows.
 * No DOM wrappers, per-cell React roots, native titles or document-wide observers.
 * Rich tooltips continue to use the same TooltipContent with their own triggers.
 */
export function SiteTooltips() {
  const [hint, setHint] = useState<Hint | null>(null);
  const id = useId();
  const closeRef = useRef<() => void>(() => {});

  useEffect(() => {
    let active: Hint | null = null;
    let pending: Element | null = null;
    let dismissed: Element | null = null;
    let openTimer: ReturnType<typeof setTimeout> | undefined;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    let point: { target: Element; x: number; y: number } | null = null;

    const clearOpen = () => { clearTimeout(openTimer); openTimer = undefined; };
    const clearClose = () => { clearTimeout(closeTimer); closeTimer = undefined; };
    const close = () => {
      clearOpen(); clearClose();
      pending = null;
      if (active) { active = null; setHint(null); }
    };
    const dismiss = () => { dismissed = active?.anchor ?? pending; close(); };
    closeRef.current = dismiss;

    function show(anchor: Element, keyboard = false) {
      const text = anchor.getAttribute("data-tooltip")?.trim();
      if (!anchor.isConnected || !text) { close(); return; }
      const rect = anchor.getBoundingClientRect();
      let position: HintPosition = anchor;
      // Wide cells/flex labels are layout boxes, not meaningful hover centres.
      // Freeze a local anchor near the pointer when opening; don't chase the mouse.
      if (!keyboard && point && (rect.width > 160 || rect.height > 48)) {
        const offsetX = Math.max(0, Math.min(rect.width, point.x - rect.left));
        const offsetY = Math.max(0, Math.min(Math.max(0, rect.height - 16), point.y - rect.top - 8));
        position = {
          contextElement: anchor,
          getBoundingClientRect: () => {
            const current = anchor.getBoundingClientRect();
            return new DOMRect(current.left + offsetX, current.top + offsetY, 0, Math.min(16, current.height));
          },
        };
      }
      active = { anchor, text, position };
      pending = null;
      setHint(active);
    }

    function queue(anchor: Element | null, immediate = false) {
      if (anchor !== dismissed) dismissed = null;
      if (anchor && anchor === dismissed) return;
      if (!anchor?.getAttribute("data-tooltip")?.trim()) {
        clearOpen(); pending = null;
        if (active && !closeTimer) closeTimer = setTimeout(close, CLOSE_DELAY);
        return;
      }
      clearClose();
      if (active?.anchor === anchor) {
        if (active.text !== anchor.getAttribute("data-tooltip")?.trim()) show(anchor, immediate);
        return;
      }
      if (pending === anchor && !immediate) return;
      const switching = active !== null;
      close();
      pending = anchor;
      if (immediate || switching) show(anchor, immediate);
      else openTimer = setTimeout(() => show(anchor), OPEN_DELAY);
    }

    function resolve(target: Element, x: number, y: number): Element | null {
      if (target.closest(RICH_TRIGGER)) return null;
      // A transparent full-card navigation link must not hide hints underneath it.
      // Read the paint stack only on these two marked surfaces, at most once/frame.
      const surface = target.closest("[data-tooltip-surface]");
      if (surface) {
        const container = surface.parentElement;
        for (const element of document.elementsFromPoint(x, y)) {
          if (element === surface || !container?.contains(element)) continue;
          if (element.closest(RICH_TRIGGER)) return null;
          const candidate = element.closest(HINT);
          if (candidate && container.contains(candidate)) return candidate;
        }
        return null;
      }
      return target.closest(HINT);
    }

    function move(event: PointerEvent) {
      if (event.pointerType === "touch" || !(event.target instanceof Element)) return;
      point = { target: event.target, x: event.clientX, y: event.clientY };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!point) return;
        const { target, x, y } = point;
        const popup = target.closest(POPUP);
        if (popup?.id === id) { clearClose(); return; }
        if (popup || target.closest(RICH_TRIGGER)) { close(); return; }
        queue(resolve(target, x, y));
      });
    }

    function focus(event: FocusEvent) {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(RICH_TRIGGER)) { close(); return; }
      if (event.target.matches(":focus-visible")) queue(event.target.closest(HINT), true);
    }
    function blur(event: FocusEvent) {
      if (event.relatedTarget instanceof Element && event.relatedTarget.closest(`#${CSS.escape(id)}`)) return;
      close();
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") dismiss();
    }
    function interact(event: Event) {
      // Let users select/copy the explanation itself; don't steal its pointer event.
      if (event.target instanceof Element && event.target.closest(`#${CSS.escape(id)}`)) return;
      dismiss();
    }
    function visibility() { if (document.hidden) dismiss(); }
    function scroll(event: Event) {
      if (event.target instanceof Element && event.target.closest(`#${CSS.escape(id)}`)) return;
      dismiss();
    }
    function leave(event: PointerEvent) { if (!event.relatedTarget) close(); }

    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerover", move, { passive: true });
    document.addEventListener("pointerout", leave);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", blur);
    document.addEventListener("keydown", key, true);
    document.addEventListener("pointerdown", interact, true);
    document.addEventListener("click", interact, true);
    document.addEventListener("input", dismiss, true);
    document.addEventListener("scroll", scroll, true);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("resize", dismiss);
    window.addEventListener("popstate", dismiss);
    window.addEventListener("hashchange", dismiss);
    window.addEventListener("blur", dismiss);
    return () => {
      clearOpen(); clearClose(); cancelAnimationFrame(frame);
      closeRef.current = () => {};
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerover", move);
      document.removeEventListener("pointerout", leave);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", blur);
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("pointerdown", interact, true);
      document.removeEventListener("click", interact, true);
      document.removeEventListener("input", dismiss, true);
      document.removeEventListener("scroll", scroll, true);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("popstate", dismiss);
      window.removeEventListener("hashchange", dismiss);
      window.removeEventListener("blur", dismiss);
    };
  }, [id]);

  useEffect(() => {
    if (!hint) return;
    const { anchor } = hint;
    const descriptions = new Set(anchor.getAttribute("aria-describedby")?.split(/\s+/).filter(Boolean));
    descriptions.add(id);
    anchor.setAttribute("aria-describedby", [...descriptions].join(" "));
    // Only observe the active hint, not all price cells or the whole document.
    const observer = new MutationObserver(() => closeRef.current());
    observer.observe(anchor, { attributes: true, attributeFilter: ["data-tooltip"] });
    // Covers a hovered row disappearing during an async refresh without watching the document.
    const connectionTimer = setInterval(() => {
      if (!anchor.isConnected || anchor.closest("[hidden], [inert]")) closeRef.current();
    }, 250);
    return () => {
      observer.disconnect();
      clearInterval(connectionTimer);
      const remaining = (anchor.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(value => value && value !== id);
      if (remaining.length) anchor.setAttribute("aria-describedby", remaining.join(" "));
      else anchor.removeAttribute("aria-describedby");
    };
  }, [hint, id]);

  return <TooltipProvider delay={OPEN_DELAY} closeDelay={CLOSE_DELAY}>
    <Tooltip open={hint !== null} onOpenChange={open => { if (!open) closeRef.current(); }}>
      <TooltipContent id={id} anchor={hint?.position} sideOffset={6} aria-live="off">{hint?.text}</TooltipContent>
    </Tooltip>
  </TooltipProvider>;
}
