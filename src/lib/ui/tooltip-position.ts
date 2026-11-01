export type TooltipPosition = Element | { contextElement: Element; getBoundingClientRect: () => DOMRect };
export type TooltipPlacement = { position: TooltipPosition; elementAnchored: boolean };

/** Wide labels retain local hints; opted-in image/cards use their whole element. */
export function tooltipPlacement(anchor: Element, point: { x: number; y: number } | null, keyboard = false): TooltipPlacement {
  const elementAnchored = anchor.getAttribute("data-tooltip-anchor") === "element";
  if (elementAnchored || keyboard || !point) return { position: anchor, elementAnchored };
  const rect = anchor.getBoundingClientRect();
  if (rect.width <= 160 && rect.height <= 48) return { position: anchor, elementAnchored };
  // Freeze offsets when opening, not on every pointer movement.
  const offsetX = Math.max(0, Math.min(rect.width, point.x - rect.left));
  const offsetY = Math.max(0, Math.min(Math.max(0, rect.height - 16), point.y - rect.top - 8));
  return {
    elementAnchored,
    position: {
      contextElement: anchor,
      getBoundingClientRect: () => {
        const current = anchor.getBoundingClientRect();
        return new DOMRect(current.left + offsetX, current.top + offsetY, 0, Math.min(16, current.height));
      },
    },
  };
}
