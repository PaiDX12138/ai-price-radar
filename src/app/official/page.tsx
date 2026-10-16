import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CatalogFilterChrome } from "@/components/catalog/catalog-filter-chrome";
import { CatalogLoading } from "@/components/catalog/catalog-loading";
import { CatalogNavState } from "@/components/catalog/catalog-nav-state";
import { OfficialListPagination } from "@/components/catalog/catalog-pagination";
import { OfficialEmailCard } from "@/components/email/official-email-card";
import { OfficialPlanCard } from "@/components/official/official-plan-card";
import { OfficialSmsCard } from "@/components/sms/official-sms-card";
import { getOfficialPlatformTabs } from "@/lib/catalog/official-prices";
import {
  OFFICIAL_PLANS_PAGE_SIZE,
  parseCatalogPage,
} from "@/lib/catalog/pagination";
import { parsePlatformTab } from "@/lib/catalog/queries";
import type { PlatformTabId } from "@/lib/catalog/types";
import {
  hasEmailPlatformData,
  listEmailTypeCards,
} from "@/lib/email-platforms";
import { hasOfficialData, listOfficialProductCards } from "@/lib/official/queries";
import { hasSmsPlatformData, listSmsTypeCards } from "@/lib/sms-platforms";

export const metadata: Metadata = {
  title: "官网定价",
  description:
    "官方地区标价参考（官网直购 + iOS App Store）与邮箱/短信接码平台公开价，便于与卡网行情对照。",
};

type PageProps = {
  searchParams: Promise<{ platform?: string; type?: string; q?: string; page?: string }>;
};

function parseOfficialPlatformTab(value: string | undefined): PlatformTabId {
  const tab = parsePlatformTab(value);
  if (tab === "other") return "all";
  return tab;
}

export default function OfficialPricingPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<CatalogLoading />}>
      <OfficialBoard searchParams={searchParams} />
    </Suspense>
  );
}

async function OfficialBoard({ searchParams }: PageProps) {
  await connection();
  const params = await searchParams;
  const platform = parseOfficialPlatformTab(params.platform);
  const q = params.q?.trim() || undefined;
  const tabs = getOfficialPlatformTabs();

  const isEmail = platform === "email";
  const isSms = platform === "sms";
  const supportedPlan =
    platform === "all" ||
    platform === "chatgpt" ||
    platform === "claude" ||
    platform === "cursor" ||
    platform === "grok" ||
    platform === "kiro" ||
    platform === "gemini";

  const planProducts = supportedPlan
    ? listOfficialProductCards({
        platform: platform === "all" ? "all" : platform,
        q,
      })
    : [];
  const emailProducts =
    isEmail || platform === "all" ? listEmailTypeCards({ q }) : [];
  const smsProducts = isSms || platform === "all" ? listSmsTypeCards({ q }) : [];

  type ListItem =
    | { kind: "plan"; key: string; product: (typeof planProducts)[number] }
    | { kind: "email"; key: string; product: (typeof emailProducts)[number] }
    | { kind: "sms"; key: string; product: (typeof smsProducts)[number] };

  const merged: ListItem[] = isEmail
    ? emailProducts.map((product) => ({
        kind: "email" as const,
        key: `email-${product.id}`,
        product,
      }))
    : isSms
      ? smsProducts.map((product) => ({
          kind: "sms" as const,
          key: `sms-${product.id}`,
          product,
        }))
      : platform === "all"
        ? [
            ...planProducts.map((product) => ({
              kind: "plan" as const,
              key: `plan-${product.id}`,
              product,
            })),
            ...emailProducts.map((product) => ({
              kind: "email" as const,
              key: `email-${product.id}`,
              product,
            })),
            ...smsProducts.map((product) => ({
              kind: "sms" as const,
              key: `sms-${product.id}`,
              product,
            })),
          ]
        : planProducts.map((product) => ({
            kind: "plan" as const,
            key: `plan-${product.id}`,
            product,
          }));

  const totalItems = merged.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / OFFICIAL_PLANS_PAGE_SIZE));
  const page = parseCatalogPage(params.page, totalPages);
  const start = (page - 1) * OFFICIAL_PLANS_PAGE_SIZE;
  const pageItems = merged.slice(start, start + OFFICIAL_PLANS_PAGE_SIZE);

  const emptyHint = isEmail
    ? q
      ? "暂无匹配的邮箱类型"
      : hasEmailPlatformData()
        ? "暂无邮箱接码报价"
        : "暂无邮箱接码数据。请检查 config/email-platforms/"
    : isSms
      ? q
        ? "暂无匹配的接码类型"
        : hasSmsPlatformData()
          ? "暂无短信接码报价"
          : "暂无短信接码数据。请检查 config/sms-platforms/"
      : !supportedPlan
        ? "该平台官方地区价即将支持，当前开放 ChatGPT / Claude / Cursor / Grok（含 X）/ Kiro / Gemini / 邮箱 / 接码。"
        : q
          ? "暂无匹配的官网定价"
          : hasOfficialData() || hasEmailPlatformData() || hasSmsPlatformData()
            ? "暂无官网定价数据"
            : "暂无官网定价数据。请先运行 pnpm official:migrate";

  return (
    <div className="mx-auto w-full max-w-[var(--apr-content-max)] px-4 pb-8 pt-4 lg:px-6">
      <CatalogNavState />
      <div className="mb-3">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-2xl font-bold leading-none tracking-[-0.03em] text-foreground sm:text-[1.75rem]">
            官网定价
          </h1>
          <span className="hidden h-4 w-px shrink-0 bg-border sm:block" aria-hidden />
          <p className="hidden shrink-0 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground sm:block">
            Official
          </p>
        </div>
      </div>

      <CatalogFilterChrome
        tabs={tabs}
        active={platform}
        basePath="/official"
        deliveryTypes={[]}
      />

      {pageItems.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pageItems.map((item) =>
            item.kind === "email" ? (
              <OfficialEmailCard key={item.key} product={item.product} />
            ) : item.kind === "sms" ? (
              <OfficialSmsCard key={item.key} product={item.product} />
            ) : (
              <OfficialPlanCard key={item.key} product={item.product} />
            ),
          )}
        </div>
      )}

      <OfficialListPagination
        platform={platform}
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        q={q}
      />
    </div>
  );
}
