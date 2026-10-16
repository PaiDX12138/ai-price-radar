"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { peekCatalogReturnPath } from "@/lib/catalog/nav-state";
import { cn } from "@/lib/utils";

type ProductBackLinkProps = {
  /** Used when there is no saved catalog leave path (direct entry / refresh). */
  fallbackHref: string;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
} & Omit<ComponentProps<typeof Link>, "href" | "onClick" | "className" | "children">;

/**
 * Prefer the catalog URL (platform / type / q / page) the user left from.
 * Scroll Y is restored by CatalogNavState on the list page.
 */
export function ProductBackLink({
  fallbackHref,
  className,
  children,
  ...rest
}: ProductBackLinkProps) {
  const router = useRouter();

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }
    const from = peekCatalogReturnPath();
    if (!from) return;
    event.preventDefault();
    // replace：详情页退出后浏览器再「后退」不会又回到详情
    router.replace(from, { scroll: false });
  };

  return (
    <Link
      href={fallbackHref}
      onClick={onClick}
      className={cn(className)}
      {...rest}
    >
      {children}
    </Link>
  );
}
