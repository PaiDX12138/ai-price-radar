import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

type ChannelMeta = {
  /** 品牌 mono SVG；没有则用 lucide 图标 */
  src?: string;
  label: string;
  fullLabel: string;
  title: string;
};

const CHANNELS: Record<string, ChannelMeta> = {
  web_direct: { label: "官网", fullLabel: "官网直购", title: "官网直购" },
  ios_store: { src: "/brands/apple.svg", label: "iOS", fullLabel: "App Store", title: "App Store" },
};

export function PayChannel({
  channel,
  divider = false,
  full = false,
  className,
}: {
  channel: string;
  /** 国家名右侧的竖线 */
  divider?: boolean;
  /** 用完整名称（详情表），卡片里用短名 */
  full?: boolean;
  className?: string;
}) {
  const meta: ChannelMeta = CHANNELS[channel] ?? {
    label: channel || "—",
    fullLabel: channel || "—",
    title: channel || "渠道",
  };
  return (
    <span
      title={meta.title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground",
        className,
      )}
    >
      {divider ? <span className="mr-0.5 h-3 w-px shrink-0 bg-foreground/25" aria-hidden /> : null}
      {meta.src ? (
        <img
          src={meta.src}
          alt=""
          width={12}
          height={12}
          className="size-3 shrink-0 object-contain dark:invert"
          aria-hidden
        />
      ) : (
        <Globe className="size-3 shrink-0" strokeWidth={2} aria-hidden />
      )}
      <span className="font-medium leading-none text-foreground/80">
        {full ? meta.fullLabel : meta.label}
      </span>
    </span>
  );
}
