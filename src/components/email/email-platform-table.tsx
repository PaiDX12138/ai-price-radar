import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OtpPlatformLogo } from "@/components/otp/otp-platform-logo";
import { formatCny } from "@/lib/catalog/format";
import { cn } from "@/lib/utils";

type OtpPlatformRow = {
  typeId: string;
  platformId: string;
  platformName: string;
  platformUrl: string;
  priceText: string | null;
  cnyPrice: number | null;
  status: "in_stock" | "low_stock" | "out_of_stock" | "unsupported";
  priceNote: string | null;
  sourceUrl: string | null;
};

const STATUS_LABEL: Record<OtpPlatformRow["status"], string> = {
  in_stock: "有货",
  low_stock: "紧张",
  out_of_stock: "缺货",
  unsupported: "未覆盖",
};

type EmailPlatformTableProps = {
  rows: OtpPlatformRow[];
  lowestPlatformId?: string | null;
};

export function EmailPlatformTable({
  rows,
  lowestPlatformId,
}: EmailPlatformTableProps) {
  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        暂无平台报价
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/80 bg-card">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/80 bg-muted/40 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2.5 font-medium">平台</th>
            <th className="px-3 py-2.5 font-medium">USD</th>
            <th className="px-3 py-2.5 font-medium">≈ CNY</th>
            <th className="px-3 py-2.5 font-medium">状态</th>
            <th className="px-3 py-2.5 font-medium">说明</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isLowest =
              lowestPlatformId &&
              row.platformId === lowestPlatformId &&
              row.cnyPrice != null;
            return (
              <tr
                key={`${row.platformId}-${row.typeId}-${row.status}`}
                className={cn(
                  "border-b border-border/60 last:border-0",
                  isLowest && "bg-[var(--apr-ink-soft)]/60",
                )}
              >
                <td className="px-3 py-2.5">
                  <a
                    href={row.sourceUrl || row.platformUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1.5 font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    <OtpPlatformLogo
                      platformId={row.platformId}
                      name={row.platformName}
                      size={14}
                    />
                    <span className="truncate">{row.platformName}</span>
                    <ExternalLink className="size-3 shrink-0 opacity-50" aria-hidden />
                  </a>
                  {isLowest ? (
                    <Badge variant="secondary" className="ml-2 align-middle text-[10px]">
                      最低
                    </Badge>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 font-mono tabular-nums text-muted-foreground">
                  {row.priceText ?? "—"}
                </td>
                <td
                  className={cn(
                    "px-3 py-2.5 font-mono font-semibold tabular-nums",
                    row.cnyPrice != null ? "text-[var(--apr-ink)]" : "text-muted-foreground/50",
                  )}
                >
                  {row.cnyPrice != null ? formatCny(row.cnyPrice) : "—"}
                </td>
                <td className="px-3 py-2.5">
                  <StatusPill status={row.status} />
                </td>
                <td className="max-w-[18rem] px-3 py-2.5 text-xs text-muted-foreground">
                  <span className="line-clamp-2" data-tooltip={row.priceNote ?? undefined}>
                    {row.priceNote ?? "—"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: OtpPlatformRow["status"] }) {
  const tone =
    status === "in_stock"
      ? "bg-emerald-100 text-emerald-800 ring-emerald-200/80 dark:bg-emerald-400/15 dark:text-emerald-300"
      : status === "low_stock"
        ? "bg-amber-100 text-amber-900 ring-amber-200/80 dark:bg-amber-400/15 dark:text-amber-300"
        : status === "unsupported"
          ? "bg-muted text-muted-foreground ring-border"
          : "bg-rose-100 text-rose-800 ring-rose-200/80 dark:bg-rose-400/15 dark:text-rose-300";

  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-medium ring-1",
        tone,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
