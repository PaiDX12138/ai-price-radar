/**
 * SMSBulk 邮箱公开价目页探针（无需 Key）
 * https://smsbulk.net/zh/email-verification
 */
import { fetchText } from "./otp-http.mjs";

const URL = "https://smsbulk.net/zh/email-verification";

/**
 * @returns {Promise<{ ok: boolean, mins: Record<string, number>, error?: string }>}
 */
export async function collectSmsbulkEmailMins() {
  const page = await fetchText(URL);
  if (!page.ok) return { ok: false, mins: {}, error: `HTTP ${page.status}` };

  const html = page.text;
  /** @type {Record<string, number>} */
  const mins = {};

  // Table rows like: gmail.com … $0.08 / outlook … $0.02 / gmx from $0.02
  const gmail = html.match(/gmail\.com[\s\S]{0,120}?\$?\s*(0\.\d{2,4})/i);
  const outlook = html.match(
    /outlook\.com[\s\S]{0,120}?\$?\s*(0\.\d{2,4})|hotmail[\s\S]{0,80}?\$?\s*(0\.\d{2,4})/i,
  );
  const domain = html.match(
    /gmx\.com[\s\S]{0,120}?\$?\s*(0\.\d{2,4})|mail\.com[\s\S]{0,80}?from\s*\$?\s*(0\.\d{2,4})/i,
  );
  // Fallback published FAQ lines
  const fromGmail = html.match(/gmail\.com[^$]{0,40}\$\s*(0\.\d{2,4})/i);
  const fromLow = html.match(/from\s*\$\s*(0\.\d{2,4})/i);

  const g = Number(gmail?.[1] || fromGmail?.[1]);
  if (Number.isFinite(g) && g > 0) mins.gmail = g;

  const o = Number(outlook?.[1] || outlook?.[2]);
  if (Number.isFinite(o) && o > 0) mins.outlook = o;
  else if (fromLow) {
    const f = Number(fromLow[1]);
    if (Number.isFinite(f) && f > 0) mins.outlook = f;
  }

  const d = Number(domain?.[1] || domain?.[2] || fromLow?.[1]);
  if (Number.isFinite(d) && d > 0) mins.domain = d;

  return {
    ok: Object.keys(mins).length > 0,
    mins,
    sourceUrl: URL,
    error: Object.keys(mins).length ? undefined : "no prices parsed",
  };
}
