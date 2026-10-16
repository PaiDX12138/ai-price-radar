import { countShops } from "../../../collectors/shops-db.mjs";

/** 店铺库 shops.sqlite 里已收录的店铺数。 */
export function getIndexedShopCount(): number {
  try {
    return countShops();
  } catch {
    return 0;
  }
}
