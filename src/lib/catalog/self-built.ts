/**
 * 商家自建卡网 vs 平台卡网（对照 参考站 渠道指南）。
 * 平台卡网：联动小铺 / 云猫发卡 / QXVX / 16688。
 * 自建卡网：Kami、独角、GetGPT、iKunLove、小黑万、公开 HTML 等独立站。
 */
import { resolveSourcePlatform } from "@/components/catalog/source-platform-logo";

const PLATFORM_CARD_SHOP = new Set(["liandong", "yunmao", "qxvx", "shop16688"]);

export function isSelfBuiltCardShop(parts: {
  platform?: string | null;
  host?: string | null;
  collectorKind?: string | null;
}): boolean {
  const kind = String(parts.collectorKind || "").toLowerCase();
  if (kind === "shopapi" || kind === "shop16688") return false;
  if (
    kind === "kami" ||
    kind === "dujiao" ||
    kind === "getgptapi" ||
    kind === "ikunloveapi" ||
    kind === "xiaoheiwan" ||
    kind === "publicproductsapi" ||
    kind === "shopuserproductsapi" ||
    kind.endsWith("html") ||
    kind === "mooncakecatalog" ||
    kind === "blackcatwholesale"
  ) {
    return true;
  }
  const id = resolveSourcePlatform(parts.platform ?? undefined, parts.host ?? undefined);
  return !PLATFORM_CARD_SHOP.has(id);
}
