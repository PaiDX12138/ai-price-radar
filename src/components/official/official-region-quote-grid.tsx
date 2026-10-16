import { OfficialRegionQuoteCard } from "@/components/official/official-region-quote-card";
import type {
  OfficialBillingPeriod,
  OfficialRegionPrice,
} from "@/lib/official/types";

type OfficialRegionQuoteGridProps = {
  rows: OfficialRegionPrice[];
  /** 当前页内标记全局最低（通常为排序后第一条且 page=1） */
  lowestRowId?: string | null;
  /** 美区折算 CNY，传给价卡涨跌% */
  usCny?: number | null;
  billingPeriod?: OfficialBillingPeriod | null;
};

export function OfficialRegionQuoteGrid({
  rows,
  lowestRowId = null,
  usCny = null,
  billingPeriod = null,
}: OfficialRegionQuoteGridProps) {
  if (!rows.length) {
    return (
      <p className="rounded-xl border border-dashed border-border/80 bg-muted/20 py-14 text-center text-sm text-muted-foreground">
        暂无地区报价
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {rows.map((row) => (
        <li key={row.id} className="min-w-0 list-none">
          <OfficialRegionQuoteCard
            row={row}
            highlight={lowestRowId && row.id === lowestRowId ? "lowest" : null}
            usCny={usCny}
            billingPeriod={billingPeriod}
          />
        </li>
      ))}
    </ul>
  );
}
