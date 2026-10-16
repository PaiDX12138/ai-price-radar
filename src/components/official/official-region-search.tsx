"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebouncedUrlQuery } from "@/lib/hooks/use-debounced-url-query";
import { cn } from "@/lib/utils";

type OfficialRegionSearchProps = {
  className?: string;
};

/** 地区报价搜索：中文名 / 英文名 / 国家码 / Storefront 编号。 */
export function OfficialRegionSearch({ className }: OfficialRegionSearchProps) {
  const query = useDebouncedUrlQuery({ param: "q", delayMs: 400 });

  return (
    <div className={cn("relative min-w-0 px-0.5 pt-0.5", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        value={query.value}
        onChange={query.onChange}
        onCompositionStart={query.onCompositionStart}
        onCompositionEnd={query.onCompositionEnd}
        placeholder="搜索国家中文 / 英文 / 编号"
        aria-label="搜索地区"
        autoComplete="off"
        spellCheck={false}
        className="h-8 w-full bg-background/40 pr-2 pl-8 text-xs"
      />
    </div>
  );
}
