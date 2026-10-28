export const PERFORMANCE_HOURS = 360;
const HOUR = 3600000;
const finite = (n) => typeof n === "number" && Number.isFinite(n);
const mean = (ns) => ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
const formatter = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const timeLabel = (ms) => formatter.format(new Date(ms));

/** Same UTC hour grid for all metrics. No request weights are supplied by the source.
 * First average groups within each model, then models within each hour, then hours.
 * This is an explicitly labelled equal-weight index, NOT a traffic-weighted SLA.
 */
export function buildPerformanceMonitor(rows, { now = Date.now(), groupKey = null, modelName = null } = {}) {
  const end = Math.floor(now / HOUR) * HOUR + HOUR;
  const start = end - PERFORMANCE_HOURS * HOUR;
  const buckets = new Map();
  let collectedAt = null;
  for (const r of rows) {
    if (groupKey !== null && r.group_key !== groupKey) continue;
    if (modelName !== null && r.model_name !== modelName) continue;
    if (r.window_hours != null && r.window_hours !== PERFORMANCE_HOURS) continue;
    const at = Date.parse(r.bucket_at);
    if (!finite(at) || at < start || at >= end || !r.has_data) continue;
    if (!finite(r.success_rate) || r.success_rate < 0 || r.success_rate > 100) continue;
    const model = buckets.get(at) ?? new Map();
    const groups = model.get(r.model_name) ?? new Map();
    // One source row per identity; later observation wins, never double-count a re-scan.
    const previous = groups.get(r.group_key);
    if (!previous || r.observed_at >= previous.observed_at) groups.set(r.group_key, r);
    model.set(r.model_name, groups); buckets.set(at, model);
    if (!collectedAt || r.observed_at > collectedAt) collectedAt = r.observed_at;
  }
  const points = Array.from({ length: PERFORMANCE_HOURS }, (_, i) => {
    const at = start + i * HOUR;
    const models = [...(buckets.get(at)?.values() ?? [])];
    const metric = (key, positive = false) => mean(models.map(groups => mean([...groups.values()].map(r => r[key]).filter(n => finite(n) && (positive ? n > 0 : n >= 0)))).filter(finite));
    return { bucketAt: new Date(at).toISOString(), availability: metric("success_rate"), latencyMs: metric("avg_latency_ms", true), ttftMs: metric("avg_ttft_ms", true), throughputTps: metric("avg_tps", true), models: models.length };
  });
  const covered = points.filter(p => p.availability !== null);
  const newest = covered.at(-1);
  // 60 fixed six-hour slots: absent hours stay in place rather than compressing time.
  const bars = Array.from({ length: 60 }, (_, i) => {
    const chunk = points.slice(i * 6, i * 6 + 6);
    const known = chunk.filter(p => p.availability !== null);
    return { availability: mean(known.map(p => p.availability)), latencyMs: mean(known.map(p => p.latencyMs).filter(finite)), ttftMs: mean(known.map(p => p.ttftMs).filter(finite)), throughputTps: mean(known.map(p => p.throughputTps).filter(finite)), startAt:chunk[0].bucketAt, endAt:new Date(Date.parse(chunk.at(-1).bucketAt)+HOUR).toISOString(), knownHours:known.length, expectedHours:6, label: modelName !== null ? "" : `${timeLabel(Date.parse(chunk[0].bucketAt))} 至 ${timeLabel(Date.parse(chunk.at(-1).bucketAt) + HOUR)}（北京时间） · 有数据 ${known.length}/6 小时 · 模型等权` };
  });
  return { availability: mean(covered.map(p => p.availability)), latestTtftMs: newest?.ttftMs ?? null,
    latestLatencyMs: newest?.latencyMs ?? null, latestThroughputTps: newest?.throughputTps ?? null,
    averageLatencyMs: mean(covered.map(p => p.latencyMs).filter(finite)), averageThroughputTps: mean(covered.map(p => p.throughputTps).filter(finite)), samples: covered.length,
    latencyHours: covered.filter(p => p.latencyMs !== null).length, throughputHours: covered.filter(p => p.throughputTps !== null).length,
    expectedHours: PERFORMANCE_HOURS, windowHours: PERFORMANCE_HOURS, windowStart: new Date(start).toISOString(), windowEnd: new Date(end).toISOString(),
    latestBucketAt: newest?.bucketAt ?? null, collectedAt, method: modelName !== null ? "group_hour_equal_weight" : "model_hour_equal_weight", bars };
}
