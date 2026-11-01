import { ExternalLink } from "lucide-react";
import { TextBand } from "@/components/catalog/text-band";
import { TonePanel } from "@/components/catalog/tone-panel";
import type { TransitSponsorship } from "@/lib/transit/snapshot";

/** Separate external link: never changes the card's existing detail-page navigation. */
export function TransitHomepageLink({ site, variant = "name" }: {
  site: { name: string; siteUrl: string; sponsorship?: TransitSponsorship };
  variant?: "name" | "card";
}) {
  let url: URL;
  let affiliate = false;
  try {
    url = new URL(site.siteUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("invalid_homepage_protocol");
  } catch {
    return variant === "name" ? <TextBand tone="ink">{site.name}</TextBand> : null;
  }
  if (site.sponsorship?.affiliateUrl) {
    try {
      const promotion = new URL(site.sponsorship.affiliateUrl);
      if (promotion.protocol === "https:" && !promotion.username && !promotion.password) {
        url = promotion;
        affiliate = true;
      }
    } catch { /* Malformed promotion URLs fall back to the verified homepage. */ }
  }

  const label = `打开 ${site.name} ${affiliate ? "推广/合作入口" : "站点首页"}（新标签页）`;
  const rel = affiliate ? "sponsored noopener noreferrer" : "noopener noreferrer";
  if (variant === "name") {
    return <a href={url.href} target="_blank" rel={rel} aria-label={label} data-tooltip={label} className="relative z-20 inline-block min-w-0 max-w-full truncate rounded-sm outline-none hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      <TextBand tone="ink" className="block truncate">{site.name}</TextBand>
    </a>;
  }

  return <a href={url.href} target="_blank" rel={rel} aria-label={label} data-tooltip={label} className="group/homepage max-w-full shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
    <TonePanel tone="ink" className="flex h-[54px] w-max min-w-[7rem] max-w-full flex-col justify-center gap-1 px-2.5 py-1.5 transition-colors group-hover/homepage:bg-muted">
      <span className="flex items-center gap-1 whitespace-nowrap text-[10px] leading-3 text-muted-foreground"><ExternalLink className="size-3 shrink-0 transition-colors group-hover/homepage:text-foreground" aria-hidden />站点首页</span>
      <TextBand tone="ink" className="w-fit max-w-36 self-start truncate text-[11px] font-medium leading-4">{url.hostname.replace(/^www\./, "")}</TextBand>
    </TonePanel>
  </a>;
}
