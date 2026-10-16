/**
 * Global proxy pool for 链动 ShopApi (optional).
 *
 * Env (user-facing):
 *   PROXY_API_URL=...          # extract-IP API (one IP per call)
 *   PROXY_URL=http://user:pass@host:port
 *   COLLECTOR_HTTP_PROXY=...   # alias for PROXY_URL
 *
 * Built-in defaults (no user config required):
 *   - channels: 4 with PROXY_API_URL, else 1
 *   - extract budget: max 2 per 10 minutes (global)
 *   - acquire order: current channel IP → standby → extract API
 *   - rotated-but-usable IPs go to standby for other channels
 */
import { ProxyAgent, fetch as undiciFetch } from "undici";

const EXTRACT_WINDOW_MS = 10 * 60 * 1000;
const EXTRACT_MAX_PER_WINDOW = 2;
const DEFAULT_IP_TTL_MS = 5 * 60 * 1000;
const CHANNEL_COOLDOWN_MS = 5 * 60 * 1000;
const IP_EXPIRE_SLACK_MS = 30 * 1000;

/**
 * @typedef {{
 *   url: string,
 *   expiresAtMs: number,
 *   source: 'api' | 'fixed' | 'standby',
 * }} ProxyIp
 */

/**
 * @typedef {{
 *   index: number,
 *   ip: ProxyIp | null,
 *   agent: import('undici').ProxyAgent | null,
 *   cooldownUntilMs: number,
 *   fetchImpl: typeof fetch,
 * }} ProxyChannel
 */

function nowMs() {
  return Date.now();
}

/**
 * Resolve fixed proxy URL (PROXY_URL / COLLECTOR_HTTP_PROXY / …).
 */
export function getFixedProxyUrl() {
  return String(
    process.env.PROXY_URL ||
      process.env.COLLECTOR_HTTP_PROXY ||
      process.env.COLLECTOR_HTTPS_PROXY ||
      process.env.HTTPS_PROXY ||
      process.env.HTTP_PROXY ||
      "",
  ).trim();
}

export function getProxyApiUrl() {
  return String(process.env.PROXY_API_URL || "").trim();
}

/**
 * @returns {'api' | 'fixed' | 'none'}
 */
export function getProxyMode() {
  if (getProxyApiUrl()) return "api";
  if (getFixedProxyUrl()) return "fixed";
  return "none";
}

export function getLiandongChannelCount() {
  return getProxyMode() === "api" ? 4 : 1;
}

/**
 * Parse common extract-API response shapes into a proxy URL.
 * @param {unknown} body
 * @param {string} rawText
 */
function parseExtractedProxy(body, rawText) {
  if (typeof body === "string" && /:\d+/.test(body)) {
    const line = body.trim().split(/\r?\n/)[0].trim();
    return normalizeProxyLine(line);
  }
  if (body && typeof body === "object") {
    const o = /** @type {Record<string, unknown>} */ (body);
    const candidates = [
      o.proxy,
      o.url,
      o.proxyUrl,
      o.http,
      o.data,
      Array.isArray(o.data) ? o.data[0] : null,
      o.result,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) {
        const n = normalizeProxyLine(c.trim());
        if (n) return n;
      }
      if (c && typeof c === "object") {
        const row = /** @type {Record<string, unknown>} */ (c);
        const host = row.host || row.ip || row.server;
        const port = row.port;
        if (host && port) {
          const user = row.user || row.username || row.account;
          const pass = row.pass || row.password || row.pwd;
          if (user && pass) {
            return `http://${encodeURIComponent(String(user))}:${encodeURIComponent(String(pass))}@${host}:${port}`;
          }
          return `http://${host}:${port}`;
        }
      }
    }
  }
  const first = String(rawText || "")
    .trim()
    .split(/\r?\n/)[0]
    ?.trim();
  return first ? normalizeProxyLine(first) : null;
}

/**
 * @param {string} line
 */
function normalizeProxyLine(line) {
  const s = String(line || "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  // user:pass@ip:port
  if (/^.+@.+:\d+$/.test(s)) return `http://${s}`;
  // ip:port:user:pass
  const parts = s.split(":");
  if (parts.length === 4 && /^\d+$/.test(parts[1])) {
    const [ip, port, user, pass] = parts;
    return `http://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${ip}:${port}`;
  }
  // ip:port
  if (/^[\d.]+:\d+$/.test(s)) return `http://${s}`;
  return null;
}

function describeProxyUrl(url) {
  if (!url) return "off";
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}:${u.port || (u.protocol === "https:" ? 443 : 80)}`;
  } catch {
    return "invalid";
  }
}

function makeDirectFetch() {
  return globalThis.fetch.bind(globalThis);
}

/**
 * @param {string} proxyUrl
 */
function makeProxiedFetch(proxyUrl) {
  const agent = new ProxyAgent(proxyUrl);
  /** @type {typeof fetch} */
  const proxied = (input, init = {}) =>
    undiciFetch(input, {
      ...init,
      dispatcher: agent,
    });
  return { agent, fetchImpl: proxied };
}

export class ProxyPool {
  constructor(opts = {}) {
    this.mode = getProxyMode();
    this.channelCount = Number(opts.channelCount) > 0 ? Number(opts.channelCount) : getLiandongChannelCount();
    this.ipTtlMs = Number(opts.ipTtlMs) > 0 ? Number(opts.ipTtlMs) : DEFAULT_IP_TTL_MS;
    this.extractMax = Number(opts.extractMax) > 0 ? Number(opts.extractMax) : EXTRACT_MAX_PER_WINDOW;
    this.extractWindowMs =
      Number(opts.extractWindowMs) > 0 ? Number(opts.extractWindowMs) : EXTRACT_WINDOW_MS;
    this.cooldownMs =
      Number(opts.cooldownMs) > 0 ? Number(opts.cooldownMs) : CHANNEL_COOLDOWN_MS;
    /** @type {number[]} */
    this.extractTimestamps = [];
    /** @type {ProxyIp[]} */
    this.standby = [];
    /** @type {ProxyChannel[]} */
    this.channels = [];
    for (let i = 0; i < this.channelCount; i += 1) {
      this.channels.push({
        index: i,
        ip: null,
        agent: null,
        cooldownUntilMs: 0,
        fetchImpl: makeDirectFetch(),
      });
    }
    const fixed = getFixedProxyUrl();
    if (this.mode === "fixed" && fixed) {
      for (const ch of this.channels) {
        this.#assignIp(ch, {
          url: fixed,
          expiresAtMs: nowMs() + 365 * 24 * 60 * 60 * 1000,
          source: "fixed",
        });
      }
    }
  }

  describe() {
    return {
      mode: this.mode,
      channelCount: this.channelCount,
      standby: this.standby.length,
      extractBudgetLeft: this.#extractBudgetLeft(),
      channels: this.channels.map((ch) => ({
        index: ch.index,
        proxy: describeProxyUrl(ch.ip?.url || ""),
        cooldown: ch.cooldownUntilMs > nowMs(),
        expiresInMs: ch.ip ? Math.max(0, ch.ip.expiresAtMs - nowMs()) : 0,
      })),
    };
  }

  /**
   * @param {number} channelIndex
   */
  isChannelCooling(channelIndex) {
    const ch = this.channels[channelIndex];
    if (!ch) return false;
    return ch.cooldownUntilMs > nowMs();
  }

  /**
   * Ensure channel has a usable fetchImpl. Returns null if cooling / budget exhausted.
   * @param {number} channelIndex
   * @returns {Promise<{ fetchImpl: typeof fetch, proxyUrl: string | null, deferred?: boolean, reason?: string }>}
   */
  async ensureChannel(channelIndex) {
    const ch = this.channels[channelIndex];
    if (!ch) {
      return { fetchImpl: makeDirectFetch(), proxyUrl: null, reason: "bad_channel" };
    }
    if (ch.cooldownUntilMs > nowMs()) {
      return {
        fetchImpl: ch.fetchImpl,
        proxyUrl: ch.ip?.url || null,
        deferred: true,
        reason: "channel_cooldown",
      };
    }

    if (this.mode === "none") {
      ch.fetchImpl = makeDirectFetch();
      return { fetchImpl: ch.fetchImpl, proxyUrl: null };
    }

    if (this.mode === "fixed") {
      if (!ch.ip) {
        const fixed = getFixedProxyUrl();
        if (!fixed) {
          ch.fetchImpl = makeDirectFetch();
          return { fetchImpl: ch.fetchImpl, proxyUrl: null };
        }
        this.#assignIp(ch, {
          url: fixed,
          expiresAtMs: nowMs() + 365 * 24 * 60 * 60 * 1000,
          source: "fixed",
        });
      }
      return { fetchImpl: ch.fetchImpl, proxyUrl: ch.ip?.url || null };
    }

    // api mode
    if (ch.ip && ch.ip.expiresAtMs - IP_EXPIRE_SLACK_MS > nowMs()) {
      return { fetchImpl: ch.fetchImpl, proxyUrl: ch.ip.url };
    }

    // retiring soon-expired IP → standby if still usable
    if (ch.ip && ch.ip.expiresAtMs > nowMs()) {
      this.#parkStandby(ch.ip);
    }

    const fromStandby = this.#takeStandby();
    if (fromStandby) {
      this.#assignIp(ch, { ...fromStandby, source: "standby" });
      return { fetchImpl: ch.fetchImpl, proxyUrl: ch.ip.url };
    }

    const extracted = await this.#extractNewIp();
    if (!extracted.ok) {
      ch.cooldownUntilMs = nowMs() + this.cooldownMs;
      return {
        fetchImpl: makeDirectFetch(),
        proxyUrl: null,
        deferred: true,
        reason: extracted.reason || "extract_failed",
      };
    }
    this.#assignIp(ch, extracted.ip);
    return { fetchImpl: ch.fetchImpl, proxyUrl: ch.ip.url };
  }

  /**
   * Mark channel blocked; rotate IP if budget allows, else cool channel.
   * @param {number} channelIndex
   * @param {{ forceRotate?: boolean }} [opts]
   */
  async reportBlocked(channelIndex, opts = {}) {
    const ch = this.channels[channelIndex];
    if (!ch) return { rotated: false, deferred: true, reason: "bad_channel" };
    if (this.mode === "none") {
      ch.cooldownUntilMs = nowMs() + this.cooldownMs;
      return { rotated: false, deferred: true, reason: "direct_cooldown" };
    }
    if (this.mode === "fixed") {
      // Single fixed proxy — cool the channel, do not burn extract budget.
      ch.cooldownUntilMs = nowMs() + this.cooldownMs;
      return { rotated: false, deferred: true, reason: "fixed_proxy_cooldown" };
    }

    // Do not put blocked IP into standby.
    ch.ip = null;
    ch.agent = null;
    ch.fetchImpl = makeDirectFetch();

    if (!opts.forceRotate && this.#extractBudgetLeft() <= 0) {
      ch.cooldownUntilMs = nowMs() + this.cooldownMs;
      return { rotated: false, deferred: true, reason: "extract_budget" };
    }

    const fromStandby = this.#takeStandby();
    if (fromStandby) {
      this.#assignIp(ch, { ...fromStandby, source: "standby" });
      return { rotated: true, deferred: false, proxyUrl: ch.ip.url, source: "standby" };
    }

    const extracted = await this.#extractNewIp();
    if (!extracted.ok) {
      ch.cooldownUntilMs = nowMs() + this.cooldownMs;
      return { rotated: false, deferred: true, reason: extracted.reason || "extract_failed" };
    }
    this.#assignIp(ch, extracted.ip);
    return { rotated: true, deferred: false, proxyUrl: ch.ip.url, source: "api" };
  }

  /**
   * Soft-rotate when IP is near expiry (prefer standby).
   * @param {number} channelIndex
   */
  async rotateIfExpiring(channelIndex) {
    const ch = this.channels[channelIndex];
    if (!ch?.ip || this.mode !== "api") return { rotated: false };
    if (ch.ip.expiresAtMs - IP_EXPIRE_SLACK_MS > nowMs()) {
      return { rotated: false };
    }
    if (ch.ip.expiresAtMs > nowMs()) this.#parkStandby(ch.ip);
    ch.ip = null;
    return this.reportBlocked(channelIndex, { forceRotate: false });
  }

  #extractBudgetLeft() {
    const cutoff = nowMs() - this.extractWindowMs;
    this.extractTimestamps = this.extractTimestamps.filter((t) => t >= cutoff);
    return Math.max(0, this.extractMax - this.extractTimestamps.length);
  }

  /**
   * @param {ProxyIp} ip
   */
  #parkStandby(ip) {
    if (!ip?.url || ip.expiresAtMs <= nowMs()) return;
    if (this.standby.some((s) => s.url === ip.url)) return;
    this.standby.push(ip);
    // keep newest / longest-lived first
    this.standby.sort((a, b) => b.expiresAtMs - a.expiresAtMs);
    if (this.standby.length > 32) this.standby.length = 32;
  }

  #takeStandby() {
    const t = nowMs();
    while (this.standby.length) {
      const ip = this.standby.shift();
      if (ip && ip.expiresAtMs - IP_EXPIRE_SLACK_MS > t) return ip;
    }
    return null;
  }

  /**
   * @param {ProxyChannel} ch
   * @param {ProxyIp} ip
   */
  #assignIp(ch, ip) {
    try {
      ch.agent?.close?.();
    } catch {
      /* ignore */
    }
    const { agent, fetchImpl } = makeProxiedFetch(ip.url);
    ch.ip = ip;
    ch.agent = agent;
    ch.fetchImpl = fetchImpl;
    ch.cooldownUntilMs = 0;
  }

  async #extractNewIp() {
    const api = getProxyApiUrl();
    if (!api) return { ok: false, reason: "no_proxy_api" };
    if (this.#extractBudgetLeft() <= 0) {
      return { ok: false, reason: "extract_budget" };
    }
    this.extractTimestamps.push(nowMs());
    try {
      const res = await fetch(api, {
        method: "GET",
        headers: { accept: "application/json,text/plain,*/*" },
        signal: AbortSignal.timeout(15_000),
      });
      const text = await res.text();
      let body = text;
      try {
        body = JSON.parse(text);
      } catch {
        /* plain text */
      }
      if (!res.ok) {
        return { ok: false, reason: `extract_http_${res.status}` };
      }
      const url = parseExtractedProxy(body, text);
      if (!url) return { ok: false, reason: "extract_parse" };
      /** @type {ProxyIp} */
      const ip = {
        url,
        expiresAtMs: nowMs() + this.ipTtlMs,
        source: "api",
      };
      return { ok: true, ip };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : "extract_error",
      };
    }
  }
}

/** Singleton for worker process. */
let sharedPool = null;

export function getSharedProxyPool(opts = {}) {
  if (!sharedPool) sharedPool = new ProxyPool(opts);
  return sharedPool;
}

export function resetSharedProxyPool() {
  sharedPool = null;
}
