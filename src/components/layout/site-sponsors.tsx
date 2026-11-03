import Image from "next/image";
import { SITE_SPONSORS } from "@/data/sponsors";
import { TextBand } from "@/components/catalog/text-band";
import { SponsorContact } from "@/components/layout/sponsor-contact";

/** Image-only sponsor strip; the same delegated custom tooltip supports keyboard focus. */
export function SiteSponsors() {
  return <section aria-label="赞助商" className="mt-10 border-t border-border/70 pt-5">
    <div className="mb-3 flex w-full items-center gap-3 sm:gap-4">
      <h2 className="shrink-0 text-base font-semibold leading-6 tracking-tight sm:text-[17px]"><TextBand tone="ink">赞助商</TextBand></h2>
      <SponsorContact />
    </div>
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {SITE_SPONSORS.map((sponsor) => <a key={sponsor.id} href={sponsor.href} target="_blank"
        rel={sponsor.sponsored ? "sponsored noopener noreferrer" : "noopener noreferrer"}
        aria-label={`打开 ${sponsor.name}（新标签页）`} data-tooltip={sponsor.description} data-tooltip-anchor="element"
        className="relative aspect-[40/17] w-full overflow-hidden rounded-lg border border-border/70 bg-background outline-none transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <Image src={sponsor.image} alt={sponsor.name} fill sizes="(min-width: 1440px) 339px, (min-width: 1024px) calc((100vw - 5.25rem) / 4), (min-width: 640px) calc((100vw - 2.75rem) / 2), calc(100vw - 2rem)" className={sponsor.id === "packyapi" ? "bg-white object-contain px-6" : "object-contain"} />
      </a>)}
    </div>
  </section>;
}
