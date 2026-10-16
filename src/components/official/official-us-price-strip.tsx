import { CountryFlag } from "@/components/official/country-flag";
import { formatCny } from "@/lib/catalog/format";
import { cn } from "@/lib/utils";

type OfficialUsPriceStripProps = {
  usListUsd?: number | null;
  usPriceText?: string | null;
  usCny: number;
  className?: string;
};

/** 美区参考价色卡：国旗 + $ · 汇率 · ≈¥（与官网详情顶栏同款）。 */
export function OfficialUsPriceStrip({
  usListUsd = null,
  usPriceText = null,
  usCny,
  className,
}: OfficialUsPriceStripProps) {
  if (!Number.isFinite(usCny) || usCny <= 0) return null;
  const fx = usFxRate(usListUsd, usCny);

  return (
    <div
      className={cn(
        "inline-flex h-[3.75rem] w-max max-w-none shrink-0 items-center gap-2 rounded-md border border-sky-200/90 bg-sky-50 px-2.5 py-1.5 dark:border-sky-400/25 dark:bg-sky-400/10",
        className,
      )}
      aria-label="美区参考价"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <CountryFlag countryCode="US" countryLabel="美国" size={16} />
          <span className="whitespace-nowrap font-mono text-base font-semibold tabular-nums leading-none text-sky-950 dark:text-sky-50">
            {formatUsUsd(usListUsd, usPriceText)}
          </span>
        </div>
        {fx != null ? (
          <p className="whitespace-nowrap font-mono text-[11px] font-medium leading-none tabular-nums tracking-wide text-sky-700/85 dark:text-sky-300/80">
            1 USD ≈ {formatCny(fx)}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <span
          aria-hidden
          className="font-mono text-base font-semibold leading-none text-sky-800/80 dark:text-sky-200/80"
        >
          ≈
        </span>
        <span className="whitespace-nowrap font-mono text-base font-semibold tabular-nums leading-none text-sky-950 dark:text-sky-50">
          {formatCny(usCny)}
        </span>
      </div>
    </div>
  );
}

function formatUsUsd(
  usListUsd: number | null | undefined,
  usPriceText: string | null | undefined,
): string {
  const n =
    usListUsd != null && Number.isFinite(usListUsd)
      ? usListUsd
      : usPriceText
        ? Number(String(usPriceText).replace(/[^0-9.]/g, ""))
        : NaN;
  if (!Number.isFinite(n)) return "—";
  return `$${n.toFixed(2)}`;
}

function usFxRate(
  usListUsd: number | null | undefined,
  usCny: number,
): number | null {
  if (usListUsd == null || !Number.isFinite(usListUsd) || usListUsd <= 0) {
    return null;
  }
  return Math.round((usCny / usListUsd) * 10000) / 10000;
}
