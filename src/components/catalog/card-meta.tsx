import type { ReactNode } from "react";
import {
  formatCardTime,
  formatListedAgo,
  formatRelativeTime,
} from "@/lib/catalog/format";
import { cn } from "@/lib/utils";

/** 卡片底部信息框（卡网商品卡 / 官网定价卡共用）。 */
export function CardMeta({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-2 overflow-hidden rounded-lg border border-border/70 bg-muted/30 px-2.5 py-2.5 text-xs",
        className,
      )}
    >
      {children}
    </dl>
  );
}

export function CardMetaRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-x-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 overflow-hidden text-right">{children}</dd>
    </div>
  );
}

/** 「更新」行：yyyy/mm/dd HH:mm · x 分钟前，琥珀色，悬停显示精确时间。 */
export function CardUpdatedRow({
  updatedAt,
}: {
  updatedAt: string | null | undefined;
}) {
  const iso = updatedAt ?? null;
  const ago = formatListedAgo(iso);
  return (
    <CardMetaRow label="更新">
      <span
        className="block truncate tabular-nums text-[var(--apr-amber)]"
        title={formatRelativeTime(iso)}
      >
        {formatCardTime(iso)}
        {ago ? ` · ${ago}` : null}
      </span>
    </CardMetaRow>
  );
}
