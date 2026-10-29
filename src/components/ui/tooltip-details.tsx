export type TooltipDetailsData = {
  title: string;
  subtitle?: string;
  rows: { label: string; value: string }[];
  note?: string;
};

/** Text-only details; shared by delegated hints and TooltipContent rich popups. */
export function TooltipDetails({ title, subtitle, rows, note }: TooltipDetailsData) {
  return <div className="min-w-0 whitespace-normal">
    <div className="mb-2 border-b border-border/60 pb-2">
      <p className="text-xs font-semibold leading-4 text-foreground">{title}</p>
      {subtitle && <p className="mt-1 break-words text-[11px] leading-4 text-muted-foreground [overflow-wrap:anywhere]">{subtitle}</p>}
    </div>
    <dl className="space-y-1.5 text-[11px] leading-4">
      {rows.map((row, index) => <div key={`${row.label}:${index}`} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-5">
        <dt className="whitespace-nowrap text-muted-foreground">{row.label}</dt>
        <dd className="min-w-0 whitespace-pre-line break-words text-right tabular-nums text-foreground [overflow-wrap:anywhere]">{row.value}</dd>
      </div>)}
    </dl>
    {note && <p className="mt-2 border-t border-border/60 pt-2 text-[10px] leading-4 text-muted-foreground">{note}</p>}
  </div>;
}

/** Keep the original element and its click behaviour, including whole-card link overlays. */
export function tooltipDetails(details: TooltipDetailsData) {
  return { "data-tooltip": details.title, "data-tooltip-details": JSON.stringify(details) };
}

export function parseTooltipDetails(raw: string | null): TooltipDetailsData | undefined {
  if (!raw || raw.length > 6000) return;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value.title !== "string" || !Array.isArray(value.rows) || value.rows.length > 12
      || (value.subtitle !== undefined && typeof value.subtitle !== "string")
      || (value.note !== undefined && typeof value.note !== "string")
      || value.rows.some((row: unknown) => !row || typeof row !== "object"
        || typeof (row as { label?: unknown }).label !== "string" || typeof (row as { value?: unknown }).value !== "string")) return;
    return value as TooltipDetailsData;
  } catch { return; }
}
