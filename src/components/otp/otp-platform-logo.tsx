import { cn } from "@/lib/utils";

const OTP_PLATFORM_LOGO: Record<string, string> = {
  "5sim": "/brands/otp/5sim.png",
  hero: "/brands/otp/hero.png",
  grizzly: "/brands/otp/grizzly.png",
  smsbulk: "/brands/otp/smsbulk.png",
  youjianma: "/brands/otp/youjianma.png",
  anymessage: "/brands/otp/anymessage.png",
  otpgmail: "/brands/otp/otpgmail.png",
  "sms-man": "/brands/otp/sms-man.png",
  onlinesim: "/brands/otp/onlinesim.png",
};

type OtpPlatformLogoProps = {
  platformId: string;
  name?: string;
  size?: number;
  className?: string;
};

export function otpPlatformLogoSrc(platformId: string): string {
  return OTP_PLATFORM_LOGO[platformId] ?? "/brands/phone.svg";
}

export function OtpPlatformLogo({
  platformId,
  name,
  size = 16,
  className,
}: OtpPlatformLogoProps) {
  const pad = Math.max(4, Math.round(size * 0.35));
  const src = otpPlatformLogoSrc(platformId);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-background ring-1 ring-border/70 shadow-sm",
        className,
      )}
      style={{ width: size + pad, height: size + pad }}
      data-tooltip={name ?? platformId}
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
  );
}
