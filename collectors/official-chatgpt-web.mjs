/**
 * ChatGPT 官网分地区标价 — 匿名公开 JSON（chatgpt.com 定价页自己调用的同一接口）。
 *
 *   GET https://chatgpt.com/backend-api/checkout_pricing_config/configs/{ISO2}
 *
 * 已探针（无登录 / 无 Cookie / 无风控挑战）：
 * - 232 个国家返回 200；ChatGPT 不开放的地区（CN / RU / IR / HK …）返回 404，按「该地区不售」处理。
 * - currency_config.{go|plus|prolite|pro|promax}.{month|year}.amount 是官网标价。
 *   tax = inclusive（已含税）/ exclusive（未含税）；税率见 currency_config.tax_percent，
 *   缺省（美国、加拿大等销售税因州而异）则保持标价，仅标注「未含税」。
 * - year.amount 是「按年付折合的每月价」，年费 = amount × 12。
 * - psp_override 各国口径不一致（埃及是税前、墨西哥是含税、危地马拉甚至是另一档价），
 *   因此不参与取价；统一用「标价 + 税」折成买家实付。
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const BASE = "https://chatgpt.com/backend-api/checkout_pricing_config/configs";
const TIMEOUT_MS = 20_000;
const ATTEMPTS = 3;

/** 本站套餐 slug → 官网配置里的套餐键 / 周期。go-annual 官网没有对应 SKU。 */
export const CHATGPT_WEB_PLAN_MAP = {
  "go-monthly": { key: "go", period: "month" },
  "plus-monthly": { key: "plus", period: "month" },
  "plus-annual": { key: "plus", period: "year" },
  "pro-5x": { key: "prolite", period: "month" },
  "pro-20x": { key: "pro", period: "month" },
  "pro-500": { key: "promax", period: "month" },
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function chatgptWebSourceUrl(countryCode) {
  return `${BASE}/${String(countryCode).toUpperCase()}`;
}

/**
 * @param {string} countryCode ISO 3166-1 alpha-2
 * @returns {Promise<{
 *   ok: boolean,
 *   unavailable?: boolean,
 *   blocked?: boolean,
 *   status: number,
 *   config?: any,
 *   error?: string,
 *   url: string,
 * }>}
 */
export async function fetchChatgptWebPricing(countryCode) {
  const cc = String(countryCode).toUpperCase();
  const url = chatgptWebSourceUrl(cc);
  let lastError = "";
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": UA,
          accept: "application/json",
          "accept-language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // 不开放的国家：不是故障，也不重试
      if (res.status === 404) return { ok: false, unavailable: true, status: 404, url };
      // 被限流 / 拦截：不重试、不绕过，交给调用方冷却
      if (res.status === 403 || res.status === 429) {
        return { ok: false, blocked: true, status: res.status, error: `HTTP ${res.status}`, url };
      }
      if (res.status >= 500) {
        lastError = `HTTP ${res.status}`;
        await sleep(1000 * attempt);
        continue;
      }
      if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}`, url };
      const json = await res.json();
      if (String(json?.country_code || "").toUpperCase() !== cc || !json?.currency_config) {
        return { ok: false, status: res.status, error: "country mismatch or empty config", url };
      }
      return { ok: true, status: res.status, config: json, url };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      await sleep(1000 * attempt);
    }
  }
  return { ok: false, status: 0, error: lastError || "fetch failed", url };
}

function roundTo(value, exponent) {
  const f = 10 ** exponent;
  return Math.round(value * f) / f;
}

/** 月均价 × 12 带来的舍入误差很小：贴近整数时按整数年费处理（200.04 → 200）。 */
function snapAnnual(total, exponent) {
  if (exponent >= 1 && Math.abs(total - Math.round(total)) <= 0.07) return Math.round(total);
  return roundTo(total, exponent);
}

/**
 * 取某套餐的官网标价，并折成买家实付（含税）。
 * @param {any} config fetchChatgptWebPricing().config
 * @param {string} planSlug 本站套餐 slug
 * @returns {{
 *   currencyCode: string,
 *   exponent: number,
 *   listValue: number,
 *   payableValue: number,
 *   taxMode: "inclusive" | "exclusive" | null,
 *   taxPercent: number | null,
 * } | null}
 */
export function extractChatgptWebOffer(config, planSlug) {
  const map = CHATGPT_WEB_PLAN_MAP[planSlug];
  const cc = config?.currency_config;
  const node = map ? cc?.[map.key]?.[map.period] : null;
  const amount = Number(node?.amount);
  const currencyCode = typeof cc?.symbol_code === "string" ? cc.symbol_code.toUpperCase() : "";
  if (!node || !Number.isFinite(amount) || amount <= 0 || !currencyCode) return null;

  const exponent = Number.isInteger(cc.minor_unit_exponent) ? cc.minor_unit_exponent : 2;
  const taxMode = node.tax === "inclusive" || node.tax === "exclusive" ? node.tax : null;
  const rawPercent = Number(cc.tax_percent);
  const taxPercent = Number.isFinite(rawPercent) && rawPercent > 0 ? rawPercent : null;

  const listValue =
    map.period === "year" ? snapAnnual(amount * 12, exponent) : roundTo(amount, exponent);
  const payableValue =
    taxMode === "exclusive" && taxPercent
      ? roundTo(listValue * (1 + taxPercent / 100), exponent)
      : listValue;

  return { currencyCode, exponent, listValue, payableValue, taxMode, taxPercent };
}

/** 展示用原币文本：$8 / EGP 220 / ₹399（整数不带小数）。 */
export function formatChatgptWebPrice(value, currencyCode, exponent = 2) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "symbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: exponent,
    })
      .format(value)
      .replace(/\u00a0/g, " ");
  } catch {
    return `${currencyCode} ${value}`;
  }
}
