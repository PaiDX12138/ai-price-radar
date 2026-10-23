import Link from "next/link";
import type { PlatformTabId } from "@/lib/catalog";
import { PLATFORM_LABEL, PlatformLogo } from "@/components/catalog/platform-logo";
import { cn } from "@/lib/utils";

type PlatformTabsProps = {
  tabs: Array<{ id: PlatformTabId; label: string }>;
  active: PlatformTabId;
  basePath?: string;
  className?: string;
};

/** Platform switch resets to page 1 (no page= in href). */
function tabHref(basePath: string, id: PlatformTabId): string {
  const pathOnly = basePath.split("?")[0] || "/";
  if (id === "all") return pathOnly;
  return `${pathOnly}?platform=${id}`;
}

/** URL-driven platform filter chips (not page pagination). */
export function PlatformTabs({
  tabs,
  active,
  basePath = "/channels",
  className,
}: PlatformTabsProps) {
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
            role="tab"
            aria-selected={selected}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-all",
              selected
                ? "bg-background/80 text-foreground shadow-sm ring-1 ring-foreground/10 backdrop-blur-sm"
                : "hover:bg-background/50 hover:text-foreground"
            )}
          >
            <PlatformLogo platform={tab.id} size={14} />
            <span>{PLATFORM_LABEL[tab.id] ?? tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
