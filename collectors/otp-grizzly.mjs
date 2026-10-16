/**
 * GrizzlySMS — 部分服务可匿名 getPrices（无需 Key）
 * GET https://api.grizzlysms.com/stubs/handler_api.php?action=getPrices&service={code}
 */
import { fetchText, minPositive } from "./otp-http.mjs";

const BASE =
  "https://api.grizzlysms.com/stubs/handler_api.php?action=getPrices&service=";

/** Our SMS typeId → Grizzly service short code(s) that work without key */
export const GRIZZLY_SMS_SERVICES = {
  google: ["go"],
  // tg works anonymously but we don't have a telegram product card; keep for future
};

/**
 * @returns {Promise<{ ok: boolean, mins: Record<string, number>, error?: string }>}
 */
export async function collectGrizzlyMins(serviceMap = GRIZZLY_SMS_SERVICES) {
  /** @type {Record<string, number>} */
  const mins = {};
  const errors = [];

  for (const [typeId, codes] of Object.entries(serviceMap)) {
    const costs = [];
    for (const code of codes) {
      const page = await fetchText(`${BASE}${encodeURIComponent(code)}`);
      if (!page.text.startsWith("{")) {
        errors.push(`${code}:${page.text.slice(0, 40)}`);
        continue;
      }
      try {
        const data = JSON.parse(page.text);
        for (const row of Object.values(data)) {
          const info = row?.[code];
          const cost = Number(info?.cost);
          if (Number.isFinite(cost) && cost > 0) costs.push(cost);
        }
      } catch (err) {
        errors.push(`${code}:parse`);
      }
    }
    const m = minPositive(costs);
    if (m != null) mins[typeId] = m;
  }

  return {
    ok: Object.keys(mins).length > 0,
    mins,
    error: errors.length ? errors.join("; ") : undefined,
    sourceUrl: "https://grizzlysms.com/",
  };
}
