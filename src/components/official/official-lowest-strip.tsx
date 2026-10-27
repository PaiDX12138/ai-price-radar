import { TextBand } from "@/components/catalog/text-band";
import { ToneChip } from "@/components/catalog/tone-chip";
import { CountryFlag } from "@/components/official/country-flag";
import { PayChannel } from "@/components/official/pay-channel";
import { VsUsTrend } from "@/components/official/vs-us-trend";
import { formatCny, formatCnyRate } from "@/lib/catalog/format";
import { displayCountryLabel } from "@/lib/official/country-display";
import {
  taxBandLabel,
  taxNote,
  type TaxBandKind,
} from "@/lib/official/currency";
import type { OfficialRegionPrice } from "@/lib/official/types";
import { cn } from "@/lib/utils";

type OfficialLowestStripProps = {
  row: OfficialRegionPrice;
  /** 美区折算 CNY，用于股票式涨跌百分比 */
  usCny?: number | null;
  className?: string;
};

/**
 * 详情顶栏右侧：单卡三栏（无竖线，宽度随内容）
 * 左 地区+渠道 · 中 当地标价+汇率 · 右 涨跌%在上、≈人民币在下
 */
export function OfficialLowestStrip({
  row,
  usCny = null,
  className,
}: OfficialLowestStripProps) {
  const taxKind = taxBandLabel(row);
  const regionLabel = displayCountryLabel(row.countryCode, row.countryLabel);

  return (
    <div
      className={cn(
        // w-max：按内容撑开；禁止 shrink / overflow 裁切右侧 ¥ 与涨跌%
        "ml-auto inline-flex h-[3.75rem] w-max max-w-none shrink-0 items-stretch rounded-md border border-sky-200/90 bg-sky-50 dark:border-sky-400/25 dark:bg-sky-400/10",
        className,
      )}
      aria-label="最低地区参考价"
    >
      {/* 左：国旗+地区名 / 渠道+税标 */}
      <div className="flex shrink-0 flex-col justify-center gap-1 px-2.5 py-1.5">
        <div className="flex items-center gap-1.5">
          <CountryFlag
            countryCode={row.countryCode}
            countryLabel={regionLabel}
            size={16}
          />
          <span className="whitespace-nowrap text-[15px] font-semibold leading-none text-sky-950 dark:text-sky-50">
            {regionLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <PayChannel
            channel={row.channel}
            className="text-[11px] text-sky-800/80 [&_span]:text-sky-800/80 dark:text-sky-300/80 dark:[&_span]:text-sky-300/80"
          />
          {taxKind ? <TaxBandLabel kind={taxKind} row={row} /> : null}
          {row.priceBasis === "usd_reference" ? <ToneChip tone="muted" className="h-4 text-[10px]">USD 参考</ToneChip> : null}
          {row.status === "stale" ? (
            <ToneChip tone="rose" className="h-4 text-[10px]" title="历史实采标价按最新汇率折算，尚未重新确认原币价格">
              历史价
            </ToneChip>
          ) : null}
        </div>
      </div>

      {/* 中：当地标价 / 汇率 */}
      <div className="flex shrink-0 flex-col justify-center gap-1 px-2.5 py-1.5">
        <p className="whitespace-nowrap font-mono text-base font-semibold tabular-nums leading-none text-sky-950 dark:text-sky-50">
          {row.priceText || "—"}
        </p>
        <p className="whitespace-nowrap font-mono text-[11px] font-medium leading-none tabular-nums tracking-wide text-sky-700/85 dark:text-sky-300/80">
          {row.fxRateToCny != null
            ? `1 ${row.currencyCode} ≈ ${formatCnyRate(row.fxRateToCny)}`
            : row.currencyCode}
        </p>
      </div>

      {/* 右：≈ + 涨跌% / 人民币，整组带足右侧内边距 */}
      <div className="flex shrink-0 items-center gap-1.5 py-1.5 pr-3 pl-1">
        <span
          aria-hidden
          className="shrink-0 font-mono text-base font-semibold leading-none text-sky-800/80 dark:text-sky-200/80"
        >
          ≈
        </span>
        <div className="flex min-w-[4.75rem] flex-col items-end justify-center gap-1">
          <div className="flex h-[12px] items-center justify-end">
            <VsUsTrend cnyPrice={row.cnyPrice} usCny={usCny} />
          </div>
          <span className="whitespace-nowrap font-mono text-base font-semibold leading-none tabular-nums text-sky-950 dark:text-sky-50">
            {formatCny(row.cnyPrice)}
          </span>
        </div>
      </div>
    </div>
  );
}

function TaxBandLabel({
  kind,
  row,
}: {
  kind: TaxBandKind;
  row: OfficialRegionPrice;
}) {
  return (
    <TextBand
      tone="amber"
      className="text-[10px] font-semibold tracking-[0.04em] text-foreground"
      title={taxNote(row)}
    >
      {kind}
    </TextBand>
  );
}
