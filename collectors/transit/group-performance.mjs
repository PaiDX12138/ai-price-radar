import { buildPerformanceMonitor, PERFORMANCE_HOURS } from "../../src/lib/transit/performance.mjs";

const finite = n => typeof n === "number" && Number.isFinite(n);
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const HOUR = 3600000;
const hasData = stats => stats && (finite(stats.availability) || stats.samples > 0
  || stats.bars?.some(bar => finite(bar.availability))
  || [stats.latestTtftMs, stats.latestLatencyMs, stats.averageLatencyMs,
    stats.latestThroughputTps, stats.averageThroughputTps, stats.throughputSummary?.value].some(finite));

/** Read-side fallback only: model membership index, never a new source/channel observation.
 * Raw source data remains in its original SQLite tables. Rebuilt on every snapshot export.
 */
export function withModelDerivedGroups(performance, stationGroups, offers, { now = Date.now() } = {}) {
  const end = Math.floor(now / HOUR) * HOUR + HOUR;
  const start = end - PERFORMANCE_HOURS * HOUR;
  const members = new Map(stationGroups.map(group => [group.id, new Set()]));
  for (const offer of offers) members.get(offer.group_id)?.add(offer.raw_model);
  const groups = new Map(Object.entries(performance.groups ?? {}));
  for (const group of stationGroups) {
    const direct = groups.get(group.group_key);
    if (direct?.scope?.stationId === performance.stationId && direct.scope.groupKey === group.group_key
      && direct.scope.modelName === undefined && direct.windowHours === PERFORMANCE_HOURS
      && !direct.aggregation && hasData(direct)) continue;
    const names = [...members.get(group.id)];
    const models = names.map(name => [name, performance.models?.[name]])
      .filter(([name, stats]) => stats?.scope?.stationId === performance.stationId
        && stats.scope.groupKey === null && stats.scope.modelName === name
        && stats.windowHours === PERFORMANCE_HOURS);
    const rows = models.flatMap(([name, stats]) => (stats._hourly ?? []).filter(point => {
      const at = Date.parse(point.bucketAt);
      return finite(at) && at >= start && at < end && at % HOUR === 0
        && finite(point.availability) && point.availability >= 0 && point.availability <= 100;
    }).map(point => ({
      station_id: performance.stationId, model_name: name, group_key: group.group_key,
      bucket_at: point.bucketAt, success_rate: point.availability, has_data: 1,
      avg_ttft_ms: stats.capabilities?.ttft === false ? null : point.ttftMs,
      avg_latency_ms: stats.capabilities?.latency === false ? null : point.latencyMs,
      avg_tps: stats.capabilities?.throughput === false ? null : point.throughputTps,
      window_hours: PERFORMANCE_HOURS, observed_at: stats.collectedAt ?? point.bucketAt,
    })));
    // A rolling throughput summary cannot fill missing availability or hourly history.
    if (!rows.some(row => finite(row.success_rate))) continue;
    const knownNames = new Set(rows.map(row => row.model_name));
    const known = models.filter(([name]) => knownNames.has(name));
    const kinds = new Set(known.map(([, stats]) => stats.kind));
    const kind = kinds.size === 1 ? known[0][1].kind : undefined;
    const derived = {
      ...buildPerformanceMonitor(rows, { now, groupKey: group.group_key }),
      scope: { stationId: performance.stationId, groupKey: group.group_key },
      ...(kind ? { kind } : {}),
      ...(known.every(([,stats])=>stats.availabilityBasis==='normal_probe')?{availabilityBasis:'normal_probe'}:{}),
      capabilities: Object.fromEntries(["ttft", "latency", "throughput"].map(key =>
        [key, known.some(([, stats]) => stats.capabilities?.[key] !== false)])),
      method: "group_member_model_hour_equal_weight",
      aggregation: { kind: "group_models", monitoredModels: known.length, totalModels: names.length },
      monitoredModels: known.length, totalModels: names.length,
    };
    if (kind === "model_probe_availability") derived.probeCount = known.reduce((sum, [, stats]) => sum + (stats.probeCount ?? 0), 0);
    // Keep rolling summaries separate from the 15-day hour series; never invent per-hour TPS.
    const summaries = known.map(([, stats]) => stats.throughputSummary)
      .filter(summary => finite(summary?.value) && summary.value > 0 && summary.windowHours === 168);
    if (summaries.length) derived.throughputSummary = {
      value: mean(summaries.map(summary => summary.value)), windowHours: 168,
      observedAt: summaries.map(summary => summary.observedAt).sort()[0],
      sourceUrl: summaries[0].sourceUrl,
      sourceUrls: [...new Set(summaries.map(summary => summary.sourceUrl))],
      modelCount: summaries.length,
    };
    groups.set(group.group_key, derived);
  }
  return {
    ...performance, groups: Object.fromEntries(groups),
    models: Object.fromEntries(Object.entries(performance.models ?? {}).map(([name, stats]) => {
      const publicStats = { ...stats };
      delete publicStats._hourly;
      return [name, publicStats];
    })),
  };
}
