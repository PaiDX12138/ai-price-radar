/** Layout fixtures only: not live detections or probabilities of provider identity. */
export type ModelSimilarity = { model: string; similarity: number };
export type ModelAuthenticityPreview = {
  claimedModel: string;
  authenticity: number;
  comparisons: number;
  candidates: ModelSimilarity[];
};

const SCORES: Record<string, number> = {
  chatgpt: 98.4, claude: 92.6, gemini: 67.8, grok: 87.2,
  glm: 99.1, deepseek: 74.5, kimi: 96.8, qwen: 48.6,
  image: 90.2, video: 82.7, other: 63.9,
};

export function buildAuthenticityPreview(
  platform: string,
  claimedModel: string,
  models: string[],
): ModelAuthenticityPreview {
  const index = Math.max(0, models.indexOf(claimedModel));
  const authenticity = Number(Math.max(8, (SCORES[platform] ?? 88.6) - index * 3.7).toFixed(1));
  const alternatives = [...new Set(models)].filter((model) => model !== claimedModel);
  const candidates = [
    { model: claimedModel, similarity: authenticity },
    ...alternatives.slice(0, 2).map((model, rank) => ({
      model,
      similarity: Number((authenticity < 80
        ? 94.2 - rank * 11.6 - index * 0.2
        : authenticity - 17.6 - rank * 13.2).toFixed(1)),
    })),
  ].sort((a, b) => b.similarity - a.similarity);
  return { claimedModel, authenticity, comparisons: 48 + index * 8, candidates };
}
