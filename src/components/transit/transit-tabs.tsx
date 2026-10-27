import Image from "next/image";
import { ImageIcon, Video, Layers3 } from "lucide-react";

export const transitTabs = [
  { id: "all", label: "全部" }, { id: "chatgpt", label: "ChatGPT" },
  { id: "claude", label: "Claude" }, { id: "gemini", label: "Gemini" }, { id: "grok", label: "Grok" },
  ...[ ["glm", "GLM"], ["deepseek", "DeepSeek"], ["kimi", "Kimi"], ["qwen", "千问"] ].map(([id, label]) => ({ id, label, icon: <span className={`inline-flex size-[19px] shrink-0 items-center justify-center rounded-md ring-1 ring-border/70 shadow-sm ${id === "kimi" ? "bg-neutral-950" : "bg-background"}`}><Image src={`/brands/${id}.svg`} alt="" width={14} height={14} className="size-3.5 object-contain" /></span> })),
  { id: "image", label: "图片生成", icon: <ImageIcon className="size-4 text-sky-600" aria-hidden /> },
  { id: "video", label: "视频生成", icon: <Video className="size-4 text-violet-600" aria-hidden /> },
  { id: "other", label: "其他", icon: <Layers3 className="size-4" aria-hidden /> },
];
export const platformNames: Record<string, string[]> = {
  chatgpt: ["GPT", "ChatGPT", "OpenAI"], claude: ["Claude", "Anthropic"], gemini: ["Gemini", "Google", "谷歌"],
  grok: ["Grok", "xAI"], glm: ["GLM", "智谱", "Zhipu"], deepseek: ["DeepSeek", "深度求索"],
  kimi: ["Kimi", "Moonshot", "月之暗面"], qwen: ["Qwen", "千问", "通义", "阿里"],
  image: ["Imagen", "图片生成", "生图"], video: ["Veo", "视频生成", "视频"],
};

/** Keep list and detail classifications identical; media has its own tabs. */
export function matchesTransitTab(price: { family: string; modelName?: string; category?: string }, id: string): boolean {
  if (id === "all") return true;
  if (id === "image" || id === "video") return price.category === id;
  if (price.category && price.category !== "text") return false;
  const text = [price.family, price.modelName ?? ""].join(" ").toLowerCase();
  const matches = (key: string) => (platformNames[key] ?? []).some((name) => text.includes(name.toLowerCase()));
  if (id === "other") return !Object.keys(platformNames).filter((key) => key !== "image" && key !== "video").some(matches);
  return matches(id);
}
