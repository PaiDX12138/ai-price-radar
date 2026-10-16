import "server-only";

import { applyLiveFxToQuotes } from "@/lib/otp/apply-live-fx";
import { loadSmsPlatformsSnapshot } from "@/lib/sms-platforms/snapshot";
import type {
  SmsPlatformQuote,
  SmsTypeCard,
  SmsTypeConfig,
} from "@/lib/sms-platforms/types";

const DETAIL_PREFIX = "sms__";

export function smsDetailId(typeId: string): string {
  return `${DETAIL_PREFIX}${typeId}`;
}

export function parseSmsDetailId(id: string): string | null {
  if (!id.startsWith(DETAIL_PREFIX)) return null;
  const typeId = id.slice(DETAIL_PREFIX.length);
  return typeId || null;
}

export function isSmsDetailId(id: string): boolean {
  return parseSmsDetailId(id) != null;
}

export function hasSmsPlatformData(): boolean {
  const snap = loadSmsPlatformsSnapshot();
  return Boolean(snap && snap.quotes.length > 0);
}

function withLiveFx(quotes: SmsPlatformQuote[]) {
  const { quotes: next, fxRate, fxDate } = applyLiveFxToQuotes(quotes);
  return { quotes: next as SmsPlatformQuote[], fxRate, fxDate };
}

function pricedQuotes(quotes: SmsPlatformQuote[]): SmsPlatformQuote[] {
  return quotes
    .filter(
      (q) =>
        q.status !== "unsupported" &&
        q.status !== "out_of_stock" &&
        q.cnyPrice != null &&
        Number.isFinite(q.cnyPrice),
    )
    .sort((a, b) => (a.cnyPrice ?? 0) - (b.cnyPrice ?? 0));
}

function toCard(
  type: SmsTypeConfig,
  quotes: SmsPlatformQuote[],
  updatedAt: string | null,
  fxRate: number,
  fxDate: string | null,
): SmsTypeCard {
  const priced = pricedQuotes(quotes.filter((q) => q.typeId === type.id));
  const platformIds = new Set(priced.map((q) => q.platformId));
  return {
    id: type.id,
    detailId: smsDetailId(type.id),
    label: type.label,
    catalogSlug: type.catalogSlug,
    summary: type.summary,
    tags: type.tags,
    lowest: priced[0] ?? null,
    platformCount: platformIds.size,
    quoteCount: priced.length,
    updatedAt,
    fxUsdToCny: fxRate,
    fxDate,
  };
}

/** 官网定价接码不展示的类型（KYC 等走卡网行情）。 */
const OFFICIAL_SMS_HIDDEN = new Set(["kyc"]);

export function listSmsTypeCards(opts: { q?: string } = {}): SmsTypeCard[] {
  const snap = loadSmsPlatformsSnapshot();
  if (!snap) return [];
  const needle = opts.q?.trim().toLowerCase() || "";
  const updatedAt = snap.capturedAt || snap.generatedAt || null;
  const { quotes, fxRate, fxDate } = withLiveFx(snap.quotes);

  return snap.types
    .filter((t) => !OFFICIAL_SMS_HIDDEN.has(t.id))
    .map((t) => toCard(t, quotes, updatedAt, fxRate, fxDate))
    .filter((card) => {
      if (!needle) return true;
      const hay = [
        card.label,
        card.summary,
        ...card.tags,
        card.lowest?.platformName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
}

export function getSmsTypeCardById(detailId: string): SmsTypeCard | null {
  const typeId = parseSmsDetailId(detailId);
  if (!typeId) return null;
  return listSmsTypeCards().find((c) => c.id === typeId) ?? null;
}

export function listSmsQuotesForType(typeId: string): SmsPlatformQuote[] {
  const snap = loadSmsPlatformsSnapshot();
  if (!snap) return [];
  const { quotes } = withLiveFx(snap.quotes.filter((q) => q.typeId === typeId));
  const priced = pricedQuotes(quotes);
  const rest = quotes
    .filter((q) => !priced.some((p) => p.platformId === q.platformId))
    .sort((a, b) => a.platformName.localeCompare(b.platformName, "zh-CN"));
  return [...priced, ...rest];
}

export function getSmsTypeConfig(typeId: string): SmsTypeConfig | null {
  const snap = loadSmsPlatformsSnapshot();
  return snap?.types.find((t) => t.id === typeId) ?? null;
}
