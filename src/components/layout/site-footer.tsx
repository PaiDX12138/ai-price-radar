import { Star } from "lucide-react";
import Link from "next/link";
import { GitHubIcon } from "@/components/icons/github-icon";
import { BRAND_NAME_ZH } from "@/lib/brand";

const GITHUB_REPO = "https://github.com/PaiDX12138/ai-price-radar";

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-5 text-center text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-1.5 px-4">
        <p className="inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
          <span className="inline-flex items-center gap-0.5">
            如果好用，可以点个 Star
            <Star
              className="size-3.5 fill-amber-400 text-amber-500"
              strokeWidth={1.75}
              aria-hidden
            />
            吗？
          </span>
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline"
          >
            <GitHubIcon className="size-3.5" />
            github
          </a>
        </p>
        <p>
          {BRAND_NAME_ZH} · 信息聚合工具，不售卖、不担保交易。使用前请阅读{" "}
          <Link
            className="underline underline-offset-2 hover:text-foreground"
            href="/docs/disclaimer"
          >
            免责声明
          </Link>
          。
        </p>
      </div>
    </footer>
  );
}
