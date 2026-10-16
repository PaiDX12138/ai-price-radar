/**
 * Optional HTTP(S) proxy for collectors (mainly ShopApi / 链动 403 bypass).
 * Env (preferred):
 *   PROXY_URL=http://user:pass@host:port
 *   PROXY_API_URL=...          # used by proxy-pool / worker only
 * Compat:
 *   COLLECTOR_HTTP_PROXY=...
 *   COLLECTOR_HTTPS_PROXY / HTTPS_PROXY / HTTP_PROXY
 */
import { ProxyAgent, fetch as undiciFetch } from "undici";
import { getFixedProxyUrl } from "./proxy-pool.mjs";

let cachedKey = "";
/** @type {ProxyAgent | null} */
let cachedAgent = null;

export function getCollectorProxyUrl() {
  return getFixedProxyUrl();
}

function getProxyAgent() {
  const url = getCollectorProxyUrl();
  if (!url) {
    cachedKey = "";
    cachedAgent = null;
    return null;
  }
  if (cachedAgent && cachedKey === url) return cachedAgent;
  cachedKey = url;
  cachedAgent = new ProxyAgent(url);
  return cachedAgent;
}

/**
 * Fetch that honors PROXY_URL / COLLECTOR_HTTP_PROXY when set; otherwise global fetch.
 * Drop-in for ShopApi `fetchImpl` (manual collect scripts).
 */
export function createProxiedFetch() {
  const agent = getProxyAgent();
  if (!agent) {
    return globalThis.fetch.bind(globalThis);
  }
  /** @type {typeof fetch} */
  const proxied = (input, init = {}) =>
    undiciFetch(input, {
      ...init,
      dispatcher: agent,
    });
  return proxied;
}

export function describeCollectorProxy() {
  const url = getCollectorProxyUrl();
  if (!url) return "off";
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}:${u.port || (u.protocol === "https:" ? 443 : 80)}`;
  } catch {
    return "invalid";
  }
}
