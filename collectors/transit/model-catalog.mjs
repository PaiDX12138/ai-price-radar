import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, copyFileSync, openSync, closeSync, statSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { fetchPublic } from "./collect.mjs";

export const MODEL_CATALOG_URL = "https://models.dev/api.json";
export const MODEL_CATALOG_INTERVAL_MS = 6 * 3600000;
export const modelCatalogPath = () => process.env.TRANSIT_MODEL_CATALOG_PATH || join(process.cwd(), "data/transit/model-catalog.json");
const providerPlatforms = { anthropic: "claude", openai: "chatgpt", deepseek: "deepseek", google: "gemini", xai: "grok", zhipuai: "glm", zai: "glm", moonshotai: "kimi", alibaba: "qwen" };
const read = path => { try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; } };
const valid = value => value?.schemaVersion === 1 && value.models && typeof value.models === "object" && !Array.isArray(value.models) && Object.keys(value.models).length >= 20;
function atomic(path, value) {
  const tmp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value)}\n`, "utf8");
  renameSync(tmp, path);
}

/** A community metadata source, not an official vendor model endpoint or an ability leaderboard. */
export function parseModelCatalog(payload, generatedAt = new Date().toISOString()) {
  if (!payload || typeof payload !== "object") throw new Error("invalid_model_catalog");
  for (const required of ["anthropic", "openai", "google", "deepseek"]) {
    if (Object.keys(payload[required]?.models ?? {}).length < 1) throw new Error(`missing_catalog_provider:${required}`);
  }
  const models = Object.create(null);
  for (const [provider, data] of Object.entries(payload)) {
    if (!data || typeof data.models !== "object" || !/^https:\/\//.test(data.doc ?? "")) continue;
    // Only direct provider catalogs: do not overwrite lab facts with a relay's alias/pricing.
    const platform = providerPlatforms[provider];
    if (!platform) continue;
    for (const [id, model] of Object.entries(data.models)) {
      if (!model || typeof id !== "string" || !id || id.length > 200 || id.includes("/")) continue;
      const owner = /^(gpt|o\d|chatgpt|codex)/i.test(id) ? "chatgpt"
        : /^claude/i.test(id) ? "claude" : /^(gemini|imagen|veo)/i.test(id) ? "gemini"
        : /^deepseek/i.test(id) ? "deepseek" : /^grok/i.test(id) ? "grok"
        : /^(glm|zai)/i.test(id) ? "glm" : /^(kimi|moonshot)/i.test(id) ? "kimi"
        : /^qwen/i.test(id) ? "qwen" : null;
      if (owner && owner !== platform) continue;
      const releasedAt = /^\d{4}-\d{2}(?:-\d{2})?$/.test(model.release_date ?? "") ? model.release_date : undefined;
      models[id.toLowerCase()] = {
        platform, series: typeof model.family === "string" ? model.family : undefined,
        releasedAt, sourceUrl: data.doc, catalogSourceUrl: MODEL_CATALOG_URL,
        canonicalModelId: typeof model.canonical_model_id === "string" ? model.canonical_model_id : `${provider}/${id}`,
        status: typeof model.status === "string" ? model.status : undefined,
        outputModalities: Array.isArray(model.modalities?.output) ? model.modalities.output.filter(value => typeof value === "string") : [],
        priceReference: typeof model.cost?.input === "number" && Number.isFinite(model.cost.input) && model.cost.input > 0 ? {
          input: model.cost.input, output: model.cost.output ?? null, currency: "USD", unit: "M Token",
          kind: "community", sourceUrl: MODEL_CATALOG_URL, providerDocUrl: data.doc,
          variablePricing: Boolean(model.cost.tiers?.length), capturedAt: generatedAt,
        } : undefined,
      };
    }
  }
  const result = { schemaVersion: 1, generatedAt, sourceUrl: MODEL_CATALOG_URL, sourceType: "community_catalog", models };
  if (!valid(result)) throw new Error("model_catalog_too_small");
  return result;
}

/** Persistent scheduling + a bounded lease + atomic last-good snapshots. Failure never blocks station prices. */
export async function refreshTransitModelCatalog({ path = modelCatalogPath(), now = Date.now(), force = false, fetchImpl = fetch } = {}) {
  mkdirSync(dirname(path), { recursive: true });
  const statePath = `${path}.state`, lockPath = `${path}.lock`;
  const state = read(statePath), current = read(path);
  if (!force && state?.nextAttemptAt > now) return { status: "skipped", nextAttemptAt: state.nextAttemptAt };
  if (!force && valid(current) && Date.parse(current.generatedAt) + MODEL_CATALOG_INTERVAL_MS > now) return { status: "fresh", count: Object.keys(current.models).length };
  try {
    if (existsSync(lockPath) && now - statSync(lockPath).mtimeMs > 120000) unlinkSync(lockPath);
    closeSync(openSync(lockPath, "wx"));
  } catch (error) {
    if (error.code === "EEXIST") return { status: "leased" };
    return { status: "failed", error: error.message };
  }
  try {
    const response = await fetchPublic(MODEL_CATALOG_URL, { timeoutMs: 15000, maxBytes: 12 * 1024 * 1024 }, fetchImpl);
    const snapshot = parseModelCatalog(JSON.parse(response.text), new Date(now).toISOString());
    if (valid(current)) copyFileSync(path, `${path}.last-good`);
    atomic(path, snapshot);
    // The current valid copy is itself recoverable even on the first successful fetch.
    if (!existsSync(`${path}.last-good`)) atomic(`${path}.last-good`, snapshot);
    atomic(statePath, { failCount: 0, lastSuccessAt: now, nextAttemptAt: now + MODEL_CATALOG_INTERVAL_MS });
    return { status: "updated", count: Object.keys(snapshot.models).length, generatedAt: snapshot.generatedAt };
  } catch (error) {
    const failCount = (state?.failCount ?? 0) + 1;
    const nextAttemptAt = now + Math.min(MODEL_CATALOG_INTERVAL_MS, 15 * 60000 * 2 ** Math.min(failCount - 1, 5));
    atomic(statePath, { failCount, lastSuccessAt: state?.lastSuccessAt ?? null, nextAttemptAt, error: error.message });
    return { status: "failed", error: error.message, nextAttemptAt };
  } finally { try { unlinkSync(lockPath); } catch { /* a terminated worker's stale lease is recovered next run */ } }
}
