import { Suspense } from "react";
import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { TransitBoard } from "@/components/transit/transit-board";
import {connection} from "next/server";
import {listTransitViews} from "@/lib/transit/queries";

export const metadata: Metadata = {
  title: "中转站点",
  description: "聚合展示中转平台、模型覆盖、分组价格与公开监测信息。",
};

export default function TransitPage() {
  return <PageShell><Suspense fallback={<div className="h-40" aria-label="加载中转站点" />}><Board /></Suspense></PageShell>;
}
async function Board() {
  await connection();
  return <TransitBoard sites={listTransitViews()}/>;
}
