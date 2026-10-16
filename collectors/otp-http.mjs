/** Shared fetch helper for OTP platform collectors. */

export async function fetchText(url, opts = {}) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
    headers: {
      accept: "application/json,text/html,*/*",
      "user-agent":
        opts.userAgent ??
        "ai-price-radar-otp/1.0 (+https://github.com/PaiDX12138/ai-price-radar)",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text, url };
}

export async function fetchJson(url, opts = {}) {
  const page = await fetchText(url, opts);
  if (!page.ok) {
    return { ...page, json: null, error: `HTTP ${page.status}` };
  }
  try {
    return { ...page, json: JSON.parse(page.text), error: null };
  } catch (err) {
    return {
      ...page,
      json: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function minPositive(nums) {
  let min = Infinity;
  for (const n of nums) {
    const v = Number(n);
    if (Number.isFinite(v) && v > 0 && v < min) min = v;
  }
  return min === Infinity ? null : min;
}
