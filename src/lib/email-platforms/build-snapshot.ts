import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  EmailPlatformConfig,
  EmailPlatformQuote,
  EmailPlatformSnapshot,
  EmailQuoteSeed,
  EmailTypeConfig,
} from "@/lib/email-platforms/types";

type SeedFile = {
  capturedAt?: string;
  fxUsdToCny?: number;
  fxNote?: string;
  quotes: EmailQuoteSeed[];
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function formatPriceText(price: number | null, currency: "CNY" | "USD"): string | null {
  if (price == null || !Number.isFinite(price)) return null;
  if (currency === "CNY") {
    return `¥${price.toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })}`;
  }
  const raw = price % 1 === 0 ? String(price) : price.toFixed(4).replace(/\.?0+$/, "");
  return `$${raw}`;
}

function toCny(
  price: number | null,
  currency: "CNY" | "USD",
  fx: number,
): number | null {
  if (price == null || !Number.isFinite(price)) return null;
  if (currency === "CNY") return Math.round(price * 10000) / 10000;
  return Math.round(price * fx * 10000) / 10000;
}

/** 从 config/email-platforms 组装快照（不依赖 data/）。 */
export function buildEmailPlatformsSnapshotFromConfig(
  rootDir: string = process.cwd(),
): EmailPlatformSnapshot {
  const cfgDir = join(rootDir, "config", "email-platforms");
  const types = readJson<EmailTypeConfig[]>(join(cfgDir, "types.json"));
  const platforms = readJson<EmailPlatformConfig[]>(join(cfgDir, "platforms.json"));
  const seed = readJson<SeedFile>(join(cfgDir, "quotes.seed.json"));
  const fx = Number(seed.fxUsdToCny) || 6.7739;
  const platformById = new Map(platforms.map((p) => [p.id, p]));

  const quotes: EmailPlatformQuote[] = [];
  for (const row of seed.quotes ?? []) {
    const plat = platformById.get(row.platformId);
    if (!plat) continue;
    const cny =
      row.status === "unsupported" ? null : toCny(row.price, row.currency, fx);
    quotes.push({
      typeId: row.typeId,
      platformId: row.platformId,
      platformName: plat.name,
      platformUrl: plat.url,
      price: row.price,
      currency: row.currency,
      cnyPrice: cny,
      usdPrice: row.currency === "USD" ? row.price : null,
      fxUsdToCny: row.currency === "USD" ? fx : null,
      fxDate: null,
      unit: row.unit ?? "per_activation",
      status: row.status ?? "in_stock",
      priceNote: row.priceNote ?? null,
      sourceUrl: row.sourceUrl ?? plat.url,
      priceText: formatPriceText(row.price, row.currency),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    capturedAt: seed.capturedAt ?? new Date().toISOString(),
    fxUsdToCny: fx,
    fxNote: seed.fxNote ?? "",
    types,
    platforms,
    quotes,
  };
}
