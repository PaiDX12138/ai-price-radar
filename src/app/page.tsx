import { connection } from "next/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogBoard } from "@/components/catalog/catalog-board";
import { CatalogLoading } from "@/components/catalog/catalog-loading";
import { BRAND_NAME_EN, BRAND_NAME_ZH } from "@/lib/brand";

export const metadata: Metadata = {
  title: BRAND_NAME_ZH,
  description: `${BRAND_NAME_ZH}（${BRAND_NAME_EN}）— 渠道汇总最低价与质保价。`,
};

type PageProps = {
  searchParams: Promise<{ platform?: string; page?: string; type?: string; q?: string }>;
};

export default function Home({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<CatalogLoading />}>
      <HomeBoard searchParams={searchParams} />
    </Suspense>
  );
}

async function HomeBoard({ searchParams }: PageProps) {
  await connection();
  const params = await searchParams;
  return (
    <CatalogBoard
      platformParam={params.platform}
      pageParam={params.page}
      typeParam={params.type}
      qParam={params.q}
      basePath="/"
    />
  );
}
