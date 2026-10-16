import "server-only";

import type {
  OfficialPlanSummary,
  OfficialPromo,
  OfficialRegionPrice,
} from "@/lib/official/types";

/** 忽略 19.99 vs 20 这类舍入噪声；低于此比例不算公开折扣。 */
export const OFFICIAL_PROMO_MIN_PERCENT = 5;

/**
 * 美区实采 USD：优先官网直购，其次 App Store。
 * 地区价差（如埃及更便宜）不算套餐级「优惠」。
 */
export function resolveUsLiveUsd(
  rows: OfficialRegionPrice[] | undefined,
): number | null {
  if (!rows?.length) return null;
  const us = rows.filter(
    (r) =>
      r.countryCode === "US" &&
      r.currencyCode === "USD" &&
      typeof r.priceValue === "number" &&
      Number.isFinite(r.priceValue) &&
      r.priceValue > 0,
  );
  if (!us.length) return null;
  const web = us.find((r) => r.channel === "web_direct");
  return (web ?? us[0]).priceValue;
}

/**
 * 基准价（无折扣时应有的美区 USD 标价）：
 * - `regularUsd`：永久价目 / 调价前 MSRP（可选，FX 类套餐促销时用）
 * - 否则用 `usListUsd`（plans.json 配置基准）
 */
export function resolvePromoBaselineUsd(plan: {
  usListUsd?: number | null;
  regularUsd?: number | null;
}): number | null {
  const regular = Number(plan.regularUsd);
  if (Number.isFinite(regular) && regular > 0) return regular;
  const list = Number(plan.usListUsd);
  if (Number.isFinite(list) && list > 0) return list;
  return null;
}

/**
 * 实采价低于基准 ≥ OFFICIAL_PROMO_MIN_PERCENT → 自动优惠角标。
 * 邀请码 / 回流首月等不在此列（公开价目未降则不亮）。
 */
export function detectOfficialPromo(opts: {
  baselineUsd: number | null | undefined;
  liveUsd: number | null | undefined;
  label?: string;
}): OfficialPromo | null {
  const baseline = Number(opts.baselineUsd);
  const live = Number(opts.liveUsd);
  if (!Number.isFinite(baseline) || baseline <= 0) return null;
  if (!Number.isFinite(live) || live <= 0) return null;
  const pct = ((baseline - live) / baseline) * 100;
  if (pct < OFFICIAL_PROMO_MIN_PERCENT) return null;
  return {
    percent: Math.round(pct * 10) / 10,
    label: opts.label?.trim() || "优惠",
  };
}

/** 单套餐：用快照地区行 + 配置基准自动判断。 */
export function resolvePlanPromo(
  plan: OfficialPlanSummary,
  regionRows?: OfficialRegionPrice[],
): OfficialPromo | null {
  const baseline = resolvePromoBaselineUsd(plan);
  const live =
    resolveUsLiveUsd(regionRows) ??
    (typeof plan.usLiveUsd === "number" && plan.usLiveUsd > 0
      ? plan.usLiveUsd
      : null) ??
    // FX 类：美区行即 usListUsd；配了 regularUsd 且 list 更低时也能亮角标
    (typeof plan.usListUsd === "number" && plan.usListUsd > 0
      ? plan.usListUsd
      : null);
  return detectOfficialPromo({ baselineUsd: baseline, liveUsd: live });
}

/** 产品卡：月付/年付取折扣幅度更大者。 */
export function resolveProductPromo(
  monthly: OfficialPlanSummary | null,
  annual: OfficialPlanSummary | null,
  regionPricesByPlanId: Record<string, OfficialRegionPrice[]>,
): OfficialPromo | null {
  const candidates = [monthly, annual]
    .filter((p): p is OfficialPlanSummary => Boolean(p))
    .map((p) => resolvePlanPromo(p, regionPricesByPlanId[p.id]))
    .filter((p): p is OfficialPromo => Boolean(p));
  if (!candidates.length) return null;
  return candidates.reduce((best, cur) =>
    cur.percent > best.percent ? cur : best,
  );
}
