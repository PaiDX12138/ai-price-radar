/**
 * 邮箱 / 短信接码平台价自动采集 → data/{email|sms}-platforms/latest.json
 *
 * Usage:
 *   pnpm collect:otp
 *   pnpm collect:otp -- --kind=sms
 *   pnpm collect:otp -- --kind=email
 *
 * 公开无需 Key：5SIM guest、Grizzly（部分服务）、SMSBulk 邮箱页、邮件码页。
 * 可选 Key（.env）：SMS_MAN_TOKEN、ONLINE_SIM_APIKEY、HERO_SMS_API_KEY
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collect5simGuestMins, FIVESIM_SMS_SERVICES } from "../collectors/otp-5sim.mjs";
import { collectGrizzlyMins } from "../collectors/otp-grizzly.mjs";
import {
  collectHeroSmsMins,
  collectOnlineSimMins,
  collectSmsManMins,
} from "../collectors/otp-optional-keys.mjs";
import { collectSmsbulkEmailMins } from "../collectors/otp-smsbulk-email.mjs";
import { collectYoujianmaMins } from "../collectors/otp-youjianma.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function parseArgs(argv) {
  let kind = "all";
  for (const a of argv) {
    if (a.startsWith("--kind=")) kind = a.slice("--kind=".length);
  }
  return { kind };
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
  return Math.round(price * fx * 10000) / 10000;
}

function loadOfficialFx() {
  const snapPath = join(root, "data", "official-prices", "latest.json");
  try {
    const snap = readJson(snapPath);
    for (const s of snap.summaries || []) {
      const row = s.lowest;
      if (
        row?.currencyCode === "USD" &&
        typeof row.fxRateToCny === "number" &&
        row.fxRateToCny > 0
      ) {
        return { rate: row.fxRateToCny, date: row.fxDate || snap.fxDate || null };
      }
    }
  } catch {
    /* ignore */
  }
  return { rate: 6.7739, date: null };
}

/**
 * Merge live mins into quote rows; keep seed for missing pairs.
 */
function mergeQuotes({
  seedQuotes,
  platforms,
  liveByPlatform,
  fx,
}) {
  const platformById = new Map(platforms.map((p) => [p.id, p]));
  const byKey = new Map();

  for (const row of seedQuotes) {
    byKey.set(`${row.typeId}::${row.platformId}`, { ...row, live: false });
  }

  for (const [platformId, payload] of Object.entries(liveByPlatform)) {
    if (!payload?.ok || !payload.mins) continue;
    const currency = payload.currency || "USD";
    for (const [typeId, price] of Object.entries(payload.mins)) {
      if (price == null || !Number.isFinite(price)) continue;
      byKey.set(`${typeId}::${platformId}`, {
        typeId,
        platformId,
        price,
        currency,
        unit: "per_activation",
        status: "in_stock",
        priceNote: payload.note || "自动采集公开起价",
        sourceUrl: payload.sourceUrl || platformById.get(platformId)?.url,
        live: true,
      });
    }
  }

  const quotes = [];
  for (const row of byKey.values()) {
    const plat = platformById.get(row.platformId);
    if (!plat) continue;
    if (row.status === "unsupported") {
      quotes.push({
        typeId: row.typeId,
        platformId: row.platformId,
        platformName: plat.name,
        platformUrl: plat.url,
        price: null,
        currency: row.currency || "USD",
        cnyPrice: null,
        usdPrice: null,
        fxUsdToCny: fx.rate,
        fxDate: fx.date,
        unit: "per_activation",
        status: "unsupported",
        priceNote: row.priceNote || null,
        sourceUrl: row.sourceUrl || plat.url,
        priceText: null,
      });
      continue;
    }
    const cny =
      row.status === "unsupported"
        ? null
        : toCny(row.price, row.currency, fx.rate);
    const usd =
      row.currency === "USD"
        ? row.price
        : row.price != null
          ? Math.round((row.price / fx.rate) * 10000) / 10000
          : null;
    quotes.push({
      typeId: row.typeId,
      platformId: row.platformId,
      platformName: plat.name,
      platformUrl: plat.url,
      price: row.price,
      currency: row.currency,
      cnyPrice: cny,
      usdPrice: usd,
      fxUsdToCny: fx.rate,
      fxDate: fx.date,
      unit: row.unit || "per_activation",
      status: row.status || "in_stock",
      priceNote: row.priceNote || null,
      sourceUrl: row.sourceUrl || plat.url,
      priceText: formatPriceText(usd ?? row.price, usd != null ? "USD" : row.currency),
    });
  }
  return quotes;
}

function writeSnapshot(kind, snapshot) {
  const outPath = join(root, "data", `${kind}-platforms`, "latest.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(
    `[collect:otp] wrote ${outPath} quotes=${snapshot.quotes.length} live=${snapshot.livePlatforms?.join(",") || "-"}`,
  );
}

async function collectSms(fx) {
  const cfgDir = join(root, "config", "sms-platforms");
  const types = readJson(join(cfgDir, "types.json"));
  const platforms = readJson(join(cfgDir, "platforms.json"));
  const seed = readJson(join(cfgDir, "quotes.seed.json"));

  console.log("[collect:otp] sms: 5sim…");
  const five = await collect5simGuestMins(FIVESIM_SMS_SERVICES);
  console.log("[collect:otp] sms: grizzly…");
  const grizzly = await collectGrizzlyMins();
  console.log("[collect:otp] sms: optional keys…");
  const smsMan = await collectSmsManMins(process.env.SMS_MAN_TOKEN || "");
  const onlineSim = await collectOnlineSimMins(process.env.ONLINE_SIM_APIKEY || "");
  const hero = await collectHeroSmsMins(process.env.HERO_SMS_API_KEY || "");

  const liveByPlatform = {
    "5sim": five.ok
      ? { ok: true, mins: five.mins, sourceUrl: five.sourceUrl, note: "5SIM guest 全球最低起价" }
      : null,
    grizzly: grizzly.ok
      ? {
          ok: true,
          mins: grizzly.mins,
          sourceUrl: grizzly.sourceUrl,
          note: "Grizzly 公开 getPrices 最低起价",
        }
      : null,
    "sms-man": smsMan.ok
      ? { ok: true, mins: smsMan.mins, sourceUrl: smsMan.sourceUrl, note: "SMS-Man API" }
      : null,
    onlinesim: onlineSim.ok
      ? {
          ok: true,
          mins: onlineSim.mins,
          sourceUrl: onlineSim.sourceUrl,
          note: "OnlineSim getTariffs",
        }
      : null,
    hero: hero.ok
      ? { ok: true, mins: hero.mins, sourceUrl: hero.sourceUrl, note: "HeroSMS getPrices" }
      : null,
  };

  const livePlatforms = Object.entries(liveByPlatform)
    .filter(([, v]) => v?.ok)
    .map(([id]) => id);

  const quotes = mergeQuotes({
    seedQuotes: seed.quotes || [],
    platforms,
    liveByPlatform,
    fx,
  });

  return {
    generatedAt: new Date().toISOString(),
    capturedAt: new Date().toISOString(),
    fxUsdToCny: fx.rate,
    fxNote: fx.date
      ? `官网日更汇率 ${fx.date}`
      : "官网快照不可用时的回退汇率",
    types,
    platforms,
    quotes,
    livePlatforms,
    collectors: {
      "5sim": five.ok ? "ok" : five.error || "fail",
      grizzly: grizzly.ok ? "ok" : grizzly.error || "fail",
      "sms-man": smsMan.skipped ? "skipped" : smsMan.ok ? "ok" : smsMan.error || "fail",
      onlinesim: onlineSim.skipped
        ? "skipped"
        : onlineSim.ok
          ? "ok"
          : onlineSim.error || "fail",
      hero: hero.skipped ? "skipped" : hero.ok ? "ok" : hero.error || "fail",
    },
  };
}

async function collectEmail(fx) {
  const cfgDir = join(root, "config", "email-platforms");
  const types = readJson(join(cfgDir, "types.json"));
  const platforms = readJson(join(cfgDir, "platforms.json"));
  const seed = readJson(join(cfgDir, "quotes.seed.json"));

  console.log("[collect:otp] email: youjianma…");
  const youjianma = await collectYoujianmaMins();
  console.log("[collect:otp] email: smsbulk…");
  const smsbulk = await collectSmsbulkEmailMins();

  const liveByPlatform = {
    youjianma: youjianma.ok
      ? {
          ok: true,
          mins: youjianma.mins,
          currency: "CNY",
          sourceUrl: youjianma.sourceUrl,
          note: "邮件码公开页探针",
        }
      : null,
    smsbulk: smsbulk.ok
      ? {
          ok: true,
          mins: smsbulk.mins,
          sourceUrl: smsbulk.sourceUrl,
          note: "SMSBulk 邮箱价目页探针",
        }
      : null,
  };

  const livePlatforms = Object.entries(liveByPlatform)
    .filter(([, v]) => v?.ok)
    .map(([id]) => id);

  const quotes = mergeQuotes({
    seedQuotes: seed.quotes || [],
    platforms,
    liveByPlatform,
    fx,
  });

  return {
    generatedAt: new Date().toISOString(),
    capturedAt: new Date().toISOString(),
    fxUsdToCny: fx.rate,
    fxNote: fx.date
      ? `官网日更汇率 ${fx.date}`
      : "官网快照不可用时的回退汇率",
    types,
    platforms,
    quotes,
    livePlatforms,
    collectors: {
      youjianma: youjianma.ok ? "ok" : youjianma.error || "fail",
      smsbulk: smsbulk.ok ? "ok" : smsbulk.error || "fail",
    },
  };
}

async function main() {
  const { kind } = parseArgs(process.argv.slice(2));
  const fx = loadOfficialFx();
  console.log(`[collect:otp] fx=1USD→${fx.rate} CNY date=${fx.date || "-"}`);

  if (kind === "all" || kind === "sms") {
    const snap = await collectSms(fx);
    writeSnapshot("sms", snap);
    console.log("[collect:otp] sms collectors", snap.collectors);
  }
  if (kind === "all" || kind === "email") {
    const snap = await collectEmail(fx);
    writeSnapshot("email", snap);
    console.log("[collect:otp] email collectors", snap.collectors);
  }
}

main().catch((err) => {
  console.error("[collect:otp] fatal", err);
  process.exitCode = 1;
});
