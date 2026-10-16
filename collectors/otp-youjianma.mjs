/**
 * 邮件码 — 公开 FAQ 标价探针
 * https://www.youjianma.com/
 */
import { fetchText } from "./otp-http.mjs";

const URL = "https://www.youjianma.com/";

/**
 * @returns {Promise<{ ok: boolean, mins: Record<string, number>, currency: 'CNY', error?: string }>}
 */
export async function collectYoujianmaMins() {
  const page = await fetchText(URL);
  if (!page.ok) return { ok: false, mins: {}, currency: "CNY", error: `HTTP ${page.status}` };

  const html = page.text;
  /** @type {Record<string, number>} */
  const mins = {};

  // 常见文案：Gmail（gmail.com）为 0.7 元/次；其他域名 0.5 元/次
  const gmail =
    html.match(/Gmail[^0-9]{0,40}(\d+(?:\.\d+)?)\s*元/i) ||
    html.match(/gmail\.com[^0-9]{0,30}(\d+(?:\.\d+)?)/i) ||
    html.match(/为\s*(0\.7)\s*元/);
  const other =
    html.match(/其他[^0-9]{0,20}(\d+(?:\.\d+)?)\s*元/) ||
    html.match(/域名[^0-9]{0,20}(\d+(?:\.\d+)?)\s*元/) ||
    html.match(/为\s*(0\.5)\s*元/);

  const g = Number(gmail?.[1]);
  const o = Number(other?.[1]);
  if (Number.isFinite(g) && g > 0) {
    mins.gmail = g;
  }
  if (Number.isFinite(o) && o > 0) {
    mins.outlook = o;
    mins.yahoo = o;
  }

  // 页面若为 SPA 抽不到，用已核实的公开 FAQ 兜底（仍标记为探针失败可回退种子）
  if (!Object.keys(mins).length) {
    return {
      ok: false,
      mins: {},
      currency: "CNY",
      sourceUrl: URL,
      error: "spa_or_no_match",
    };
  }

  return { ok: true, mins, currency: "CNY", sourceUrl: URL };
}
