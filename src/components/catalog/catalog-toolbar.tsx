"use client";

import { useEffect, useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildSearchHref,
  useDebouncedUrlQuery,
} from "@/lib/hooks/use-debounced-url-query";
import { cn } from "@/lib/utils";

const TYPE_ALL = "__all__";

/** Internal value → trigger / item label */
function typeLabel(value: string): string {
  if (!value || value === TYPE_ALL) return "全部";
  return value;
}

type CatalogToolbarProps = {
  deliveryTypes: string[];
  className?: string;
};

/** Type select + narrow search; URL-driven (type, q). Resets page on change. */
export function CatalogToolbar({ deliveryTypes, className }: CatalogToolbarProps) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const typeParam = searchParams.get("type") ?? "";
  const paramsKey = searchParams.toString();

  const typeValue = useMemo(() => {
    if (typeParam && deliveryTypes.includes(typeParam)) return typeParam;
    return TYPE_ALL;
  }, [typeParam, deliveryTypes]);

  const query = useDebouncedUrlQuery({ param: "q", delayMs: 400 });

  useEffect(() => {
    if (typeParam && !deliveryTypes.includes(typeParam)) {
      startTransition(() => {
        router.replace(
          buildSearchHref(pathname, new URLSearchParams(paramsKey), {
            type: null,
          }),
          { scroll: false },
        );
      });
    }
  }, [typeParam, deliveryTypes, pathname, router, paramsKey, startTransition]);

  return (
    <div
      data-slot="catalog-toolbar"
      className={cn(
        "flex w-full min-w-0 flex-nowrap items-center gap-2 px-0.5 pt-0.5",
        className,
      )}
    >
      <Select
        value={typeValue}
        onValueChange={(value) => {
          const next = !value || value === TYPE_ALL ? null : String(value);
          startTransition(() => {
            router.replace(
              buildSearchHref(pathname, new URLSearchParams(paramsKey), {
                type: next,
              }),
              { scroll: false },
            );
          });
        }}
      >
        <SelectTrigger size="sm" className="w-[7rem] shrink-0 bg-background/40">
          <SelectValue placeholder="全部">
            {(value: string | null) => typeLabel(value ?? TYPE_ALL)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          <SelectItem value={TYPE_ALL}>{typeLabel(TYPE_ALL)}</SelectItem>
          {deliveryTypes.map((t) => (
            <SelectItem key={t} value={t}>
              {typeLabel(t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query.value}
          onChange={query.onChange}
          onCompositionStart={query.onCompositionStart}
          onCompositionEnd={query.onCompositionEnd}
          placeholder="搜索商品 / 类型 / 标题"
          aria-label="搜索商品"
          autoComplete="off"
          spellCheck={false}
          className="h-7 w-full bg-background/40 pr-2 pl-7 text-xs"
        />
      </div>
    </div>
  );
}
