/** Homepage priority requested by the product; never a fixed model-name shortlist. */
export const TRANSIT_MODEL_PLATFORM_ORDER = ["claude", "chatgpt", "deepseek", "gemini", "grok", "glm", "kimi", "qwen"] as const;

export type TransitModelMetadata = {
  platform?: string;
  series?: string;
  version?: string;
  releasedAt?: string;
  /** Required for a release date to affect sorting; never infer a release date from its name. */
  sourceUrl?: string;
  catalogSourceUrl?: string;
  canonicalModelId?: string;
  status?: string;
  outputModalities?: string[];
  priceReference?: {input:number;output:number|null;currency:string;unit:string;kind:string;sourceUrl:string;providerDocUrl?:string;variablePricing:boolean;capturedAt:string};
};
export type TransitModelCatalog = Record<string, TransitModelMetadata>;
export type OrderableTransitModel = { modelName?: string; family?: string };
const sharedCatalog: TransitModelCatalog = {};
const natural = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const normalize = (value: string) => value.trim().toLowerCase();

function platformOf(model: OrderableTransitModel): string {
  const name = normalize(model.modelName ?? "");
  const family = normalize(model.family ?? "");
  const text = `${family} ${name}`;
  if (/gpt|openai|chatgpt|codex/.test(text) || /^o\d(?:\b|[-.])/.test(name)) return "chatgpt";
  if (/claude|anthropic/.test(text)) return "claude";
  if (/gemini|google|imagen|banana|veo/.test(text)) return "gemini";
  if (/grok|xai/.test(text)) return "grok";
  if (/glm|zhipu|智谱/.test(text)) return "glm";
  if (/deepseek/.test(text)) return "deepseek";
  if (/kimi|moonshot/.test(text)) return "kimi";
  if (/qwen|千问|通义/.test(text)) return "qwen";
  // Keep unlisted vendors separate rather than mixing all "other" platforms together.
  return `other:${family || name.split(/[-\d]/)[0] || "unknown"}`;
}

function inferredSeries(name: string): string {
  return normalize(name)
    .replace(/(?:[-_]\d{8}|[-_]\d{4})$/, "")
    .replace(/[-_](?:latest|preview|highspeed|ultraspeed)\b/g, "")
    .replace(/\d+(?:[._-]\d+)*/g, "")
    .replace(/[-_.]+/g, "-").replace(/^-|-$/g, "");
}

function releaseTime(metadata?: TransitModelMetadata): number | null {
  const date = metadata?.releasedAt;
  if (!date || !/^\d{4}-\d{2}(?:-\d{2})?$/.test(date) || !/^https:\/\//.test(metadata?.sourceUrl ?? "")) return null;
  const time = Date.parse(`${date.length === 7 ? `${date}-01` : date}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, date.length) === date ? time : null;
}

function versionParts(name: string, metadata?: TransitModelMetadata): number[] {
  const canonical = (metadata?.canonicalModelId ?? name).split("/").pop()!;
  // Strip snapshot dates; a suffix such as 20261001 is not a model generation.
  const version = canonical.replace(/[-_]\d{4,8}$/, "").match(/\d+(?:[.-]\d{1,2})*/)?.[0];
  return version ? version.split(/[.-]/).map(Number) : [];
}

/** Broad product tiers, not pinned model IDs. A new major generation always wins. */
function capabilityTier(name: string, platform: string, series: string): number {
  const text = `${name} ${series}`;
  if (platform === "claude") return /opus/.test(text) ? 50 : /fable/.test(text) ? 40 : /sonnet/.test(text) ? 30 : /haiku/.test(text) ? 10 : 35;
  if (platform === "chatgpt") return /astra/.test(text) ? 60 : /pro/.test(text) ? 55 : /sol/.test(text) ? 45 : /terra/.test(text) ? 35 : /nano/.test(text) ? 5 : /mini/.test(text) ? 10 : 40;
  if (/ultra|max/.test(text)) return 50;
  if (/pro|thinking|reasoner/.test(text)) return 40;
  if (/flash|lite|mini|fast/.test(text)) return 10;
  return 30;
}

function searchRank(name: string, query: string) {
  if (!query) return 0;
  return name === query ? 0 : name.startsWith(query) ? 1 : name.includes(query) ? 2 : 3;
}

function roundRobin<T>(queues: readonly T[][]): T[] {
  const output: T[] = [];
  for (let depth = 0; queues.some(queue => depth < queue.length); depth++) {
    for (const queue of queues) if (depth < queue.length) output.push(queue[depth]);
  }
  return output;
}

/** Pure, stable and shared by both surfaces. No request-count or price ranking. */
export function orderTransitModels<T extends OrderableTransitModel>(
  models: readonly T[],
  { query = "", catalog = sharedCatalog }: { query?: string; catalog?: TransitModelCatalog } = {},
): T[] {
  const normalizedQuery = normalize(query);
  const entries = models.map(item => {
    const name = normalize(item.modelName ?? item.family ?? "");
    const metadata = Object.hasOwn(catalog, name) ? catalog[name] : undefined;
    return {
      item, name, platform: metadata?.platform || platformOf(item),
      series: normalize(metadata?.series || inferredSeries(name)),
      released: releaseTime(metadata), version: versionParts(name, metadata),
      deprecated: metadata?.status === "deprecated", match: searchRank(name, normalizedQuery),
    };
  });
  type Entry = (typeof entries)[number];
  const compare = (a: Entry, b: Entry) => {
    if (a.deprecated !== b.deprecated) return a.deprecated ? 1 : -1;
    const major = (b.version[0] ?? -1) - (a.version[0] ?? -1);
    if (major) return major;
    const tier = capabilityTier(b.name, b.platform, b.series) - capabilityTier(a.name, a.platform, a.series);
    if (tier) return tier;
    for (let i = 1; i < Math.max(a.version.length, b.version.length); i++) {
      const version = (b.version[i] ?? 0) - (a.version[i] ?? 0);
      if (version) return version;
    }
    if (a.released !== null || b.released !== null) {
      const release = (b.released ?? -Infinity) - (a.released ?? -Infinity);
      if (release) return release;
    }
    // Natural descending name is only a deterministic fallback, NOT a release/quality claim.
    return natural.compare(b.name, a.name) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
      || String(a.item.modelName ?? "").localeCompare(String(b.item.modelName ?? ""), "en");
  };
  const platformRank = (platform: string) => {
    const index = TRANSIT_MODEL_PLATFORM_ORDER.findIndex(id => id === platform);
    return index < 0 ? TRANSIT_MODEL_PLATFORM_ORDER.length : index;
  };
  const ranked: Entry[] = [];
  // Matching names must beat every non-match, even across different platforms.
  for (const match of [...new Set(entries.map(entry => entry.match))].sort((a, b) => a - b)) {
    const platforms = new Map<string, Entry[]>();
    for (const entry of entries.filter(entry => entry.match === match)) {
      const queue = platforms.get(entry.platform) ?? [];
      queue.push(entry); platforms.set(entry.platform, queue);
    }
    const queues = [...platforms.entries()]
      .sort(([a], [b]) => platformRank(a) - platformRank(b) || natural.compare(a, b))
      .map(([, platformEntries]) => {
        const generations = new Map<string, Entry[]>();
        for (const entry of platformEntries.sort(compare)) {
          const key = `${entry.deprecated}:${entry.version[0] ?? -1}`;
          const queue = generations.get(key) ?? [];
          queue.push(entry); generations.set(key, queue);
        }
        return [...generations.values()].flatMap(generation => {
          const series = new Map<string, Entry[]>();
          for (const entry of generation) {
            const queue = series.get(entry.series) ?? [];
            queue.push(entry); series.set(entry.series, queue);
          }
          // Series diversity cannot promote an old generation above newer available models.
          return roundRobin([...series.values()].map(queue => queue.sort(compare)).sort((a, b) => compare(a[0], b[0])));
        });
      });
    ranked.push(...roundRobin(queues));
  }
  return ranked.map(entry => entry.item);
}

/** A four-row price table must not mix token, image and video billing units. */
export function transitModelModality(model: OrderableTransitModel & { category?: string }, catalog: TransitModelCatalog = sharedCatalog): string {
  if (model.category === "image" || model.category === "video") return model.category;
  const name = normalize(model.modelName ?? "");
  const outputs = (Object.hasOwn(catalog, name) ? catalog[name]?.outputModalities : undefined) ?? [];
  if (outputs.includes("video")) return "video";
  if (outputs.includes("image")) return "image";
  if (/^(veo|sora|mini(max)?-h\d)|video/.test(name)) return "video";
  if (/gpt-image|imagen|banana|imagine-image/.test(name)) return "image";
  return "text";
}

export function selectTransitCardModels<T extends OrderableTransitModel & { category?: string }>(
  models: readonly T[], options: { query?: string; catalog?: TransitModelCatalog; platform?: string } = {},
): T[] {
  const mode = options.platform === "image" || options.platform === "video" ? options.platform : "text";
  return orderTransitModels(models.filter(item => transitModelModality(item, options.catalog) === mode), options).slice(0, 4);
}
