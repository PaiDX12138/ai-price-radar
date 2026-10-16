import "server-only";

import { loadEmailPlatformsSnapshot } from "@/lib/email-platforms/snapshot";
import type {
  EmailPlatformQuote,
  EmailTypeCard,
  EmailTypeConfig,
} from "@/lib/email-platforms/types";
import { applyLiveFxToQuotes } from "@/lib/otp/apply-live-fx";

const DETAIL_PREFIX = "email__";

export function emailDetailId(typeId: string): string {
  return `${DETAIL_PREFIX}${typeId}`;
}

export function parseEmailDetailId(id: string): string | null {
  if (!id.startsWith(DETAIL_PREFIX)) return null;
  const typeId = id.slice(DETAIL_PREFIX.length);
  return typeId || null;
}

export function isEmailDetailId(id: string): boolean {
  return parseEmailDetailId(id) != null;
}

export function hasEmailPlatformData(): boolean {
  const snap = loadEmailPlatformsSnapshot();
  return Boolean(snap && snap.quotes.length > 0);
}

function withLiveFx(quotes: EmailPlatformQuote[]) {
  const { quotes: next, fxRate, fxDate } = applyLiveFxToQuotes(quotes);
  return { quotes: next as EmailPlatformQuote[], fxRate, fxDate };
}

function pricedQuotes(quotes: EmailPlatformQuote[]): EmailPlatformQuote[] {
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
  type: EmailTypeConfig,
  quotes: EmailPlatformQuote[],
  updatedAt: string | null,
  fxRate: number,
  fxDate: string | null,
): EmailTypeCard {
  const priced = pricedQuotes(quotes.filter((q) => q.typeId === type.id));
  const platformIds = new Set(priced.map((q) => q.platformId));
  return {
    id: type.id,
    detailId: emailDetailId(type.id),
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

/** 列表卡：按 types.json 顺序。 */
export function listEmailTypeCards(opts: { q?: string } = {}): EmailTypeCard[] {
  const snap = loadEmailPlatformsSnapshot();
  if (!snap) return [];
  const needle = opts.q?.trim().toLowerCase() || "";
  const updatedAt = snap.capturedAt || snap.generatedAt || null;
  const { quotes, fxRate, fxDate } = withLiveFx(snap.quotes);

  return snap.types
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

export function getEmailTypeCardById(detailId: string): EmailTypeCard | null {
  const typeId = parseEmailDetailId(detailId);
  if (!typeId) return null;
  return listEmailTypeCards().find((c) => c.id === typeId) ?? null;
}

export function listEmailQuotesForType(typeId: string): EmailPlatformQuote[] {
  const snap = loadEmailPlatformsSnapshot();
  if (!snap) return [];
  const { quotes } = withLiveFx(snap.quotes.filter((q) => q.typeId === typeId));
  const priced = pricedQuotes(quotes);
  const rest = quotes
    .filter((q) => !priced.some((p) => p.platformId === q.platformId))
    .sort((a, b) => a.platformName.localeCompare(b.platformName, "zh-CN"));
  return [...priced, ...rest];
}

export function getEmailTypeConfig(typeId: string): EmailTypeConfig | null {
  const snap = loadEmailPlatformsSnapshot();
  return snap?.types.find((t) => t.id === typeId) ?? null;
}
