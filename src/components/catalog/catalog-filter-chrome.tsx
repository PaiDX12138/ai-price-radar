import type { ReactNode } from "react";
import { CatalogToolbar } from "@/components/catalog/catalog-toolbar";
import { PlatformTabs } from "@/components/catalog/platform-tabs";
import { StickyPlatformFilter } from "@/components/catalog/sticky-platform-filter";
import type { PlatformTabId } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export type CatalogFilterTab<T extends string = PlatformTabId> = { id: T; label: string; icon?: ReactNode };

type CatalogFilterChromeProps<T extends string = PlatformTabId> = {
  tabs: CatalogFilterTab<T>[];
  active: T;
  /** 写入 URL 的路径前缀，如 `/` / `/channels` / `/official` */
  basePath: string;
  deliveryTypes: string[];
  className?: string;
  /** 全宽吸顶（官网定价 Tab 较多，避免邮箱/接码被挤出可视区） */
  wide?: boolean;
  searchPlaceholder?: string;
  searchLabel?: string;
  clientNavigation?: boolean;
};

/**
 * 平台 Tab + 类型/搜索工具条（吸顶壳）。
 * 卡网行情与官网定价共用，保证交互一致。
 */
export function CatalogFilterChrome<T extends string = PlatformTabId>({
  tabs,
  active,
  basePath,
  deliveryTypes,
  className,
  wide = false,
  searchPlaceholder,
  searchLabel,
  clientNavigation = false,
}: CatalogFilterChromeProps<T>) {
  return (
    <StickyPlatformFilter wide={wide} className={cn("mb-5 w-full", className)}>
      <PlatformTabs tabs={tabs} active={active} basePath={basePath} clientNavigation={clientNavigation} />
      <CatalogToolbar deliveryTypes={deliveryTypes} searchPlaceholder={searchPlaceholder} searchLabel={searchLabel} />
    </StickyPlatformFilter>
  );
}
