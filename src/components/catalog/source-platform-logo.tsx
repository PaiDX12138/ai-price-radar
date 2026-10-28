import type { Source } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";
import shopHostLogos from "@/data/generated/shop-host-logos.json";

export type SourcePlatformId = Source["platform"];

/** Readable card-shop / 卡网平台 labels. */
export const SOURCE_PLATFORM_LABEL: Record<SourcePlatformId, string> = {
  liandong: "联动小铺",
  yunmao: "云猫发卡",
  qxvx: "QXVX",
  shop16688: "16688",
  kami: "Kami",
  dujiao: "独角数卡",
  public: "Public / HTML",
  getgpt: "GetGPT",
  ikunlove: "iKunLove",
  xiaoheiwan: "小黑丸",
};

/**
 * 已接入卡网平台展示顺序（全站各 AI 板块共用，不按单商品报价裁剪）。
 * 筛选项以 catalog.sources 实际出现的平台为准，按此序排列。
 */
export const SOURCE_PLATFORM_ORDER: SourcePlatformId[] = [
  "liandong",
  "yunmao",
  "qxvx",
  "shop16688",
  "kami",
  "dujiao",
  "getgpt",
  "ikunlove",
  "xiaoheiwan",
  "public",
];

type HostLogoManifest = {
  generatedAt?: string | null;
  hosts?: Record<string, string>;
};

const HOST_FAVICON_SRC: Record<string, string> = {
  ...((shopHostLogos as HostLogoManifest).hosts || {}),
};

/**
 * Platform brand marks.
 * Kami / 独角：统一品牌标（多店共用同一套系统）。
 * 联动 / 云猫 / QXVX：平台标。
 * 其余自建站：采集时自动写入的 host favicon（shop-host-logos.json）。
 */
const SOURCE_PLATFORM_SRC: Record<SourcePlatformId, string> = {
  liandong: "/brands/shops/liandong.png",
  yunmao: "/brands/shops/yunmao.png",
  qxvx: "/brands/shops/qxvx.png",
  shop16688: "/brands/shops/shop16688.png",
  kami: "/brands/shops/kami.svg",
  dujiao: "/brands/shops/dujiao.png",
  public: HOST_FAVICON_SRC["catcard.uk"] || "/brands/shops/public.svg",
  getgpt: HOST_FAVICON_SRC["getgpt.pro"] || "/brands/shops/getgpt.png",
  ikunlove: HOST_FAVICON_SRC["ikunlove.best"] || "/brands/shops/ikunlove.png",
  xiaoheiwan:
    HOST_FAVICON_SRC["upgrade.xiaoheiwan.com"] || "/brands/shops/xiaoheiwan.svg",
};

/** 始终用平台品牌标，不用单站 favicon。 */
const BRAND_LOGO_PLATFORMS = new Set<SourcePlatformId>([
  "liandong",
  "yunmao",
  "qxvx",
  "shop16688",
  "kami",
  "dujiao",
]);

const HOST_HINTS: Array<{ re: RegExp; platform: SourcePlatformId }> = [
  { re: /(^|\.)ldxp\.cn$/i, platform: "liandong" },
  { re: /(^|\.)wzyp\.cn$/i, platform: "liandong" },
  { re: /(^|\.)catfk\.com$/i, platform: "yunmao" },
  { re: /(^|\.)qxvx\.cn$/i, platform: "qxvx" },
  { re: /(^|\.)16688\.com\.cn$/i, platform: "shop16688" },
  { re: /xiaoheiwan\.com$/i, platform: "xiaoheiwan" },
];

function normalizeHost(host?: string | null): string {
  return String(host ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./i, "")
    .toLowerCase();
}

export function resolveSourcePlatform(
  platform: string | undefined,
  host?: string
): SourcePlatformId {
  if (platform && platform in SOURCE_PLATFORM_SRC) {
    return platform as SourcePlatformId;
  }
  const h = normalizeHost(host);
  for (const { re, platform: p } of HOST_HINTS) {
    if (re.test(h)) return p;
  }
  return "public";
}

function resolveHostFavicon(host: string): string | null {
  if (!host) return null;
  if (HOST_FAVICON_SRC[host]) return HOST_FAVICON_SRC[host];
  const parts = host.split(".");
  for (let i = 1; i < parts.length - 1; i += 1) {
    const parent = parts.slice(i).join(".");
    if (HOST_FAVICON_SRC[parent]) return HOST_FAVICON_SRC[parent];
  }
  // 约定路径兜底（manifest 未重建时仍可读已落盘文件）
  return null;
}

function resolveLogoSrc(platformId: SourcePlatformId, host?: string): {
  src: string;
  label: string;
} {
  const label = SOURCE_PLATFORM_LABEL[platformId];
  if (BRAND_LOGO_PLATFORMS.has(platformId)) {
    return { src: SOURCE_PLATFORM_SRC[platformId], label };
  }
  const h = normalizeHost(host);
  const fav = resolveHostFavicon(h);
  if (fav) return { src: fav, label };
  return { src: SOURCE_PLATFORM_SRC[platformId], label };
}

type SourcePlatformLogoProps = {
  platform: string;
  host?: string;
  className?: string;
  size?: number;
  withLabel?: boolean;
  /** When false, bare mark (no gray pad / ring card). */
  framed?: boolean;
};

/** Card-network / shop-platform mark (联动 / 云猫 / …). Client-safe. */
export function SourcePlatformLogo({
  platform,
  host,
  className = "",
  size = 16,
  withLabel = false,
  framed = true,
}: SourcePlatformLogoProps) {
  const id = resolveSourcePlatform(platform, host);
  const { src, label } = resolveLogoSrc(id, host);

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} data-tooltip={label}>
      {framed ? (
        <span
          className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-background ring-1 ring-border/70 shadow-sm"
          style={{
            width: size + Math.max(4, Math.round(size * 0.35)),
            height: size + Math.max(4, Math.round(size * 0.35)),
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            width={size}
            height={size}
            className="block object-contain"
            draggable={false}
          />
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          className="block shrink-0 object-contain"
          style={{ width: size, height: size }}
          draggable={false}
        />
      )}
      {withLabel ? (
        <span className="leading-none text-sm">{label}</span>
      ) : null}
    </span>
  );
}
