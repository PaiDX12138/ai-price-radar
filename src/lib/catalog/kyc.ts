/**
 * Detect 「已过 KYC」 from offer title / tags.
 * Positive account signals only — not KYC-as-a-service, not 「免/未过 KYC」.
 */
const PASSED_KYC_RE =
  /已过\s*kyc|(?<![未不])过了?\s*kyc|已完成\s*kyc|完成\s*kyc|kyc\s*已过|kyc\s*通过|通过\s*kyc|已实名|实名(?:认证)?通过/i;

const NEGATIVE_KYC_RE = /免\s*kyc|无需\s*kyc|不用\s*kyc|不需要\s*kyc|未过\s*kyc|不过\s*kyc|未完成\s*kyc/i;

export function titlePassedKyc(text: string): boolean {
  const raw = String(text || "");
  if (!raw.trim()) return false;
  if (NEGATIVE_KYC_RE.test(raw)) return false;
  return PASSED_KYC_RE.test(raw);
}

export function offerPassedKyc(parts: {
  sourceTitle?: string | null;
  tags?: string[] | null;
}): boolean {
  const hay = [parts.sourceTitle ?? "", ...(parts.tags ?? [])].join("\n");
  return titlePassedKyc(hay);
}
