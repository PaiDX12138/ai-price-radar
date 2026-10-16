import { Layers, Phone } from "lucide-react";
import type { PlatformId, PlatformTabId } from "@/lib/catalog";
import { cn } from "@/lib/utils";

type PlatformLogoProps = {
  platform: PlatformTabId;
  className?: string;
  withLabel?: boolean;
  size?: number;
};

export const PLATFORM_LABEL: Record<PlatformTabId, string> = {
  all: "全部",
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  grok: "Grok / X",
  cursor: "Cursor",
  kiro: "Kiro",
  email: "邮箱",
  sms: "接码",
  other: "其他",
};

/** Brand files under public/brands/ — sourced from pdx-toll/site where available. */
const BRAND_SRC: Partial<Record<PlatformTabId, string>> = {
  all: "/brands/all.svg",
  chatgpt: "/brands/openai.svg",
  claude: "/brands/claude.svg",
  gemini: "/brands/gemini.svg",
  grok: "/brands/grok.svg",
  cursor: "/brands/cursor.svg",
  kiro: "/brands/kiro.svg",
  email: "/brands/gmail.svg",
};

export function PlatformLogo({
  platform,
  className = "",
  withLabel = false,
  size = 16,
}: PlatformLogoProps) {
  const pad = Math.max(4, Math.round(size * 0.35));
  const brand = BRAND_SRC[platform];

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-md bg-background ring-1 ring-border/70 shadow-sm"
        style={{ width: size + pad, height: size + pad }}
      >
        {platform === "sms" ? (
          <Phone className="text-foreground" style={{ width: size, height: size }} strokeWidth={2} aria-hidden />
        ) : platform === "other" ? (
          <Layers className="text-muted-foreground" style={{ width: size, height: size }} strokeWidth={2} aria-hidden />
        ) : brand ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={brand}
            alt=""
            width={size}
            height={size}
            className="block"
            draggable={false}
          />
        ) : null}
      </span>
      {withLabel ? (
        <span className="leading-none text-sm">{PLATFORM_LABEL[platform]}</span>
      ) : null}
    </span>
  );
}

export function isPlatformId(value: string): value is PlatformId {
  return ["chatgpt", "claude", "cursor", "grok", "kiro", "gemini", "email", "sms", "other"].includes(
    value,
  );
}
