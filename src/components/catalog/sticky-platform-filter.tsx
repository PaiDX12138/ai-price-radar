"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const HEADER_OFFSET_PX = 48; // site-header h-12

type StickyPlatformFilterProps = {
  children: ReactNode;
  className?: string;
  /** Full-width shell (detail filter bar); default w-fit for homepage tabs. */
  wide?: boolean;
};

/**
 * Sticky chrome that fuses with site-header when stuck:
 * full-bleed shared background, no top radius / border / shadow seam.
 */
export function StickyPlatformFilter({
  children,
  className,
  wide = false,
}: StickyPlatformFilterProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { rootMargin: `-${HEADER_OFFSET_PX}px 0px 0px 0px`, threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.aprTabsStuck = stuck ? "1" : "0";
    return () => {
      delete document.documentElement.dataset.aprTabsStuck;
    };
  }, [stuck]);

  return (
    <div
      data-stuck={stuck ? "true" : "false"}
      data-wide={wide ? "true" : "false"}
      data-slot="apr-sticky-chrome"
      className={cn(
        "apr-tab-stick sticky top-12 z-30",
        wide && "w-full",
        className
      )}
    >
      <div
        ref={sentinelRef}
        className="pointer-events-none absolute top-0 left-0 h-px w-full -translate-y-full"
        aria-hidden
      />
      <div
        className={cn(
          "apr-tab-stick-inner flex max-w-full flex-col items-stretch gap-0",
          "transition-[background-color,box-shadow,border-color,border-radius,padding,margin] duration-200 ease-out",
          stuck
            ? "w-full rounded-none border-0 bg-transparent p-0 shadow-none"
            : cn(
                wide ? "w-full" : "w-fit",
                "rounded-xl border border-border/60 bg-muted/70 p-1",
                "shadow-sm backdrop-blur supports-[backdrop-filter]:bg-muted/55"
              )
        )}
      >
        {children}
      </div>
    </div>
  );
}
