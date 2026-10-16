/**
 * Deterministic ShopApi fetch mock: one healthy shop + one failing shop.
 * Proves ≥1 non-empty offers and per-shop failure isolation without live tokens.
 */

const OK_TOKEN = "fixture-ok-token";
const DEAD_TOKEN = "fixture-dead-token";

const FIXTURE_ITEMS = [
  {
    name: "【菲区官充】Codex Plus 月卡代充｜质保30天｜自动发货",
    price: 118,
    real_price: 118,
    goods_key: "fx-plus-warranty",
    link: "https://pay.ldxp.cn/item/fx-plus-warranty",
    status: 1,
    goods_type: "card",
    extend: { stock_count: 86, send_order: 0 },
    category: { name: "ChatGPT" },
  },
  {
    name: "Plus 日抛成品号（演示缺货）",
    price: 22,
    goods_key: "fx-plus-oos",
    link: "https://pay.ldxp.cn/item/fx-plus-oos",
    status: 1,
    goods_type: "card",
    extend: { stock_count: 0 },
    category: { name: "ChatGPT" },
  },
  {
    name: "【埃及区官充】Codex GO 月卡代充｜质保30天",
    price: 32,
    goods_key: "fx-go",
    link: "https://pay.ldxp.cn/item/fx-go",
    status: 1,
    goods_type: "card",
    extend: { stock_count: 3 },
    category: { name: "ChatGPT" },
  },
  {
    name: "【IOS渠道】Claude Pro 官充 月卡【质保订阅30天】",
    price: 142,
    goods_key: "fx-claude",
    link: "https://pay.ldxp.cn/item/fx-claude",
    status: 1,
    goods_type: "card",
    extend: { stock_count: 41 },
    category: { name: "Claude" },
  },
];

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * @param {string} input
 * @param {RequestInit} [init]
 */
export async function mockShopApiFetch(input, init = {}) {
  const url = String(input);
  let body = {};
  try {
    body = init.body ? JSON.parse(String(init.body)) : {};
  } catch {
    body = {};
  }
  const token = String(body.token || "");

  if (url.includes("/shopApi/Shop/info")) {
    if (token === DEAD_TOKEN) {
      return jsonResponse({ code: 0, msg: "店铺链接不存在", data: null });
    }
    if (token === OK_TOKEN) {
      return jsonResponse({
        code: 1,
        msg: "ok",
        data: {
          nickname: "Fixture 链动店",
          link: `https://pay.ldxp.cn/shop/${OK_TOKEN}`,
          create_time: Math.floor(Date.now() / 1000),
          card_count: FIXTURE_ITEMS.length,
          custom_status: 1,
          custom_status_msg: "",
        },
      });
    }
    return jsonResponse({ code: 0, msg: "未知 token", data: null });
  }

  if (url.includes("/shopApi/Shop/categoryList")) {
    if (token !== OK_TOKEN) return jsonResponse({ code: 0, msg: "fail", data: null });
    return jsonResponse({
      code: 1,
      data: [
        { id: 0, name: "全部", goods_count: FIXTURE_ITEMS.length },
        { id: 11, name: "AI订阅", goods_count: FIXTURE_ITEMS.length },
      ],
    });
  }

  if (url.includes("/shopApi/Shop/goodsList")) {
    if (token !== OK_TOKEN) return jsonResponse({ code: 0, msg: "fail", data: { list: [] } });
    const page = Number(body.current || 1);
    if (page > 1) return jsonResponse({ code: 1, data: { list: [], total: FIXTURE_ITEMS.length } });
    return jsonResponse({
      code: 1,
      data: { list: FIXTURE_ITEMS, total: FIXTURE_ITEMS.length },
    });
  }

  return jsonResponse({ code: 0, msg: `unhandled ${url}`, data: null }, 404);
}

export const FIXTURE_SOURCES = [
  {
    id: "fixture-ok",
    platform: "liandong",
    name: "Fixture 链动店",
    baseUrl: "https://pay.ldxp.cn",
    shopToken: OK_TOKEN,
    enabled: true,
  },
  {
    id: "fixture-dead",
    platform: "liandong",
    name: "Fixture 失效店",
    baseUrl: "https://pay.ldxp.cn",
    shopToken: DEAD_TOKEN,
    enabled: true,
  },
];
