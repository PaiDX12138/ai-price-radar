import { Gift } from "lucide-react";
import { tooltipDetails } from "@/components/ui/tooltip-details";
import type { TransitSponsorship } from "@/lib/transit/snapshot";

/** An informational mark, independent of navigation and automatic ordering. */
export function TransitSponsorMark({ sponsorship }: { sponsorship?: TransitSponsorship }) {
  if (!sponsorship) return null;
  return <span tabIndex={0} role="img" aria-label="赞助合作说明"
    {...tooltipDetails({
      title: "推广 / 合作",
      subtitle: "该平台为推广/合作链接，不影响公开采集数据和站点排序。",
      rows: [
        ...(sponsorship.benefit ? [{ label: "本站点福利", value: sponsorship.benefit }] : []),
      ],
    })}
    className="relative z-20 inline-flex size-[1em] shrink-0 cursor-help items-center justify-center rounded-sm text-[var(--apr-ink)] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
    <Gift className="size-[1em]" strokeWidth={1.8} aria-hidden />
  </span>;
}
