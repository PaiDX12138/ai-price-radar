/** Display only ms/s; persisted durations always remain milliseconds. */
export function formatTransitDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const rounded = Math.round(ms);
  return rounded < 1000 ? `${rounded}ms` : `${Number((ms / 1000).toFixed(2))}s`;
}

/** TPS is provided by the source; never infer it from latency or model prices. */
export function formatTransitThroughput(tps: number | null | undefined): string {
  if (tps == null || !Number.isFinite(tps) || tps <= 0) return "—";
  return tps < 0.1 ? "<0.1t/s" : `${Number(tps.toFixed(1))}t/s`;
}

const bucketFormatter = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
/** Stable on both SSR and the client, regardless of the server's local timezone. */
export function formatTransitBucketTime(iso: string | null | undefined): string {
  if (!iso) return "暂无";
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? bucketFormatter.format(date) : "时间未知";
}
