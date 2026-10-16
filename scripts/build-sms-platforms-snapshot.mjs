/**
 * 从 config/sms-platforms/* 生成 data/sms-platforms/latest.json
 * Usage: node scripts/build-sms-platforms-snapshot.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cfgDir = join(root, "config", "sms-platforms");
const outPath = join(root, "data", "sms-platforms", "latest.json");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function formatPriceText(price, currency) {
  if (price == null || !Number.isFinite(price)) return null;
  if (currency === "CNY") {
    return `¥${price.toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })}`;
  }
  const raw =
    price % 1 === 0 ? String(price) : price.toFixed(4).replace(/\.?0+$/, "");
  return `$${raw}`;
}

function toCny(price, currency, fx) {
  if (price == null || !Number.isFinite(price)) return null;
  if (currency === "CNY") return Math.round(price * 10000) / 10000;
  if (currency === "USD") return Math.round(price * fx * 10000) / 10000;
  return null;
}

const types = readJson(join(cfgDir, "types.json"));
const platforms = readJson(join(cfgDir, "platforms.json"));
const seed = readJson(join(cfgDir, "quotes.seed.json"));

const platformById = new Map(platforms.map((p) => [p.id, p]));
const fx = Number(seed.fxUsdToCny) || 6.7739;

const quotes = [];
for (const row of seed.quotes ?? []) {
  const plat = platformById.get(row.platformId);
  if (!plat) {
    console.warn(`[skip] unknown platform: ${row.platformId}`);
    continue;
  }
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
    fxUsdToCny: row.currency === "USD" ? fx : null,
    unit: row.unit ?? "per_activation",
    status: row.status ?? "in_stock",
    priceNote: row.priceNote ?? null,
    sourceUrl: row.sourceUrl ?? plat.url,
    priceText: formatPriceText(row.price, row.currency),
  });
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  capturedAt: seed.capturedAt ?? new Date().toISOString(),
  fxUsdToCny: fx,
  fxNote: seed.fxNote ?? "",
  types,
  platforms,
  quotes,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(
  `Wrote ${outPath} · types=${types.length} platforms=${platforms.length} quotes=${quotes.length}`,
);
