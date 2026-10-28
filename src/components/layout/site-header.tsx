import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { GitHubIcon } from "@/components/icons/github-icon";
import { GithubStarMascot } from "@/components/layout/github-star-mascot";
import { QqGroupMenu } from "@/components/layout/qq-group-menu";
import { SitePrimaryNav } from "@/components/layout/site-primary-nav";
import { buttonVariants } from "@/components/ui/button-variants";
import { BRAND_NAME_EN } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * 顶栏：品牌 …… 板块 Tabs(居中) …… 工具
 * 选中态用黑色底边。
 */
export function SiteHeader() {
  return (
    <header className="site-header sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-[border-color,box-shadow,background-color] duration-200 ease-out">
      <div className="relative mx-auto flex h-12 w-full max-w-[var(--apr-content-max)] items-center px-4 lg:px-6">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "relative z-10 shrink-0 gap-2 px-2 font-semibold text-foreground",
          )}
        >
          <Image
            src="/brand/logo-nav.png"
            alt=""
            width={16}
            height={16}
            className="size-4 shrink-0 object-contain"
            priority
            aria-hidden
          />
          <span className="hidden truncate sm:inline">{BRAND_NAME_EN}</span>
          <span className="sr-only sm:hidden">{BRAND_NAME_EN}</span>
        </Link>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto">
            <Suspense fallback={<div className="h-12 w-[12rem]" aria-hidden />}>
              <SitePrimaryNav />
            </Suspense>
          </div>
        </div>

        <div className="relative z-10 ml-auto flex shrink-0 items-center gap-0.5">
          <GithubStarMascot />
          <a
            href="https://github.com/PaiDX12138/ai-price-radar"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            data-tooltip="GitHub"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" }),
              "text-muted-foreground",
            )}
          >
            <GitHubIcon className="size-4" />
          </a>
          <QqGroupMenu />
        </div>
      </div>
    </header>
  );
}
