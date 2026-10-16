import { connection } from "next/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogBoard } from "@/components/catalog/catalog-board";
import { CatalogLoading } from "@/components/catalog/catalog-loading";
import { BRAND_NAME_ZH } from "@/lib/brand";

export const metadata: Metadata = {
  title: BRAND_NAME_ZH,
};

type PageProps = {
  searchParams: Promise<{ platform?: string; page?: string; type?: string; q?: string }>;
};

export default function ChannelsPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<CatalogLoading />}>
      <ChannelsBoard searchParams={searchParams} />
    </Suspense>
  );
}

async function ChannelsBoard({ searchParams }: PageProps) {
  await connection();
  const params = await searchParams;
  return (
    <CatalogBoard
      platformParam={params.platform}
      pageParam={params.page}
      typeParam={params.type}
      qParam={params.q}
      basePath="/channels"
    />
  );
}
