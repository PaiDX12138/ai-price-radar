import { cn } from "@/lib/utils";

type ProductLogoProps = {
  slug: string;
  name?: string;
  className?: string;
  size?: number;
};

/**
 * Per-product brand mark — transparent-bg official marks preferred (no black tiles).
 * Aligns with 参考站 BrandIcon where possible; Tab logos stay in platform-logo.tsx.
 */
const SLUG_SRC: Record<string, string> = {
  "icloud-email": "/brands/apple.svg",
  "outlook-account": "/brands/outlook.svg",
  "gmail-account": "/brands/gmail.svg",
  "email-account": "/brands/mail.svg",
  "yahoo-email": "/brands/yahoo.svg",
  "domain-email": "/brands/mail.svg",
  "qq-email": "/brands/qq.png",
  "education-email": "/brands/graduation.svg",
  "chatgpt-plus": "/brands/openai.svg",
  "chatgpt-plus-recharge": "/brands/openai.svg",
  "chatgpt-free-account": "/brands/openai.svg",
  "chatgpt-mirror": "/brands/openai.svg",
  "chatgpt-go": "/brands/openai.svg",
  "chatgpt-team": "/brands/openai.svg",
  "chatgpt-pro-5x": "/brands/openai.svg",
  "chatgpt-pro-20x": "/brands/openai.svg",
  "chatgpt-pro-500": "/brands/openai.svg",
  "chatgpt-quota-recharge": "/brands/openai.svg",
  "chatgpt-codex-service": "/brands/openai.svg",
  "chatgpt-plus-team-seat": "/brands/openai.svg",
  "chatgpt-edu": "/brands/openai.svg",
  "chatgpt-enterprise": "/brands/openai.svg",
  "chatgpt-api-credit": "/brands/openai.svg",
  "chatgpt-plus-ios": "/brands/openai.svg",
  "codex-plus": "/brands/openai.svg",
  "claude-account": "/brands/claude.svg",
  "claude-kyc": "/brands/claude.svg",
  "claude-pro": "/brands/claude.svg",
  "claude-pro-month": "/brands/claude.svg",
  "claude-team": "/brands/claude.svg",
  "claude-team-standard": "/brands/claude.svg",
  "claude-team-premium": "/brands/claude.svg",
  "claude-max": "/brands/claude.svg",
  "claude-max-5x": "/brands/claude.svg",
  "claude-max-20x": "/brands/claude.svg",
  "claude-api": "/brands/claude.svg",
  "claude-pro-ios": "/brands/claude.svg",
  "claude-sonnet-seat": "/brands/claude.svg",
  "claude-mirror": "/brands/claude.svg",
  "claude-service": "/brands/claude.svg",
  "gemini-pro": "/brands/gemini.svg",
  "gemini-year": "/brands/gemini.svg",
  "gemini-recharge": "/brands/gemini.svg",
  "gemini-advanced": "/brands/gemini.svg",
  "gemini-ultra": "/brands/gemini.svg",
  "google-one-ai": "/brands/gemini.svg",
  "gemini-api": "/brands/gemini.svg",
  "gemini-pro-workspace": "/brands/gemini.svg",
  "gemini-mirror": "/brands/gemini.svg",
  "gemini-service": "/brands/gemini.svg",
  "grok-account": "/brands/grok.svg",
  "grok-plus": "/brands/grok.svg",
  "grok-premium": "/brands/grok.svg",
  "grok-super": "/brands/grok.svg",
  "grok-ultra": "/brands/grok.svg",
  "grok-service": "/brands/grok.svg",
  "super-grok": "/brands/grok.svg",
  "super-grok-heavy": "/brands/grok.svg",
  "grok-x-premium": "/brands/grok.svg",
  "grok-heavy": "/brands/grok.svg",
  "grok-api": "/brands/grok.svg",
  "xai-super-grok": "/brands/grok.svg",
  "grok-plus-seat": "/brands/grok.svg",
  "sms-openai": "/brands/openai.svg",
  "sms-google": "/brands/google.svg",
  "sms-paypal": "/brands/paypal.svg",
  "sms-generic": "/brands/phone.svg",
  "sms-kyc": "/brands/phone.svg",
  "sms-verification": "/brands/phone.svg",
  // other — transparent SVG marks
  "cursor-account": "/brands/cursor.svg",
  "cursor-free-account": "/brands/cursor.svg",
  "cursor-plus": "/brands/cursor.svg",
  "cursor-pro": "/brands/cursor.svg",
  "cursor-pro-plus": "/brands/cursor.svg",
  "cursor-ultra": "/brands/cursor.svg",
  "cursor-service": "/brands/cursor.svg",
  "kiro-account": "/brands/kiro.svg",
  "kiro-free-account": "/brands/kiro.svg",
  "kiro-pro-account": "/brands/kiro.svg",
  "kiro-pro": "/brands/kiro.svg",
  "kiro-pro-plus": "/brands/kiro.svg",
  "kiro-pro-max": "/brands/kiro.svg",
  "kiro-power": "/brands/kiro.svg",
  "kiro-quota-recharge": "/brands/kiro.svg",
  "kiro-mirror": "/brands/kiro.svg",
  "kiro-service": "/brands/kiro.svg",
  "windsurf-account": "/brands/windsurf.svg",
  "perplexity-account": "/brands/perplexity.svg",
  "suno-account": "/brands/suno.svg",
  "muse-ai-account": "/brands/muse.svg",
  "dreamina-account": "/brands/dreamina.png",
  "duolingo-super": "/brands/duolingo.png",
  "apple-id-account": "/brands/apple.svg",
  "x-twitter-account": "/brands/x.svg",
  "x-twitter-premium": "/brands/x.svg",
  "x-twitter-premium-plus": "/brands/x.svg",
  "telegram-account": "/brands/telegram.svg",
  "telegram-premium": "/brands/telegram.svg",
  "virtual-card": "/brands/virtual-card.svg",
  "gift-card": "/brands/gift-card.svg",
  "other-product": "/brands/package.svg",
  "microsoft-365": "/brands/microsoft.svg",
  "notion-ai": "/brands/notion.svg",
  "midjourney-plan": "/brands/midjourney.png",
  "github-copilot": "/brands/github.svg",
};

function resolveSrc(slug: string, name?: string): string {
  if (SLUG_SRC[slug]) return SLUG_SRC[slug]!;
  const hay = (slug + " " + (name ?? "")).toLowerCase();
  if (hay.includes("cursor")) return "/brands/cursor.svg";
  if (hay.includes("kiro")) return "/brands/kiro.svg";
  if (hay.includes("windsurf")) return "/brands/windsurf.svg";
  if (hay.includes("perplexity")) return "/brands/perplexity.svg";
  if (hay.includes("suno")) return "/brands/suno.svg";
  if (hay.includes("dreamina") || hay.includes("即梦")) return "/brands/dreamina.png";
  if (hay.includes("muse")) return "/brands/muse.svg";
  if (hay.includes("duolingo") || hay.includes("多邻国")) return "/brands/duolingo.png";
  if (hay.includes("telegram")) return "/brands/telegram.svg";
  if (hay.includes("twitter") || hay.includes("x-twitter")) return "/brands/x.svg";
  if (hay.includes("icloud") || hay.includes("apple")) return "/brands/apple.svg";
  if (hay.includes("outlook") || hay.includes("hotmail") || hay.includes("微软邮箱")) {
    return "/brands/outlook.svg";
  }
  if (hay.includes("gmail") || hay.includes("谷歌邮箱")) return "/brands/gmail.svg";
  if (hay.includes("yahoo") || hay.includes("雅虎")) return "/brands/yahoo.svg";
  if (hay.includes("qq") || hay.includes("腾讯邮箱")) return "/brands/qq.png";
  if (hay.includes("paypal")) return "/brands/paypal.svg";
  if (hay.includes("chatgpt") || hay.includes("openai") || hay.includes("codex")) return "/brands/openai.svg";
  if (hay.includes("claude")) return "/brands/claude.svg";
  if (hay.includes("gemini")) return "/brands/gemini.svg";
  if (hay.includes("grok")) return "/brands/grok.svg";
  if (hay.includes("visa") || hay.includes("virtual")) return "/brands/visa.png";
  if (hay.includes("mail") || hay.includes("email")) return "/brands/mail.svg";
  if (hay.includes("sms")) return "/brands/phone.svg";
  return "/brands/package.svg";
}

export function ProductLogo({ slug, name, className = "", size = 22 }: ProductLogoProps) {
  const src = resolveSrc(slug, name);
  const pad = Math.max(4, Math.round(size * 0.35));
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-background ring-1 ring-border/70 shadow-sm",
        className
      )}
      style={{ width: size + pad, height: size + pad }}
      data-tooltip={name ?? slug}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={size} height={size} className="block object-contain" draggable={false} />
    </span>
  );
}
