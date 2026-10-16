"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CompositionEvent,
} from "react";
import { Search } from "lucide-react";
import { OfficialDetailPagination } from "@/components/catalog/catalog-pagination";
import { OFFICIAL_REGIONS_PAGE_SIZE } from "@/lib/catalog/pagination";
import { OfficialRegionFilterChrome } from "@/components/official/official-region-filter-chrome";
import { OfficialRegionQuoteGrid } from "@/components/official/official-region-quote-grid";
import { Input } from "@/components/ui/input";
import { matchRegionQuery } from "@/lib/official/region-search";
import type {
  OfficialBillingPeriod,
  OfficialRegionPrice,
} from "@/lib/official/types";
import { cn } from "@/lib/utils";

type OfficialRegionQuotesSectionProps = {
  planId: string;
  everyRow: OfficialRegionPrice[];
  channel: string | null;
  channelOptions: string[];
  channelCounts: Record<string, number>;
  /** 首屏 URL 上的 q（仅 hydration） */
  initialQ?: string;
  billingPeriod: OfficialBillingPeriod;
  monthlyPlanId: string | null;
  annualPlanId: string | null;
  lowestRowId: string | null;
  usCny: number | null;
};

/** 用 history.replaceState 同步 q/page，避免 Next 软导航 → Suspense 重挂载打断输入。 */
function syncUrlQuery(patch: { q?: string; page?: number }) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const q = patch.q?.trim() ?? "";
  if (q) url.searchParams.set("q", q);
  else url.searchParams.delete("q");
  if (patch.page != null && patch.page > 1) {
    url.searchParams.set("page", String(patch.page));
  } else {
    url.searchParams.delete("page");
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  const cur = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== cur) {
    window.history.replaceState(window.history.state, "", next);
  }
}

/**
 * 详情地区报价：搜索/翻页在客户端完成。
 * 输入法组合期不写 URL；写 URL 只用 replaceState，不触发 RSC 刷新。
 */
export function OfficialRegionQuotesSection({
  planId,
  everyRow,
  channel,
  channelOptions,
  channelCounts,
  initialQ = "",
  billingPeriod,
  monthlyPlanId,
  annualPlanId,
  lowestRowId,
  usCny,
}: OfficialRegionQuotesSectionProps) {
  const [qDraft, setQDraft] = useState(initialQ);
  const [page, setPage] = useState(1);
  const composingRef = useRef(false);
  const qDraftRef = useRef(qDraft);
  qDraftRef.current = qDraft;

  const channelTabs = useMemo(
    () => [
      { id: null as string | null, count: everyRow.length },
      ...channelOptions.map((c) => ({
        id: c as string | null,
        count: channelCounts[c] ?? 0,
      })),
    ],
    [everyRow.length, channelOptions, channelCounts],
  );

  const filtered = useMemo(() => {
    const base = channel
      ? everyRow.filter((row) => row.channel === channel)
      : everyRow;
    const q = qDraft.trim();
    if (!q) return base;
    return base.filter((row) => matchRegionQuery(row, q));
  }, [everyRow, channel, qDraft]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / OFFICIAL_REGIONS_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const rows = filtered.slice(
    (safePage - 1) * OFFICIAL_REGIONS_PAGE_SIZE,
    safePage * OFFICIAL_REGIONS_PAGE_SIZE,
  );

  // 搜索变化回到第 1 页
  useEffect(() => {
    setPage(1);
  }, [qDraft, channel]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  // 防抖同步 URL（组合期跳过）
  useEffect(() => {
    if (composingRef.current) return;
    const handle = window.setTimeout(() => {
      if (composingRef.current) return;
      syncUrlQuery({ q: qDraftRef.current, page: safePage });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [qDraft, safePage]);

  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setQDraft(e.target.value);
  }, []);

  const onCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  const onCompositionEnd = useCallback((e: CompositionEvent<HTMLInputElement>) => {
    composingRef.current = false;
    setQDraft(e.currentTarget.value);
  }, []);

  const goPage = useCallback(
    (next: number) => {
      const p = Math.min(Math.max(1, next), totalPages);
      setPage(p);
      syncUrlQuery({ q: qDraftRef.current, page: p });
    },
    [totalPages],
  );

  return (
    <div className="space-y-3">
      <OfficialRegionFilterChrome
        planId={planId}
        channel={channel}
        tabs={channelTabs}
        q={qDraft}
        billingPeriod={billingPeriod}
        monthlyPlanId={monthlyPlanId}
        annualPlanId={annualPlanId}
        searchSlot={
          <div className="relative min-w-0 flex-1 px-0.5 pt-0.5">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={qDraft}
              onChange={onChange}
              onCompositionStart={onCompositionStart}
              onCompositionEnd={onCompositionEnd}
              placeholder="搜索国家中文 / 英文 / 编号"
              aria-label="搜索地区"
              autoComplete="off"
              spellCheck={false}
              className={cn("h-8 w-full bg-background/40 pr-2 pl-8 text-xs")}
            />
          </div>
        }
      />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/80 px-4 py-8 text-center text-sm text-muted-foreground">
          没有符合筛选的地区报价
        </p>
      ) : (
        <OfficialRegionQuoteGrid
          rows={rows}
          lowestRowId={lowestRowId}
          usCny={usCny}
          billingPeriod={billingPeriod}
        />
      )}

      <OfficialDetailPagination
        planId={planId}
        page={safePage}
        totalPages={totalPages}
        totalItems={totalItems}
        channel={channel}
        q={qDraft}
        onPageClick={goPage}
      />
    </div>
  );
}
