import "server-only";

import { getOfficialUsdToCny } from "@/lib/official/queries";
import { formatUsdPrice } from "@/lib/otp/format";

export { formatUsdPrice };

const FALLBACK_RATE = 6.7739;

export type OtpFx = {
  rate: number;
  date: string | null;
};

/** 接码/邮箱报价折算：优先官网日更汇率。 */
export function resolveOtpFx(): OtpFx {
  try {
    const fx = getOfficialUsdToCny();
    if (typeof fx.rate === "number" && Number.isFinite(fx.rate) && fx.rate > 0) {
      return fx;
    }
  } catch {
    /* ignore */
  }
  return { rate: FALLBACK_RATE, date: null };
}

export function quoteToUsdAndCny(
  price: number | null,
  currency: "CNY" | "USD",
  fxRate: number,
): { usd: number | null; cny: number | null } {
  if (price == null || !Number.isFinite(price)) {
    return { usd: null, cny: null };
  }
  if (currency === "USD") {
    return {
      usd: price,
      cny: Math.round(price * fxRate * 10000) / 10000,
    };
  }
  return {
    usd: Math.round((price / fxRate) * 10000) / 10000,
    cny: price,
  };
}
