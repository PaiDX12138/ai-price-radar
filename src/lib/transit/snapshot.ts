import "server-only";

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {inactiveTransitIds} from "./station-policy.mjs";

export type TransitSponsorship = { affiliateUrl?: string; code?: string; benefit?: string };

export type TransitStation = {
  service_state?: { allowSignup: boolean; allowTopup: boolean; observedAt: string; closed?: boolean; closedAt?: string };
  catalog_only?: boolean;
  currency_kind?: "usd_cash" | "cny_credit" | "usd_credit" | "usd_base";
  billing_configuration?: {price:number;usdExchangeRate:number;stripeUnitPrice:number|null};
  id: string;
  name: string;
  sponsorship?: TransitSponsorship;
  site_url: string;
  canonical_url?: string | null;
  host: string;
  system: string;
  source_type: string;
  collector_kind?: string | null;
  status: string;
  listed_at: string;
  description?: string | null;
  docs_url?: string | null;
  logo_url?: string | null;
  logo_local_path?: string | null;
  monitoring_url?: string | null;
  source_fingerprint?: string | null;
  last_source_generated_at?: string | null;
  last_seen_at: string | null;
  last_collected_at: string | null;
  last_collect_ok: number | null;
  risk_note: string | null;
  config_json?: string | null;
  raw_meta_json: string | null;
  recharge_ratio?: number | null;
  recharge_details_json?: string | null;
};

export type TransitGroup = {
  id: string;
  station_id: string;
  group_key: string;
  display_name: string;
  recharge_ratio: number | null;
  model_ratio: number | null;
  completion_ratio: number | null;
  cache_read_ratio: number | null;
  cache_write_ratio: number | null;
  pool_type: string | null;
  subscription: string | null;
  channel_type: string | null;
  disclosure: string | null;
  description?: string | null;
  warning?: string | null;
  third_party_allowed?: number | null;
  supported_protocols_json?: string | null;
  endpoint_overrides_json?: string | null;
  raw_group_json?: string | null;
  status: string;
  observed_at: string;
  updated_at: string;
};

export type TransitOffer = {
  id: string;
  group_id: string;
  raw_model: string;
  standard_model: string | null;
  family: string | null;
  modality: string;
  price_kind: string;
  input_price: number | null;
  output_price: number | null;
  cache_read_price: number | null;
  cache_write_price: number | null;
  cache_write_1h_price?: number | null;
  cache_creation_price?: number | null;
  fixed_price: number | null;
  price_unit: string | null;
  currency: string;
  composite_multiplier: number | null;
  discount_ratio?: number | null;
  discount_source?: string | null;
  discount_basis?: string | null;
  discount_details_json?: string | null;
  vendor_id?: number | null;
  vendor_name?: string | null;
  quota_type?: number | null;
  billing_mode?: string | null;
  model_price_min?: number | null;
  model_price_max?: number | null;
  image_ratio?: number | null;
  image_billing_json?: string | null;
  tiers_json?: string | null;
  supported_endpoint_types_json?: string | null;
  base_price_json?: string | null;
  effective_price_json?: string | null;
  source_model_version?: string | null;
  source_url: string | null;
  raw_offer_hash: string | null;
  raw_offer_json?: string | null;
  observed_at: string;
  updated_at: string;
};

export type TransitSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  source: string;
  stations: TransitStation[];
  groups: TransitGroup[];
  offers: TransitOffer[];
  performance?: TransitPerformanceSnapshot[];
  stats?: {
    stationCount?: number;
    groupCount?: number;
    offerCount?: number;
  };
};

export type TransitMonitorStats = {
  kind?: "probe_availability" | "model_probe_availability";
  availabilityBasis?: "normal_probe";
  aggregation?: { kind: "group_models"; monitoredModels: number; totalModels: number };
  sourceVersion?: string;
  probeCount?: number;
  throughputSummary?: { value: number; windowHours: number; observedAt: string; sourceUrl: string; sourceUrls?: string[]; modelCount?: number };
  coverageScope?: "infrastructure";
  monitoredModels?: number;
  totalModels?: number;
  sourceSummary?: { availability: number; observedAt: string; sourceUrl: string };
  capabilities?: { ttft: boolean; latency: boolean; throughput: boolean };
  scope: { stationId: string; groupKey: string | null; modelName?: string };
  availability: number | null;
  latestTtftMs: number | null;
  latestLatencyMs?: number | null;
  latestThroughputTps?: number | null;
  averageThroughputTps?: number | null;
  latencyHours?: number;
  throughputHours?: number;
  averageLatencyMs: number | null;
  samples: number;
  expectedHours: number;
  windowHours: number;
  windowStart: string;
  windowEnd: string;
  latestBucketAt: string | null;
  collectedAt: string | null;
  method: string;
  bars: { availability: number | null; latencyMs: number | null; label: string; startAt?: string; endAt?: string; ttftMs?: number | null; throughputTps?: number | null; knownHours?: number; expectedHours?: number }[];
};
export type TransitPerformanceSnapshot = {
  stationId: string;
  station: TransitMonitorStats;
  groups: Record<string, TransitMonitorStats>;
  models?: Record<string, TransitMonitorStats>;
  infrastructure?: { id: number; name: string; monitor: TransitMonitorStats }[];
};

const SNAPSHOT_REL = join("data", "transit", "latest.json");
const TTL_DEFAULT = 300;
const TTL_MIN = 60;
const TTL_MAX = 3600;

type MemoryEntry = {
  snapshot: TransitSnapshot;
  loadedAtMs: number;
  mtimeMs: number;
  path: string;
  checkedAtMs: number;
};

let memory: MemoryEntry | null = null;

export function resolveTransitSnapshotPath(): string {
  return process.env.TRANSIT_SNAPSHOT_PATH || join(process.cwd(), SNAPSHOT_REL);
}

export function getTransitCacheTtlSeconds(): number {
  const raw = Number(process.env.TRANSIT_CACHE_TTL_SECONDS ?? TTL_DEFAULT);
  if (!Number.isFinite(raw)) return TTL_DEFAULT;
  return Math.min(TTL_MAX, Math.max(TTL_MIN, Math.trunc(raw)));
}

function isValidSnapshot(value: unknown): value is TransitSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as TransitSnapshot;
  return (
    v.schemaVersion === 1 &&
    typeof v.generatedAt === "string" &&
    Array.isArray(v.stations) &&
    Array.isArray(v.groups) &&
    Array.isArray(v.offers)
    && (v.performance === undefined || Array.isArray(v.performance))
  );
}

function visibleSnapshot(snapshot: TransitSnapshot): TransitSnapshot {
  const inactive=inactiveTransitIds();
  if(!snapshot.stations.some(s=>inactive.has(s.id)))return snapshot;
  const stations=snapshot.stations.filter(s=>!inactive.has(s.id)),groups=snapshot.groups.filter(g=>!inactive.has(g.station_id));
  const ids=new Set(groups.map(g=>g.id)),offers=snapshot.offers.filter(o=>ids.has(o.group_id));
  return {...snapshot,stations,groups,offers,performance:snapshot.performance?.filter(p=>!inactive.has(p.stationId)),
    stats:{stationCount:stations.length,groupCount:groups.length,offerCount:offers.length}};
}

/**
 * Frontend read path: memory TTL + disk mtime invalidation.
 * It never opens SQLite and never calls a remote collector.
 */
export function loadTransitSnapshot(): TransitSnapshot | null {
  const path = resolveTransitSnapshotPath();
  const now = Math.floor(performance.timeOrigin + performance.now());
  if(memory?.path!==path) memory=null;
  // Refreshes inside this window are entirely memory-only (no SQLite or fs).
  if(memory && now-memory.checkedAtMs<30000) return memory.snapshot;
  const fallback=() => {
    if(memory) {memory.checkedAtMs=now;return memory.snapshot;}
    try {
      const previous=JSON.parse(readFileSync(`${path}.last-good`,"utf8"));
      if(isValidSnapshot(previous)) {
        const visible=visibleSnapshot(previous);
        memory={snapshot:visible,mtimeMs:0,path,loadedAtMs:now,checkedAtMs:now};return visible;
      }
    } catch { /* clean empty state on first boot */ }
    return null;
  };
  if (!existsSync(path)) return fallback();

  let mtimeMs = 0;
  try {
    mtimeMs = statSync(path).mtimeMs;
  } catch {
    return fallback();
  }

  if (
    memory &&
    memory.mtimeMs === mtimeMs &&
    now - memory.loadedAtMs < getTransitCacheTtlSeconds() * 1000
  ) {
    memory.checkedAtMs=now;
    return memory.snapshot;
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!isValidSnapshot(parsed)) throw new Error(`Invalid transit snapshot at ${path}`);
    const visible=visibleSnapshot(parsed);
    memory = { snapshot: visible, loadedAtMs: now, mtimeMs, path,checkedAtMs:now };
    return visible;
  } catch (error) {
    console.warn("[transit] read snapshot failed:", error instanceof Error ? error.message : error);
    return fallback();
  }
}

export function clearTransitSnapshotCache(): void {
  memory = null;
}
