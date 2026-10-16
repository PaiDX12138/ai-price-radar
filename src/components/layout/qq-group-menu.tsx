"use client";

import { useEffect, useRef, useState } from "react";
import { QqIcon } from "@/components/icons/qq-icon";
import { buttonVariants } from "@/components/ui/button-variants";
import { QQ_GROUP } from "@/lib/community";
import { cn } from "@/lib/utils";

/** 导航 QQ 群：点击展开小弹窗显示二维码。 */
export function QqGroupMenu() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(QQ_GROUP.number);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="QQ 交流群"
        aria-expanded={open}
        title="QQ 交流群"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "text-muted-foreground"
        )}
      >
        <QqIcon className="size-4" />
      </button>
      <div
        className={cn(
          "absolute top-full right-0 z-50 pt-2 transition-opacity duration-150",
          open ? "visible opacity-100" : "invisible opacity-0 pointer-events-none"
        )}
      >
        <div className="w-44 rounded-xl border border-border bg-popover p-3 text-center text-popover-foreground shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={QQ_GROUP.qr}
            alt="QQ 群二维码"
            className="mx-auto size-36 rounded-md"
            draggable={false}
          />
          <p className="mt-2 text-sm font-medium">{QQ_GROUP.name}</p>
          <button
            type="button"
            onClick={copy}
            className="mt-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {copied ? "群号已复制" : `群号 ${QQ_GROUP.number}`}
          </button>
        </div>
      </div>
    </div>
  );
}
