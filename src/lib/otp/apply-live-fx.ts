import "server-only";

import { formatUsdPrice } from "@/lib/otp/format";
import { quoteToUsdAndCny, resolveOtpFx } from "@/lib/otp/fx";

type MutableQuote = {
  price: number | null;
  currency: "CNY" | "USD";
  status: string;
  cnyPrice: number | null;
  fxUsdToCny: number | null;
  usdPrice?: number | null;
  fxDate?: string | null;
  priceText: string | null;
};

/** 用官网日更汇率重算报价上的 USD / CNY。 */
export function applyLiveFxToQuotes<T extends MutableQuote>(quotes: T[]): {
  quotes: T[];
  fxRate: number;
  fxDate: string | null;
} {
  const fx = resolveOtpFx();
  const next = quotes.map((q) => {
    if (q.status === "unsupported" || q.price == null || !Number.isFinite(q.price)) {
      return {
        ...q,
        cnyPrice: null,
        usdPrice: null,
        fxUsdToCny: fx.rate,
        fxDate: fx.date,
        priceText: q.currency === "USD" ? formatUsdPrice(q.price) : q.priceText,
      };
    }
    const { usd, cny } = quoteToUsdAndCny(q.price, q.currency, fx.rate);
    return {
      ...q,
      cnyPrice: cny,
      usdPrice: usd,
      fxUsdToCny: fx.rate,
      fxDate: fx.date,
      priceText: formatUsdPrice(usd),
    };
  });
  return { quotes: next, fxRate: fx.rate, fxDate: fx.date };
}
