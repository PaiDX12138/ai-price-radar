"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChartColumn, CircleDollarSign } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const NAV = [
  {
    id: "catalog",
    label: "卡网行情",
    href: "/",
    icon: ChartColumn,
  },
  {
    id: "official",
    label: "官网定价",
    href: "/official",
    icon: CircleDollarSign,
  },
] as const;

type NavId = (typeof NAV)[number]["id"];

/** 文档等非板块页：保持受控且无选中项，避免 value 变 undefined 触发 Base UI 报错 */
const NAV_NONE = "none" as const;

function resolveNavValue(pathname: string): NavId | typeof NAV_NONE {
  if (pathname.startsWith("/official")) return "official";
  if (
    pathname === "/" ||
    pathname.startsWith("/channels") ||
    pathname.startsWith("/products")
  ) {
    return "catalog";
  }
  return NAV_NONE;
}

/**
 * 顶栏板块切换 — shadcn Tabs `line`（底栏指示，非胶囊底）。
 * 水平居中；选中态黑色字 + 黑色底边。
 */
export function SitePrimaryNav({ className }: { className?: string }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const value = resolveNavValue(pathname);

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        if (next === NAV_NONE) return;
        const item = NAV.find((n) => n.id === next);
        if (item) router.push(item.href);
      }}
      className={cn("gap-0", className)}
    >
      <TabsList
        variant="line"
        aria-label="板块"
        className={cn(
          "h-12 gap-0.5 rounded-none bg-transparent p-0",
          "group-data-horizontal/tabs:h-12",
        )}
      >
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <TabsTrigger
              key={item.id}
              value={item.id}
              className={cn(
                "h-12 gap-1.5 rounded-none px-3",
                "text-[13px] leading-none tracking-tight",
                "font-medium text-muted-foreground",
                "hover:text-foreground",
                "data-active:bg-transparent data-active:font-semibold data-active:text-foreground data-active:shadow-none",
                "dark:data-active:bg-transparent dark:data-active:text-foreground",
                "after:bottom-0 after:h-[2px] after:rounded-none after:bg-foreground after:opacity-0",
                "group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
                "[&_svg]:size-3.5 [&_svg]:opacity-70",
                "data-active:[&_svg]:opacity-100",
              )}
            >
              <Icon aria-hidden strokeWidth={2} />
              {item.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
