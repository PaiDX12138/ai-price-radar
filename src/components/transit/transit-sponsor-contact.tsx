"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Handshake, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TonePanel } from "@/components/catalog/tone-panel";

const CONTACT_QQ = "3632164290";

/** Shared dialog handles focus, outside-click / Escape close and focus restoration. */
export function TransitSponsorContact() {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [copying, setCopying] = useState(false);
  const copyMessage = copyStatus === "copied" ? "QQ 号已复制" : copyStatus === "failed" ? "复制失败，请选中号码复制" : "复制 QQ 号";

  useEffect(() => {
    if (copyStatus !== "copied") return;
    const timer = window.setTimeout(() => setCopyStatus("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  async function copyQQ() {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(CONTACT_QQ);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    } finally {
      setCopying(false);
    }
  }

  return <Dialog>
    <DialogTrigger render={<Button variant="ghost" size="xs" className="shrink-0 gap-1.5 text-muted-foreground hover:text-[var(--apr-ink)]" />}>
      <Handshake className="size-3.5" strokeWidth={1.8} aria-hidden />
      成为赞助商
    </DialogTrigger>
    <DialogContent className="sm:max-w-sm">
      <DialogHeader className="pr-7">
        <DialogTitle>成为赞助商</DialogTitle>
        <DialogDescription className="text-xs leading-5">如有合作或赞助意向，欢迎联系站点作者洽谈。</DialogDescription>
      </DialogHeader>
      <TonePanel tone="ink" className="py-3">
        <dl className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><MessageCircle className="size-3.5 text-[var(--apr-ink)]" aria-hidden />联系 QQ</dt>
          <dd className="flex items-center gap-2">
            <span className="select-all font-mono text-base font-semibold tabular-nums tracking-wide text-foreground">{CONTACT_QQ}</span>
            <Button type="button" variant="ghost" size="icon-xs" disabled={copying} onClick={copyQQ}
              aria-label={copyMessage} data-tooltip={copyMessage} data-tooltip-anchor="element"
              className="text-muted-foreground hover:text-[var(--apr-ink)]">
              {copyStatus === "copied" ? <Check className="size-3.5 text-[var(--apr-ink)]" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
            </Button>
          </dd>
        </dl>
        <p role="status" className={copyStatus === "failed" ? "mt-2 text-xs text-muted-foreground" : "sr-only"}>{copyStatus === "idle" ? "" : copyMessage}</p>
      </TonePanel>
    </DialogContent>
  </Dialog>;
}
