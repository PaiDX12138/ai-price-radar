"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ListPagination } from "@/components/catalog/catalog-pagination";
import { OFFERS_PAGE_SIZE, parseCatalogPage } from "@/lib/catalog/pagination";
import { OfferCard } from "@/components/catalog/offer-card";
import {
  SOURCE_PLATFORM_LABEL,
  resolveSourcePlatform,
  type SourcePlatformId,
} from "@/components/catalog/source-platform-logo";
import { StickyPlatformFilter } from "@/components/catalog/sticky-platform-filter";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { offerPassedKyc } from "@/lib/catalog/kyc";
import { isSelfBuiltCardShop } from "@/lib/catalog/self-built";
import type { OfferWithSource, PlatformId } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";

const ALL = "__all__";

/** GPT：成品账号 / 订阅/会员 / 额度充值 / 辅助服务 / 中转服务 */
export const GPT_DELIVERY_TYPES = [
  "成品账号",
  "订阅/会员",
  "额度充值",
  "辅助服务",
  "中转服务",
] as const;

/** Claude：成品账号 / 接码/验证 / 订阅/会员 / 中转服务 / 辅助服务 */
export const CLAUDE_DELIVERY_TYPES = [
  "成品账号",
  "接码/验证",
  "订阅/会员",
  "中转服务",
  "辅助服务",
] as const;

/** Cursor：成品账号（普号）/ 订阅档（Pro·Pro+·Ultra）/ 辅助服务 */
export const CURSOR_DELIVERY_TYPES = ["成品账号", "订阅/会员", "辅助服务"] as const;

/** Kiro：成品账号 / 订阅档 / 额度充值 / 中转 / 辅助 */
export const KIRO_DELIVERY_TYPES = [
  "成品账号",
  "订阅/会员",
  "额度充值",
  "中转服务",
  "辅助服务",
] as const;

/** Gemini：成品账号 / 充值开通 / 订阅 / 中转 / 辅助 */
export const GEMINI_DELIVERY_TYPES = [
  "成品账号",
  "充值/开通",
  "订阅/会员",
  "中转服务",
  "辅助服务",
] as const;

/** 邮箱：统一 邮箱/账号（分档靠标准商品卡，不靠类型筛） */
export const EMAIL_DELIVERY_TYPES = ["邮箱/账号"] as const;

/** 接码：统一 接码/验证（分档靠标准商品卡） */
export const SMS_DELIVERY_TYPES = ["接码/验证"] as const;

/** 其他：工具账号 / 订阅 / 虚拟卡 / 礼品卡 / 其他 */
export const OTHER_DELIVERY_TYPES = [
  "工具账号",
  "订阅/会员",
  "虚拟卡",
  "礼品卡",
  "其他",
] as const;

type ProductOffersPanelProps = {
  offers: OfferWithSource[];
  deliveryType: string;
  platform: PlatformId;
  /** 全站已接入卡网平台；缺省时回退为当前报价里出现的平台 */
  sourcePlatforms?: Array<{ id: SourcePlatformId; label: string }>;
  /** 从列表页带入的搜索词（填入「搜索渠道 / 标题」并立即筛选） */
  initialQ?: string;
};

function offerHay(offer: OfferWithSource): string {
  return [offer.sourceTitle, offer.source.name, ...offer.tags].join("\n");
}

function matchesDeliveryType(
  offer: OfferWithSource,
  selected: string,
  productDeliveryType: string
): boolean {
  if (!selected) return true;
  if (productDeliveryType === selected) return true;
  const hay = offerHay(offer);
  if (selected === "中转服务") {
    return /镜像站|网页镜像|镜像|mirror|网页中转|共享中转|中转站|中转|额度|号池|倍率|美金|astra|flare|天卡|周卡/.test(
      hay
    );
  }
  if (selected === "辅助服务") {
    return /周边|辅助|提链|扫码|自助充值|额度重置|代操作|服务包|协助|退款|教程/.test(hay) &&
      !/镜像站|网页镜像|号池|倍率|加油包|api\s*key/.test(hay);
  }
  if (selected === "成品账号") {
    return /成品号|成品账号|普号|白号|长效|成品|free/.test(hay);
  }
  if (selected === "接码/验证") {
    return /kyc|persona|人脸|真人认证|实名认证|接码|验证码/.test(hay);
  }
  if (selected === "额度充值") {
    return /加油包|add-?on|积分包|额度包|额度充值|点数充值|补充积分|flow\s*积分|flow积分/.test(hay) &&
      !/号池|api\s*key|日卡|周卡|网页镜像/.test(hay);
  }
  if (selected === "充值/开通") {
    return /充值|开通|代充|直充|兑换链接|激活链接|订阅链接|cdk|卡密|自备账号|充自己/.test(hay) &&
      !/成品号|家庭组席位|拼车|镜像站|号池站/.test(hay);
  }
  if (selected === "订阅/会员") {
    return /订阅|会员|代充|直充|月卡|年卡|正价|pro\+|promax|pro max|power/.test(hay) &&
      !/镜像站|网页镜像|号池|加油包/.test(hay);
  }
  return hay.includes(selected);
}

export function ProductOffersPanel({
  offers,
  deliveryType,
  platform,
  sourcePlatforms,
  initialQ = "",
}: ProductOffersPanelProps) {
  const [type, setType] = useState(ALL);
  const [shopPlatform, setShopPlatform] = useState(ALL);
  const [warrantyOnly, setWarrantyOnly] = useState(false);
  const [kycOnly, setKycOnly] = useState(false);
  /** 开启后隐藏商家自建卡网；默认不过滤 */
  const [hideSelfBuilt, setHideSelfBuilt] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [q, setQ] = useState(() => initialQ.trim());
  const [page, setPage] = useState(1);
  const showKycFilter = platform === "claude";

  // 路由带入的 q 变化时同步（同页客户端跳转 / 返回再进）
  useEffect(() => {
    setQ(initialQ.trim());
    setPage(1);
  }, [initialQ]);

  const typeOptions = useMemo(() => {
    if (platform === "chatgpt") return [...GPT_DELIVERY_TYPES];
    if (platform === "claude") return [...CLAUDE_DELIVERY_TYPES];
    if (platform === "cursor") return [...CURSOR_DELIVERY_TYPES];
    if (platform === "kiro") return [...KIRO_DELIVERY_TYPES];
    if (platform === "gemini") return [...GEMINI_DELIVERY_TYPES];
    if (platform === "email") return [...EMAIL_DELIVERY_TYPES];
    if (platform === "sms") return [...SMS_DELIVERY_TYPES];
    if (platform === "other") return [...OTHER_DELIVERY_TYPES];
    const set = new Set<string>();
    if (deliveryType.trim()) set.add(deliveryType.trim());
    return [...set];
  }, [platform, deliveryType]);

  // 全站接入平台（链动/云猫…）对各 AI 板块一视同仁；不按本页报价裁剪
  const platformOptions = useMemo(() => {
    if (sourcePlatforms && sourcePlatforms.length > 0) {
      return sourcePlatforms.map((p) => [p.id, p.label] as [SourcePlatformId, string]);
    }
    const map = new Map<SourcePlatformId, string>();
    for (const offer of offers) {
      const id = resolveSourcePlatform(offer.source.platform, offer.source.host);
      map.set(id, SOURCE_PLATFORM_LABEL[id]);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "zh-CN"));
  }, [sourcePlatforms, offers]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const min = minPrice.trim() === "" ? null : Number(minPrice);
    const max = maxPrice.trim() === "" ? null : Number(maxPrice);
    const minOk = min != null && Number.isFinite(min) ? min : null;
    const maxOk = max != null && Number.isFinite(max) ? max : null;
    const typeSel = type === ALL ? "" : type;
    const platSel = shopPlatform === ALL ? "" : shopPlatform;

    return offers.filter((offer) => {
      if (typeSel && !matchesDeliveryType(offer, typeSel, deliveryType)) return false;
      if (platSel) {
        const id = resolveSourcePlatform(offer.source.platform, offer.source.host);
        if (id !== platSel) return false;
      }
      if (warrantyOnly && !offer.warranty) return false;
      if (kycOnly && !offerPassedKyc(offer)) return false;
      if (
        hideSelfBuilt &&
        isSelfBuiltCardShop({
          platform: offer.source.platform,
          host: offer.source.host,
          collectorKind: offer.source.collectorKind,
        })
      ) {
        return false;
      }
      if (minOk != null && offer.price < minOk) return false;
      if (maxOk != null && offer.price > maxOk) return false;
      if (needle) {
        const hay = offerHay(offer).toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [
    offers,
    type,
    shopPlatform,
    warrantyOnly,
    kycOnly,
    hideSelfBuilt,
    minPrice,
    maxPrice,
    q,
    deliveryType,
  ]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / OFFERS_PAGE_SIZE));
  const safePage = parseCatalogPage(String(page), totalPages);
  const pageOffers = filtered.slice(
    (safePage - 1) * OFFERS_PAGE_SIZE,
    safePage * OFFERS_PAGE_SIZE
  );

  // 筛选变化时回到第 1 页；总数变少时钳制页码
  useEffect(() => {
    setPage(1);
  }, [type, shopPlatform, warrantyOnly, kycOnly, hideSelfBuilt, minPrice, maxPrice, q]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  if (offers.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/80 px-4 py-8 text-center text-sm text-muted-foreground">
        暂无渠道报价
      </p>
    );
  }

  const goPage = (next: number) => {
    const p = parseCatalogPage(String(next), totalPages);
    setPage(p);
    // 翻页后滚到筛选条附近，避免停在页底
    requestAnimationFrame(() => {
      const el = document.querySelector("[data-slot='product-offer-filter']");
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <StickyPlatformFilter wide>
        <div
          data-slot="product-offer-filter"
          className="flex w-full min-w-0 flex-wrap items-center gap-2 px-0.5 py-0.5"
        >
          <Select
            value={type}
            onValueChange={(v) => setType(v ?? ALL)}
          >
            <SelectTrigger size="sm" className="w-[7.5rem] shrink-0 bg-background/40">
              <SelectValue placeholder="类型">
                {(value: string | null) =>
                  !value || value === ALL ? "全部类型" : value
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false}>
              <SelectItem value={ALL}>全部类型</SelectItem>
              {typeOptions.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={shopPlatform}
            onValueChange={(v) => setShopPlatform(v ?? ALL)}
          >
            <SelectTrigger size="sm" className="w-[8rem] shrink-0 bg-background/40">
              <SelectValue placeholder="卡网平台">
                {(value: string | null) => {
                  if (!value || value === ALL) return "全部平台";
                  return SOURCE_PLATFORM_LABEL[value as SourcePlatformId] ?? value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false}>
              <SelectItem value={ALL}>全部平台</SelectItem>
              {platformOptions.map(([id, label]) => (
                <SelectItem key={id} value={id}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button
            type="button"
            role="switch"
            aria-checked={warrantyOnly}
            onClick={() => setWarrantyOnly((v) => !v)}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2 text-xs transition-colors",
              warrantyOnly
                ? "border-emerald-800/30 bg-emerald-800/10 text-emerald-800"
                : "border-input bg-background/40 text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "size-3.5 rounded-full border transition-colors",
                warrantyOnly
                  ? "border-emerald-800 bg-emerald-800"
                  : "border-muted-foreground/40 bg-transparent"
              )}
              aria-hidden
            />
            仅质保
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={hideSelfBuilt}
            title="开启后隐藏 Kami / 独角等商家自建卡网，仅保留联动/云猫/QXVX 平台店"
            onClick={() => setHideSelfBuilt((v) => !v)}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2 text-xs transition-colors",
              hideSelfBuilt
                ? "border-orange-700/35 bg-orange-500/12 text-orange-900"
                : "border-input bg-background/40 text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "size-3.5 rounded-full border transition-colors",
                hideSelfBuilt
                  ? "border-orange-700 bg-orange-600"
                  : "border-muted-foreground/40 bg-transparent"
              )}
              aria-hidden
            />
            过滤自建
          </button>

          {showKycFilter ? (
            <button
              type="button"
              role="switch"
              aria-checked={kycOnly}
              onClick={() => setKycOnly((v) => !v)}
              className={cn(
                "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2 text-xs transition-colors",
                kycOnly
                  ? "border-violet-700/35 bg-violet-600/12 text-violet-800"
                  : "border-input bg-background/40 text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "size-3.5 rounded-full border transition-colors",
                  kycOnly
                    ? "border-violet-700 bg-violet-700"
                    : "border-muted-foreground/40 bg-transparent"
                )}
                aria-hidden
              />
              过Kyc
            </button>
          ) : null}

          <div className="flex shrink-0 items-center gap-1">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="最低价"
              aria-label="最低价"
              className="h-7 w-[4.75rem] bg-background/40 px-2 text-xs"
            />
            <span className="text-xs text-muted-foreground" aria-hidden>
              –
            </span>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="最高价"
              aria-label="最高价"
              className="h-7 w-[4.75rem] bg-background/40 px-2 text-xs"
            />
          </div>

          <div className="relative min-w-[8rem] flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索渠道 / 标题"
              aria-label="搜索渠道"
              autoComplete="off"
              spellCheck={false}
              className="h-7 w-full bg-background/40 pr-2 pl-7 text-xs"
            />
          </div>
        </div>
      </StickyPlatformFilter>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/80 px-4 py-8 text-center text-sm text-muted-foreground">
          没有符合筛选的渠道
        </p>
      ) : (
        <>
          <ul className="grid items-stretch gap-3 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {pageOffers.map((offer) => (
              <li key={offer.id} className="flex min-w-0">
                <OfferCard offer={offer} deliveryType={deliveryType} />
              </li>
            ))}
          </ul>
          <ListPagination
            page={safePage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemLabel="条报价"
            hrefForPage={(p) => (p > 1 ? `#offers-page-${p}` : "#offers")}
            onPageClick={goPage}
          />
        </>
      )}
    </div>
  );
}
