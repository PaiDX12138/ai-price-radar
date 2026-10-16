/**
 * 5SIM — 公开 guest 价目（无需 API Key）
 * GET https://5sim.net/v1/guest/prices
 */
import { fetchJson, minPositive } from "./otp-http.mjs";

export const FIVESIM_GUEST_PRICES_URL = "https://5sim.net/v1/guest/prices";

/** Our typeId → 5sim service slug(s) */
export const FIVESIM_SMS_SERVICES = {
  openai: ["openai"],
  paypal: ["paypal"],
  google: ["google"],
  generic: ["other"],
};

export const FIVESIM_EMAIL_HINT_SERVICES = {
  /** SMS side proxies for email-related account signup codes */
  gmail: ["google"],
  outlook: ["microsoft"],
  yahoo: ["yahoo"],
  icloud: ["apple"],
};

/**
 * @returns {Promise<{ ok: boolean, mins: Record<string, number>, error?: string }>}
 */
export async function collect5simGuestMins(serviceMap) {
  const page = await fetchJson(FIVESIM_GUEST_PRICES_URL);
  if (!page.json || typeof page.json !== "object") {
    return { ok: false, mins: {}, error: page.error || "bad json" };
  }

  /** @type {Record<string, number[]>} */
  const buckets = {};
  for (const [typeId, slugs] of Object.entries(serviceMap)) {
    buckets[typeId] = [];
  }

  for (const svcs of Object.values(page.json)) {
    if (!svcs || typeof svcs !== "object") continue;
    for (const [typeId, slugs] of Object.entries(serviceMap)) {
      for (const slug of slugs) {
        const operators = svcs[slug];
        if (!operators || typeof operators !== "object") continue;
        for (const info of Object.values(operators)) {
          const cost = Number(info?.cost);
          if (Number.isFinite(cost) && cost > 0) buckets[typeId].push(cost);
        }
      }
    }
  }

  /** @type {Record<string, number>} */
  const mins = {};
  for (const [typeId, arr] of Object.entries(buckets)) {
    const m = minPositive(arr);
    if (m != null) mins[typeId] = m;
  }
  return { ok: Object.keys(mins).length > 0, mins, sourceUrl: FIVESIM_GUEST_PRICES_URL };
}
