"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Link2,
  LoaderCircle,
  Store,
} from "lucide-react";
import { PLATFORM_LABEL, PlatformLogo } from "@/components/catalog/platform-logo";
import {
  SourcePlatformLogo,
  type SourcePlatformId,
} from "@/components/catalog/source-platform-logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlatformId, PlatformTabId } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";

const MODE_HOME = "homepage";
const MODE_OTHER = "other";

const HOME_PLATFORM_LOGOS: SourcePlatformId[] = [
  "liandong",
  "yunmao",
  "qxvx",
  "shop16688",
  "kami",
  "dujiao",
];

const PRODUCT_LINE_ORDER: PlatformId[] = [
  "chatgpt",
  "claude",
  "cursor",
  "grok",
  "kiro",
  "gemini",
  "email",
  "sms",
  "other",
];

type ShopSubmitDialogProps = {
  className?: string;
  deliveryTypesByPlatform: Partial<Record<PlatformTabId, string[]>>;
};

type FieldTone = "idle" | "error" | "warn" | "ok";

type SubmitResult = {
  ok: boolean;
  title: string;
  detail?: string;
  fieldHint?: string;
  /** 已收录 / 已核对过 → 琥珀色提示，不算失败 */
  duplicate?: boolean;
};

function ChoiceCard({
  selected,
  onClick,
  className,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-xl border px-3 py-2.5 text-left transition-all duration-150 outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring/50",
        selected
          ? "border-[color-mix(in_oklab,var(--apr-ink)_40%,var(--border))] bg-[color-mix(in_oklab,var(--apr-ink-soft)_70%,var(--card))] shadow-sm ring-1 ring-[color-mix(in_oklab,var(--apr-ink)_18%,transparent)]"
          : "border-border/80 bg-card hover:border-foreground/15 hover:bg-muted/40",
        className,
      )}
    >
      {children}
    </button>
  );
}

function FieldHint({
  tone,
  children,
}: {
  tone: FieldTone;
  children: ReactNode;
}) {
  if (!children) return null;
  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-1.5 text-[12px] font-medium leading-snug",
        "animate-in fade-in-0 slide-in-from-top-1 duration-200",
        tone === "error" && "text-rose-600 dark:text-rose-400",
        tone === "warn" && "text-amber-700 dark:text-amber-400",
        tone === "ok" && "text-emerald-700 dark:text-emerald-400",
        tone === "idle" && "text-muted-foreground",
      )}
    >
      <CircleAlert
        className={cn(
          "mt-0.5 size-3.5 shrink-0",
          tone === "error" && "text-rose-500",
          tone === "warn" && "text-amber-500",
          tone === "ok" && "text-emerald-500",
        )}
        aria-hidden
        strokeWidth={2.25}
      />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/**
 * 收录申请：店铺首页入库；「其他」按商品线+类型走归类规则核对详情链接。
 */
export function ShopSubmitDialog({
  className,
  deliveryTypesByPlatform,
}: ShopSubmitDialogProps) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<string>(MODE_HOME);
  const [url, setUrl] = useState("");
  const [productLine, setProductLine] = useState<PlatformId>("chatgpt");
  const [deliveryType, setDeliveryType] = useState<string>("");
  const [fieldHint, setFieldHint] = useState<string | null>(null);
  const [fieldTone, setFieldTone] = useState<FieldTone>("idle");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const typeOptions = useMemo(() => {
    const list = deliveryTypesByPlatform[productLine] ?? [];
    return list.filter(Boolean);
  }, [deliveryTypesByPlatform, productLine]);

  useEffect(() => {
    if (!typeOptions.length) {
      setDeliveryType("");
      return;
    }
    if (!typeOptions.includes(deliveryType)) {
      setDeliveryType(typeOptions[0]);
    }
  }, [typeOptions, deliveryType]);

  const reset = () => {
    setMode(MODE_HOME);
    setUrl("");
    setProductLine("chatgpt");
    setDeliveryType("");
    setFieldHint(null);
    setFieldTone("idle");
    setPending(false);
    setResult(null);
  };

  const clearHint = () => {
    setFieldHint(null);
    setFieldTone("idle");
  };

  const showFieldError = (text: string, tone: FieldTone = "error") => {
    setFieldHint(text);
    setFieldTone(tone);
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;

    if (!url.trim()) {
      showFieldError("请填写链接");
      return;
    }
    if (mode === MODE_OTHER && !deliveryType) {
      showFieldError("请选择类型", "warn");
      return;
    }

    setPending(true);
    clearHint();

    try {
      const res = await fetch("/api/shops/submit", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          mode,
          url: url.trim(),
          productLine: mode === MODE_OTHER ? productLine : undefined,
          deliveryType: mode === MODE_OTHER ? deliveryType : undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | (SubmitResult & { fieldHint?: string; code?: string })
        | null;

      if (!data) {
        setResult({
          ok: false,
          title: "提交失败",
          detail: "服务无响应，请稍后重试",
        });
        showFieldError("暂时无法提交");
        return;
      }

      if (!data.ok) {
        if (data.fieldHint) showFieldError(data.fieldHint, "error");
        setResult({
          ok: false,
          title: data.title || "未通过",
          detail: data.detail,
          fieldHint: data.fieldHint,
        });
        return;
      }

      const duplicate =
        Boolean(data.duplicate) ||
        data.code === "shop_duplicate" ||
        data.code === "detail_duplicate";

      if (duplicate && data.fieldHint) {
        showFieldError(data.fieldHint, "warn");
      } else {
        clearHint();
      }
      setResult({
        ok: true,
        duplicate,
        title: data.title || "已完成",
        detail: data.detail,
        fieldHint: data.fieldHint,
      });
    } catch {
      setResult({
        ok: false,
        title: "网络异常",
        detail: "请检查网络后重试",
      });
      showFieldError("网络异常");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        className={cn(
          "group relative flex max-w-[16.5rem] items-center gap-2 rounded-lg border border-border/80",
          "bg-card px-2.5 py-1.5 text-left shadow-[0_1px_0_color-mix(in_oklab,var(--foreground)_4%,transparent)]",
          "transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out",
          "hover:border-[color-mix(in_oklab,var(--apr-ink)_28%,var(--border))]",
          "hover:bg-[color-mix(in_oklab,var(--apr-ink-soft)_55%,var(--card))]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          "active:translate-y-px",
          className,
        )}
      >
        <span
          className="absolute left-0 top-1/2 h-[52%] w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--apr-ink)]/80"
          aria-hidden
        />
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--apr-ink-soft)] text-[var(--apr-ink)]">
          <Store className="size-3.5" aria-hidden strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1 leading-none">
          <span className="block text-[11px] leading-none text-muted-foreground">
            没有你的／想看见的店铺？
          </span>
          <span className="mt-1 flex items-center gap-0.5">
            <span className="relative inline-block font-semibold tracking-[-0.02em] text-foreground">
              <span
                className="absolute inset-x-[-2px] bottom-[0.08em] z-0 h-[0.42em] rounded-[1px] bg-[color-mix(in_oklab,var(--apr-ink)_22%,transparent)]"
                aria-hidden
              />
              <span className="relative z-10 text-[13px] sm:text-sm">收录申请</span>
            </span>
            <ChevronRight
              className="relative z-10 size-3.5 text-[var(--apr-ink)]/70 transition-transform group-hover:translate-x-0.5"
              aria-hidden
              strokeWidth={2.25}
            />
          </span>
        </span>
      </DialogTrigger>

      <DialogContent className="gap-5 sm:max-w-lg" showCloseButton={!pending}>
        {result ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center animate-in fade-in-0 zoom-in-95 duration-200">
            <span
              className={cn(
                "flex size-12 items-center justify-center rounded-full ring-1",
                !result.ok
                  ? "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-400"
                  : result.duplicate
                    ? "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-400"
                    : "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
              )}
            >
              {!result.ok || result.duplicate ? (
                <CircleAlert className="size-6" strokeWidth={2} aria-hidden />
              ) : (
                <CheckCircle2 className="size-6" strokeWidth={2} aria-hidden />
              )}
            </span>
            <div className="space-y-1.5">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                {result.title}
              </h2>
              {result.detail ? (
                <p className="mx-auto max-w-[22rem] text-[13px] leading-relaxed text-muted-foreground">
                  {result.detail}
                </p>
              ) : null}
            </div>
            <DialogFooter className="w-full sm:justify-center">
              {result.ok ? (
                <DialogClose render={<Button type="button" className="min-w-28" />}>
                  完成
                </DialogClose>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="min-w-28"
                  onClick={() => setResult(null)}
                >
                  返回修改
                </Button>
              )}
            </DialogFooter>
          </div>
        ) : (
          <>
            <DialogHeader className="gap-1.5 pr-6">
              <DialogTitle className="flex items-center gap-2">
                <span className="h-4 w-[3px] rounded-full bg-[var(--apr-ink)]" aria-hidden />
                收录申请
              </DialogTitle>
              <DialogDescription className="text-[13px]">
                贴公开链接，通过检查后写入店铺档案。
              </DialogDescription>
            </DialogHeader>

            <form id={formId} onSubmit={onSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">方式</Label>
                <div className="grid grid-cols-2 gap-2">
                  <ChoiceCard
                    selected={mode === MODE_HOME}
                    onClick={() => {
                      setMode(MODE_HOME);
                      clearHint();
                    }}
                  >
                    <p className="text-[13px] font-semibold text-foreground">店铺首页</p>
                    <div className="mt-2 flex items-center gap-1">
                      {HOME_PLATFORM_LOGOS.map((id) => (
                        <SourcePlatformLogo key={id} platform={id} size={14} framed />
                      ))}
                    </div>
                  </ChoiceCard>

                  <ChoiceCard
                    selected={mode === MODE_OTHER}
                    onClick={() => {
                      setMode(MODE_OTHER);
                      clearHint();
                    }}
                  >
                    <p className="text-[13px] font-semibold text-foreground">其他</p>
                    <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                      选商品线 / 类型后贴详情页
                    </p>
                  </ChoiceCard>
                </div>
              </div>

              {mode === MODE_OTHER ? (
                <>
                  <div className="grid gap-2">
                    <Label className="text-muted-foreground">商品线</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {PRODUCT_LINE_ORDER.map((id) => (
                        <ChoiceCard
                          key={id}
                          selected={productLine === id}
                          onClick={() => {
                            setProductLine(id);
                            clearHint();
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5"
                        >
                          <PlatformLogo platform={id} size={14} />
                          <span className="text-xs font-medium">{PLATFORM_LABEL[id]}</span>
                        </ChoiceCard>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-muted-foreground">类型</Label>
                    {typeOptions.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {typeOptions.map((type) => (
                          <ChoiceCard
                            key={type}
                            selected={deliveryType === type}
                            onClick={() => {
                              setDeliveryType(type);
                              clearHint();
                            }}
                            className="px-2.5 py-1.5"
                          >
                            <span className="text-xs font-medium">{type}</span>
                          </ChoiceCard>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] text-muted-foreground">该板块暂无类型列</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={`${formId}-url`} className="text-muted-foreground">
                      详情链接 · 具体商品的详情页面链接
                    </Label>
                    <div className="relative">
                      <Link2
                        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                      <Input
                        id={`${formId}-url`}
                        type="url"
                        inputMode="url"
                        placeholder="https://…/item/…  /goods/…  /products/…"
                        value={url}
                        onChange={(e) => {
                          setUrl(e.target.value);
                          clearHint();
                        }}
                        autoComplete="off"
                        aria-invalid={fieldTone === "error" || undefined}
                        className={cn(
                          "pl-8 transition-[border-color,box-shadow] duration-200",
                          fieldTone === "error" &&
                            "border-rose-500/50 focus-visible:border-rose-500 focus-visible:ring-rose-500/20",
                          fieldTone === "warn" &&
                            "border-amber-500/45 focus-visible:border-amber-500 focus-visible:ring-amber-500/20",
                        )}
                      />
                    </div>
                    {fieldHint ? <FieldHint tone={fieldTone}>{fieldHint}</FieldHint> : null}
                  </div>
                </>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor={`${formId}-url`} className="text-muted-foreground">
                    首页链接
                  </Label>
                  <div className="relative">
                    <Link2
                      className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      id={`${formId}-url`}
                      type="url"
                      inputMode="url"
                      placeholder="https://…/shop/…"
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        clearHint();
                      }}
                      autoComplete="off"
                      aria-invalid={fieldTone === "error" || undefined}
                      className={cn(
                        "pl-8 transition-[border-color,box-shadow] duration-200",
                        fieldTone === "error" &&
                          "border-rose-500/50 focus-visible:border-rose-500 focus-visible:ring-rose-500/20",
                        fieldTone === "warn" &&
                          "border-amber-500/45 focus-visible:border-amber-500 focus-visible:ring-amber-500/20",
                      )}
                    />
                  </div>
                  {fieldHint ? <FieldHint tone={fieldTone}>{fieldHint}</FieldHint> : null}
                </div>
              )}
            </form>

            <DialogFooter>
              <DialogClose
                render={<Button type="button" variant="outline" disabled={pending} />}
              >
                取消
              </DialogClose>
              <Button type="submit" form={formId} disabled={pending} className="gap-1.5">
                {pending ? (
                  <>
                    <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                    检查中
                  </>
                ) : (
                  "提交"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
