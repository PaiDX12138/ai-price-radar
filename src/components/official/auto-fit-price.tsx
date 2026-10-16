"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type AutoFitPriceProps = {
  text: string;
  className?: string;
  /** 起始字号 px */
  maxPx?: number;
  /** 最小字号 px */
  minPx?: number;
  title?: string;
};

/**
 * 定宽容器内自适应缩小字号，保证整段价格完整可见（不影响其它样式）。
 */
export function AutoFitPrice({
  text,
  className,
  maxPx = 15,
  minPx = 9,
  title,
}: AutoFitPriceProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      let size = maxPx;
      el.style.fontSize = `${size}px`;
      // 先用最大字号，超宽再逐步缩小
      while (size > minPx && el.scrollWidth > el.clientWidth + 0.5) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, maxPx, minPx]);

  return (
    <span
      ref={ref}
      title={title ?? text}
      className={cn(
        "block w-full overflow-hidden whitespace-nowrap leading-none",
        className,
      )}
      style={{ fontSize: maxPx }}
    >
      {text}
    </span>
  );
}
