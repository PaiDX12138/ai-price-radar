"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

type HistoryBackLinkProps = {
  /** 无历史记录时（直达 / 刷新）回落地址 */
  fallbackHref?: string;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<typeof Link>, "href" | "onClick" | "className" | "children">;

/** 优先浏览器后退；无可用历史则去 fallbackHref。 */
export function HistoryBackLink({
  fallbackHref = "/",
  className,
  children,
  ...rest
}: HistoryBackLinkProps) {
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
    event.preventDefault();
    // 站内跳转进来 → 后退；直达 / 外链进入 → 回首页等 fallback
    try {
      const ref = document.referrer;
      if (ref && new URL(ref).origin === window.location.origin) {
        router.back();
        return;
      }
    } catch {
      /* ignore bad referrer */
    }
    router.push(fallbackHref);
  };

  return (
    <Link href={fallbackHref} onClick={onClick} className={cn(className)} {...rest}>
      {children}
    </Link>
  );
}
