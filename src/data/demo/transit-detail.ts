import type { TransitDemo } from "@/data/demo/transit";

const basePrices: Record<string, [number, number]> = {
  GPT: [2, 8], Claude: [3, 15], Gemini: [1.25, 10], DeepSeek: [0.27, 1.1], Qwen: [0.3, 1.2],
};

/** Group-level preview declarations; never inferred from model names or prices. */
const demoGroups = [
  { name: "共享组", pool: "自有号池", subscription: "混池", disclosure: "站点公开", factor: 1, cache: 90.2, limit: 99 },
  { name: "标准组", pool: "自有号池", subscription: "Pro", disclosure: "站点公开", factor: 1.5, cache: 87, limit: 99 },
  { name: "Plus 专享", pool: "自有号池", subscription: "Plus", disclosure: "站点公开", factor: 1.2, cache: 68.5, limit: 10 },
  { name: "混合渠道", pool: "混合渠道", subscription: "混池", disclosure: "站点公开", factor: 0.8, cache: 43.5, limit: 16 },
  { name: "基础组", pool: null, subscription: "Plus", disclosure: "站点公开", factor: 0.9, cache: 0, limit: 1 },
  { name: "未披露组", pool: null, subscription: null, disclosure: null, factor: 1.1, cache: null, limit: 6 },
];

export function getDemoGroupLabels(siteId: string, group: string) {
  if (siteId === "plain") return { pool: null, subscription: null, disclosure: null };
  const fixture = demoGroups.find((item) => item.name === group);
  return {
    pool: fixture?.pool ?? null,
    subscription: fixture?.subscription ?? null,
    disclosure: fixture?.disclosure ?? null,
  };
}
export function buildTransitDetail(site: TransitDemo) {
  // All groups, prices, history and statistics below are fictional UI fixtures.
  const quotes = demoGroups.flatMap((group, index) => site.prices.slice(0, group.limit).map((price) => {
    const multiplier = Number.parseFloat(price.range) * group.factor;
    const [input, output] = basePrices[price.family] ?? [1, 4];
    const round = (value: number) => Number(value.toFixed(4));
    const media = price.category != null;
    return {
      id: `${price.id}:${index}`, family: price.family, category: price.category ?? "text",
      model: price.modelName ?? price.family, group: group.name,
      multiplier: round(multiplier), requests: Math.round((price.requestCount ?? 0) * (index ? 0.35 : 0.65)),
      input: media ? null : round(input * multiplier), output: media ? null : round(output * multiplier),
      cacheRead: media ? null : round(input * multiplier * 0.1), cacheWrite: media ? null : round(input * multiplier * 1.25),
      fixedPrice: media ? round((price.fixedPrice ?? 0) * (index ? 1.5 : 1)) : null,
      unit: price.priceUnit ?? "M Token", channel: site.channels[index % site.channels.length],
      cacheHitRate: media || site.cacheHitRate == null ? null : group.cache,
      availability: site.availability, latestMs: site.availability ? 2100 + index * 500 : null,
      avgMs: site.availability ? 3800 + index * 300 : null,
      history: [1.15, 1.08, 1].map((factor, i) => ({ date: ["10/08", "10/15", "10/21"][i], value: round(multiplier * factor) })),
    };
  }));
  return { quotes, listedAt: "2026-10-08T00:00:00+08:00", lastCheckedAt: site.updatedAt };
}
export type TransitDetailQuote = ReturnType<typeof buildTransitDetail>["quotes"][number];
