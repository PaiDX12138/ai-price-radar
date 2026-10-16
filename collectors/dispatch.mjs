/**
 * kind → collector 分发（卡网全量；shopApi 仍走 collectors/shopApi.mjs）。
 */
import { collectDujiao } from "./dujiao.mjs";
import {
  collectBeibeiHtml,
  collectBlackcatWholesale,
  collectGenericHtml,
  collectMakerichHtml,
  collectMooncakeCatalog,
  collectOpensoraHtml,
  collectUnicornHtml,
} from "./htmlKinds.mjs";
import {
  collectGetgptApi,
  collectIkunloveApi,
  collectPublicProductsApi,
  collectShopUserProductsApi,
  collectXiaoheiwan,
} from "./jsonKinds.mjs";
import { collectKami } from "./kami.mjs";
import { collectShopApi } from "./shopApi.mjs";
import { collectShop16688 } from "./shop16688.mjs";
import { hostOf, kindToPlatform } from "./util.mjs";

/**
 * @param {{ id: string, kind: string, baseUrl: string, name?: string, shopToken?: string, platform?: string, sourceUrl?: string }} target
 * @param {object} [options]
 */
export async function collectByKind(target, options = {}) {
  const kind = String(target.kind || target.collectorKind || "");
  switch (kind) {
    case "kami":
      return collectKami(target, options);
    case "dujiao":
      return collectDujiao(target, options);
    case "shopApi":
      return collectShopApi(target, options);
    case "shop16688":
      return collectShop16688(target, options);
    case "getgptApi":
      return collectGetgptApi(target, options);
    case "ikunloveApi":
      return collectIkunloveApi(target, options);
    case "publicProductsApi":
      return collectPublicProductsApi(target, options);
    case "xiaoheiwan":
      return collectXiaoheiwan(target, options);
    case "shopUserProductsApi":
      return collectShopUserProductsApi(target, options);
    case "mooncakeCatalog":
      return collectMooncakeCatalog(target, options);
    case "blackcatWholesale":
      return collectBlackcatWholesale(target, options);
    case "genericHtml":
      return collectGenericHtml(target, options);
    case "unicornHtml":
      return collectUnicornHtml(target, options);
    case "opensoraHtml":
      return collectOpensoraHtml(target, options);
    case "makerichHtml":
      return collectMakerichHtml(target, options);
    case "beibeiHtml":
      return collectBeibeiHtml(target, options);
    default:
      return {
        ok: false,
        sourceId: target.id,
        error: `Unsupported collector kind: ${kind}`,
        offers: [],
      };
  }
}

/**
 * Expand config/collectors.json kinds+hosts into collect targets.
 * shopApi / shop16688 hosts are registry only — live shops need token/shop_no configs.
 */
export function expandCollectorTargets(collectorsConfig, opts = {}) {
  const kinds = Array.isArray(collectorsConfig?.kinds) ? collectorsConfig.kinds : [];
  const onlyKind = opts.kind ? String(opts.kind) : null;
  const skipShopApi = opts.skipShopApi !== false; // default skip — tokens live elsewhere
  /** @type {any[]} */
  const out = [];

  for (const entry of kinds) {
    const kind = entry.kind;
    if (onlyKind && kind !== onlyKind) continue;
    if (skipShopApi && (kind === "shopApi" || kind === "shop16688")) continue;
    const hosts = Array.isArray(entry.hosts) ? entry.hosts : [];
    for (const host of hosts) {
      const h = String(host || "")
        .trim()
        .replace(/^https?:\/\//i, "")
        .replace(/\/$/, "");
      if (!h) continue;
      const baseUrl = `https://${h}`;
      const id = `${kind}-${h.replace(/[^\w.-]+/g, "-")}`.toLowerCase();
      out.push({
        id,
        kind,
        collectorKind: kind,
        name: `${entry.label || kind} · ${h}`,
        baseUrl,
        sourceUrl: baseUrl,
        platform: kindToPlatform(kind),
        host: hostOf(baseUrl) || h,
        enabled: true,
      });
    }
  }
  return out;
}
