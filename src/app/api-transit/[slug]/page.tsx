import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { CatalogLoading } from "@/components/catalog/catalog-loading";
import { TransitDetail } from "@/components/transit/transit-detail";
import {getTransitSite} from "@/lib/transit/queries";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  return { title: `${getTransitSite(slug)?.name ?? "站点"} · 中转详情` };
}
export default function TransitDetailPage({ params }: Props) {
  return <Suspense fallback={<CatalogLoading />}><Detail params={params} /></Suspense>;
}
async function Detail({ params }: Props) {
  await connection();
  const { slug } = await params;
  const site = getTransitSite(slug);
  if (!site) notFound();
  return <TransitDetail site={site} />;
}
