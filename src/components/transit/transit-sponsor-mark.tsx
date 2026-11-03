import { Gift, Handshake } from "lucide-react";
import { tooltipDetails, type TooltipDetailsData } from "@/components/ui/tooltip-details";
import { TonePanel } from "@/components/catalog/tone-panel";
import { TextBand } from "@/components/catalog/text-band";
import type { TransitSponsorship } from "@/lib/transit/snapshot";

function sponsorshipHint(): TooltipDetailsData {
  return {
    title: "推广 / 合作",
    subtitle: "该平台为推广/合作链接，不影响公开采集数据和站点排序。",
    rows: [],
  };
}

/** An informational mark, independent of navigation and automatic ordering. */
export function TransitSponsorMark({ sponsorship }: { sponsorship?: TransitSponsorship }) {
  if (!sponsorship) return null;
  return <span tabIndex={0} role="img" aria-label="赞助合作说明"
    {...tooltipDetails(sponsorshipHint())}
    className="relative z-20 inline-flex size-[1em] shrink-0 cursor-help items-center justify-center rounded-sm text-[var(--apr-ink)] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
    <Gift className="size-[1em]" strokeWidth={1.8} aria-hidden />
  </span>;
}

/** Detail-only summary: same height and spacing as the adjacent homepage/metrics. */
export function TransitSponsorCard({ sponsorship }: { sponsorship?: TransitSponsorship }) {
  if (!sponsorship) return null;
  return <section aria-label="赞助合作" tabIndex={0} {...tooltipDetails(sponsorshipHint())}
    className="max-w-full shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
    <TonePanel tone="ink" className="flex h-[54px] w-max min-w-[7rem] max-w-full flex-col justify-center gap-1 px-2.5 py-1.5">
      <span className="flex items-center gap-1 whitespace-nowrap text-[10px] leading-3 text-muted-foreground">
        <Handshake className="size-3 shrink-0 text-[var(--apr-ink)]" strokeWidth={1.8} aria-hidden />
        赞助合作
      </span>
      <TextBand tone="ink" className="w-fit max-w-full self-start truncate text-xs font-medium leading-4">合作支持</TextBand>
    </TonePanel>
  </section>;
}
