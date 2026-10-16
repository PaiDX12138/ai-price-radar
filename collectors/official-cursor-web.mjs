/**
 * Cursor 官网直购地区价（公开口径）。
 * 证据：https://cursor.com/pricing — The X Subscription 美区 USD 标价（税前）。
 */
import {
  formatUsdFxPrice,
  usdListToLocal,
} from "./official-usd-fx-web.mjs";

export const CURSOR_WEB_SOURCE_URL = "https://cursor.com/pricing";
export const GROK_WEB_SOURCE_URL = "https://x.ai/pricing";
/** 帮助中心公开的美区 Web 标价（Basic / Premium / Premium+） */
export const X_PREMIUM_WEB_SOURCE_URL = "https://help.x.com/en/using-x/x-premium";

export const cursorUsdToLocal = usdListToLocal;
export const formatCursorWebPrice = formatUsdFxPrice;
