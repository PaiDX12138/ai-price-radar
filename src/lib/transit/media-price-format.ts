import type { TransitMediaPricing } from "./view";

export const MEDIA_BILLING_LABELS = {
  token: "按 Token", per_image: "按张 · 随规格", upstream_cost: "按上游实际费用", per_request: "按次", variable: "按规格",
} as const;

export const formatTransitPriceAmount = (value: number) => value !== 0 && Math.abs(value) < 0.000001 ? String(value) : String(Number(value.toFixed(6)));
const valid = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
export type MediaPriceBounds = { min: number | null; max: number | null };

/** Persisted amounts already include the current offer's group multiplier. */
export function mediaPriceBounds(value?: TransitMediaPricing, fallbackFixed?: number | null): MediaPriceBounds | null {
  const rawMin = value?.min, rawMax = value?.max;
  const min = valid(rawMin) ? rawMin : null;
  const max = valid(rawMax) ? rawMax : null;
  if (min !== null && max !== null && min > max) return null;
  if (min !== null || max !== null) return { min, max };
  const fixed = value?.fixed ?? fallbackFixed;
  return valid(fixed) ? { min: fixed, max: fixed } : null;
}

export function formatMediaPriceBounds(bounds: MediaPriceBounds | null): string {
  if (!bounds) return "未披露";
  const { min, max } = bounds;
  if (min !== null && max !== null) return min === max ? `$${formatTransitPriceAmount(min)}` : `$${formatTransitPriceAmount(min)}–${formatTransitPriceAmount(max)}`;
  if (min !== null) return `$${formatTransitPriceAmount(min)}起`;
  if (max !== null) return `≤$${formatTransitPriceAmount(max)}`;
  return "未披露";
}

export function formatTransitMediaPrice(value?: TransitMediaPricing, fallbackFixed?: number | null) {
  return formatMediaPriceBounds(mediaPriceBounds(value, fallbackFixed));
}

/** Summarize disclosed offers only. Never invent the missing end of a one-sided range. */
export function summarizeMediaPrices(values: (MediaPriceBounds | null)[]): MediaPriceBounds | null {
  const known = values.filter((value): value is MediaPriceBounds => value !== null);
  if (!known.length) return null;
  return {
    min: known.every(value => value.min !== null) ? Math.min(...known.map(value => value.min!)) : null,
    max: known.every(value => value.max !== null) ? Math.max(...known.map(value => value.max!)) : null,
  };
}
