/** Percentage-band display tiers, not SLA targets or individual chart-bucket states. */
export function transitAvailabilityTone(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value < 0 || value > 100) return "muted";
  if (value >= 90) return "emerald";
  if (value >= 70) return "amber";
  return "rose";
}
