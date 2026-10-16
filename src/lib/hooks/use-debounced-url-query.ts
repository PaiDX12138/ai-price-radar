"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type CompositionEvent,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function buildHref(
  pathname: string,
  current: URLSearchParams,
  patch: Record<string, string | null>,
): string {
  const params = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
  }
  params.delete("page");
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

type UseDebouncedUrlQueryOptions = {
  /** URL 参数名，默认 `q` */
  param?: string;
  /** 写入 URL 的防抖（仅在非输入法组合期），默认 400ms */
  delayMs?: number;
};

/**
 * 搜索框 ↔ URL `?q=`：本地 draft + 防抖写回。
 * 关键点：中文 IME 组合期内绝不 router.replace / 绝不被 URL 回写覆盖 draft，
 * 否则会 Suspense 重挂载 + 组合被打断 → 拼音乱码。
 */
export function useDebouncedUrlQuery(options: UseDebouncedUrlQueryOptions = {}) {
  const param = options.param ?? "q";
  const delayMs = options.delayMs ?? 400;

  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const qParam = searchParams.get(param) ?? "";
  const paramsKey = searchParams.toString();

  const [draft, setDraft] = useState(qParam);
  const composingRef = useRef(false);
  /** 最近一次由本 hook 推上 URL 的值（trim 后），用于区分「自己写回」与「外部导航」 */
  const lastPushedRef = useRef(qParam.trim());
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const paramsKeyRef = useRef(paramsKey);
  paramsKeyRef.current = paramsKey;
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const pushUrl = useCallback(
    (raw: string) => {
      const next = raw.trim();
      const cur = new URLSearchParams(paramsKeyRef.current).get(param) ?? "";
      if (next === cur.trim()) {
        lastPushedRef.current = next;
        return;
      }
      lastPushedRef.current = next;
      startTransition(() => {
        router.replace(
          buildHref(
            pathnameRef.current,
            new URLSearchParams(paramsKeyRef.current),
            { [param]: next || null },
          ),
          { scroll: false },
        );
      });
    },
    [param, router, startTransition],
  );

  const schedulePush = useCallback(() => {
    clearTimer();
    if (composingRef.current) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (composingRef.current) return;
      pushUrl(draftRef.current);
    }, delayMs);
  }, [clearTimer, delayMs, pushUrl]);

  // 外部 URL 变化（后退 / 清筛选）→ 同步 draft；自己的写回与组合期跳过
  useEffect(() => {
    if (composingRef.current) return;
    if (qParam.trim() === lastPushedRef.current) return;
    lastPushedRef.current = qParam.trim();
    setDraft(qParam);
  }, [qParam]);

  // draft 变化 → 防抖写 URL（组合期由 composition 事件门控）
  useEffect(() => {
    schedulePush();
    return clearTimer;
  }, [draft, schedulePush, clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value);
  }, []);

  const onCompositionStart = useCallback(() => {
    composingRef.current = true;
    clearTimer();
  }, [clearTimer]);

  const onCompositionEnd = useCallback(
    (e: CompositionEvent<HTMLInputElement>) => {
      composingRef.current = false;
      const value = e.currentTarget.value;
      setDraft(value);
      draftRef.current = value;
      // 组合结束立刻排队写 URL（仍走 delay，避免连按）
      schedulePush();
    },
    [schedulePush],
  );

  return {
    value: draft,
    onChange,
    onCompositionStart,
    onCompositionEnd,
  };
}

export function buildSearchHref(
  pathname: string,
  current: URLSearchParams,
  patch: Record<string, string | null>,
): string {
  return buildHref(pathname, current, patch);
}
