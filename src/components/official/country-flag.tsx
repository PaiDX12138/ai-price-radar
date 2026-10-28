import Image from "next/image";
import {
  displayCountryLabel,
  flagCdnUrl,
} from "@/lib/official/country-display";
import { cn } from "@/lib/utils";

type CountryFlagProps = {
  countryCode: string;
  countryLabel?: string;
  size?: number;
  className?: string;
};

/**
 * 国旗：严格按 ISO countryCode → flagcdn（TW/HK/MO 分别为 tw/hk/mo 区旗）。
 * alt 用统一展示名（中国台湾 / 中国香港 / 中国澳门）。
 */
export function CountryFlag({
  countryCode,
  countryLabel,
  size = 18,
  className,
}: CountryFlagProps) {
  const code = String(countryCode || "").toUpperCase();
  if (!code) return null;
  const label = displayCountryLabel(code, countryLabel);
  return (
    <span
      data-tooltip={label}
      className={cn(
        "inline-flex shrink-0 overflow-hidden rounded-[3px] ring-1 ring-foreground/10",
        className,
      )}
      style={{ width: size, height: Math.round(size * 0.75) }}
    >
      <Image
        src={flagCdnUrl(code, 40)}
        alt={label}
        width={size}
        height={Math.round(size * 0.75)}
        className="h-full w-full object-cover"
        unoptimized
      />
    </span>
  );
}
