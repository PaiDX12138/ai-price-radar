/** Right Code's public schema. No Packy/New API pricing or performance assumptions. */
import { randomUUID, createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { upsertTransitCollection, upsertTransitPerformance, recordTransitSourceSnapshot } from "../transit-db.mjs";
import { rightApiOfferDiscount } from "./rightapi-discounts.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const number = value => value === null || value === undefined || value === "" || typeof value === "boolean"
  ? null : Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const plainText = text => String(text ?? "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ").trim();
const object = value => value && typeof value === "object" && !Array.isArray(value);

function familyOf(name) {
  const lower = name.toLowerCase();
  return /^claude/.test(lower) ? "Claude" : /^(gpt|codex|chatgpt|o\d)/.test(lower) ? "GPT"
    : /^(gemini|imagen|veo|nano-banana)/.test(lower) ? "Gemini" : /^grok/.test(lower) ? "Grok"
    : /^deepseek/.test(lower) ? "DeepSeek" : /^(glm|zai)/.test(lower) ? "GLM"
    : /^(kimi|moonshot)/.test(lower) ? "Kimi" : /^qwen/.test(lower) ? "Qwen" : "其他";
}

/** Only published effective prices are sale prices. Missing values are never base-price fallbacks. */
export function parseRightApiPricing(payload, upstreamPayload, config) {
  if (!Array.isArray(payload?.upstreams) || !Array.isArray(upstreamPayload?.upstreams)) throw new Error("invalid_rightapi_pricing_schema");
  const publicChannels = new Map(upstreamPayload.upstreams.map(channel => [channel.prefix, channel]));
  const groups = [], offers = [], seen = new Set(), modelNames = new Set();
  for (const channel of payload.upstreams) {
    const key = channel.prefix;
    if (typeof key !== "string" || !key.startsWith("/") || seen.has(key) || !Array.isArray(channel.models)) throw new Error("invalid_rightapi_channel");
    seen.add(key);
    const info = publicChannels.get(key);
    if (!info || !Number.isInteger(info.id)) throw new Error(`unmatched_rightapi_channel:${key}`);
    const active = info.is_active === true;
    groups.push({ groupKey: key, displayName: channel.name || info.name || key,
      modelRatio: number(info.rate), disclosure: "站点公开", description: plainText(channel.remark || info.remark),
      status: active ? "active" : "inactive", supportedProtocols: channel.supported_protocols ?? info.supported_protocols ?? [],
      rawGroup: { upstreamId: info.id, prefix: key, officialCurrency: channel.official_currency, modality: channel.modality },
    });
    const ownModels = new Set();
    for (const model of channel.models) {
      if (typeof model.name !== "string" || !model.name.trim() || ownModels.has(model.name)) throw new Error("invalid_rightapi_model");
      ownModels.add(model.name);
      // Unavailable rows remain in archived responses, not the public sale/minimum-price catalog.
      if (!active || model.is_available !== true) continue;
      modelNames.add(model.name);
      const effective = object(model.effective_price_config) ? model.effective_price_config : {};
      const mode = model.billing_mode;
      if (!["token", "tiered", "request", "param_rule", "time"].includes(mode)) throw new Error(`unsupported_rightapi_billing:${mode}`);
      const perRequest = mode === "request";
      const modality = channel.modality === "image" ? "image" : channel.modality === "video" ? "video" : "text";
      const amount = field => number(effective[field]);
      if (perRequest ? amount("request_price") === null : amount("input_price") === null || amount("output_price") === null) {
        throw new Error(`missing_rightapi_effective_price:${key}:${model.name}`);
      }
      offers.push({ groupKey: key, rawModel: model.name, family: familyOf(model.name), modality,
        priceKind: perRequest ? "fixed" : "token", currency: "CREDIT", priceUnit: perRequest ? "次" : "M Token",
        inputPrice: amount("input_price"), outputPrice: amount("output_price"),
        cacheReadPrice: amount("cache_read_input_price"), cacheWritePrice: amount("cache_creation_input_price"),
        cacheCreationPrice: amount("cache_creation_input_price"), fixedPrice: perRequest ? amount("request_price") : null,
        billingMode: perRequest ? "per_request" : mode, imageBilling: perRequest ? "per_request" : modality === "image" ? "token" : null,
        tiers: effective.tiers ?? null, supportedEndpointTypes: channel.supported_protocols ?? [],
        sourceUrl: config.pricingUrl, sourceModelVersion: String(model.pricing_version ?? ""),
        basePrice: { prices: model.base_price_config, officialCurrency: channel.official_currency },
        effectivePrice: { ...effective, groupRate: number(model.effective_total_multiplier),
          upstreamRate: number(model.effective_upstream_rate), modelRate: number(model.effective_model_rate),
          basis: "rightapi_public_effective_credit", officialCurrency: channel.official_currency,
          // Keep live condition flags as evidence; do not recalculate source timezone locally.
          sourceTimePeriods: model.time_periods, pricingSource: model.pricing_source },
        rawOffer: model, compositeMultiplier: null,
      });
    }
  }
  if (modelNames.size < (config.minimumModels ?? 5) || !offers.length) throw new Error("incomplete_rightapi_pricing");
  return { groups, offers, modelCount: modelNames.size, unresolved: [] };
}

export function parseRightApiAvailability(payload, identity, observedAt) {
  const generated = number(payload?.generated_at);
  if (!Array.isArray(payload?.upstreams) || generated === null || generated > Date.parse(observedAt) / 1000 + 300) throw new Error("invalid_rightapi_availability");
  if (Date.parse(observedAt) / 1000 - generated > 48 * 3600) throw new Error("stale_rightapi_availability");
  const rows = [], seen = new Set();
  for (const channel of payload.upstreams) {
    const known = identity.get(channel.upstream_prefix);
    if (!known) continue;
    if (channel.upstream_id !== known.id || !Array.isArray(channel.windows?.["24h"])) throw new Error("mismatched_rightapi_availability_channel");
    for (const model of channel.windows["24h"]) {
      if (!known.models.has(model.model)) continue;
      if (!Array.isArray(model.points)) throw new Error("invalid_rightapi_hour_points");
      for (const point of model.points) {
        const start = number(point.start_at), end = number(point.end_at), rate = number(point.availability);
        if (start === null || end === null || !Number.isInteger(start) || !Number.isInteger(end)
          || start % 3600 || start < generated - 26 * 3600 || end <= start || end > start + 3600 || end > generated + 300
          || typeof point.no_sample !== "boolean" || rate === null || rate > 100) throw new Error("invalid_rightapi_hour_bucket");
        const key = JSON.stringify([channel.upstream_prefix, model.model, start]);
        if (seen.has(key)) throw new Error("duplicate_rightapi_hour_bucket");
        seen.add(key);
        rows.push({ groupKey: channel.upstream_prefix, modelName: model.model,
          bucketAt: new Date(start * 1000).toISOString(), bucketEndAt: new Date(end * 1000).toISOString(),
          resolutionSeconds: 3600, isPartial: end < start + 3600, successRate: rate,
          userAvailability: number(point.user_availability), firstAttemptAvailability: number(point.first_attempt_availability),
          hasData: !point.no_sample, avgTtftMs: null, avgLatencyMs: null, avgTps: null,
        });
      }
    }
  }
  if (!rows.length) throw new Error("empty_rightapi_availability");
  return { rows, sourceGeneratedAt: new Date(generated * 1000).toISOString() };
}

export async function collectRightApiSource(db, config, options, runtime) {
  if (!config.enabled) return { id: config.id, status: "skipped" };
  const { fetchPublic, claimTransit, finishTransit } = runtime;
  const now = () => options.now ?? new Date().toISOString();
  const owner = options.owner ?? randomUUID(), startedAt = now(), runId = `transit-${config.id}-${randomUUID()}`;
  const warnings = [];
  const rawDir = options.rawDir ?? join(root, "data/transit/raw");
  const get = async (url, kind, json = true) => {
    const response = await fetchPublic(url, config, options.fetchImpl);
    const hash = createHash("sha256").update(response.text).digest("hex");
    const path = join(rawDir, config.id, `${kind}-${hash}.txt`);
    mkdirSync(dirname(path), { recursive: true });
    if (!existsSync(path)) writeFileSync(path, response.text, "utf8");
    recordTransitSourceSnapshot(db, { ...response, stationId: config.id, runId, sourceKind: kind, sourceUrl: url,
      payloadText: response.text, payloadHash: hash, payloadPath: path, capturedAt: now() });
    return json ? JSON.parse(response.text) : response.text;
  };
  let status = "skipped", parsed;
  if (claimTransit(db, config, { owner, now: startedAt, force: options.force })) {
    try {
      const pricing = await get(config.pricingUrl, "pricing");
      const channels = await get(config.upstreamsUrl, "channels");
      parsed = parseRightApiPricing(pricing, channels, config);
      let recharge = null;
      try {
        const metadata = await get(config.metadataUrl, "metadata");
        const document = plainText(await get(config.rechargeDocumentationUrl, "recharge-document", false));
        const sentence = document.match(/充值比例\s*(\d+(?:\.\d+)?)\s*元\s*=\s*站内\s*(\d+(?:\.\d+)?)\s*\$/);
        const ratio = number(metadata["public.balance.price"]);
        if (!sentence || !ratio || Number(sentence[2]) <= 0 || Math.abs(Number(sentence[1]) / Number(sentence[2]) - ratio) > 1e-8) throw new Error("rightapi_recharge_evidence_mismatch");
        recharge = { ratioCnyPerCredit: ratio, sourceUrl: config.rechargeDocumentationUrl, statusUrl: config.metadataUrl,
          observedAt: now(), evidence: sentence[0], scope: "public_base", creditUnit: "station_display_usd", paidCurrency: "CNY" };
      } catch (error) { warnings.push(`recharge: ${error.message}`); }
      let fx = null;
      const fxPath = join(rawDir, config.id, "fx-cache.json");
      try {
        const saved = JSON.parse(readFileSync(fxPath, "utf8"));
        const age = Date.parse(now()) - Date.parse(saved.updatedAt);
        if (saved.sourceUrl === config.fxUrl && age >= 0 && age < 7 * 86400000
          && number(saved.usdToCny) > 0) fx = saved;
      } catch { /* fetch first reference below */ }
      if (!fx || Date.parse(now()) - Date.parse(fx.updatedAt) >= 24 * 3600000) {
        try {
          const payload = await get(config.fxUrl, "discount-fx");
          const rate = number(payload?.rates?.CNY), sourceTime = number(payload?.time_last_update_unix);
          const age = Date.parse(now()) - sourceTime * 1000;
          if (payload.result !== "success" || payload.base_code !== "USD" || !rate || !sourceTime
            || age < -300000 || age > 7 * 86400000) throw new Error("invalid_or_stale_discount_fx");
          fx = { usdToCny: rate, date: new Date(sourceTime * 1000).toISOString().slice(0, 10),
            sourceUrl: config.fxUrl, updatedAt: new Date(sourceTime * 1000).toISOString() };
          mkdirSync(dirname(fxPath), { recursive: true });
          writeFileSync(`${fxPath}.${process.pid}.tmp`, JSON.stringify(fx), "utf8");
          renameSync(`${fxPath}.${process.pid}.tmp`, fxPath);
        } catch (error) { warnings.push(`discount-fx: ${error.message}`); }
      }
      for (const offer of parsed.offers) offer.discount = rightApiOfferDiscount(offer, { recharge, fx, sourceUrl: config.pricingUrl, observedAt: now() });
      let logoLocalPath = db.prepare("SELECT logo_local_path FROM transit_stations WHERE id=?").get(config.id)?.logo_local_path ?? null;
      let logoEvidence = null;
      try {
        const response = await fetchPublic(config.logoUrl, { ...config, maxBytes:128*1024 }, options.fetchImpl);
        if (!response.contentType?.includes("image/webp")) throw new Error("invalid_logo_content_type");
        const bytes = response.bytes;
        if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") throw new Error("invalid_webp_logo");
        const path = join(options.publicRoot ?? join(root, "public"), config.logoLocalPath.replace(/^\//, ""));
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(`${path}.${process.pid}.tmp`, bytes); renameSync(`${path}.${process.pid}.tmp`, path);
        logoLocalPath = config.logoLocalPath;
        logoEvidence = { sourceUrl: config.logoUrl, sha256: createHash("sha256").update(bytes).digest("hex"), observedAt: now() };
      } catch (error) { warnings.push(`logo: ${error.message}`); }
      db.transaction(() => {
        upsertTransitCollection(db, { station: { ...config, config, recharge, sourceType: "official_public",
          description: "Right Code · AI Agent 分发平台", logoLocalPath,
          rawMeta: { logo: logoEvidence, discountFx: fx, metricsAccess: { publicAvailability: true, publicLatency: false, publicTps: false } } },
          groups: parsed.groups, offers: parsed.offers, collectionComplete: true, observedAt: now(),
          run: { runId, collectorKind: config.collectorKind, status: "success", startedAt, finishedAt: now(), errorMessage: warnings.join("; ") || null } });
        finishTransit(db, config.id, owner, { ok: true, at: now(), intervalMs: warnings.length ? 15 * 60000 : options.intervalMs });
      })();
      status = "success";
    } catch (error) {
      upsertTransitCollection(db, { station: { ...config, status: "candidate" },
        run: { runId, collectorKind: config.collectorKind, status: "failed", startedAt, finishedAt: now(), errorMessage: error.message, httpStatus: error.httpStatus } });
      finishTransit(db, config.id, owner, { ok: false, at: now(), error: error.message, retryAfter: error.retryAfter });
      return { id: config.id, status: "failed", error: error.message };
    }
  }
  let performanceRows = 0;
  if (options.includePerformance !== false && claimTransit(db, config, { owner, now: now(), force: options.force, task: "performance" })) {
    try {
      const groups = db.prepare("SELECT group_key,raw_group_json,id FROM transit_groups WHERE station_id=? AND status='active'").all(config.id);
      const identity = new Map(groups.map(group => [group.group_key, {
        id: JSON.parse(group.raw_group_json ?? "{}").upstreamId,
        models: new Set(db.prepare("SELECT raw_model FROM transit_offers WHERE group_id=? AND status='active'").all(group.id).map(row => row.raw_model)),
      }]));
      const payload = await get(config.performanceUrl, "availability-all");
      const performance = parseRightApiAvailability(payload, identity, now());
      performanceRows = upsertTransitPerformance(db, { stationId: config.id, ...performance, observedAt: now(),
        sourceUrl: config.performanceUrl, sourceSchema: "rightapi_availability_24h_v1", windowHours: 24 });
      finishTransit(db, config.id, owner, { ok: true, at: now(), task: "performance", intervalMs: config.performanceIntervalMs ?? 3600000 });
    } catch (error) {
      warnings.push(`performance: ${error.message}`);
      finishTransit(db, config.id, owner, { ok: false, at: now(), task: "performance", error: error.message, retryAfter: error.retryAfter });
    }
  }
  return { id: config.id, status, models: parsed?.modelCount, offers: parsed?.offers.length, performanceRows, warnings };
}
