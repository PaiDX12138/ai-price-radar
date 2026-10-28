import type { ReactNode } from "react";
import Link from "next/link";
import type { PlatformTabId } from "@/lib/catalog";
import { PLATFORM_LABEL, PlatformLogo } from "@/components/catalog/platform-logo";
import { cn } from "@/lib/utils";
import { navigateTransitFilter } from "@/lib/transit/use-page-search";

type PlatformTabsProps<T extends string = PlatformTabId> = {
  tabs: Array<{ id: T; label: string; icon?: ReactNode }>;
  active: T;
  basePath?: string;
  className?: string;
  /** Use the already-loaded detail dataset instead of starting an RSC navigation. */
  clientNavigation?: boolean;
};

/** Platform switch resets to page 1 (no page= in href). */
function tabHref(basePath: string, id: string): string {
  const pathOnly = basePath.split("?")[0] || "/";
  if (id === "all") return pathOnly;
  return `${pathOnly}?platform=${id}`;
}

/** URL-driven platform filter chips (not page pagination). */
export function PlatformTabs<T extends string = PlatformTabId>({
  tabs,
  active,
  basePath = "/channels",
  className,
  clientNavigation = false,
}: PlatformTabsProps<T>) {
  return (
    <div
      role="tablist"
      data-slot="platform-tabs"
      className={cn(
        // Content only — glass lives on .apr-tab-stick-inner
        "inline-flex w-full max-w-full flex-wrap items-center gap-1 p-0.5 text-muted-foreground",
        className
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={tabHref(basePath, tab.id)}
            scroll={false}
            onClick={clientNavigation ? (event) => {
              if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              navigateTransitFilter(tabHref(basePath, tab.id));
            } : undefined}
            role="tab"
            aria-selected={selected}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-all",
              selected
                ? "bg-background/80 text-foreground shadow-sm ring-1 ring-foreground/10 backdrop-blur-sm"
                : "hover:bg-background/50 hover:text-foreground"
            )}
          >
            {tab.icon ?? <PlatformLogo platform={tab.id as PlatformTabId} size={14} />}
            <span>{tab.label || PLATFORM_LABEL[tab.id as PlatformTabId]}</span>
          </Link>
        );
      })}
    </div>
  );
}
