/**
 * 自建卡网站点 favicon 自动拉取。
 * - Kami / 独角 / 联动 / 云猫 / QXVX：用固定品牌标，不拉单站 ico
 * - 其余自建站：优先 favicon.svg / link[rel=icon] / favicon.ico（避开 apple-touch 宣传图）
 * 写入 public/brands/shops/hosts/ + src/data/generated/shop-host-logos.json
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BROWSER_UA, delay, hostOf } from "./util.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const HOST_FAVICON_DIR = join(root, "public/brands/shops/hosts");
export const HOST_FAVICON_MANIFEST = join(root, "src/data/generated/shop-host-logos.json");

/** 这些平台用品牌标，采集时不覆盖为单站 favicon。 */
const BRAND_PLATFORMS = new Set(["liandong", "yunmao", "qxvx", "shop16688", "kami", "dujiao"]);
const BRAND_KINDS = new Set(["shopapi", "shop16688", "kami", "dujiao"]);

const EXT_BY_MIME = {
  "image/svg+xml": "svg",
  "image/png": "png",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function normalizeFaviconHost(host) {
  return String(host || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./i, "")
    .toLowerCase();
}

export function shouldFetchHostFavicon(source) {
  const platform = String(source?.platform || "").toLowerCase();
  const kind = String(source?.collectorKind || source?.kind || "").toLowerCase();
  if (BRAND_PLATFORMS.has(platform) || BRAND_KINDS.has(kind)) return false;
  const host = normalizeFaviconHost(source?.host || hostOf(source?.baseUrl));
  return Boolean(host);
}

function sniffExt(buf, contentType, url) {
  const mime = String(contentType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (EXT_BY_MIME[mime]) return EXT_BY_MIME[mime];
  if (/\.svg(\?|$)/i.test(url)) return "svg";
  if (/\.png(\?|$)/i.test(url)) return "png";
  if (/\.jpe?g(\?|$)/i.test(url)) return "jpg";
  if (/\.webp(\?|$)/i.test(url)) return "webp";
  if (/\.ico(\?|$)/i.test(url)) return "ico";
  if (!buf?.length) return "bin";
  const head = buf.subarray(0, Math.min(64, buf.length)).toString("utf8");
  if (head.includes("<svg") || head.includes("<?xml")) return "svg";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  if (buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01) return "ico";
  return "ico";
}

function absolutize(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return "";
  }
}

async function fetchBuffer(url, { timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "user-agent": BROWSER_UA,
      },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 32) return null;
    return {
      buf,
      contentType: res.headers.get("content-type") || "",
      finalUrl: res.url || url,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function listCandidates(origin) {
  const ranked = [];
  let html = "";
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(origin + "/", {
      signal: ctrl.signal,
      headers: { accept: "text/html,*/*", "user-agent": BROWSER_UA },
    });
    clearTimeout(timer);
    if (res.ok) html = await res.text();
  } catch {
    /* ignore */
  }

  const linkRe = /<link\b[^>]*>/gi;
  let m;
  while ((m = linkRe.exec(html))) {
    const tag = m[0];
    const relMatch = tag.match(/\brel=["']([^"']+)["']/i);
    if (!relMatch || !/icon/i.test(relMatch[1])) continue;
    const rel = relMatch[1].toLowerCase();
    const hrefMatch = tag.match(/\bhref=["']([^"']+)["']/i);
    const href = hrefMatch?.[1];
    if (!href) continue;
    const url = absolutize(href, origin + "/");
    if (!url) continue;
    // apple-touch 常为启动图/宣传图，优先级最低
    const prio = /apple/i.test(rel) ? 80 : /shortcut/i.test(rel) ? 10 : 20;
    ranked.push({ prio, url });
  }

  ranked.push({ prio: 5, url: `${origin}/favicon.svg` });
  ranked.push({ prio: 15, url: `${origin}/favicon.ico` });
  ranked.push({ prio: 25, url: `${origin}/favicon.png` });
  // Logo.png 一类（catcard）作兜底
  ranked.push({ prio: 60, url: `${origin}/Logo.png` });
  ranked.push({ prio: 90, url: `${origin}/apple-touch-icon.png` });
  ranked.push({ prio: 95, url: `${origin}/apple-icon.jpg` });

  const seen = new Set();
  return ranked
    .sort((a, b) => a.prio - b.prio)
    .map((x) => x.url)
    .filter((u) => {
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    });
}

function clearHostAssets(host) {
  if (!existsSync(HOST_FAVICON_DIR)) return;
  for (const name of readdirSync(HOST_FAVICON_DIR)) {
    if (name === "manifest.json") continue;
    const stem = name.replace(/\.[^.]+$/, "");
    if (stem === host) {
      try {
        unlinkSync(join(HOST_FAVICON_DIR, name));
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * @returns {Promise<{ host: string, src: string|null, error?: string }>}
 */
export async function fetchAndSaveHostFavicon(hostOrUrl, { force = false } = {}) {
  const host = normalizeFaviconHost(hostOrUrl);
  if (!host) return { host: "", src: null, error: "empty host" };

  mkdirSync(HOST_FAVICON_DIR, { recursive: true });

  if (!force) {
    const existing = findExistingHostAsset(host);
    if (existing) return { host, src: existing };
  }

  const origin = `https://${host}`;
  const candidates = await listCandidates(origin);
  for (const url of candidates) {
    const hit = await fetchBuffer(url);
    if (!hit) continue;
    // 跳过明显过大的宣传 JPG（apple 类），除非是 SVG/ICO/小 PNG
    const ext = sniffExt(hit.buf, hit.contentType, hit.finalUrl || url);
    if ((ext === "jpg" || ext === "jpeg") && hit.buf.length > 80_000) continue;
    if (ext === "png" && hit.buf.length > 400_000) continue;

    clearHostAssets(host);
    const fileName = `${host}.${ext}`;
    const abs = join(HOST_FAVICON_DIR, fileName);
    writeFileSync(abs, hit.buf);
    const src = `/brands/shops/hosts/${fileName}`;
    return { host, src };
  }
  return { host, src: null, error: "no favicon found" };
}

function findExistingHostAsset(host) {
  if (!existsSync(HOST_FAVICON_DIR)) return null;
  const prefer = ["svg", "png", "ico", "webp", "jpg"];
  const names = readdirSync(HOST_FAVICON_DIR).filter((n) => n.startsWith(`${host}.`));
  for (const ext of prefer) {
    const hit = names.find((n) => n === `${host}.${ext}`);
    if (hit) return `/brands/shops/hosts/${hit}`;
  }
  return names[0] ? `/brands/shops/hosts/${names[0]}` : null;
}

function scanDiskManifest() {
  const out = {};
  if (!existsSync(HOST_FAVICON_DIR)) return out;
  for (const name of readdirSync(HOST_FAVICON_DIR)) {
    if (!/\.(svg|png|ico|webp|jpe?g|gif)$/i.test(name)) continue;
    if (name.startsWith("_") || name === "manifest.json") continue;
    const host = name.replace(/\.[^.]+$/, "");
    // 同 host 多扩展名时保留优先级更高的
    const src = `/brands/shops/hosts/${name}`;
    const prev = out[host];
    if (!prev) {
      out[host] = src;
      continue;
    }
    const rank = (p) => {
      const e = p.split(".").pop()?.toLowerCase();
      return { svg: 0, png: 1, ico: 2, webp: 3, jpg: 4, jpeg: 5 }[e] ?? 9;
    };
    if (rank(src) < rank(prev)) out[host] = src;
  }
  return out;
}

export function writeHostFaviconManifest(extra = {}) {
  mkdirSync(dirname(HOST_FAVICON_MANIFEST), { recursive: true });
  mkdirSync(HOST_FAVICON_DIR, { recursive: true });
  const merged = {
    generatedAt: new Date().toISOString(),
    hosts: {
      ...scanDiskManifest(),
      ...extra,
    },
  };
  // drop nulls
  for (const [k, v] of Object.entries(merged.hosts)) {
    if (!v) delete merged.hosts[k];
  }
  writeFileSync(HOST_FAVICON_MANIFEST, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  // 同步一份到 public，方便排查
  writeFileSync(
    join(HOST_FAVICON_DIR, "manifest.json"),
    `${JSON.stringify(merged, null, 2)}\n`,
    "utf8",
  );
  return merged;
}

/**
 * 从 catalog sources 批量同步自建站 favicon。
 * @param {Array<{ host?: string, platform?: string, collectorKind?: string, baseUrl?: string }>} sources
 */
export async function syncHostFavicons(sources, { force = false, concurrency = 3 } = {}) {
  const hosts = [
    ...new Set(
      (sources || [])
        .filter(shouldFetchHostFavicon)
        .map((s) => normalizeFaviconHost(s.host || hostOf(s.baseUrl)))
        .filter(Boolean),
    ),
  ].sort();

  const results = {};
  let i = 0;
  async function worker() {
    while (i < hosts.length) {
      const idx = i;
      i += 1;
      const host = hosts[idx];
      process.stdout.write(`[favicon] (${idx + 1}/${hosts.length}) ${host} ... `);
      const r = await fetchAndSaveHostFavicon(host, { force });
      if (r.src) {
        results[host] = r.src;
        console.log(`ok ${r.src}`);
      } else {
        console.log(`skip ${r.error || "failed"}`);
      }
      await delay(200);
    }
  }

  const n = Math.max(1, Math.min(concurrency, hosts.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  const manifest = writeHostFaviconManifest(results);
  return { hosts: hosts.length, saved: Object.keys(results).length, manifest };
}

export function loadHostFaviconManifest() {
  if (!existsSync(HOST_FAVICON_MANIFEST)) {
    return { generatedAt: null, hosts: scanDiskManifest() };
  }
  try {
    return JSON.parse(readFileSync(HOST_FAVICON_MANIFEST, "utf8"));
  } catch {
    return { generatedAt: null, hosts: scanDiskManifest() };
  }
}
