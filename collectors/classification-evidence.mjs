import { readFileSync } from "node:fs";

const evidence = JSON.parse(readFileSync(new URL("../config/catalog-classification-evidence.json", import.meta.url), "utf8"));

function canonicalUrl(value) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:aff|ref|utm_.+)$/i.test(key)) url.searchParams.delete(key);
    }
    return url.href;
  } catch { return null; }
}

const rules = new Map(evidence.entries.map((entry) => [
  `${canonicalUrl(entry.url)}\n${entry.sourceTitle.trim()}`, entry.productSlug,
]));

/** Detail-backed, URL-scoped exceptions. Never infer from a shop name or price. */
export function auditedClassification(title, url) {
  const key = canonicalUrl(url);
  return key ? rules.get(`${key}\n${String(title || "").trim()}`) || null : null;
}
