import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CatalogLoading } from "@/components/catalog/catalog-loading";
import { OfficialEmailDetail } from "@/components/email/official-email-detail";
import { OfficialPlanDetailView } from "@/components/official/official-plan-detail";
import { OfficialSmsDetail } from "@/components/sms/official-sms-detail";
import {
  getEmailTypeCardById,
  isEmailDetailId,
  listEmailQuotesForType,
  parseEmailDetailId,
} from "@/lib/email-platforms";
import {
  getSmsTypeCardById,
  isSmsDetailId,
  listSmsQuotesForType,
  parseSmsDetailId,
} from "@/lib/sms-platforms";
import {
  getOfficialPlanSummaryById,
  listOfficialFamilyPlans,
  listOfficialRegionPrices,
} from "@/lib/official/queries";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; channel?: string; q?: string }>;
};

/** 渠道固定展示顺序：官网直购 → iOS App Store */
const CHANNEL_ORDER = ["web_direct", "ios_store"];

function billingPhrase(period: "monthly" | "annual") {
  return period === "annual" ? "年付" : "月付";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  if (isEmailDetailId(decoded)) {
    const card = getEmailTypeCardById(decoded);
    if (!card) return { title: "邮箱接码价" };
    return {
      title: `${card.label} 接码平台价`,
      description: `${card.label} 各接码平台公开价对照。`,
    };
  }
  if (isSmsDetailId(decoded)) {
    const card = getSmsTypeCardById(decoded);
    if (!card) return { title: "短信接码价" };
    return {
      title: `${card.label} 平台价`,
      description: `${card.label} 各短信接码平台公开价对照。`,
    };
  }
  const plan = getOfficialPlanSummaryById(decoded);
  if (!plan) return { title: "官网地区价" };
  return {
    title: `${plan.label} ${billingPhrase(plan.billingPeriod)}官方地区价`,
    description: `${plan.label} 各地区官方公开标价与人民币估算。`,
  };
}

export default function OfficialPlanDetailPage({ params, searchParams }: PageProps) {
  return (
    <Suspense fallback={<CatalogLoading />}>
      <OfficialPlanDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function OfficialPlanDetail({ params, searchParams }: PageProps) {
  await connection();
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);

  if (isEmailDetailId(id)) {
    const card = getEmailTypeCardById(id);
    const typeId = parseEmailDetailId(id);
    if (!card || !typeId) notFound();
    const quotes = listEmailQuotesForType(typeId);
    return (
      <OfficialEmailDetail
        card={card}
        quotes={quotes}
        fxUsdToCny={card.fxUsdToCny}
        fxNote={card.fxDate ? `汇率日期 ${card.fxDate}` : "与官网定价日更汇率同源"}
      />
    );
  }

  if (isSmsDetailId(id)) {
    const card = getSmsTypeCardById(id);
    const typeId = parseSmsDetailId(id);
    if (!card || !typeId) notFound();
    const quotes = listSmsQuotesForType(typeId);
    return (
      <OfficialSmsDetail
        card={card}
        quotes={quotes}
        fxUsdToCny={card.fxUsdToCny}
        fxNote={card.fxDate ? `汇率日期 ${card.fxDate}` : "与官网定价日更汇率同源"}
      />
    );
  }

  const sp = await searchParams;
  const plan = getOfficialPlanSummaryById(id);
  if (!plan) notFound();

  const everyRow = listOfficialRegionPrices(id);
  const channelCounts: Record<string, number> = {};
  for (const row of everyRow) {
    channelCounts[row.channel] = (channelCounts[row.channel] ?? 0) + 1;
  }
  const channelOptions = [
    ...CHANNEL_ORDER.filter((c) => channelCounts[c]),
    ...Object.keys(channelCounts).filter((c) => !CHANNEL_ORDER.includes(c)),
  ];
  const channel =
    sp.channel && channelOptions.includes(sp.channel) ? sp.channel : null;
  // 搜索 / 翻页在客户端完成，避免输入时 router 导航打断中文输入法
  const q = sp.q ?? "";
  const family = listOfficialFamilyPlans(id);
  const monthlyPlanId =
    family.find((p) => p.billingPeriod === "monthly")?.id ?? null;
  const annualPlanId =
    family.find((p) => p.billingPeriod === "annual")?.id ?? null;

  return (
    <OfficialPlanDetailView
      plan={plan}
      everyRow={everyRow}
      channel={channel}
      channelOptions={channelOptions}
      channelCounts={channelCounts}
      q={q}
      monthlyPlanId={monthlyPlanId}
      annualPlanId={annualPlanId}
    />
  );
}
