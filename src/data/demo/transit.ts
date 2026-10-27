import { DEMO_MODELS } from "@/data/demo/transit-models";

/** Entirely fictional preview data; never use as collected quotes. */
export type TransitDemo = {
  id: string;
  /** Static fixture timestamp, not a live collection time. */
  updatedAt: string;
  name: string;
  system: string;
  description: string;
  models: string[];
  groups: number;
  prices: { id?: string; family: string; range: string; modelName?: string; requestCount?: number; category?: "image" | "video"; fixedPrice?: number; priceUnit?: string }[];
  channels: string[];
  availability: string | null;
  samples: number;
  latency: string | null;
  recharge: string;
  /** CNY paid per one site credit; not an official-price discount. */
  rechargeMultiplier: number | null;
  cacheHitRate: number | null;
  monitoringSource: "station_public" | "unknown";
};

export const transitDemos: TransitDemo[] = [
  { updatedAt: "2026-10-21T08:00:00+08:00", id: "north", cacheHitRate: 90.2, monitoringSource: "station_public", name: "North API", system: "New API", description: "多模型统一接入，文本与视觉模型目录。", models: ["GPT-4.1", "Claude Sonnet 4", "Gemini 2.5 Pro", "DeepSeek V3"], groups: 8, prices: [{ family: "GPT", range: "0.15–0.80×" }, { family: "Claude", range: "0.30–1.20×" }, { family: "Gemini", range: "0.25–0.60×" }], channels: ["官方 API", "混合渠道"], availability: "99.2%", samples: 1240, latency: "2.8s", rechargeMultiplier: 1, recharge: "¥1 = 1 额度" },
  { updatedAt: "2026-10-21T08:00:00+08:00", id: "orbit", cacheHitRate: 83.6, monitoringSource: "station_public", name: "Orbit Relay", system: "Sub2API", description: "面向开发工具的分组接入与模型服务。", models: ["GPT-4.1", "Claude Sonnet 4", "Claude Opus 4"], groups: 5, prices: [{ family: "GPT", range: "0.08–0.35×" }, { family: "Claude", range: "0.12–0.90×" }], channels: ["一手自建号池", "逆向"], availability: "97.8%", samples: 680, latency: "4.1s", rechargeMultiplier: 1, recharge: "¥1 = 1 额度" },
  { updatedAt: "2026-10-21T08:00:00+08:00", id: "pixel", cacheHitRate: 77.7, monitoringSource: "station_public", name: "Pixel Gateway", system: "New API", description: "聚合文本、视觉与图片生成模型。", models: ["GPT-4.1", "Gemini 2.5 Pro", "Imagen 3"], groups: 6, prices: [{ family: "GPT", range: "0.20–0.65×" }, { family: "Gemini", range: "0.18–0.50×" }], channels: ["云厂商", "官方 API"], availability: "98.6%", samples: 920, latency: "3.2s", rechargeMultiplier: 7, recharge: "¥7 = 1 额度" },
  { updatedAt: "2026-10-21T08:00:00+08:00", id: "cedar", cacheHitRate: 43.5, monitoringSource: "station_public", name: "青杉 API", system: "自研", description: "国产模型与常用推理模型统一目录。", models: ["DeepSeek V3", "DeepSeek R1", "Qwen3", "GLM-4"], groups: 4, prices: [{ family: "DeepSeek", range: "0.20–0.75×" }, { family: "Qwen", range: "0.30–0.80×" }], channels: ["官方 API", "云厂商"], availability: "99.5%", samples: 1560, latency: "1.9s", rechargeMultiplier: 1, recharge: "¥1 = 1 额度" },
  { updatedAt: "2026-10-21T08:00:00+08:00", id: "echo", cacheHitRate: 32.8, monitoringSource: "station_public", name: "Echo Hub", system: "Sub2API", description: "按模型与号池划分的多分组调用入口。", models: ["Claude Sonnet 4", "Claude Opus 4", "Gemini 2.5 Pro"], groups: 7, prices: [{ family: "Claude", range: "0.10–1.10×" }, { family: "Gemini", range: "0.22–0.55×" }], channels: ["逆向", "二级分销"], availability: "94.7%", samples: 420, latency: "5.6s", rechargeMultiplier: 0.2, recharge: "¥1 = 5 额度" },
  { updatedAt: "2026-10-21T08:00:00+08:00", id: "plain", cacheHitRate: null, monitoringSource: "unknown", name: "PlainRoute", system: "New API", description: "基础模型价格与分组信息公开展示。", models: ["GPT-4.1", "DeepSeek V3", "Qwen3"], groups: 3, prices: [{ family: "GPT", range: "0.25–0.90×" }, { family: "DeepSeek", range: "0.35–0.70×" }], channels: ["未披露"], availability: null, samples: 0, latency: null, rechargeMultiplier: null, recharge: "未披露" },
];

/** Fictional model-level request counts for preview; not inferred from price order. */
const DEMO_USAGE: Record<string, Record<string, number>> = {
  north: { GPT: 4800, Claude: 6200, Gemini: 2100 },
  orbit: { GPT: 7600, Claude: 9200 },
  pixel: { GPT: 3100, Gemini: 5500 },
  cedar: { DeepSeek: 8300, Qwen: 4900 },
  echo: { Claude: 6400, Gemini: 1800 },
  plain: { GPT: 2700, DeepSeek: 3600 },
};
for (const site of transitDemos) {
  for (const price of site.prices) {
    price.requestCount = DEMO_USAGE[site.id]?.[price.family];
    price.modelName = site.models.find((name) => name.toLowerCase().includes(price.family.toLowerCase()));
  }
}

/** Additional fictional offers to preview the full four-row layout. */
const DEMO_EXTRA: Record<string, { family: string; modelName: string; range: string; requestCount: number }[]> = {
  north: [{ family: "DeepSeek", modelName: "DeepSeek V3", range: "0.18–0.50×", requestCount: 1600 }],
  orbit: [{ family: "Gemini", modelName: "Gemini 2.5 Pro", range: "0.20–0.55×", requestCount: 4200 }, { family: "DeepSeek", modelName: "DeepSeek V3", range: "0.15–0.60×", requestCount: 1800 }],
  pixel: [{ family: "Claude", modelName: "Claude Sonnet 4", range: "0.25–0.85×", requestCount: 2600 }, { family: "Qwen", modelName: "Qwen3", range: "0.18–0.45×", requestCount: 1300 }],
  cedar: [{ family: "GPT", modelName: "GPT-4.1", range: "0.22–0.65×", requestCount: 2800 }, { family: "Gemini", modelName: "Gemini 2.5 Pro", range: "0.30–0.80×", requestCount: 1700 }],
  echo: [{ family: "GPT", modelName: "GPT-4.1", range: "0.12–0.55×", requestCount: 5200 }, { family: "DeepSeek", modelName: "DeepSeek V3", range: "0.20–0.65×", requestCount: 1400 }],
  plain: [{ family: "Qwen", modelName: "Qwen3", range: "0.25–0.60×", requestCount: 1900 }, { family: "Claude", modelName: "Claude Sonnet 4", range: "0.30–0.95×", requestCount: 1100 }],
};
for (const site of transitDemos) {
  for (const offer of DEMO_EXTRA[site.id] ?? []) {
    site.prices.push(offer);
    if (!site.models.includes(offer.modelName)) site.models.push(offer.modelName);
  }
}

// Fictional media API examples: request pricing is separate from token pricing.
const pixelDemo = transitDemos.find((site) => site.id === "pixel")!;
pixelDemo.prices.push(
  { family: "Gemini", modelName: "Imagen 3", range: "1.00×", requestCount: 950, category: "image", fixedPrice: 0.04, priceUnit: "张" },
  { family: "Gemini", modelName: "Veo 3", range: "1.00×", requestCount: 720, category: "video", fixedPrice: 0.4, priceUnit: "秒" },
);
if (!pixelDemo.models.includes("Veo 3")) pixelDemo.models.push("Veo 3");

// Additional low-usage fixture variants keep the homepage's popular four unchanged.
const fixturePlatform: Record<string, string> = { GPT: "chatgpt", Claude: "claude", Gemini: "gemini", DeepSeek: "deepseek", Qwen: "qwen" };
for (const site of transitDemos) {
  const originals = site.prices.filter((price) => !price.category);
  for (const original of originals) {
    for (const modelName of DEMO_MODELS[fixturePlatform[original.family]] ?? []) {
      if (site.prices.some((price) => price.modelName === modelName)) continue;
      site.prices.push({ ...original, id: undefined, modelName, requestCount: 12 });
      if (!site.models.includes(modelName)) site.models.push(modelName);
    }
  }
}

// Identity is independent of usage rank and survives filtering/reordering.
for (const site of transitDemos) {
  const seen = new Set<string>();
  for (const price of site.prices) {
    price.id = JSON.stringify([site.id, price.family, price.modelName, price.category ?? "token", price.range]);
    if (seen.has(price.id)) throw new Error(`Duplicate transit offer: ${price.id}`);
    seen.add(price.id);
  }
}
