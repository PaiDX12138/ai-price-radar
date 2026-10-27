import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { CatalogLoading } from "@/components/catalog/catalog-loading";
import { TransitDetail } from "@/components/transit/transit-detail";
import { transitDemos } from "@/data/demo/transit";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${transitDemos.find((site) => site.id === slug)?.name ?? "站点"} · 中转详情` };
}
export default function TransitDetailPage({ params }: Props) {
  return <Suspense fallback={<CatalogLoading />}><Detail params={params} /></Suspense>;
}
async function Detail({ params }: Props) {
  await connection();
  const { slug } = await params;
  const site = transitDemos.find((item) => item.id === slug);
  if (!site) notFound();
  return <TransitDetail site={site} />;
}
