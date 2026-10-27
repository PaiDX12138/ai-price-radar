import "server-only";

import {
  officialComparisonPool,
  sortByDisplayCny,
  toDisplayRegionPrice,
} from "@/lib/official/exclusive-price";
import { resolveProductPromo } from "@/lib/official/promos";
import {
  clearOfficialSnapshotCache,
  loadOfficialSnapshot,
} from "@/lib/official/snapshot";
import type {
  OfficialLowestRow,
  OfficialPlanSummary,
  OfficialProductCard,
  OfficialRegionPrice,
} from "@/lib/official/types";

export function clearOfficialCache() {
  clearOfficialSnapshotCache();
}

/** 地区行统一折成不含税后按 CNY 排序。 */
function regionRowsForPlan(planId: string): OfficialRegionPrice[] {
  const rows = loadOfficialSnapshot()?.regionPricesByPlanId[planId] ?? [];
  return [...rows].map(toDisplayRegionPrice).sort(sortByDisplayCny);
}

function lowestToRow(lowest: OfficialLowestRow): OfficialRegionPrice {
  return {
    id: "lowest",
    ...lowest,
  };
}

function rowToLowest(row: OfficialRegionPrice): OfficialLowestRow {
  return {
    countryCode: row.countryCode,
    countryLabel: row.countryLabel,
    currencyCode: row.currencyCode,
    priceText: row.priceText,
    priceValue: row.priceValue,
    cnyPrice: row.cnyPrice,
    fxRateToCny: row.fxRateToCny,
    fxDate: row.fxDate,
    sourceUrl: row.sourceUrl,
    status: row.status,
    channel: row.channel,
    priceBasis: row.priceBasis,
    sourceOfferId: row.sourceOfferId,
    listPriceValue: row.listPriceValue,
    taxMode: row.taxMode ?? null,
    taxPercent: row.taxPercent ?? null,
    updatedAt: row.updatedAt,
    lastSuccessAt: row.lastSuccessAt,
  };
}

/** 套餐汇总：最低价 / 美区价按不含税展示口径。 */
function withDisplaySummary(plan: OfficialPlanSummary): OfficialPlanSummary {
  const rows = regionRowsForPlan(plan.id);
  const pool = officialComparisonPool(rows);
  const lowestRow = pool[0] ?? toDisplayRegionPrice(lowestToRow(plan.lowest));
  const usRows = rows.filter((r) => r.countryCode === "US");
  const verifiedUs = usRows.filter((r) => r.status === "available" || r.status === "stale");
  const us = verifiedUs.find((r) => r.channel === "web_direct") ?? verifiedUs[0] ?? usRows[0] ?? null;
  const usCny = us?.status === "estimated" ? null : us?.cnyPrice ?? plan.usCny;
  const savePct = usCny == null || usCny <= 0 ? null :
    lowestRow.cnyPrice < usCny
      ? Math.round(((usCny - lowestRow.cnyPrice) / usCny) * 10000) / 100
      : lowestRow.countryCode === "US"
        ? 0
        : null;
  const usLiveUsd =
    us &&
    us.currencyCode?.toUpperCase() === "USD" &&
    us.priceValue != null &&
    Number.isFinite(us.priceValue) &&
    us.priceValue > 0
      ? us.priceValue
      : plan.usLiveUsd;

  return {
    ...plan,
    // 直接从完整地区行重算，旧快照的汇总也不能漏掉历史报价。
    sampleCount: rows.length ? new Set(rows.map((r) => r.countryCode)).size : plan.sampleCount,
    quoteCount: rows.length || plan.quoteCount,
    channelCounts: rows.length
      ? rows.reduce<Record<string, number>>((counts, row) => {
          counts[row.channel] = (counts[row.channel] ?? 0) + 1;
          return counts;
        }, {})
      : plan.channelCounts,
    usCny,
    usLiveUsd,
    usPriceText: us?.priceText ?? plan.usPriceText,
    savePct,
    lowest: rowToLowest(lowestRow),
  };
}

function allSummaries(): OfficialPlanSummary[] {
  return (loadOfficialSnapshot()?.summaries ?? []).map(withDisplaySummary);
}

/** 是否已有可展示的官方价数据（用于空态文案）。 */
export function hasOfficialData(): boolean {
  return allSummaries().length > 0;
}

/**
 * 套餐汇总（配置顺序）。搜索覆盖：套餐名 / 平台 / 产品族 / 全部地区名与代码。
 */
export function listOfficialPlanSummaries(
  opts: { platform?: string; q?: string } = {},
): OfficialPlanSummary[] {
  const platform =
    opts.platform && opts.platform !== "all" ? opts.platform : null;
  const needle = opts.q?.trim().toLowerCase() || "";
  const snapshot = loadOfficialSnapshot();
  if (!snapshot) return [];

  return snapshot.summaries
    .filter((s) => {
      if (platform && s.catalogPlatform !== platform && s.appSlug !== platform) {
        return false;
      }
      if (!needle) return true;
      const regions = regionRowsForPlan(s.id);
      const hay = [
        s.label,
        s.appName,
        s.provider,
        s.family,
        s.catalogSlug,
        s.billingPeriod === "annual" ? "年付 annual" : "月付 monthly",
        ...regions.flatMap((r) => [r.countryLabel, r.countryCode, r.priceText]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    })
    .map(withDisplaySummary);
}

/** 列表卡：按产品族（family）合并月付 / 年付。 */
export function listOfficialProductCards(
  opts: { platform?: string; q?: string } = {},
): OfficialProductCard[] {
  const plans = listOfficialPlanSummaries(opts);
  const order: string[] = [];
  const byFamily = new Map<string, OfficialPlanSummary[]>();
  for (const plan of plans) {
    const key = `${plan.appSlug}__${plan.family}`;
    if (!byFamily.has(key)) {
      byFamily.set(key, []);
      order.push(key);
    }
    byFamily.get(key)!.push(plan);
  }

  const regionMap: Record<string, OfficialRegionPrice[]> = {};
  for (const plan of plans) {
    regionMap[plan.id] = regionRowsForPlan(plan.id);
  }

  const cards: OfficialProductCard[] = [];
  for (const key of order) {
    const group = byFamily.get(key) ?? [];
    const monthly = group.find((p) => p.billingPeriod === "monthly") ?? null;
    const annual = group.find((p) => p.billingPeriod === "annual") ?? null;
    const primary = monthly ?? annual;
    if (!primary) continue;
    const updatedAt =
      [monthly?.updatedAt, annual?.updatedAt]
        .filter((v): v is string => Boolean(v))
        .sort()
        .at(-1) ?? null;
    cards.push({
      id: key,
      family: primary.family,
      label: primary.label,
      catalogSlug: primary.catalogSlug,
      appSlug: primary.appSlug,
      appName: primary.appName,
      provider: primary.provider,
      catalogPlatform: primary.catalogPlatform,
      monthly,
      annual,
      detailId: primary.id,
      sampleCount: Math.max(monthly?.sampleCount ?? 0, annual?.sampleCount ?? 0),
      quoteCount: Math.max(
        monthly?.quoteCount ?? monthly?.sampleCount ?? 0,
        annual?.quoteCount ?? annual?.sampleCount ?? 0,
      ),
      updatedAt,
      promo: resolveProductPromo(monthly, annual, regionMap),
    });
  }
  return cards;
}

export function getOfficialPlanSummaryById(
  id: string,
): OfficialPlanSummary | null {
  if (!id) return null;
  return allSummaries().find((s) => s.id === id) ?? null;
}

/** 同产品族的月付 / 年付套餐（详情页切换用），月付在前。 */
export function listOfficialFamilyPlans(id: string): OfficialPlanSummary[] {
  const current = getOfficialPlanSummaryById(id);
  if (!current) return [];
  return allSummaries()
    .filter((s) => s.appSlug === current.appSlug && s.family === current.family)
    .sort((a, b) =>
      a.billingPeriod === b.billingPeriod
        ? 0
        : a.billingPeriod === "monthly"
          ? -1
          : 1,
    );
}

/**
 * 某套餐全部地区报价（实采当前价和历史价共同按人民币升序，估算价置后）。
 * 同一国家官网 + iOS 各一条；`channel` 可只看某一渠道。
 */
export function listOfficialRegionPrices(
  planId: string,
  opts: { channel?: string | null } = {},
): OfficialRegionPrice[] {
  const rows = regionRowsForPlan(planId);
  if (!rows.length) return [];
  return opts.channel ? rows.filter((r) => r.channel === opts.channel) : rows;
}

/**
 * 商品详情「官方参考」：优先月付套餐的美区价，缺失则取该套餐最低区。
 */
/**
 * 官网日更 USD→CNY 汇率（与 collect:official --mode=fx_only 同源）。
 * 优先取快照里任意 USD 报价的 fxRateToCny，其次用美区 list/cny 反推。
 */
export function getOfficialUsdToCny(): {
  rate: number;
  date: string | null;
} {
  const fallback = { rate: 6.7739, date: null as string | null };
  const snapshot = loadOfficialSnapshot();
  if (!snapshot) return fallback;

  for (const plan of snapshot.summaries) {
    const row = plan.lowest;
    if (
      row?.currencyCode === "USD" &&
      typeof row.fxRateToCny === "number" &&
      Number.isFinite(row.fxRateToCny) &&
      row.fxRateToCny > 0
    ) {
      return { rate: row.fxRateToCny, date: row.fxDate ?? snapshot.fxDate };
    }
  }

  for (const plan of snapshot.summaries) {
    if (
      typeof plan.usListUsd === "number" &&
      plan.usListUsd > 0 &&
      typeof plan.usCny === "number" &&
      plan.usCny > 0
    ) {
      return {
        rate: Math.round((plan.usCny / plan.usListUsd) * 10000) / 10000,
        date: snapshot.fxDate,
      };
    }
  }

  return { rate: fallback.rate, date: snapshot.fxDate };
}

/**
 * 卡网「官方正价」：取官网/商店真实最低地区报价（月付优先），含美区对照价。
 */
export function getOfficialLowestQuoteBySlug(catalogSlug: string): {
  planId: string;
  row: OfficialRegionPrice;
  usCny: number | null;
  usListUsd: number | null;
  usPriceText: string | null;
} | null {
  if (!catalogSlug) return null;
  const snapshot = loadOfficialSnapshot();
  if (!snapshot) return null;
  const candidates = snapshot.summaries.filter(
    (s) => s.catalogSlug === catalogSlug,
  );
  if (!candidates.length) return null;
  const plan =
    candidates.find((s) => s.billingPeriod === "monthly") ?? candidates[0];
  const displayPlan = withDisplaySummary(plan);
  const row = toDisplayRegionPrice(lowestToRow(displayPlan.lowest));
  if (!Number.isFinite(row.cnyPrice) || row.cnyPrice <= 0) return null;
  return {
    planId: displayPlan.id,
    row,
    usCny: displayPlan.usCny,
    usListUsd: displayPlan.usListUsd,
    usPriceText: displayPlan.usPriceText,
  };
}

/** @deprecated 优先用 getOfficialLowestQuoteBySlug；此处返回最低地区折合 CNY。 */
export function getOfficialCnyBySlug(catalogSlug: string): number | null {
  return getOfficialLowestQuoteBySlug(catalogSlug)?.row.cnyPrice ?? null;
}
