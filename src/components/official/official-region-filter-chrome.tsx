import Link from "next/link";
import { Globe } from "lucide-react";
import { StickyPlatformFilter } from "@/components/catalog/sticky-platform-filter";
import { OfficialBillingPeriodSwitch } from "@/components/official/official-billing-period-switch";
import type { ReactNode } from "react";
import { OfficialRegionSearch } from "@/components/official/official-region-search";
import { regionChannelTabLabel } from "@/lib/official/region-search";
import type { OfficialBillingPeriod } from "@/lib/official/types";
import { cn } from "@/lib/utils";

export type OfficialRegionChannelTab = {
  id: string | null;
  count: number;
};

type OfficialRegionFilterChromeProps = {
  planId: string;
  channel: string | null;
  tabs: OfficialRegionChannelTab[];
  /** 当前搜索词，切换渠道时保留 */
  q?: string;
  billingPeriod: OfficialBillingPeriod;
  monthlyPlanId: string | null;
  annualPlanId: string | null;
  className?: string;
  /** 自定义搜索槽（客户端筛选时传入，避免 URL 导航打断输入） */
  searchSlot?: ReactNode;
};

function channelHref(planId: string, channel: string | null, q?: string) {
  const base = `/official/${encodeURIComponent(planId)}`;
  const params = new URLSearchParams();
  if (channel) params.set("channel", channel);
  if (q?.trim()) params.set("q", q.trim());
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** 与 PlatformLogo 同款小图标底。 */
function ChannelTabIcon({ channel }: { channel: string | null }) {
  const size = 14;
  const pad = Math.max(4, Math.round(size * 0.35));
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-md bg-background shadow-sm ring-1 ring-border/70"
      style={{ width: size + pad, height: size + pad }}
      aria-hidden
    >
      {channel === "ios_store" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/brands/apple.svg"
          alt=""
          width={size}
          height={size}
          className="block dark:invert"
          draggable={false}
        />
      ) : channel === "web_direct" ? (
        <Globe
          className="text-foreground"
          style={{ width: size, height: size }}
          strokeWidth={2}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/brands/all.svg"
          alt=""
          width={size}
          height={size}
          className="block"
          draggable={false}
        />
      )}
    </span>
  );
}

/**
 * 详情地区报价筛选：内容宽度自适应（不拉满），渠道 Tab + 搜索。
 */
export function OfficialRegionFilterChrome({
  planId,
  channel,
  tabs,
  q = "",
  billingPeriod,
  monthlyPlanId,
  annualPlanId,
  className,
  searchSlot,
}: OfficialRegionFilterChromeProps) {
  return (
    <StickyPlatformFilter className={cn("w-fit max-w-full", className)}>
      <div className="flex w-fit max-w-full flex-col items-stretch">
        <div
          role="tablist"
          aria-label="价格渠道"
          className="inline-flex max-w-full flex-wrap items-center gap-1 p-0.5 text-muted-foreground"
        >
          {tabs.map((tab) => {
            const selected = tab.id === channel;
            return (
              <Link
                key={tab.id ?? "all"}
                href={channelHref(planId, tab.id, q)}
                scroll={false}
                role="tab"
                aria-selected={selected}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-all",
                  selected
                    ? "bg-background/80 text-foreground shadow-sm ring-1 ring-foreground/10 backdrop-blur-sm"
                    : "hover:bg-background/50 hover:text-foreground",
                )}
              >
                <ChannelTabIcon channel={tab.id} />
                <span>{regionChannelTabLabel(tab.id)}</span>
                <span className="tabular-nums text-[11px] font-normal text-muted-foreground">
                  {tab.count}
                </span>
              </Link>
            );
          })}
        </div>
        <div className="flex w-full min-w-0 items-center gap-1.5 px-0.5 pt-0.5">
          {searchSlot ?? <OfficialRegionSearch className="min-w-0 flex-1" />}
          <OfficialBillingPeriodSwitch
            active={billingPeriod}
            monthlyPlanId={monthlyPlanId}
            annualPlanId={annualPlanId}
            channel={channel}
            q={q}
          />
        </div>
      </div>
    </StickyPlatformFilter>
  );
}
