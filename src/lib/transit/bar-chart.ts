export type DetectionObservation = {
  availability: number | null;
  latencyMs: number | null;
  label: string;
  startAt?: string;
  endAt?: string;
  ttftMs?: number | null;
  throughputTps?: number | null;
  knownHours?: number;
  expectedHours?: number;
};

const positive = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
export const LATENCY_HEIGHT_CAP_MS = 120000;

/** Fixed 0–120s log scale shared by every period chart. Never depends on neighbours.
 * 1s ≈ 30%, 10s ≈ 59%, 30s ≈ 77%, 60s ≈ 88%; >=120s caps at 100%.
 * Missing latency is a short neutral-height marker, not an invented zero duration.
 */
export function latencyBarHeight(ms: number | null | undefined): number {
  if (!positive(ms)) return 18;
  return Number((18 + 82 * Math.log1p(Math.min(ms, LATENCY_HEIGHT_CAP_MS) / 1000) / Math.log1p(120)).toFixed(2));
}

/** Fixed contiguous buckets preserve missing slots and chronological coverage. */
export function aggregateObservations(samples: DetectionObservation[], maxBars = 50) {
  const limit = Number.isFinite(maxBars) ? Math.max(1, Math.floor(maxBars)) : 50;
  const count = Math.min(samples.length, limit);
  return Array.from({ length: count }, (_, i) => {
    const bucket = samples.slice(Math.floor(i * samples.length / count), Math.floor((i + 1) * samples.length / count));
    const known = bucket.map(x => x.availability).filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100);
    return {
      count: bucket.length,
      availability: average(known),
      latencyMs: average(bucket.map(x => x.latencyMs).filter(positive)),
      ttftMs: average(bucket.map(x => x.ttftMs).filter(positive)),
      throughputTps: bucket.some(x => x.throughputTps !== undefined) ? average(bucket.map(x => x.throughputTps).filter(positive)) : undefined,
      startAt: bucket[0].startAt,
      endAt: bucket.at(-1)!.endAt,
      knownHours: bucket.every(x => x.knownHours !== undefined) ? bucket.reduce((n, x) => n + x.knownHours!, 0) : undefined,
      expectedHours: bucket.every(x => x.expectedHours !== undefined) ? bucket.reduce((n, x) => n + x.expectedHours!, 0) : undefined,
      label: bucket.length === 1 ? bucket[0].label : `${bucket[0].label} — ${bucket.at(-1)!.label}`,
    };
  });
}

// Hundreds of bars share three formatters; constructing Intl for every label stalls page changes.
const dayTimeFormatter = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const timeFormatter = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false });
const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" });

export function barTimeRange(bar: Pick<DetectionObservation, "startAt" | "endAt" | "label">): string {
  if (!bar.startAt || !bar.endAt) return bar.label.split("（")[0].split(" · ")[0].replace(" 至 ", "–");
  const start = new Date(bar.startAt), end = new Date(bar.endAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return "时间未知";
  const sameDay = dayFormatter.format(start) === dayFormatter.format(end);
  return `${dayTimeFormatter.format(start)}–${sameDay ? timeFormatter.format(end) : dayTimeFormatter.format(end)}`;
}
