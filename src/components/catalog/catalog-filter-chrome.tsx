import { CatalogToolbar } from "@/components/catalog/catalog-toolbar";
import { PlatformTabs } from "@/components/catalog/platform-tabs";
import { StickyPlatformFilter } from "@/components/catalog/sticky-platform-filter";
import type { PlatformTabId } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export type CatalogFilterTab = { id: PlatformTabId; label: string };

type CatalogFilterChromeProps = {
  tabs: CatalogFilterTab[];
  active: PlatformTabId;
  /** 写入 URL 的路径前缀，如 `/` / `/channels` / `/official` */
  basePath: string;
  deliveryTypes: string[];
  className?: string;
  /** 全宽吸顶（官网定价 Tab 较多，避免邮箱/接码被挤出可视区） */
  wide?: boolean;
};

/**
 * 平台 Tab + 类型/搜索工具条（吸顶壳）。
 * 卡网行情与官网定价共用，保证交互一致。
 */
export function CatalogFilterChrome({
  tabs,
  active,
  basePath,
  deliveryTypes,
  className,
  wide = false,
}: CatalogFilterChromeProps) {
  return (
    <StickyPlatformFilter wide={wide} className={cn("mb-5 w-full", className)}>
      <PlatformTabs tabs={tabs} active={active} basePath={basePath} />
      <CatalogToolbar deliveryTypes={deliveryTypes} />
    </StickyPlatformFilter>
  );
}
