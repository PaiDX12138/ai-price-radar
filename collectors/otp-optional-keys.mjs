/**
 * 可选 API Key 平台（有 Key 才采；无 Key 跳过）
 * - SMS_MAN_TOKEN → api.sms-man.com
 * - ONLINE_SIM_APIKEY → onlinesim.io getTariffs
 * - HERO_SMS_API_KEY → hero-sms stubs getPrices（SMS-Activate 兼容）
 */
import { fetchJson, fetchText, minPositive } from "./otp-http.mjs";

const SMS_MAN_APP = {
  openai: null, // resolve via applications list if needed
  google: null,
  paypal: null,
};

/**
 * SMS-Man get-prices (token required)
 * https://api.sms-man.com/control/get-prices?token=
 */
export async function collectSmsManMins(token) {
  if (!token) return { ok: false, mins: {}, skipped: true };
  const page = await fetchJson(
    `https://api.sms-man.com/control/get-prices?token=${encodeURIComponent(token)}&currency=USD`,
  );
  if (!page.json || page.json.success === false) {
    return {
      ok: false,
      mins: {},
      error: page.json?.error_msg || page.error || "sms-man failed",
    };
  }

  // Response shape: { "0": { "1": { cost, count }, ... }, ... } country → appId → meta
  // Without application id map we take global min across all — not ideal.
  // Better: fetch applications then map codes.
  const appsPage = await fetchJson(
    `https://api.sms-man.com/control/applications?token=${encodeURIComponent(token)}`,
  );
  const apps = Array.isArray(appsPage.json) ? appsPage.json : [];
  const codeToId = new Map();
  for (const a of apps) {
    if (a?.code && a?.id != null) codeToId.set(String(a.code).toLowerCase(), String(a.id));
  }
  const map = {
    openai: ["openai", "chatgpt", "oa"],
    google: ["go", "google", "youtube"],
    paypal: ["pp", "paypal"],
    generic: ["ot", "other", "full"],
  };

  /** @type {Record<string, number[]>} */
  const buckets = { openai: [], google: [], paypal: [], generic: [] };
  const prices = page.json;
  for (const country of Object.values(prices)) {
    if (!country || typeof country !== "object") continue;
    for (const [typeId, codes] of Object.entries(map)) {
      for (const code of codes) {
        const id = codeToId.get(code);
        if (!id) continue;
        const row = country[id];
        const cost = Number(row?.cost ?? row?.price);
        if (Number.isFinite(cost) && cost > 0) buckets[typeId].push(cost);
      }
    }
  }

  /** @type {Record<string, number>} */
  const mins = {};
  for (const [k, arr] of Object.entries(buckets)) {
    const m = minPositive(arr);
    if (m != null) mins[k] = m;
  }
  return {
    ok: Object.keys(mins).length > 0,
    mins,
    sourceUrl: "https://sms-man.com/",
  };
}

/**
 * OnlineSim getTariffs with apikey
 */
export async function collectOnlineSimMins(apikey) {
  if (!apikey) return { ok: false, mins: {}, skipped: true };
  const map = {
    openai: "openai",
    google: "google",
    paypal: "paypal",
    generic: "service",
  };
  /** @type {Record<string, number>} */
  const mins = {};
  for (const [typeId, filter] of Object.entries(map)) {
    const url = `https://onlinesim.io/api/getTariffs.php?apikey=${encodeURIComponent(apikey)}&lang=en&filter_service=${encodeURIComponent(filter)}&locale_price=1`;
    const page = await fetchJson(url);
    const countries = page.json?.countries || page.json?.services || {};
    const costs = [];
    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      const p = Number(node.price ?? node.locale_price ?? node.cost);
      if (Number.isFinite(p) && p > 0) costs.push(p);
      for (const v of Object.values(node)) {
        if (v && typeof v === "object") walk(v);
      }
    };
    walk(countries);
    const m = minPositive(costs);
    if (m != null) mins[typeId] = m;
  }
  return {
    ok: Object.keys(mins).length > 0,
    mins,
    sourceUrl: "https://onlinesim.io/",
  };
}

/**
 * HeroSMS SMS-Activate compatible getPrices
 */
export async function collectHeroSmsMins(apiKey) {
  if (!apiKey) return { ok: false, mins: {}, skipped: true };
  const map = {
    openai: "openai",
    google: "go",
    paypal: "pp",
    generic: "full",
  };
  /** @type {Record<string, number>} */
  const mins = {};
  for (const [typeId, service] of Object.entries(map)) {
    const url = `https://hero-sms.com/stubs/handler_api.php?api_key=${encodeURIComponent(apiKey)}&action=getPrices&service=${encodeURIComponent(service)}`;
    const page = await fetchText(url);
    if (!page.text.startsWith("{")) continue;
    try {
      const data = JSON.parse(page.text);
      const costs = [];
      for (const row of Object.values(data)) {
        const info = row?.[service] || Object.values(row || {})[0];
        const cost = Number(info?.cost);
        if (Number.isFinite(cost) && cost > 0) costs.push(cost);
      }
      const m = minPositive(costs);
      if (m != null) mins[typeId] = m;
    } catch {
      /* ignore */
    }
  }
  return {
    ok: Object.keys(mins).length > 0,
    mins,
    sourceUrl: "https://hero-sms.com/",
  };
}
