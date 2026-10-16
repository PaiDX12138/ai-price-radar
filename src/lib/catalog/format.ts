import type { OfferStatus } from "@/lib/catalog/types";

export function formatCny(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "暂无价格";
  return `¥${value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** 汇率用：小额多留小数，避免 `≈ ¥0.00`。 */
export function formatCnyRate(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const digits = abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return `¥${value.toLocaleString("zh-CN", {
    minimumFractionDigits: Math.min(2, digits),
    maximumFractionDigits: digits,
  })}`;
}

/** Absolute local time from ISO (no Date.now). Includes seconds. */
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "未记录";
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

/** 卡片展示用：yyyy/mm/dd HH:mm（不含秒） */
export function formatCardTime(iso: string | null): string {
  if (!iso) return "未记录";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "未记录";
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
}

/**
 * 粗粒度相对时间：分钟 / 小时 / 天 / 月 / 年（用于「收录于xx前」）。
 * 客户端组件可用；SSR 勿依赖精确到秒。
 */
export function formatListedAgo(iso: string | null | undefined, nowMs: number = Date.now()): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const diff = Math.max(0, nowMs - t);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;
  if (diff < hour) {
    const n = Math.max(1, Math.floor(diff / minute));
    return `${n}分钟前`;
  }
  if (diff < day) {
    const n = Math.max(1, Math.floor(diff / hour));
    return `${n}小时前`;
  }
  if (diff < month) {
    const n = Math.max(1, Math.floor(diff / day));
    return `${n}天前`;
  }
  if (diff < year) {
    const n = Math.max(1, Math.floor(diff / month));
    return `${n}月前`;
  }
  const n = Math.max(1, Math.floor(diff / year));
  return `${n}年前`;
}

export function statusBadge(status: OfferStatus): { label: string; className: string } {
  if (status === "in_stock") return { label: "有货", className: "badge-success" };
  if (status === "low_stock") return { label: "紧张", className: "badge-warning" };
  return { label: "缺货", className: "badge-ghost" };
}

/**
 * 非计件库存文案：统一成「库存一般 / 库存非常多 / 库存充足」等。
 * 「人工发货」原样返回（琥珀色单独渲染，不加「库存」前缀）。
 * 有数字件数时走 stockCount，不用本函数。
 */
export function formatQualitativeStock(label: string | null | undefined): string | null {
  const t = String(label ?? "").trim();
  if (!t) return null;
  if (t === "人工发货" || t.includes("人工发货")) return "人工发货";
  if (t.startsWith("库存")) return t;
  return `库存${t}`;
}

/** 16688 等：无计件 + 人工发货标签 → 展示「人工发货」 */
export function resolveOfferStockLabel(offer: {
  stockCount?: number | null;
  stockLabel?: string | null;
  tags?: string[] | null;
  sourceId?: string;
  collectorKind?: string | null;
  source?: { platform?: string | null; collectorKind?: string | null } | null;
}): string | null {
  if (offer.stockCount !== null && offer.stockCount !== undefined) return null;
  const fromLabel = formatQualitativeStock(offer.stockLabel);
  if (fromLabel === "人工发货") return "人工发货";
  const tags = Array.isArray(offer.tags) ? offer.tags : [];
  if (tags.some((t) => String(t).includes("人工发货"))) return "人工发货";
  // 存量报价：16688 且 qty=-1/空 未写 stockLabel 时，按人工发货展示
  const kind = String(
    offer.collectorKind || offer.source?.collectorKind || "",
  ).toLowerCase();
  const platform = String(offer.source?.platform || "").toLowerCase();
  const sid = String(offer.sourceId || "");
  const is16688 =
    kind === "shop16688" ||
    platform === "shop16688" ||
    sid.startsWith("16688-");
  if (is16688) return "人工发货";
  return fromLabel;
}
/** 报价超过这个时长没在成功采集里出现，就算数据较旧 */
export const OFFER_STALE_MS = 24 * 60 * 60 * 1000;

/** 店铺最近一轮采集失败，或报价 lastSeenAt 超过 24 小时 */
export function isOfferStale(
  offer: { lastSeenAt?: string | null; capturedAt: string; source?: { collectStatus?: string } },
  nowMs: number = Date.now(),
): boolean {
  if (offer.source?.collectStatus === "failed") return true;
  const seen = Date.parse(offer.lastSeenAt || offer.capturedAt);
  return Number.isFinite(seen) && nowMs - seen > OFFER_STALE_MS;
}
