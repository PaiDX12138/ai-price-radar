/**
 * Title → product slug + long-warranty flag.
 * Match order & rules aligned with 参考站 `src/lib/catalog.ts`
 * (参考实现) — ChatGPT family, verification, peripheral, Team/Plus
 * disambiguation. Slugs keep this repo’s seed names (e.g. chatgpt-team,
 * gemini-year, sms-verification).
 */

/** @type {Array<{ slug: string, name: string, platform: string, deliveryType: string, summary?: string }>} */
export const PRODUCT_SEED = [
  // GPT 类型对齐 参考站：成品账号 / 订阅/会员 / 辅助服务；本站额外「中转服务」
  {
    slug: "chatgpt-free-account",
    name: "ChatGPT 普号",
    platform: "chatgpt",
    deliveryType: "成品账号",
    summary: "ChatGPT 普号、Free 号、白号或 OpenAI 普通账号",
  },
  {
    slug: "chatgpt-plus",
    name: "ChatGPT Plus 试用订阅",
    platform: "chatgpt",
    deliveryType: "订阅/会员",
    summary: "日抛、成品号、网页号、已/未接码等试用订阅；非官方正价代充",
  },
  {
    slug: "chatgpt-plus-recharge",
    name: "ChatGPT Plus 正价代充",
    platform: "chatgpt",
    deliveryType: "订阅/会员",
    summary: "官方/官网/正价/正规或真实付费的 Plus 充值渠道",
  },
  {
    slug: "chatgpt-go",
    name: "ChatGPT Go",
    platform: "chatgpt",
    deliveryType: "订阅/会员",
  },
  {
    slug: "chatgpt-team",
    name: "ChatGPT Team / Business",
    platform: "chatgpt",
    deliveryType: "订阅/会员",
    summary: "K12 · Team · 正价席位 · 母号/子号 · 邀请/自动拉",
  },
  {
    slug: "chatgpt-pro-5x",
    name: "ChatGPT Pro 5x",
    platform: "chatgpt",
    deliveryType: "订阅/会员",
    summary: "ChatGPT Pro 5x 充值、代开或卡密（约 100 刀档）",
  },
  {
    slug: "chatgpt-pro-20x",
    name: "ChatGPT Pro 20x",
    platform: "chatgpt",
    deliveryType: "订阅/会员",
    summary: "ChatGPT Pro 20x 充值、代开或卡密（约 200 刀档）",
  },
  {
    // 参考站 主仓尚无独立 seed，但市面大量 500 刀 / 50x 档；单独成卡，禁止塞进「未分倍率」
    slug: "chatgpt-pro-500",
    name: "ChatGPT Pro 500",
    platform: "chatgpt",
    deliveryType: "订阅/会员",
    summary: "ChatGPT Pro 500 刀 / 50x 档充值、代开或卡密",
  },
  {
    slug: "chatgpt-codex-service",
    name: "Codex / ChatGPT 周边与自助服务",
    platform: "chatgpt",
    deliveryType: "辅助服务",
    summary:
      "提链、扫码对接、非正价自助充值、邀请增额、额度重置等；不含成品账号、独立接码、账号额度直充、正价 Plus 充值",
  },
  {
    slug: "chatgpt-quota-recharge",
    name: "ChatGPT / Codex 额度充值",
    platform: "chatgpt",
    deliveryType: "额度充值",
    summary:
      "官方点数/额度直充到个人订阅账号（如 Codex 250 额度）；非 API 中转、非成品号、非 Plus/Pro 月卡代开",
  },
  {
    slug: "chatgpt-mirror",
    name: "ChatGPT 镜像 / 中转服务",
    platform: "chatgpt",
    deliveryType: "中转服务",
    summary: "网页镜像、API/号池中转、中转余额等",
  },
  // Cursor：对齐 GPT 渠道类型 — 成品账号 / 订阅/会员 / 辅助服务
  {
    slug: "cursor-free-account",
    name: "Cursor 普号 / Free",
    platform: "cursor",
    deliveryType: "成品账号",
    summary: "Free Auto 白号、小白号、微软长效普号等",
  },
  {
    slug: "cursor-plus",
    name: "Cursor Plus",
    platform: "cursor",
    deliveryType: "订阅/会员",
    summary: "官网 Cursor Plus（$8/月）；卡网常见「小杯」成品或代充",
  },
  {
    slug: "cursor-pro",
    name: "Cursor Pro",
    platform: "cursor",
    deliveryType: "订阅/会员",
    summary: "对照官网 Cursor Premium（$30/月）；含旧称 Pro 20/40 刀成品或代充（不含 Pro+ / Ultra）",
  },
  {
    slug: "cursor-pro-plus",
    name: "Cursor Pro+",
    platform: "cursor",
    deliveryType: "订阅/会员",
    summary: "对照官网 Cursor Super（$100/月）；含旧称 Pro+ 成品或订阅",
  },
  {
    slug: "cursor-ultra",
    name: "Cursor Ultra",
    platform: "cursor",
    deliveryType: "订阅/会员",
    summary: "Cursor Ultra 月卡成品、正价代充",
  },
  {
    slug: "cursor-service",
    name: "Cursor 辅助服务",
    platform: "cursor",
    deliveryType: "辅助服务",
    summary: "插件计费共享、日/周卡、协助充值、自助退款等；独立接码归接码页",
  },
  // Kiro（AWS）：成品账号 / 订阅/会员 / 额度充值 / 中转服务 / 辅助服务
  // 官方档：Free(50) → Pro(1000·$20) → Pro+(2000·$40) → Pro Max(5000·$100) → Power(10000·$200)
  {
    slug: "kiro-free-account",
    name: "Kiro 普号 / Free",
    platform: "kiro",
    deliveryType: "成品账号",
    summary: "Free 50 额度、JSON/kirors 普号、Gmail 老号等",
  },
  {
    slug: "kiro-pro",
    name: "Kiro Pro",
    platform: "kiro",
    deliveryType: "订阅/会员",
    summary: "Pro · 1000 积分/额度 · $20；含学生 Pro 年账",
  },
  {
    slug: "kiro-pro-plus",
    name: "Kiro Pro+",
    platform: "kiro",
    deliveryType: "订阅/会员",
    summary: "Pro+ · 2000 积分/额度 · $40",
  },
  {
    slug: "kiro-pro-max",
    name: "Kiro Pro Max",
    platform: "kiro",
    deliveryType: "订阅/会员",
    summary: "Pro Max · 5000 积分/额度 · $100",
  },
  {
    slug: "kiro-power",
    name: "Kiro Power",
    platform: "kiro",
    deliveryType: "订阅/会员",
    summary: "Power · 10000 积分/额度 · $200",
  },
  {
    // 官方 add-on credits：付费档可预购积分包（$0.04/积分），充到已有订阅账号 → 额度充值
    slug: "kiro-quota-recharge",
    name: "Kiro 加油包 / 额度充值",
    platform: "kiro",
    deliveryType: "额度充值",
    summary:
      "官方 add-on credits / 加油包 / 积分包直充到已有 Pro 及以上账号；非新开订阅、非 API 中转",
  },
  {
    // 非 Claude 面向的 Kiro 原生中转（若有）；Claude-Kiro 反代归 claude-mirror
    slug: "kiro-mirror",
    name: "Kiro 镜像 / 中转服务",
    platform: "kiro",
    deliveryType: "中转服务",
    summary: "Kiro 原生号池/中转（非 Claude 调用面）；Claude-Kiro API/渠道归 Claude 中转服务",
  },
  {
    slug: "kiro-service",
    name: "Kiro 辅助服务",
    platform: "kiro",
    deliveryType: "辅助服务",
    summary: "协助开通/充值、自助退款、注册导入教程等；加油包归额度充值，Claude-Kiro 归 Claude 中转",
  },
  // Claude 渠道类型：成品账号 · 接码/验证 · 订阅/会员 · 中转服务 · 辅助服务
  {
    slug: "claude-account",
    name: "Claude 普号 / 兑换号",
    platform: "claude",
    deliveryType: "成品账号",
    summary: "Claude 普号、free 号、礼品卡兑换专用号",
  },
  {
    slug: "claude-kyc",
    name: "Claude KYC 认证",
    platform: "claude",
    deliveryType: "接码/验证",
    summary:
      "独立渠道：Persona/人脸/实名/批量过 KYC 认证服务；已过·免 KYC 的成品号归账号/订阅，代提链归辅助服务",
  },
  {
    slug: "claude-pro-month",
    name: "Claude Pro",
    platform: "claude",
    deliveryType: "订阅/会员",
    summary: "Claude Pro 订阅、直充或卡密",
  },
  {
    slug: "claude-max-5x",
    name: "Claude Max 5x",
    platform: "claude",
    deliveryType: "订阅/会员",
    summary: "Claude Max 5x 官方套餐、账号或代开",
  },
  {
    slug: "claude-max-20x",
    name: "Claude Max 20x",
    platform: "claude",
    deliveryType: "订阅/会员",
    summary: "Claude Max 20x 官方套餐、账号或代开",
  },
  {
    slug: "claude-team-premium",
    name: "Claude Team Premium",
    platform: "claude",
    deliveryType: "订阅/会员",
    summary: "Claude Team 高级席位、Premium seat 或 6.25x 团队订阅",
  },
  {
    slug: "claude-team-standard",
    name: "Claude Team Standard",
    platform: "claude",
    deliveryType: "订阅/会员",
    summary: "Claude Team 标准席位、Standard seat 或 1.25x 团队订阅",
  },
  {
    // Claude-Kiro / Claude API KEY / Claude code 刀额度号池等 —— 卖的是 Claude 调用，不是 Kiro IDE
    slug: "claude-mirror",
    name: "Claude 镜像 / 中转服务",
    platform: "claude",
    deliveryType: "中转服务",
    summary:
      "Claude-Kiro 反代、Claude API KEY、Claude code 刀额度/日周卡、Claude 号池等；多模型合池仍归 ChatGPT 中转",
  },
  {
    slug: "claude-service",
    name: "Claude 辅助服务",
    platform: "claude",
    deliveryType: "辅助服务",
    summary:
      "协助充值、自助退款、教程、代提链等；不含 Claude KYC 认证（认证一律归接码/验证）",
  },
  {
    slug: "gemini-year",
    name: "Gemini Pro 成品号 / 年卡",
    platform: "gemini",
    deliveryType: "成品账号",
    summary: "Gemini Pro / Google AI Pro 年卡·月卡成品号、Pixel、老邮箱直登等；不含家庭组席位自助邀请",
  },
  {
    slug: "gemini-recharge",
    name: "Gemini Pro 充值 / 开通",
    platform: "gemini",
    deliveryType: "充值/开通",
    summary: "官网代充、CDK、兑换/激活/订阅链接（充自己号）；与成品号、Ultra 订阅档分开",
  },
  {
    slug: "gemini-ultra",
    name: "Google AI Ultra / Gemini Ultra",
    platform: "gemini",
    deliveryType: "订阅/会员",
    summary: "Gemini Ultra / Google AI Ultra 个人版或订阅档；家庭组车位/自助邀请归周边自助",
  },
  {
    slug: "gemini-pro",
    name: "Gemini Pro（未分档）",
    platform: "gemini",
    deliveryType: "订阅/会员",
    summary:
      "无法判定年卡/充值/Ultra 的 Gemini 兜底（含 Flow 积分号等）；卡网暂无 AI 点数代充货，不做额度充值档",
  },
  {
    slug: "gemini-mirror",
    name: "Gemini 镜像 / 中转服务",
    platform: "gemini",
    deliveryType: "中转服务",
    summary:
      "Gemini 网页镜像、官网 API KEY、号池站直连等；多模型合池仍归 ChatGPT 中转；成品号里的反重力·反代说明不算中转",
  },
  {
    slug: "gemini-service",
    name: "Gemini 周边与自助服务",
    platform: "gemini",
    deliveryType: "辅助服务",
    summary:
      "家庭组席位/拼车/自动邀请（自备 Google 号入组）、协助开通、自助退款、教程等；不含成品号与兑换链接主卖",
  },
  // Grok：对照公开比价档位 / The X Subscription（2026-10）
  // 类型：成品账号 / 订阅/会员 / 辅助服务
  // 档位：普号 → Plus($8·原 Lite) → Premium($30·原 SuperGrok) → Super($100·原 Plus) → Ultra($200·原 Heavy)
  {
    slug: "grok-account",
    name: "Grok 普号 / 体验号",
    platform: "grok",
    deliveryType: "成品账号",
    summary: "普通账号 / 体验",
  },
  {
    slug: "grok-plus",
    name: "Grok Plus",
    platform: "grok",
    deliveryType: "订阅/会员",
    summary: "Plus / 8 刀 · 原 SuperGrok Lite",
  },
  {
    slug: "grok-premium",
    name: "Grok Premium",
    platform: "grok",
    deliveryType: "订阅/会员",
    summary: "Premium / 30 刀 · 原 SuperGrok",
  },
  {
    slug: "grok-super",
    name: "Grok Super",
    platform: "grok",
    deliveryType: "订阅/会员",
    summary: "Super / 100 刀 · 原 SuperGrok Plus",
  },
  {
    slug: "grok-ultra",
    name: "Grok Ultra",
    platform: "grok",
    deliveryType: "订阅/会员",
    summary: "Ultra / 200 刀 · 原 SuperGrok Heavy",
  },
  {
    slug: "grok-service",
    name: "Grok 辅助服务",
    platform: "grok",
    deliveryType: "辅助服务",
    summary: "日/周卡、协助充值、自助退款、教程等；独立接码归接码页",
  },
  // X 订阅档：挂 Grok 板块、排在全部 Grok 档位之后；卡片主标 / 角标用 X logo
  {
    slug: "x-twitter-premium",
    name: "X Premium",
    platform: "grok",
    deliveryType: "订阅/会员",
    summary: "Premium · 纯推特会员（未捆绑 Grok）",
  },
  {
    slug: "x-twitter-premium-plus",
    name: "X Premium+",
    platform: "grok",
    deliveryType: "订阅/会员",
    summary: "Premium+ · 纯推特会员增强档（未捆绑 Grok）",
  },
  // 接码：对照公开比价五档 —
  // openai-phone-verification / paypal / google / phone-verification / identity-verification
  {
    slug: "sms-openai",
    name: "OpenAI / ChatGPT 接码",
    platform: "sms",
    deliveryType: "接码/验证",
    summary: "Codex / ChatGPT / Plus / OpenAI 手机短信接码；成品号「已/未接码」不归此档",
  },
  {
    slug: "sms-paypal",
    name: "PayPal 接码",
    platform: "sms",
    deliveryType: "接码/验证",
    summary: "PayPal 一次性或长效短信接码",
  },
  {
    slug: "sms-google",
    name: "Google / Gemini 接码",
    platform: "sms",
    deliveryType: "接码/验证",
    summary: "Google / Gmail / YouTube / Gemini 短信或邮箱收码",
  },
  {
    slug: "sms-generic",
    name: "通用接码",
    platform: "sms",
    deliveryType: "接码/验证",
    summary: "微软 / Cursor / Claude SMS / Meta 等未单列品牌的短信接码",
  },
  {
    slug: "sms-kyc",
    name: "真人 / KYC 验证",
    platform: "sms",
    deliveryType: "接码/验证",
    summary: "非 Claude 的 Persona / Cyber / 真人 KYC；Claude KYC 仍挂 Claude 页",
  },
  // 邮箱：对照公开比价 — Gmail / Outlook / iCloud / 教育 / 其他
  {
    slug: "gmail-account",
    name: "Gmail / Google 邮箱",
    platform: "email",
    deliveryType: "邮箱/账号",
    summary: "纯 Gmail、谷歌邮箱、Google 账号；企业 Edu 谷歌后缀仍归此档",
  },
  {
    slug: "outlook-account",
    name: "Outlook / Hotmail 邮箱",
    platform: "email",
    deliveryType: "邮箱/账号",
    summary: "Outlook / Hotmail / 微软邮箱令牌号、OAuth2 / Graph / IMAP",
  },
  {
    slug: "icloud-email",
    name: "iCloud 邮箱",
    platform: "email",
    deliveryType: "邮箱/账号",
    summary: "iCloud / 苹果隐私邮箱、取码 URL；GPT 成品号附带 iCloud 不归此档",
  },
  {
    slug: "education-email",
    name: "教育邮箱",
    platform: "email",
    deliveryType: "邮箱/账号",
    summary: "edu / 校友 / 大学教育邮箱短租或长效；企业 Edu 谷歌账号仍归 Gmail",
  },
  {
    slug: "email-account",
    name: "其他邮箱",
    platform: "email",
    deliveryType: "邮箱/账号",
    summary: "Mail.com、163、域名邮箱、人机邮箱等未分品牌号源",
  },
  // 其他：对照参考站（不含 Cursor/Kiro/Windsurf/X——已独立或挂 Grok）
  {
    slug: "perplexity-account",
    name: "Perplexity 账号",
    platform: "other",
    deliveryType: "工具账号",
    summary: "Perplexity Pro 月卡 / 自助充值等",
  },
  {
    slug: "suno-account",
    name: "Suno 账号",
    platform: "other",
    deliveryType: "工具账号",
    summary: "Suno Pro / Premier 订阅或成品",
  },
  {
    slug: "muse-ai-account",
    name: "Muse AI 账号",
    platform: "other",
    deliveryType: "工具账号",
    summary: "Muse 成品号 / 邀请码（对标 SuperGrok 文案仍归此档）",
  },
  {
    slug: "dreamina-account",
    name: "Dreamina / 即梦",
    platform: "other",
    deliveryType: "工具账号",
    summary: "即梦会员、Seedance 算力 / 视频生成渠道",
  },
  {
    slug: "duolingo-super",
    name: "多邻国 Super 会员",
    platform: "other",
    deliveryType: "订阅/会员",
    summary: "Duolingo Super 超级会员",
  },
  {
    slug: "apple-id-account",
    name: "Apple ID / 苹果账号",
    platform: "other",
    deliveryType: "工具账号",
    summary: "各区 Apple ID / 美区港区日区等；含密保 / 小火箭成品",
  },
  {
    slug: "telegram-account",
    name: "Telegram 账号",
    platform: "other",
    deliveryType: "工具账号",
    summary: "TG / 电报成品号、直登号、协议号",
  },
  {
    slug: "telegram-premium",
    name: "Telegram Premium / Pro 会员",
    platform: "other",
    deliveryType: "订阅/会员",
    summary: "电报 Premium / Stars 会员代开",
  },
  {
    slug: "virtual-card",
    name: "虚拟卡",
    platform: "other",
    deliveryType: "虚拟卡",
    summary: "VISA / MasterCard 0 刀或虚拟卡号",
  },
  {
    slug: "gift-card",
    name: "礼品卡",
    platform: "other",
    deliveryType: "礼品卡",
    summary: "Apple / ChatGPT / Claude 等礼品卡；不是账号成品",
  },
  {
    slug: "other-product",
    name: "其他商品",
    platform: "other",
    deliveryType: "其他",
    summary: "售前说明、杂项工具等未单列商品",
  },
];

/** 旧 Grok / Kiro slug → 新档位（catalog / raw 兼容） */
export const LEGACY_PRODUCT_SLUG_MAP = {
  "super-grok": "grok-premium",
  "super-grok-heavy": "grok-ultra",
  "kiro-account": "kiro-free-account",
  "kiro-pro-account": "kiro-pro",
  // Flow 积分号曾误挂额度充值；卡网无 AI 点数代充货，归未分档
  "gemini-quota-recharge": "gemini-pro",
  // 接码：旧笼统档 + 参考站 slug → 本站五档
  "sms-verification": "sms-generic",
  "openai-phone-verification": "sms-openai",
  "paypal-phone-verification": "sms-paypal",
  "google-phone-verification": "sms-google",
  "phone-verification": "sms-generic",
  "identity-verification": "sms-kyc",
};

function matches(value, needles) {
  return needles.some((n) => value.includes(String(n).toLowerCase()));
}

/** 参考站-style title normalize (typos, separators, brand aliases). */
function normalizeTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/美國/g, "美国")
    .replace(/虛擬/g, "虚拟")
    .replace(/[×✕✖✘]/g, "x")
    .replace(/[＄￥]/g, "$")
    .replace(/[\ufe0e\ufe0f]/g, "")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/[｜|/【】[\]()（）,，:：\-_/–—]+/g, " ")
    .replace(/gptplus/g, "gpt plus")
    .replace(/\bgplus\b/g, "gpt plus")
    .replace(/g\s*plus/g, "gpt plus")
    .replace(/plus月卡/g, "plus 月卡")
    .replace(/普拉斯/g, "plus")
    .replace(/\bpuls\b/g, "plus")
    .replace(/\bpulus\b/g, "plus")
    .replace(/\bgemin\b/g, "gemini")
    .replace(/geminipro/g, "gemini pro")
    .replace(/\bulrta\b/g, "ultra")
    .replace(/\bgtp\b/g, "gpt")
    // G.PT / GJ.PT / GJPT 破甲工具等马赛克写法 → gpt
    .replace(/\bgj\.?\s*pt\b/g, "gpt")
    .replace(/\bg\.?\s*pt\b/g, "gpt")
    .replace(/\bgjpt\b/g, "gpt")
    .replace(/\bgmai\b/g, "gmail")
    .replace(/谷歌gmai/g, "谷歌gmail")
    .replace(/\bcoedx\b/g, "codex")
    .replace(/\bcluade\b/g, "claude")
    .replace(/\bbusisness\b/g, "business")
    .replace(/chat\s*gpt/g, "chatgpt")
    .replace(/claude\s*code/g, "claude code")
    // Grok 变体写法：gr.ok / g/rok / gr-ok / g.rok / g r o k / gro_k / 单写 gro
    .replace(/(?<![a-z])g[\s._\/\-]{0,2}r[\s._\/\-]{0,2}[o0][\s._\/\-]{0,2}k(?![a-z])/g, "grok")
    .replace(/(?<![a-z])gro(?![a-z0-9])/g, "grok")
    .replace(/supergro[\s\-]*k/g, "supergrok")
    .replace(/gro[\s\-]+k/g, "grok")
    .replace(/supergrokplus/g, "super grok plus")
    .replace(/supergroklite/g, "super grok lite")
    .replace(/supergrokheavy/g, "super grok heavy")
    .replace(/supergrok/g, "super grok")
    .replace(/supergro\b/g, "super grok")
    .replace(/\bgro\s+super\s+heavy\b/g, "grok ultra")
    .replace(/\bgro\s+heavy\b/g, "grok heavy")
    // 卡网中文别名：格洛克/超级格洛克就是 Grok；只把带会员语义的「马斯克」别名归一化，
    // 避免商品描述里随口提到马斯克时把无关商品误归到 Grok。
    .replace(/格洛克/g, "grok")
    .replace(
      /马斯克(?=\s*(?:\d+(?:\.\d+)?\s*(?:美金|美元|刀|\$)\s*)?(?:plus|会员|订阅|充值|代充|cdk|卡密))/g,
      "grok",
    )
    .replace(/(接|收|来)\s*[🐎🐴🦆鸭马]/g, "$1码")
    .replace(/\s+/g, " ")
    .trim();
}

function hasNearbyNegation(value, signalPattern) {
  const scoped = new RegExp(`(?:非|不是|不含)\\s*(?:[^\\s]{1,8}\\s+)?${signalPattern}`, "i");
  const direct = new RegExp(`(?:无\\s*|not\\s+)${signalPattern}`, "i");
  return scoped.test(value) || direct.test(value);
}

/* ---------- warranty (参考站 warranty_long) ---------- */

function hasBlockingNoWarrantySignal(text) {
  const cleaned = text.replace(
    /不质保(?:封号|封禁|被封|账号|账户)|封号(?:不质保|无质保|不保|不售后|不在售后范围)|封禁(?:不质保|无质保|不保|不售后|不在售后范围)|不保(?:封号|封禁|被封|账号|账户)|不管(?:封号|封禁|被封)|封号不管/g,
    "",
  );
  return /无.{0,4}质保|没.{0,4}质保|不质保|不保|不售后|售后不管|一律不售后|无售后|不作售后条件|不做售后|不管售后/.test(
    cleaned,
  );
}

function hasFirstActionWarrantySignal(text) {
  return /质保首登|保首登|包首登|首登质保|首次登录|首次登陆|质保首次|质保购买一小时内首登|质保\d+h?内首登|质保[一二三四五六七八九十]+小时内首登|质保上车|只质保上车|仅质保上车|包上车|保上车|上车质保|质保登上|质保登录|质保登陆|质保直登|质保首登成功/.test(
    text,
  );
}

function hasShortWarrantySignal(text) {
  return /质保(?:[1-9]|1[0-4]|一|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四)天|(?:^|[^0-9])(?:[1-9]|1[0-4])天质保|(?:一|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四)天质保|质保(?:一周|1周|两周|2周|二周)|(?:一周|1周|两周|2周|二周)质保|7天售后|七天售后|质保\d{1,2}h|质保(?:24|48|72)小时|质保\d+小时|\d+h质保|\d+小时质保|质保(?:1|2|3|4|5|6|7|8|9|一|二|三|四|五|六|七|八|九)次|质保额度|质保不来码|质保开通|仅质保开通|只质保开通|质保充值成功|质保激活成功|质保到手/.test(
    text,
  );
}

function hasLongWarrantySignal(text) {
  return /质保(?:1[5-9]|[2-9]\d|[1-9]\d{2,})天|(?:1[5-9]|[2-9]\d|[1-9]\d{2,})天质保|质保(?:十五|二十|二十五|二十八|三十|一百八十)天|(?:十五|二十|二十五|二十八|三十|一百八十)天质保|质保(?:半个月|一个月|1个月|一月|整月|两个月|2个月|二个月|三个月|3个月|一年|1年|12个月|180天)|(?:半个月|一个月|1个月|一月|整月|两个月|2个月|二个月|三个月|3个月|一年|1年|12个月|180天)质保|全程质保|全程保|质保全程|包月售后|包月质保|质保包月|质保订阅|保订阅|掉订阅质保|质保掉订阅|质保封号/.test(
    text,
  );
}

/** Align with 参考站: only long warranty counts toward「有质保最低」. */
export function isLongWarrantyTitle(title) {
  const text = normalizeTitle(title);
  if (!text) return false;
  if (hasBlockingNoWarrantySignal(text)) return false;
  if (hasFirstActionWarrantySignal(text)) return false;
  if (hasShortWarrantySignal(text) && !hasLongWarrantySignal(text)) return false;
  return hasLongWarrantySignal(text);
}

/* ---------- shared signals ---------- */

function hasAccountBundleSignal(value) {
  return matches(value, [
    "成品号",
    "半成品",
    "账号",
    "账户",
    "账密",
    "plus",
    "pro",
    "team",
    "business",
    "月卡",
    "年卡",
    "12个月",
    "一年",
    "会员",
    "订阅",
  ]);
}

function hasAccountOrSubscriptionDeliverySignal(value) {
  return matches(value, [
    "成品号",
    "库存号",
    "账号",
    "账户",
    "账密",
    "首登",
    "直登",
    "质保首登",
    "老邮箱",
    "已验证",
    "月卡",
    "年卡",
    "会员",
    "订阅",
    "直充",
    "代充",
    "卡密",
    "自助开通",
    "自动发货",
    "接码",
    "带rt",
    "带 rt",
    "导入中转站",
    "直接导入",
  ]);
}

function isAiSubscriptionOrAccountTitle(value) {
  if (!matches(value, ["chatgpt", "gpt", "openai", "codex", "claude", "gemini", "grok", "plus", "team", "business"])) {
    return false;
  }
  return matches(value, [
    "plus",
    "pro",
    "team",
    "business",
    "free",
    "普号",
    "白号",
    "普通号",
    "普通账号",
    "成品号",
    "账号",
    "兑换号",
    "cdk",
    "直充",
    "充值",
    "卡密",
    "月卡",
    "会员",
  ]);
}

function isPriceAdjustmentListing(value) {
  if (matches(value, ["定金", "订金", "占位价", "占位链接", "改价专用", "拍下改价"])) return true;
  if (
    matches(value, [
      "无需补差价",
      "无须补差价",
      "不需补差价",
      "不需要补差价",
      "不用补差价",
      "无需补差",
      "无需补款",
      "无须补款",
      "不需补款",
      "不需要补款",
      "不用补款",
    ])
  ) {
    return false;
  }
  return matches(value, ["补差价", "补差链接", "差价链接", "补款", "补款链接", "补拍"]);
}

function isMirrorSiteProduct(value) {
  if (!matches(value, ["镜像站", "网页镜像", "镜像", "mirror"])) return false;
  return matches(value, ["chatgpt", "gpt", "openai", "plus", "claude", "gemini", "grok"]);
}

/** GPT 镜像/网页中转（非 API 号池）；归入「中转服务」标准品。 */
function isChatGptMirrorTransit(value) {
  if (isApiCredit(value) || isApiProductCoreSignal(value)) return false;
  if (matches(value, ["号池", "api额度", "api 额度", "中转余额", "中转api", "中转 api"])) return false;
  const mirror = matches(value, ["镜像站", "网页镜像", "镜像", "mirror"]);
  const webShare =
    matches(value, ["网页中转", "共享中转", "中转站"]) &&
    matches(value, ["天卡", "周卡", "日卡", "小时", "共享", "镜像"]);
  if (!mirror && !webShare) return false;
  // Claude/Gemini/Grok 镜像仍走各品牌标准品
  if (matches(value, ["claude", "gemini", "grok", "super grok"]) && !matches(value, ["chatgpt", "gpt", "openai", "plus"])) {
    return false;
  }
  return matches(value, ["chatgpt", "gpt", "openai", "plus", "codex"]);
}

/* ---------- verification / SMS ---------- */

/** Ignore account status, bundled links and negative promises when identifying what is sold. */
function standalonePhoneDeliveryText(value) {
  return value
    .replace(/(?:已完成|已经|已|尚未|未|没|需要\s*自己|需要\s*自行|自己|自行|无需|无须|不需要|需)\s*(?:手机\s*)?接码/g, " ")
    .replace(/(?:不质保|不保|不管|不支持|不含|无需|无须)\s*(?:(?:codex|chatgpt|openai|gpt|plus)\s*)?(?:短信\s*)?接码(?:服务)?/g, " ")
    .replace(/(?:包含|包括|附赠|自带|带|附)\s*(?:电话\s*)?(?:长效\s*|长期\s*)?接码(?:地址|链接)/g, " ");
}

/** Concrete account delivery evidence. Plus/Pro/channel/validity alone is not an account. */
function hasConcretePhoneAccountBundle(value) {
  const accountText = value
    // "最多绑定三个账号" describes phone capacity, not delivery of three accounts.
    .replace(/(?:最多(?:能)?\s*)?(?:可|能)?\s*(?:绑定|接|接收)\s*[\d一二两三四五六七八九十]+(?:\s*[~～至到-]\s*[\d一二两三四五六七八九十]+)?\s*(?:个)?\s*(?:账号|账户|号)/g, " ")
    .replace(/(?:可接|能接)\s*[\d一二两三四五六七八九十]+\s*次\s*(?:同一|不同)?\s*(?:账号|账户)/g, " ")
    .replace(/\b(?:rt|json)\s*渠道/g, " ")
    .replace(/(?:不是|非|不含|不提供|不卖)\s*(?:成品(?:账号|号)?|账号|账户|账密)/g, " ");
  return /成品|账号|账户|账密|张密|密码|首登|直登|网页号|日抛|车位|席位|代充|充值|(?:带|发|交付)\s*(?:rt|json)|(?:rt|json)\s*(?:格式|交付|发货)/.test(accountText);
}

/** Standalone phone rental / SMS delivery: duration and target plan must not imply subscription. */
function hasStandalonePhoneDeliverySignal(value) {
  const delivery = standalonePhoneDeliveryText(value);
  if (hasConcretePhoneAccountBundle(value)) return false;
  return /(?:长效|长期|短效|短信|实卡|实体卡|独立|自助|无限)\s*接码|\d+\s*天\s*(?:无限\s*)?接码|接码\s*(?:服务|手机号|号码)|质保不来码|(?:接码|收码).{0,24}(?:绑定|可接)\s*[\d一二两三四五六七八九十]/.test(delivery) ||
    (matches(delivery, ["实卡", "实体卡", "手机号", "电话号码"]) && matches(delivery, ["接码", "收码"]));
}

function isBundledVerificationAccount(value) {
  if (isExplicitVerificationServiceDelivery(value)) return false;
  if (
    hasAccountBundleSignal(value) &&
    matches(value, ["接码", "收码", "验证码", "手机号", "手机号码", "手机验证"])
  ) {
    return true;
  }
  return matches(value, [
    "已接码",
    "已经接码",
    "已完成接码",
    "已手机接码",
    "已接码验证",
    "已手机接码验证",
    "未接码",
    "没接码",
    "自行接码",
    "自己接码",
    "需要自己接码",
    "需要自行接码",
    "codex自己接码",
    "需接码",
    "需使用自行接码",
    "不需要手机验证接码",
    "不需要手机验证",
    "无需手机验证",
    "带接码地址",
    "带接码链接",
    "带电话接码链接",
    "原始接码链接",
    "接码链接",
    "长效接码链接",
    "包含长效接码",
  ]);
}

/** 参考站 hasIdentityVerificationSignal */
function hasIdentityVerificationSignal(value) {
  return (
    matches(value, ["kyc", "人脸验证", "真人认证", "实名认证"]) ||
    /(^|[^a-z])persona([^a-z]|$)/.test(value)
  );
}

/**
 * 已过/免 KYC 的账号成品、订阅标题不算「KYC 认证服务」。
 * 注意：禁止裸匹配「过kyc」——「批量过KYC / 接批量过」是认证服务本身，不是已过 KYC 的成品号。
 */
function hasIdentityVerificationBundleSignal(value) {
  const alreadyOrExemptKyc = matches(value, [
    "已过kyc",
    "已过 kyc",
    "以过kyc",
    "以过 kyc",
    "免kyc",
    "免 kyc",
    "免过kyc",
    "免过 kyc",
    "已完成kyc",
    "已完成 kyc",
    "已完成真人",
    "已过真人",
  ]);
  const accountOrSubBundle = matches(value, [
    "成品号",
    "成品账号",
    "账号",
    "账户",
    "子号",
    "max",
    "pro",
    "team",
    "plus",
    "会员",
    "订阅",
    "月卡",
    "年卡",
  ]);
  // 已过/免 KYC → 描述的是成品状态，不是「帮你做认证」
  if (alreadyOrExemptKyc) return true;
  // 账号/订阅主卖仍排除纯 KYC；明确「KYC 认证服务/批量过」除外
  if (accountOrSubBundle && !isClaudeKycServiceDelivery(value)) return true;
  return false;
}

/**
 * Claude KYC 认证服务（独立渠道 claude-kyc / 接码/验证）。
 * 卖的是「帮你过 Persona/人脸/实名」，不是已过·免 KYC 的账号，也不是代提链辅助。
 */
function isClaudeKycServiceDelivery(value) {
  if (
    matches(value, [
      "代提链",
      "提链接",
      "提链",
      "kyc链接",
      "kyc 链接",
      "提取kyc",
      "提取 kyc",
    ])
  ) {
    return false;
  }
  // 「免KYC认证 / 已过KYC」是成品属性，子串会撞上「kyc认证」，必须先排除
  if (
    matches(value, [
      "免kyc",
      "免 kyc",
      "免过kyc",
      "已过kyc",
      "已过 kyc",
      "以过kyc",
      "以过 kyc",
      "已完成kyc",
      "已完成 kyc",
      "已完成真人",
      "已过真人",
    ])
  ) {
    return false;
  }
  return matches(value, [
    "kyc认证",
    "kyc 认证",
    "认证服务",
    "代认证",
    "批量过kyc",
    "批量过 kyc",
    "接批量过",
    "批量过认证",
    "人脸验证",
    "真人认证",
    "实名认证",
    "主动触发",
  ]);
}

/** 参考站 isIdentityVerificationService */
function isIdentityVerificationService(value) {
  if (!hasIdentityVerificationSignal(value)) return false;
  // KYC 代提链 / 提取链接 → Claude 辅助服务，不是真人过认证
  if (
    matches(value, [
      "代提链",
      "提链接",
      "提链",
      "kyc链接",
      "kyc 链接",
      "提取kyc",
      "提取 kyc",
    ])
  ) {
    return false;
  }
  // 已过/免 KYC 成品 → 不是认证服务
  if (hasIdentityVerificationBundleSignal(value) && !isClaudeKycServiceDelivery(value)) {
    return false;
  }
  // 明确「KYC 认证服务 / 批量过」→ 独立认证渠道（可压过标题里顺带的 pro/账号弱信号）
  if (isClaudeKycServiceDelivery(value)) return true;
  return !hasIdentityVerificationBundleSignal(value);
}

/** PayPal 接码（对照参考站 paypal-phone-verification） */
function isPaypalPhoneVerification(value) {
  return matches(value, ["paypal", "pay pal"]);
}

/**
 * Google / Gmail / YouTube / Gemini 接码（对照参考站 google-phone-verification）。
 * 标题带「注册 openai 专用」仍归 Google（参考站如此）。
 */
function isGooglePhoneVerification(value) {
  if (
    matches(value, [
      "google接码",
      "google 接码",
      "google接马",
      "google 接马",
      "gmail接码",
      "gmail 接码",
      "gmail接马",
      "gmail 接马",
      "谷歌接码",
      "谷歌接马",
      "谷歌验证码",
      "gemini 接码",
      "gemini接码",
      "gemini 接马",
      "gemini接马",
      "youtube接码",
      "youtube 接码",
      "youtube接马",
      "youtube 接马",
      "google/gmail",
      "gmail/youtube",
      "google、gmail",
      "google，gmail",
    ])
  ) {
    return true;
  }
  if (
    matches(value, ["gmail", "google", "谷歌邮箱", "谷歌"]) &&
    matches(value, ["接码", "接马", "验证码", "收码", "来码"])
  ) {
    return true;
  }
  return false;
}

/** OpenAI / ChatGPT / Codex / Plus 接码（对照参考站 openai-phone-verification） */
function isOpenaiPhoneVerification(value) {
  if (isPaypalPhoneVerification(value) || isGooglePhoneVerification(value)) return false;
  if (matches(value, ["cursor", "claude", "kiro", "grok"]) && !matches(value, ["openai", "chatgpt", "codex", "gpt"])) return false;
  if (isCodexPhoneVerification(value)) return true;
  if (
    matches(value, [
      "codex接码",
      "codex 接码",
      "codex接马",
      "codex 接马",
      "openai接码",
      "openai 接码",
      "openai接马",
      "chatgpt接码",
      "chatgpt 接码",
      "gpt接码",
      "gpt 接码",
      "plus接码",
      "plus 接码",
      "plus接马",
      "plus 接马",
    ])
  ) {
    return true;
  }
  return (
    (matches(value, ["openai", "chatgpt", "codex", "gpt"]) || /(^|[^a-z])plus([^a-z]|$)/.test(value)) &&
    matches(value, ["接码", "接马", "验证码", "收码", "来码", "手机号", "实卡"])
  );
}

/**
 * 接码/验证分流（对照 参考站 classifyVerificationService + 五档 slug）。
 * Claude KYC → claude-kyc；其余按 PayPal → Google → OpenAI → 通用 / KYC。
 */
function classifyVerificationService(value) {
  if (isIdentityVerificationService(value) && isClaudeProduct(value)) {
    return "claude-kyc";
  }
  if (isIdentityVerificationService(value)) {
    return "sms-kyc";
  }
  if (isPaypalPhoneVerification(value)) return "sms-paypal";
  if (isGooglePhoneVerification(value)) return "sms-google";
  if (isOpenaiPhoneVerification(value)) return "sms-openai";
  return "sms-generic";
}

function isStandaloneVerificationService(value) {
  // 对齐 参考站 isStandaloneVerificationService：禁止「实卡渠道 + 未接码」误伤 Plus 成品
  if (isIdentityVerificationService(value)) return true;
  if (hasStandalonePhoneDeliverySignal(value)) return true;
  // Do not let "已/未接码、支持收码、不保接码" override actual account delivery.
  const delivery = standalonePhoneDeliveryText(value);
  if (hasConcretePhoneAccountBundle(value) && !/单次接码|一次性接码|一次性验证/.test(delivery)) {
    return false;
  }
  value = delivery;
  if (matches(value, ["接码自助", "接码 自助", "接码自助卡密", "手机接码自助", "手机接码 自助"])) {
    return true;
  }
  if (matches(value, ["sms 接码", "短信接码", "短信 接码", "实卡接码", "实体卡接码", "短效接码", "短效 接码", "收码", "质保不来码"])) {
    return true;
  }
  if (matches(value, ["单次接码", "一次性接码", "一次性验证"])) return true;
  if (
    matches(value, ["手机接码", "手机号验证", "手机验证"]) &&
    matches(value, ["号码", "实卡", "自助卡密", "质保1次成功接码"])
  ) {
    return true;
  }
  if (matches(value, ["手机接码"]) && matches(value, ["可绑定", "绑定 3 个", "绑定3个"])) {
    return true;
  }
  if (
    matches(value, ["长效接码", "长期接码", "长效接马", "长期接马"]) &&
    !hasAccountBundleSignal(value) &&
    !matches(value, ["成品号", "成品账号", "账密"])
  ) {
    return true;
  }
  if (
    matches(value, [
      "codex接码",
      "codex 接码",
      "gpt codex 接码",
      "gpt codex接码",
      "openai codex 接码",
      "openai codex接码",
      "gemini 接码",
      "claude 接码",
      "google接码",
      "google 接码",
      "谷歌接码",
      "gmail接码",
      "gmail 接码",
      "专用gmail接码",
      "专用 gmail 接码",
    ]) &&
    !hasAccountBundleSignal(value) &&
    !/不保\s*codex\s*接码|不保\s*接码|不管\s*codex\s*接码|不质保\s*接码/.test(value)
  ) {
    return true;
  }
  // 「PLUS接码/接马」：卖的是接码能力，不是 Plus 成品（标题常带 Plus/GPT 关键词）
  if (
    matches(value, ["plus接码", "plus 接码", "plus接马", "plus 接马"]) &&
    !matches(value, ["成品号", "成品账号", "账密", "独享账号", "渠道", "rt", "json", "首登", "直登"])
  ) {
    return true;
  }
  // 卖接码手机号 / 可接 N 个号（不是 Plus 成品；标题可带 G Plus 等品牌词）
  if (
    matches(value, [
      "接码手机号",
      "接马手机号",
      "接码号码",
      "接马号码",
      "手机号可接",
      "可接1",
      "可接 1",
      "可接2",
      "可接 2",
      "可接3",
      "可接 3",
      "可接1~",
      "可接1-",
      "可接1—",
    ]) &&
    matches(value, ["接码", "接马", "手机号", "号码"]) &&
    !matches(value, ["成品号", "成品账号", "账密", "独享账号", "rt", "json", "首登", "直登", "月卡", "订阅"])
  ) {
    return true;
  }
  return false;
}

function isExplicitVerificationServiceDelivery(value) {
  if (!matches(value, ["接码服务", "取号", "取号服务", "短信服务", "手机号服务", "号码服务"])) {
    return false;
  }
  return !matches(value, [
    "成品号",
    "成品账号",
    "账号",
    "账户",
    "会员",
    "订阅",
    "月卡",
    "年卡",
    "直充",
    "代充",
    "卡密",
    "自助开通",
    "自动发货",
  ]);
}

function isCodexPhoneVerification(value) {
  if (!matches(value, ["codex"])) return false;
  if (isAiSubscriptionOrAccountTitle(value)) return false;
  if (hasAccountBundleSignal(value)) return false;
  return matches(value, ["接码", "验证码", "短信", "手机号", "手机", "号码", "2fa", "二验", "验证"]);
}

function isVerificationService(value) {
  if (isStandaloneVerificationService(value)) return true;
  if (isBundledVerificationAccount(value)) return false;
  if (isExplicitVerificationServiceDelivery(value)) return true;
  if (isAiSubscriptionOrAccountTitle(value)) return false;
  if (matches(value, ["接码", "收码", "短信验证", "验证码", "手机号验证", "手机验证", "一次性验证", "单次接码"])) {
    return true;
  }
  return matches(value, ["验证"]) && matches(value, ["手机号", "手机号码", "短信", "接码"]);
}

/* ---------- ChatGPT peripheral / API ---------- */

function isChatGptPaymentLinkExtractionService(value) {
  const hasPay = matches(value, ["upi", "ideal", "i deal", "paypal", "荷兰渠道"]);
  const hasGpt = matches(value, [
    "chatgpt",
    "gpt",
    "openai",
    "plus",
    "team",
    "k12",
    "48team",
    "48 team",
    "codex",
  ]);
  if (!hasPay && !hasGpt) return false;
  return matches(value, [
    "提链",
    "提炼",
    "提取链接",
    "链接提取",
    "长链提取",
    "长链接提取",
    "代提长链接",
    "代提长链",
    "代提链接",
    "提长链接",
    "提长链",
    "支付长链",
    "支付长链提取",
    "teamlink",
    "team link",
    "team提链",
    "team 提链",
    "扫码对接",
    "提取upi支付二维码",
    "提取支付二维码",
    "支付二维码",
    "支付链接",
    "提链服务",
    "代付代扫",
    "代付服务",
    "代扫服务",
    "提取授权文件",
    "10秒提取",
  ]);
}

function isChatGptSelfServiceRecharge(value) {
  if (
    isChatGptGoProduct(value) ||
    isChatGptTeamDominant(value) ||
    isChatGptPro500(value) ||
    isChatGptPro20(value) ||
    isChatGptPro5(value)
  ) {
    return false;
  }
  if (matches(value, ["gemini", "google ai", "claude", "grok", "perplexity", "telegram", "twitter", "x premium"])) {
    return false;
  }
  // 含官方/正价信号的 Plus 充值不是「周边自助」，走正价代充
  if (isPlusOfficialRechargeExcludedFromPeripheral(value)) return false;
  if (!matches(value, ["chatgpt", "gpt", "openai", "plus", "kakao", "codex", "gplus", "g plus"])) {
    return false;
  }
  return matches(value, [
    "自助充值",
    "自助开通",
    "自助卡密",
    "卡密自助",
    "自助激活",
    "自动充值",
    "自动开通",
    "自动激活",
    "全自动充值",
    "全自动开通",
    "全自动激活",
  ]);
}

/** 参考站 周边说明：不含正价 Plus 充值（官方/正价/正规代充即便写了自助也不进周边） */
function isPlusOfficialRechargeExcludedFromPeripheral(value) {
  if (!matches(value, ["plus", "gplus", "g plus", "chatgpt", "gpt", "openai", "codex"])) {
    return false;
  }
  if (hasChatGptPlusRechargeOfficialDirectSignal(value)) return true;
  // 「官方渠道 + 充值/代充/自动充值」实质也是官方 Plus 充值面
  if (
    matches(value, ["官方渠道", "官网渠道"]) &&
    matches(value, ["充值", "代充", "直充", "自动充值", "自助充值", "cdk", "卡密"])
  ) {
    return true;
  }
  return false;
}

/** Codex/ChatGPT 好友邀请增额 — 周边服务，不是 Team 席位 */
function isChatGptInviteQuotaService(value) {
  if (matches(value, ["team", "business", "k12", "席位", "母号", "子号", "自动拉"])) {
    return false;
  }
  return (
    matches(value, [
      "好友邀请",
      "邀请好友",
      "邀请奖励",
      "邀请增额",
      "自助邀请",
      "卡密自助邀请",
      "邀请1次",
      "邀请一次",
    ]) ||
    (matches(value, ["邀请"]) && matches(value, ["额度增加", "增额", "额度奖励", "奖励"])) ||
    (matches(value, ["codex"]) && matches(value, ["邀请"]) && !matches(value, ["team", "plus 成品", "成品号"]))
  );
}

function isNegatedApiMention(value) {
  return /非\s*api|不是\s*api|无\s*api|不含\s*api/i.test(value);
}

function isApiProductCoreSignal(value) {
  if (isNegatedApiMention(value)) return false;
  return matches(value, [
    "apikey",
    "api key",
    "api-key",
    "codex api",
    "openai api",
    "chatgpt api",
    "gpt api",
    "中转api",
    "中转 api",
    "api中转",
    "api 中转",
    "中转余额",
    "中转站额度",
    "余额兑换码",
    "api 额度",
    "api额度",
  ]);
}

function hasMoneyAmount(value) {
  return matches(value, ["刀", "美元", "美金"]) || /\d+\s*\$/.test(value);
}

/** 官方 Pro/Plus 订阅代充（非额度中转）。 */
function isOfficialProOrPlusSubscriptionDelivery(value) {
  return matches(value, [
    "官方充值",
    "官网正规",
    "官网直充",
    "正规代充",
    "正规卡充",
    "正规充值",
    "正规卡付",
    "菲区卡充",
    "菲区订阅",
    "带账单",
    "可开发票",
    "ios嘿充",
    "美区ios",
    "正价充值",
    "官方订阅",
    "官方直充",
    "真实付费",
  ]);
}

function hasPositiveApiWord(value) {
  if (isNegatedApiMention(value)) return false;
  return (
    matches(value, [
      "apikey",
      "api key",
      "api-key",
      "codex api",
      "openai api",
      "chatgpt api",
      "gpt api",
      "中转api",
      "api中转",
      "api 额度",
      "api额度",
    ]) || /(^|[^a-z\u4e00-\u9fff])api([^a-z\u4e00-\u9fff]|$)/i.test(value)
  );
}

/** 参考站 hasExplicitApiProductSignal */
function hasExplicitApiProductSignal(value) {
  if (isNegatedApiMention(value) && !/openai-\d+-astra|image-[\d.]+-flare|倍率|号池/i.test(value)) {
    return false;
  }
  if (/(^|[^a-z])api([^a-z]|$).{0,12}\d+\s*(?:刀|美元|美金|\$)/.test(value)) return true;
  if (matches(value, ["apikey", "api key", "api-key"])) return true;
  if (matches(value, ["claude/gpt/gemini中转站", "中转余额", "中转 gpt", "api中转", "api 中转"])) return true;
  if (
    matches(value, ["中转"]) &&
    (matches(value, ["号池", "余额", "api", "额度"]) || hasMoneyAmount(value)) &&
    !hasAccountOrSubscriptionDeliverySignal(value)
  ) {
    return true;
  }
  if (matches(value, ["中转站"]) && !hasAccountOrSubscriptionDeliverySignal(value)) return true;
  if (matches(value, ["号池"]) && (matches(value, ["api", "codex", "额度", "余额", "中转"]) || hasMoneyAmount(value))) {
    return true;
  }
  if (
    /(?:总共|共)\s*\d+\s*(?:刀|美元|美金)/.test(value) &&
    matches(value, ["plus渠道", "plus 渠道", "plus号池", "plus 号池", "老plus渠道", "老 plus 渠道", "30天有效期"])
  ) {
    return true;
  }
  if (matches(value, ["中转api", "中转 api"])) return true;
  if (matches(value, ["兑换码"]) && matches(value, ["api", "额度", "100刀", "200刀", "300刀", "1000刀", "2100刀", "官方1:1"])) {
    return true;
  }
  if (matches(value, ["codexapi", "codex api", "codex 授权", "codex 授權"])) return true;
  if (matches(value, ["gpt api", "openai api", "geminiapi", "gemini api"])) return true;
  if (matches(value, ["api 额度", "api额度", "api 100刀", "api 50刀", "api 300刀"])) return true;
  if (matches(value, ["余额兑换", "余额 兑换", "倍率"])) return true;
  if (matches(value, ["余额充值", "充值余额", "美元额度", "美金额度", "刀额度"])) return true;
  return false;
}

/** @deprecated 逻辑并入 isKiroMirrorProduct；保留给 isApiCredit 兜底 */
function isKiroApiCreditProduct(value) {
  return isKiroMirrorProduct(value);
}

/**
 * 号池站国内直连 / 月会员兑换码 —— 中转面，不是 Plus 成品试用订阅。
 * 例：号池站 ChatGPT Plus国内直连-月会员兑换码【质保30天】
 */
function isChatGptPoolStationTransit(value) {
  if (!matches(value, ["chatgpt", "gpt", "openai", "plus", "gplus", "g plus", "g plus"])) {
    return false;
  }
  // 明确成品号/账密交付 → 仍归试用订阅
  if (
    matches(value, [
      "成品号",
      "成品账号",
      "独享成品",
      "独享账号",
      "账密",
      "首登",
      "直登",
      "已接码",
      "未接码",
      "日抛",
      "共享账号",
      "拼车",
    ])
  ) {
    return false;
  }
  const pool = matches(value, ["号池站", "号池"]);
  if (!pool) return false;
  if (matches(value, ["国内直连", "直连", "兑换码", "会员兑换码", "月会员兑换"])) return true;
  if (matches(value, ["国内"]) && matches(value, ["月会员", "兑换码"])) return true;
  return false;
}

function isModelPoolCreditProduct(value) {
  if (!matches(value, ["池", "号池", "pool"])) return false;
  if (!matches(value, ["claude", "gemini", "gpt", "chatgpt", "codex", "openai"])) return false;
  if (matches(value, ["team", "团队", "席位", "seat"])) return false;
  // 号池站国内直连兑换码：即便写「月会员」也是中转，不是订阅成品
  if (isChatGptPoolStationTransit(value)) return true;
  if (
    matches(value, ["号池站", "号池"]) &&
    matches(value, ["直连", "国内直连", "兑换码"]) &&
    !matches(value, ["成品号", "成品账号", "账密", "首登", "直登"])
  ) {
    return true;
  }
  if (
    isClaudeProduct(value) &&
    matches(value, ["max", "pro"]) &&
    !matches(value, ["月卡", "月会员", "年卡", "订阅", "成品号", "账号", "直充", "代充"])
  ) {
    return true;
  }
  if (matches(value, ["额度", "中转", "api", "刀", "美元", "美金", "余额"])) return true;
  if (matches(value, ["月会员", "会员兑换码", "月卡", "年卡", "订阅"])) return false;
  return matches(value, ["兑换码", "token"]);
}

function isClaudeCodeCreditProduct(value) {
  if (!matches(value, ["claude code"])) return false;
  return matches(value, ["每天", "有效期", "额度", "不限量额度"]) && hasMoneyAmount(value);
}

function isModelApiCreditProduct(value) {
  if (!matches(value, ["codex api", "openai api", "chatgpt api", "gpt api"])) return false;
  if (matches(value, ["余额兑换码", "余额 兑换码", "兑换码", "额度", "刀卡", "美元额度", "美金额度"])) return true;
  return /\d+\s*\$\s*余额/.test(value) || /\d+\s*\$\s*余额兑换码/.test(value);
}

function isChatGptAccountOrSubscriptionDominant(value) {
  if (!matches(value, ["chatgpt", "gpt", "openai", "plus"])) return false;
  if (
    matches(value, [
      "codex api",
      "api cdk",
      "api 额度",
      "api额度",
      "api中转",
      "api 中转",
      "充值余额",
      "余额充值",
      "中转余额",
      "美元额度",
      "美金额度",
      "刀额度",
    ])
  ) {
    return false;
  }
  return (
    isChatGptPlus(value) ||
    isChatGptPro500(value) ||
    isChatGptPro20(value) ||
    isChatGptPro5(value) ||
    isChatGptFreeAccount(value) ||
    isChatGptAccountTitle(value)
  );
}

/**
 * GPT / 多模型中转 / API 额度（对照 参考站 isApiProduct → openai-api-cdk）。
 * 本站落到 chatgpt-mirror（中转服务）。
 */
function isChatGptTransitOrApiCredit(value) {
  if (isCodexPhoneVerification(value)) return false;
  if (isNegatedApiMention(value) && !/openai-\d+-astra|image-[\d.]+-flare|倍率|号池/i.test(value)) {
    return false;
  }

  if (isChatGptPoolStationTransit(value)) return true;
  if (isApiProductCoreSignal(value)) return true;
  if (matches(value, ["倍率"]) && hasMoneyAmount(value) && matches(value, ["plus", "pro", "gpt", "chatgpt", "openai", "codex"])) {
    return true;
  }
  if (matches(value, ["号池"]) && matches(value, ["codex", "额度", "余额", "刀", "美元", "美金", "中转", "plus", "pro", "api"])) {
    return true;
  }

  // 中转站商品名 / 线路 SKU（Pure Tokens 等）
  if (/openai-\d+-astra|image-[\d.]+-flare|pure\s*tokens?|纯tokens?/i.test(value)) return true;

  // 「Pro/Plus 额度 + 美金/刀」→ 额度包，不是订阅成品
  if (matches(value, ["额度"]) && hasMoneyAmount(value) && matches(value, ["openai", "chatgpt", "gpt", "codex", "plus", "pro"])) {
    if (isOfficialProOrPlusSubscriptionDelivery(value) && !matches(value, ["号池", "倍率", "astra", "flare", "中转api"])) {
      return false;
    }
    if (/\b(?:pro|plus)\b/.test(value) && /额度/.test(value)) return true;
    if (/\d+\s*(?:美金|美元|刀|\$)/.test(value) && matches(value, ["pro", "plus", "openai", "gpt"])) return true;
  }

  if (
    matches(value, ["中转"]) &&
    (matches(value, ["额度", "余额", "号池", "倍率"]) || hasPositiveApiWord(value) || hasMoneyAmount(value)) &&
    !matches(value, ["成品号", "成品账号", "账密", "首登", "直登"])
  ) {
    return true;
  }

  if (hasPositiveApiWord(value) && matches(value, ["cdk", "token", "额度", "中转"])) return true;

  if (
    /(?:总共|共)\s*\d+\s*(?:刀|美元|美金)/.test(value) &&
    matches(value, ["plus渠道", "plus 渠道", "plus号池", "plus 号池", "老plus渠道", "老 plus 渠道", "30天有效期"])
  ) {
    return true;
  }

  return false;
}

/**
 * 账号额度/点数直充（充到个人订阅号，非 API 中转、非卖成品号）。
 * 例：【官方充值】Codex 250额度 充个人账号 非Api
 */
function isChatGptAccountQuotaRecharge(value) {
  if (!matches(value, ["chatgpt", "gpt", "openai", "codex"])) return false;
  if (matches(value, ["claude", "gemini", "grok", "cursor"]) && !matches(value, ["chatgpt", "gpt", "openai", "codex"])) {
    return false;
  }
  // 邀请增额 / 重置额度 → 周边
  if (isChatGptInviteQuotaService(value)) return false;
  if (matches(value, ["重置额度", "额度重置", "刷新额度", "恢复额度"])) return false;
  // 明确中转/号池/API 线路
  if (matches(value, ["号池", "中转站", "中转api", "中转 api", "api中转", "镜像站", "网页镜像"])) {
    return false;
  }
  if (hasPositiveApiWord(value) && !isNegatedApiMention(value)) return false;

  const hasQuotaWord = matches(value, [
    "额度",
    "点数",
    "点数额度",
    "使用额度",
    "官方点数",
    "额度点",
    "额度充值",
    "点数额度充值",
    "点数充值",
  ]);
  if (!hasQuotaWord) return false;

  const hasQuotaAmount =
    /\d+\s*(?:额度|点|点数)/.test(value) ||
    matches(value, ["额度充值", "点数额度充值", "点数充值", "充额度", "额度点"]);

  const topUpToOwnAccount = matches(value, [
    "充个人",
    "充自己",
    "直充自己",
    "充个人账号",
    "充自己号",
    "充自己账号",
    "到自己号",
    "到自己账号",
    "自备账号",
    "自备号",
  ]);

  const officialTopUp = matches(value, [
    "官方充值",
    "官方直充",
    "官方点数",
    "额度充值",
    "点数额度充值",
    "点数充值",
    "点数补充",
    "官方点数补充",
  ]);

  // 「非Api」+ 官方充值/额度 → 账号额度直充
  if (isNegatedApiMention(value) && (officialTopUp || topUpToOwnAccount || hasQuotaAmount)) {
    return true;
  }

  if (topUpToOwnAccount && hasQuotaWord) return true;
  if (officialTopUp && hasQuotaAmount) return true;
  if (
    hasQuotaAmount &&
    matches(value, ["充值", "直充", "代充", "卡充", "cdk"]) &&
    !matches(value, ["成品号", "独享账号", "月卡", "年卡", "席位"])
  ) {
    return true;
  }
  return false;
}

/** 参考站 isApiProduct — 本站归入 chatgpt-mirror */
function isApiCredit(value) {
  if (isCodexPhoneVerification(value)) return false;
  // Seedance / 即梦额度包不是 GPT 中转
  if (isDreaminaProduct(value)) return false;
  if (isPerplexityProduct(value) || isSunoProduct(value) || isMuseAiProduct(value)) return false;
  if (isChatGptAccountQuotaRecharge(value)) return false;
  if (isChatGptPeripheralService(value)) return false;
  // 「非Api」明确否定时，除非有号池/倍率/线路 SKU，否则不进中转
  if (isNegatedApiMention(value) && !/openai-\d+-astra|image-[\d.]+-flare|倍率|号池/i.test(value)) {
    return false;
  }

  // 号池站国内直连兑换码：优先于「Plus 订阅主卖」判断
  if (isChatGptPoolStationTransit(value)) return true;

  if (hasExplicitApiProductSignal(value)) return true;

  if (isChatGptAccountOrSubscriptionDominant(value)) return false;
  if (isChatGptTeam(value)) return false;
  if (
    isClaudeProduct(value) &&
    matches(value, ["team", "席位", "标准席位", "高级席位", "1.25x", "1.25倍", "6.25x", "6.25倍"])
  ) {
    return false;
  }
  if (matches(value, ["gemini pro", "google ai pro"]) && matches(value, ["一年", "订阅", "cdk"])) {
    return false;
  }

  if (isChatGptTransitOrApiCredit(value)) return true;
  if (isKiroApiCreditProduct(value)) return true;
  if (isModelApiCreditProduct(value)) return true;
  if (isModelPoolCreditProduct(value)) return true;
  if (isClaudeCodeCreditProduct(value)) return true;
  // 「额度 + claude」勿误伤 Kiro/Windsurf 等工具账号（只是可用 Claude 模型）
  if (
    matches(value, ["额度"]) &&
    matches(value, ["claude", "gemini", "gpt", "codex", "openai", "ai 平台"]) &&
    !matches(value, ["kiro", "windsurf", "cursor"])
  ) {
    return true;
  }

  return false;
}

/**
 * Codex / GPT 破甲工具、兑换卡、合卡 → 辅助服务。
 * 纯 Cursor 破甲不含 codex/gpt → 留给 cursor-service。
 * Codex+Cursor 合卡：有 Codex/GPT 信号时归本站 GPT 辅助（避免只被 Cursor 兜底吸走）。
 */
function isChatGptPoJiaTool(value) {
  // 「Plus 账号支持反代/逆向/破甲」卖的是订阅账号，能力说明不能抢占辅助分类。
  // 仅在明确订阅交付信号下排除；真正的破甲工具/兑换卡仍走原规则。
  const supportIndex = value.indexOf("支持");
  if (
    supportIndex >= 0 &&
    /(?:plus|pro)/i.test(value) &&
    /成品|账号|帐号|账密|独享|首登|质保\s*\d+\s*天|封禁必赔/.test(value) &&
    /支持[^。；;]*(?:破甲|破盾)/.test(value) &&
    !/破甲工具|破盾工具|破甲兑换|破甲合卡/.test(value.slice(0, supportIndex))
  ) return false;
  if (
    !matches(value, [
      "破甲",
      "破盾",
      "破甲工具",
      "破甲兑换",
      "破甲合卡",
      "cyber效果",
      "gpt cyber",
      "codex cyber",
    ])
  ) {
    return false;
  }
  if (!matches(value, ["codex", "chatgpt", "gpt", "openai"])) return false;
  // 仅 Cursor、无 GPT/Codex 品牌 → 不抢
  if (
    matches(value, ["cursor"]) &&
    !matches(value, ["codex", "chatgpt", "gpt", "openai"])
  ) {
    return false;
  }
  return true;
}

function isChatGptPeripheralService(value) {
  // 破甲工具优先认（先于其它周边信号门槛）
  if (isChatGptPoJiaTool(value)) return true;

  const payLink = isChatGptPaymentLinkExtractionService(value);
  const selfRecharge = isChatGptSelfServiceRecharge(value);
  const inviteQuota = isChatGptInviteQuotaService(value);
  if (
    !payLink &&
    !selfRecharge &&
    !inviteQuota &&
    !matches(value, ["codex", "chatgpt", "gpt", "openai", "plus"])
  ) {
    return false;
  }
  if (isCodexPhoneVerification(value)) return false;
  if (isApiProductCoreSignal(value)) return false;
  // 正价/官方 Plus 充值一律不进周边（即使标题带自助充值）
  if (isPlusOfficialRechargeExcludedFromPeripheral(value)) return false;

  if (inviteQuota) return true;

  if (selfRecharge) {
    const accountDelivery = matches(value, [
      "成品号",
      "成品账号",
      "成品帐号",
      "独享账号",
      "独享账户",
      "账密",
      "首登",
      "直登",
    ]);
    const ownAccount = matches(value, [
      "非成品",
      "自备账号",
      "自备号",
      "自己账号",
      "自己的账号",
      "自己号",
      "到自己账号",
      "冲自己号",
      "充值自己号",
      "给自己号",
      "任何账号可充",
      "kakao自助充值",
    ]);
    if (accountDelivery && !ownAccount) return false;
    return true;
  }

  if (payLink) {
    if (matches(value, ["代付代扫", "代付服务", "代扫服务"])) return true;
    if (matches(value, ["成品号", "账号", "账户", "账密", "月卡", "会员", "直充", "代充"])) return false;
    return true;
  }

  const peripheral =
    matches(value, ["重置额度", "额度重置", "刷新额度", "恢复额度"]) ||
    (matches(value, ["重置"]) && matches(value, ["plus", "pro", "额度"])) ||
    matches(value, ["长链提取", "长链接提取", "链接提取", "提取服务", "提取服务包", "长链服务包"]) ||
    (matches(value, ["服务包"]) && matches(value, ["长链", "提取", "codex", "chatgpt", "gpt", "plus"]));
  if (!peripheral) return false;
  if (matches(value, ["成品号", "账号", "账户", "账密", "月卡", "会员", "直充", "代充", "卡密", "cdk"])) {
    return false;
  }
  return true;
}

/* ---------- ChatGPT tier detectors ---------- */

/**
 * 标题里显式写出的 Pro 倍率（5x / 10x / 20x / 50x…）。
 * 有显式倍率时，刀数/$ 只能作无倍率标题的兜底，禁止 `PRO 10X 200$` 因 200$ 进 20x。
 */
function extractExplicitProMultipliers(value) {
  const set = new Set();
  // 尾边界用 lookahead，避免 `5x 20x` 只吃到 5（分隔符被消费导致漏 20）
  for (const m of value.matchAll(/(?:^|[^0-9])(\d+)\s*x(?=$|[^0-9a-z])/gi)) {
    set.add(Number(m[1]));
  }
  // 粘连价：`PRO10x200刀` / `10x200$` — x 后直接跟刀数，仍算显式倍率
  for (const m of value.matchAll(
    /(?:^|[^0-9])(\d+)\s*x\s*\d{2,4}\s*(?:刀|\$|美元|美金|usd)/gi,
  )) {
    set.add(Number(m[1]));
  }
  for (const m of value.matchAll(/(?:^|[^0-9a-z])x\s*(\d+)(?=$|[^0-9a-z])/gi)) {
    set.add(Number(m[1]));
  }
  for (const m of value.matchAll(/(?:^|[^0-9])(\d+)\s*倍/g)) {
    set.add(Number(m[1]));
  }
  return set;
}

/**
 * 倍率边界：禁止 `codex 5.6` / `codex 20` 里单词尾 `x`+数字误命中 `x5`/`x20`。
 * 一律要求 `x` 前不是字母数字（`[^0-9a-z]x\s*N`）。
 * 50x 与 500 刀同归 pro-500 卡（产品设计如此）。
 */
function hasChatGptPro500SignalRaw(value) {
  const mults = extractExplicitProMultipliers(value);
  if (mults.size > 0) return mults.has(50);
  return (
    matches(value, ["500刀", "500 美元", "500美元", "500美金", "500 美金", "promax", "pro max"]) ||
    /\$\s*500\b|\b500\s*\$/.test(value) ||
    /\bpro\s*500\b/.test(value) ||
    /\bpro\s*50\b/.test(value) ||
    /(?:^|[^0-9])500\s*(?:刀|美元|美金|档|套餐)/.test(value)
  );
}

function hasChatGptPro20SignalRaw(value) {
  const mults = extractExplicitProMultipliers(value);
  if (mults.size > 0) return mults.has(20);
  return (
    matches(value, ["200刀", "200 美元", "200美元", "200美金", "200 美金"]) ||
    /\$\s*200\b|\b200\s*\$/.test(value) ||
    /\bpro\s*20\b/.test(value) ||
    /\bpro\s*200\b/.test(value) ||
    /(?:^|[^0-9])200\s*(?:刀|美元|美金|档|套餐)/.test(value)
  );
}

function hasChatGptPro5SignalRaw(value) {
  const mults = extractExplicitProMultipliers(value);
  // 禁止把 50x / 15x / 10x / codex 5.6 等误判为 5x
  if (mults.size > 0) return mults.has(5);
  return (
    matches(value, ["100刀", "100 美元", "100美元", "100美金", "100 美金"]) ||
    /\$\s*100\b|\b100\s*\$/.test(value) ||
    /\bpro\s*5\b/.test(value) ||
    /\bpro\s*100\b/.test(value) ||
    /(?:^|[^0-9])100\s*(?:刀|美元|美金|档|套餐)/.test(value)
  );
}

function hasChatGptPro500Signal(value) {
  return hasChatGptPro500SignalRaw(value);
}

function hasChatGptPro20Signal(value) {
  if (hasChatGptPro500SignalRaw(value)) return false;
  return hasChatGptPro20SignalRaw(value);
}

function hasChatGptPro5Signal(value) {
  if (hasChatGptPro500SignalRaw(value) || hasChatGptPro20SignalRaw(value)) return false;
  return hasChatGptPro5SignalRaw(value);
}

function isPrimaryChatGptPro5Tier(value) {
  return (
    /\b(?:chatgpt\s*)?(?:gpt\s*)?pro\s*5x\s*(?:月卡|套餐|官方|充值|卡充|直充|代充)/.test(value) ||
    /\b(?:chatgpt\s*)?(?:gpt\s*)?pro\s*5\s*倍\s*(?:月卡|套餐|官方|充值|卡充|直充|代充)/.test(value)
  );
}

function isMixedChatGptProTier(value) {
  if (matches(value, ["gemini", "claude", "cursor"])) return false;
  if (!matches(value, ["pro", "gpt pro", "chatgpt pro", "openai pro", "codex pro"])) return false;
  if (isPrimaryChatGptPro5Tier(value)) return false;
  // 用 raw 信号：标题同时写 5x/20x（或再带 500）→ 不进任一 Pro 卡
  const tiers = [
    hasChatGptPro5SignalRaw(value),
    hasChatGptPro20SignalRaw(value),
    hasChatGptPro500SignalRaw(value),
  ].filter(Boolean);
  return tiers.length >= 2;
}

function isChatGptProFamily(value) {
  return matches(value, ["pro", "gpt pro", "chatgpt pro", "openai", "codex"]);
}

function isChatGptPro500(value) {
  if (matches(value, ["gemini", "claude", "cursor"])) return false;
  if (isChatGptTransitOrApiCredit(value)) return false;
  if (isChatGptFreeAccount(value)) return false;
  if (isChatGptTeamDominant(value)) return false;
  if (isMixedChatGptProTier(value)) return false;
  return isChatGptProFamily(value) && hasChatGptPro500Signal(value);
}

function isChatGptPro20(value) {
  if (matches(value, ["gemini", "claude", "cursor"])) return false;
  if (isChatGptTransitOrApiCredit(value)) return false;
  if (isChatGptFreeAccount(value)) return false;
  if (isChatGptTeamDominant(value)) return false;
  if (isPrimaryChatGptPro5Tier(value)) return false;
  if (isMixedChatGptProTier(value)) return false;
  return isChatGptProFamily(value) && hasChatGptPro20Signal(value);
}

function isChatGptPro5(value) {
  if (matches(value, ["gemini", "claude", "cursor"])) return false;
  if (isChatGptTransitOrApiCredit(value)) return false;
  if (isChatGptFreeAccount(value)) return false;
  if (isChatGptTeamDominant(value)) return false;
  if (isMixedChatGptProTier(value)) return false;
  return isChatGptProFamily(value) && hasChatGptPro5Signal(value);
}

function isChatGptGoProduct(value) {
  if (matches(value, ["opencode", "open code"])) return false;
  const hasChatGpt = matches(value, ["chatgpt", "gpt", "openai"]);
  const standaloneGo =
    /\bgo\b/.test(value) &&
    matches(value, ["月卡", "年卡", "直充", "充值", "激活", "会员", "订阅", "独享", "自助", "卡密", "成品号"]);
  if (!hasChatGpt && !standaloneGo) return false;
  if (matches(value, ["google", "gojek", "gopay"])) return false;
  return /\bgo\b/.test(value) || /\bgo(?=\d|月|年|直充|充值|激活|会员|订阅|独享)/.test(value);
}

function isNegatedPlus(value) {
  if (/不是\s*plus\s*的/.test(value)) return false;
  if (isExplicitlyNotFinishedPlus(value)) return true;
  return matches(value, ["非plus", "非 plus", "不是plus", "不是 plus", "不含plus", "不含 plus", "无plus", "无 plus"]);
}

/** 「不是成品 Plus / 非成品号」等明确否定成品订阅。 */
function isExplicitlyNotFinishedPlus(value) {
  if (
    /不是\s*成品\s*plus|非\s*成品\s*plus|不是\s*成品号|非\s*成品号|不是成品！！！|不是成品!!!/i.test(
      value,
    )
  ) {
    return true;
  }
  // 「❌不是成品号」「注意只是资格不是成品」
  if (/不是成品/.test(value) && matches(value, ["plus", "资格", "资格号", "半价"])) return true;
  return false;
}

/**
 * Plus 半价资格 / 名额号：卖的是可开 Plus 的普通号，不是成品 Plus 订阅。
 * → chatgpt-free-account（普号）
 */
function isPlusQualificationAccount(value) {
  if (matches(value, ["claude", "gemini", "grok", "cursor"])) return false;
  // Pro 倍率充值/续费里夹带「资格号」= 可续费的号，不是在卖普号
  if (
    matches(value, ["续费", "代充", "直充", "官充", "cdk", "卡充", "充值", "卡冲", "充值专用"]) &&
    (hasChatGptPro5SignalRaw(value) ||
      hasChatGptPro20SignalRaw(value) ||
      hasChatGptPro500SignalRaw(value))
  ) {
    return false;
  }
  const qual = matches(value, [
    "半价资格",
    "plus半价资格",
    "资格账号",
    "资格号",
    "资格老号",
    "半价名额",
    "半价资格号",
    "半价资格账号",
    "仅plus半价名额",
    "plus半价名额",
    "只是资格",
    "注意只是资格",
    "注意是资格号",
    "仅资格",
    "资格不是成品",
  ]);
  if (qual) return true;
  // 「特别优惠 / 首月 $10」半价名额包装
  if (
    matches(value, ["半价名额", "特别优惠"]) &&
    matches(value, ["plus"]) &&
    (isExplicitlyNotFinishedPlus(value) || matches(value, ["不是代充", "无代充"]))
  ) {
    return true;
  }
  return isExplicitlyNotFinishedPlus(value) && matches(value, ["plus", "资格", "名额"]);
}

/**
 * 教程 / 脚本 / 指南类 listing（非实体账号/订阅）。
 * ChatGPT 相关 → chatgpt-codex-service；其它平台 → 不进订阅卡（由调用方决定）。
 */
function isTutorialOrScriptListing(value) {
  if (
    !matches(value, [
      "教程",
      "教学",
      "使用教程",
      "充值教程",
      "操作教程",
      "图文教程",
      "视频教程",
      "自动化脚本",
      "全套脚本",
      "附带脚本",
      "附带自动化脚本",
      "脚本教程",
    ])
  ) {
    return false;
  }
  // 主卖成品订阅/账号时，「教程」只是描述附带 → 不当教程 listing
  const strongProduct = matches(value, [
    "成品号",
    "独享账号",
    "独享成品",
    "plus 成品",
    "plus成品",
    "质保订阅",
    "官方直充",
    "官方充值",
    "正价代充",
  ]);
  if (strongProduct) return false;
  return true;
}

function isLikelyChatGptFreeAccountTitle(value) {
  if (!matches(value, ["free", "普号", "普通号", "普通账号", "白号"])) return false;
  if (isFreeStatusRechargePrerequisite(value)) return false;
  if (hasChatGptPaidSubscriptionSignal(value)) return false;
  if (
    matches(value, [
      "google",
      "gmail",
      "谷歌",
      "pixel",
      "tiktok",
      "facebook",
      "instagram",
      "telegram",
      "twitter",
      "推特",
      "steam",
      "苹果",
      "apple",
    ])
  ) {
    return false;
  }
  if (matches(value, ["chatgpt", "gpt", "openai", "codex"])) return true;
  return matches(value, [
    "rt",
    "json",
    "cpa",
    "sub2api",
    "已接码",
    "已经接码",
    "质保首登",
    "高额度",
    "高端",
    "优质",
    "成品号",
    "直登",
  ]);
}

/**
 * 付费订阅 / 正价卡充成品信号 —— 绝不能进普号。
 * （含无 Pro 字样的「Codex 10x 正价卡充成品号|质保订阅」）
 */
function hasChatGptPaidSubscriptionSignal(value) {
  if (
    matches(value, [
      "正价卡充",
      "正价卡冲",
      "正价代充",
      "正价直充",
      "官方充值",
      "官方直充",
      "官方代充",
      "正规秒充",
      "正规卡充",
      "正规卡冲",
    ])
  ) {
    return true;
  }
  if (
    matches(value, ["卡充", "卡冲", "代充", "直充", "官充", "续费"]) &&
    matches(value, ["成品号", "月卡", "订阅", "正价", "质保订阅"])
  ) {
    return true;
  }
  if (
    matches(value, ["质保订阅", "掉订阅"]) &&
    matches(value, ["月卡", "一个月", "成品号", "续费"])
  ) {
    return true;
  }
  // 任意显式倍率 + 充值/成品订阅面
  const mults = extractExplicitProMultipliers(value);
  if (
    mults.size > 0 &&
    matches(value, ["卡充", "卡冲", "代充", "直充", "续费", "正价", "月卡", "订阅", "成品号"])
  ) {
    return true;
  }
  return false;
}

/** 「须账号为 Free 状态」= 代充前置条件，不是在卖 Free 号 */
function isFreeStatusRechargePrerequisite(value) {
  return (
    /(?:账号|账户|帐号)\s*为\s*free|须(?:账号|账户)?(?:为)?\s*free\s*状态|free\s*状态/.test(value) &&
    matches(value, ["充值", "代充", "直充", "秒充", "卡充", "官方"])
  );
}

function isChatGptFreeAccount(value) {
  if (isPlusQualificationAccount(value)) return true;
  if (isFreeStatusRechargePrerequisite(value)) return false;
  if (hasChatGptPaidSubscriptionSignal(value)) return false;
  // 「普号 / 资格号 + Pro 20x 充值」仍是 Pro 代充，不是普号成品
  if (
    matches(value, ["续费", "代充", "直充", "官充", "cdk", "卡充", "充值", "卡冲", "充值专用"]) &&
    (hasChatGptPro5SignalRaw(value) ||
      hasChatGptPro20SignalRaw(value) ||
      hasChatGptPro500SignalRaw(value))
  ) {
    return false;
  }
  if (isLikelyChatGptFreeAccountTitle(value)) return true;
  if (matches(value, ["free", "普号", "白号", "普通号", "普通账号", "空白账号"])) return true;
  return matches(value, ["长效"]) && !matches(value, ["plus", "pro", "team", "business"]);
}

function isChatGptPlusCarpool(value) {
  if (!matches(value, ["plus", "chatgpt plus", "gpt plus"])) return false;
  if (!matches(value, ["拼车"])) return false;
  return !matches(value, ["team", "business", "t5", "团队", "母号", "自动拉", "直拉"]);
}

function isChatGptPlusAccountWithParentEmail(value) {
  if (!matches(value, ["plus"])) return false;
  if (!matches(value, ["成品号", "独享成品号", "独享成品"])) return false;
  if (!matches(value, ["母号邮箱", "母号 邮箱"])) return false;
  return matches(value, ["icloud", "gmail", "邮箱", "google", "outlook", "hotmail"]);
}

function isChatGptTeamExclusion(value) {
  return matches(value, [
    "有team不能冲",
    "有 team 不能冲",
    "非team",
    "非 team",
    "不是team",
    "不是 team",
    "无team",
    "无 team",
    "不含team",
    "不含 team",
    "要稳买我的team",
    "要稳买我的 team",
  ]);
}

function hasEmailSignal(value) {
  return matches(value, [
    "gmail",
    "icloud",
    "icloud邮箱",
    "icloud 邮箱",
    "苹果隐私邮箱",
    "邮箱",
    "谷歌邮箱",
    "google 邮箱",
    "google邮箱",
    "hotmail",
    "outlook",
    "微软邮箱",
    "教育邮箱",
    "edu邮箱",
    "域名邮箱",
    "人机邮箱",
  ]);
}

function isChatGptTeamDominant(value) {
  if (matches(value, ["gemini", "claude", "grok"])) return false;
  if (isChatGptTeamExclusion(value)) return false;
  if (isChatGptPlusCarpool(value)) return false;
  if (isChatGptPlusAccountWithParentEmail(value)) return false;
  // 好友邀请增额是周边，不是 Team
  if (isChatGptInviteQuotaService(value)) return false;
  if (
    hasEmailSignal(value) &&
    matches(value, ["母号"]) &&
    !matches(value, ["team", "business", "k12", "团队", "席位", "邀请", "自动拉", "直拉"])
  ) {
    return false;
  }

  return matches(value, [
    "gpt team",
    "chatgpt team",
    "k12",
    "k12 子号",
    "team bug",
    "bug team",
    "team子号",
    "team 子号",
    "team账号",
    "team 账号",
    "team成品",
    "team 成品",
    "team席位",
    "team 席位",
    "team反代",
    "team 反代",
    "team月卡",
    "team 月卡",
    "team rt",
    "team凭证",
    "team 凭证",
    "chatgpt business",
    "gpt business",
    "gptbusiness",
    "business(team)",
    "business team",
    "busisness team",
    "business子号",
    "business 子号",
    "团队",
    "母号",
    "自动拉",
    "直拉",
    "拼车位",
    "车位",
    "邀请",
    "团队号",
    "团队席位",
    "席位",
  ]);
}

function isChatGptTeam(value) {
  if (matches(value, ["gemini", "claude", "grok"])) return false;
  if (isChatGptTeamExclusion(value)) return false;
  return isChatGptTeamDominant(value) || matches(value, ["team", "t5", "t5倍", "k12"]);
}

function isChatGptPlus(value) {
  const hasChatGpt = matches(value, ["chatgpt", "gpt", "openai"]) || (matches(value, ["codex"]) && matches(value, ["plus"]));
  const hasPlus = matches(value, ["plus"]);
  if (!hasChatGpt && !hasPlus) return false;
  if (matches(value, ["pro"]) && !matches(value, ["plus"])) return false;
  if (isChatGptGoProduct(value)) return false;
  // 号池站国内直连兑换码 → 中转服务，不是试用订阅
  if (isChatGptPoolStationTransit(value)) return false;
  // 资格号 / 教程脚本 绝不是 Plus 试用订阅
  if (isPlusQualificationAccount(value)) return false;
  if (isTutorialOrScriptListing(value)) return false;
  if (isExplicitlyNotFinishedPlus(value)) return false;
  if (hasChatGpt && hasPlus) return true;

  if (hasPlus && !hasChatGpt) {
    return matches(value, [
      "plus 成品",
      "plus成品",
      "plus 独享成品",
      "plus独享成品",
      "plus 会员",
      "plus会员",
      "plus 账号",
      "plus账号",
      "plus 月卡",
      "plus月卡",
      "plus 一个月",
      "plus一个月",
      "plus 直充",
      "plus直充",
      "plus 代充",
      "plus代充",
      "plus 卡密",
      "plus卡密",
      "plus 自助",
      "plus自助",
      "plus 日抛",
      "plus日抛",
      "plus 试用",
      "plus试用",
      "gpt plus",
      "成品 plus",
      "成品号",
      "独享账号",
      "账号",
      "账密",
      "首登",
      "直登",
      "质保首登",
      "日抛",
      "试用",
      "rt",
      "凭证",
      "已接码",
      "会员",
      "月卡",
      "订阅",
      "直充",
      "充值",
      "卡密",
      "cc 渠道",
      "谷歌正规付款",
    ]);
  }

  return matches(value, [
    "ios土区",
    "土区 ios",
    "土区",
    "自助卡密",
    "续费一个月",
    "一个月卡密",
    "一个月 成品号",
    "一个月",
    "月卡",
    "订阅",
    "直充",
    "充值",
    "卡密",
    "cc 渠道",
    "谷歌正规付款",
  ]);
}

function hasChatGptPlusAccountDeliverySignal(value) {
  if (
    matches(value, [
      "自备账号",
      "自备号",
      "自己账号",
      "自己的账号",
      "自己号",
      "自己的号",
      "到自己账号",
      "充值到自己账号",
      "充自己号",
      "给自己号",
      "任何账号可充",
    ])
  ) {
    return false;
  }

  if (
    matches(value, [
    "成品号",
    "成品账号",
      "成品帐号",
    "独享账号",
      "独享账户",
    "账密",
    "首登",
    "直登",
    "未接码",
    "已接码",
    "网页号",
    "半成品",
      "母号邮箱",
      "邮箱随机发货",
      "拿到后立刻改密码",
      "拿到后改密码",
      "修改密码",
      "改密码",
      "支持登录codex",
      "支持登录 codex",
      "直接登录codex",
      "直接登录 codex",
      "登录codex",
      "登录 codex",
      "带2fa",
      "带 2fa",
    "2fa",
    "二验",
    ])
  ) {
    return true;
  }

  const emailCred = matches(value, [
    "gmail邮箱",
    "gmail 邮箱",
    "icloud邮箱",
    "icloud 邮箱",
    "outlook邮箱",
    "outlook 邮箱",
    "微软邮箱",
    "谷歌邮箱",
  ]);
  const loginCred = matches(value, [
    "支持登录",
    "可以登录",
    "可登录",
    "登录codex",
    "登录 codex",
    "可网页",
    "动态家宽注册",
    "2fa",
    "二验",
  ]);
  return emailCred && loginCred;
}

function isChatGptPlusPixTrial(value) {
  const trial = [
    "试用",
    "新号",
    "老号",
    "不包二验",
    "未接码",
    "已接码",
    "首登",
    "质保48小时",
    "质保两天",
    "质保首登",
    "渠道非成品",
    "自备账号",
    "自己账号",
    "有team不能冲",
  ];
  if (matches(value, ["pix"])) {
    if (matches(value, ["巴西", "巴西渠道"])) return true;
    return matches(value, [...trial, "巴西老哥", "巴西渠道"]);
  }
  return matches(value, ["巴西渠道"]) && matches(value, trial);
}

function hasChatGptPlusRechargeOfficialDirectSignal(text) {
  return /官方直充|官方充值|官方代充|官方订阅|正价(?:代充|充值|直充|实付)?|正规充值|正规官方|正规卡付|正规卡冲|官网直充|官网直冲|官网代充|真实付费(?:开通|充值)?/i.test(
    text,
  );
}

function isChatGptPlusRecharge(value) {
  // gplus / Codex Plus 官方充值也算 Plus 正价面
  const plusLike =
    isChatGptPlus(value) ||
    (matches(value, ["plus", "gplus", "g plus"]) &&
      matches(value, ["chatgpt", "gpt", "openai", "codex", "官方", "菲区", "充值", "代充"]));
  if (!plusLike) return false;
  if (hasChatGptPlusAccountDeliverySignal(value)) return false;
  if (isChatGptPlusPixTrial(value)) return false;
  if (hasChatGptPlusRechargeOfficialDirectSignal(value)) return true;
  if (
    matches(value, ["官方渠道", "官网渠道"]) &&
    matches(value, ["充值", "代充", "直充", "自动充值", "自助充值", "cdk"])
  ) {
  return true;
  }
  return false;
}

function isChatGptAccountTitle(value) {
  if (!matches(value, ["chatgpt", "gpt", "openai", "codex"])) return false;
  if (matches(value, ["plus", "pro", "team", "business", "t5"])) return false;
  // 正价卡充 / 倍率订阅成品 ≠ 普号账号
  if (hasChatGptPaidSubscriptionSignal(value)) return false;
  if (extractExplicitProMultipliers(value).size > 0) return false;
  return matches(value, ["成品号", "账号", "独享号", "直登", "日抛", "网页号", "半成品"]);
}

function isChatGptProduct(value) {
  if (matches(value, ["gemini", "claude", "grok", "cursor"])) return false;
  if (matches(value, ["steam"])) return false;
  if (isChatGptPro20(value) || isChatGptPro5(value)) return true;
  if (isChatGptGoProduct(value)) return true;
  if (isLikelyChatGptFreeAccountTitle(value)) return true;
  return matches(value, ["chatgpt", "gpt", "openai", "codex", "plus", "team", "business", "t5", "k12"]);
}

function isBarePro(value) {
  if (matches(value, ["gemini", "claude", "cursor"])) return false;
  if (
    isChatGptPro5(value) ||
    isChatGptPro20(value) ||
    isChatGptPro500(value) ||
    isMixedChatGptProTier(value)
  ) {
    return false;
  }
  if (matches(value, ["plus", "team", "go"]) && !matches(value, ["pro"])) return false;
  // 10x / 15x 等无对应标准卡 → 不进 5/20/500（标题可无 pro 字样）
  const mults = extractExplicitProMultipliers(value);
  const hasNonStandard = [...mults].some((n) => n !== 5 && n !== 20 && n !== 50);
  if (
    hasNonStandard &&
    matches(value, ["chatgpt", "gpt", "openai", "codex", "pro"]) &&
    (matches(value, ["pro"]) ||
      matches(value, ["卡充", "卡冲", "代充", "直充", "续费", "正价", "月卡", "订阅", "成品号"]))
  ) {
  return true;
  }
  // 无倍率的正价卡充/订阅成品，且未写 Plus/Team → 未分档，不进普号
  if (
    matches(value, ["chatgpt", "gpt", "openai", "codex"]) &&
    hasChatGptPaidSubscriptionSignal(value) &&
    !matches(value, ["plus", "team", "go", "free", "普号", "白号", "普通号"])
  ) {
    return true;
  }
  return (
    matches(value, ["chatgpt pro", "gpt pro", "openai pro", "codex pro"]) ||
    (matches(value, ["pro"]) && matches(value, ["chatgpt", "gpt", "openai", "codex"]))
  );
}

/* ---------- Cursor ---------- */

function isCursorProduct(value) {
  if (!matches(value, ["cursor"])) return false;
  // 虚拟卡适用性说明（支持 Cursor/Kiro…）不是 Cursor 商品
  if (
    matches(value, ["visa", "虚拟卡", "0刀", "0 刀"]) &&
    !matches(value, [
      "成品号",
      "cursor plus",
      "cursor pro",
      "cursor ultra",
      "cursor free",
      "普号",
      "白号",
      "月卡",
      "插件",
    ])
  ) {
    return false;
  }
  return true;
}

/** 「无 cursor / cursor 勿拍」等否定，避免 Grok 旧版标题误进 Cursor */
function isCursorNegatedMention(value) {
  return /无\s*cursor|cursor\s*勿拍|勿拍\s*[,，]?\s*cursor|旧版\s*无\s*cursor|bot勿拍\s*,\s*cursor勿拍/.test(
    value,
  );
}

function hasCursorFreeSignal(value) {
  return matches(value, [
    "free auto",
    "free号",
    "free 号",
    "free白号",
    "free 白号",
    "白号",
    "小白号",
    "普号",
    "普通号",
    "cursor free",
  ]);
}

function isCursorProPlus(value) {
  if (!isCursorProduct(value) || isCursorNegatedMention(value)) return false;
  // 官网 Super ≈ 卡网 Pro+
  if (
    matches(value, ["cursor super", "cursorsuper", "super月卡", "super 月卡", "super成品", "super 成品"]) &&
    !matches(value, ["ultra"])
  ) {
    return true;
  }
  return (
    matches(value, ["pro+", "pro＋", "pro plus", "proplus", "cursor pro+", "cursor pro＋"]) ||
    /pro\s*\+|pro\s*plus/.test(value)
  );
}

function isCursorUltra(value) {
  if (!isCursorProduct(value) || isCursorNegatedMention(value)) return false;
  if (isCursorProPlus(value)) return false;
  return matches(value, ["ultra", "cursorultra", "cursor ultra"]);
}

/**
 * 官网 Cursor Plus（$8）：须先于 Pro 判定；不得吞掉 Pro+ / Ultra。
 */
function isCursorPlus(value) {
  if (!isCursorProduct(value) || isCursorNegatedMention(value)) return false;
  if (isCursorProPlus(value) || isCursorUltra(value)) return false;
  if (
    matches(value, [
      "cursor plus",
      "cursorplus",
      "cursor-plus",
      "plus月卡",
      "plus 月卡",
      "plus年卡",
      "plus 年卡",
      "plus成品",
      "plus 成品",
      "plus独享",
      "plus 独享",
      "plus代充",
      "plus 代充",
      "plus直充",
      "plus 直充",
      "plus会员",
      "plus 会员",
    ])
  ) {
    return true;
  }
  // 裸 plus + cursor，且非 pro（避免 pro+ / pro plus）
  if (
    matches(value, ["plus"]) &&
    !matches(value, ["pro"]) &&
    !/pro\s*\+|pro\s*plus|pro\s*＋/.test(value)
  ) {
    return true;
  }
  // 价位锚点：$8 / 8刀 / 8美金（无 pro/ultra）
  if (
    !matches(value, ["pro", "ultra"]) &&
    /(\$\s*8\b|\b8\s*(\$|刀|美金|usd|美元)\b|8\s*刀)/i.test(value)
  ) {
    return true;
  }
  return false;
}

function isCursorFreeAccount(value) {
  if (!isCursorProduct(value) || isCursorNegatedMention(value)) return false;
  if (isCursorProPlus(value) || isCursorUltra(value) || isCursorPlus(value)) return false;
  // 标题同时写 Pro/Ultra 订阅信号时，白号/普号词不抢档
  if (
    matches(value, ["pro"]) &&
    matches(value, ["月卡", "成品", "独享", "代充", "直充", "订阅", "会员"])
  ) {
    return false;
  }
  return hasCursorFreeSignal(value);
}

function isCursorPro(value) {
  if (!isCursorProduct(value) || isCursorNegatedMention(value)) return false;
  if (isCursorProPlus(value) || isCursorUltra(value) || isCursorPlus(value)) return false;
  if (hasCursorFreeSignal(value) && !matches(value, ["pro", "premium"])) return false;
  // 官网 Premium ≈ 卡网 Pro
  if (
    matches(value, [
      "cursor premium",
      "cursorpremium",
      "premium月卡",
      "premium 月卡",
      "premium成品",
      "premium 成品",
      "premium独享",
      "premium 独享",
      "premium代充",
      "premium 代充",
    ])
  ) {
    return true;
  }
  // 明确 Pro
  if (
    matches(value, [
      "cursor pro",
      "pro月卡",
      "pro 月卡",
      "pro成品",
      "pro 成品",
      "pro独享",
      "pro 独享",
      "pro代充",
      "pro 代充",
      "pro直充",
      "pro 直充",
    ])
  ) {
    return true;
  }
  if (matches(value, ["pro"]) && matches(value, ["cursor"])) return true;
  // 未写档位的 Cursor 月卡/年卡/官方会员成品 → 默认按 Pro 订阅面
  if (
    matches(value, ["月卡", "年卡", "会员", "订阅", "成品号", "独享成品", "代充", "直充", "充值"]) &&
    !matches(value, ["插件", "日卡", "周卡", "协助充值", "退款", "接码", "接马"]) &&
    !hasCursorFreeSignal(value)
  ) {
    return true;
  }
  return false;
}

/**
 * 插件计费共享、日/周卡、协助充值、自助退款等。
 * 正价 Pro/Ultra 代充成品走订阅档，不进辅助。
 */
function isCursorService(value) {
  if (!isCursorProduct(value) || isCursorNegatedMention(value)) return false;
  if (hasCursorFreeSignal(value)) return false;
  // 明确订阅成品/正价档优先
  if (isCursorProPlus(value) || isCursorPlus(value)) return false;
  if (
    (isCursorUltra(value) ||
      matches(value, ["cursor pro", "cursor plus", "pro月卡", "pro 月卡", "plus月卡", "pro"])) &&
    matches(value, ["成品号", "独享", "正价", "官方会员", "官方代充", "正规实付", "月卡"])
  ) {
    return false;
  }
  if (
    matches(value, [
      "插件计费",
      "插件",
      "日卡",
      "周卡",
      "协助充值",
      "自助退款",
      "退款",
      "额度重置",
      "重置额度",
    ])
  ) {
    return true;
  }
  // 纯「协助开通/充值」且非成品交付
  if (
    matches(value, ["协助", "帮充", "代充服务"]) &&
    !matches(value, ["成品号", "独享成品", "账密", "首登"])
  ) {
    return true;
  }
  return false;
}

function classifyCursorProduct(value) {
  if (!isCursorProduct(value) || isCursorNegatedMention(value)) return null;
  // 接码已在上游分流；此处再兜底一次
  if (isVerificationService(value) || isCodexPhoneVerification(value)) return null;
  // 订阅档优先于辅助（避免「Ultra 正价代充」被协助类词带走）
  // 档位：Pro+ / Super → Ultra → Plus → Pro / Premium → 普号 → 辅助
  if (isCursorProPlus(value)) return "cursor-pro-plus";
  if (isCursorUltra(value)) return "cursor-ultra";
  if (isCursorPlus(value)) return "cursor-plus";
  if (isCursorPro(value)) return "cursor-pro";
  if (isCursorFreeAccount(value)) return "cursor-free-account";
  if (isCursorService(value)) return "cursor-service";
  // 残留 Cursor 标题：有账号交付信号 → 普号；否则辅助
  if (matches(value, ["成品号", "账号", "账密", "白号", "token", "直登", "首登"])) {
    return "cursor-free-account";
  }
  return "cursor-service";
}

/* ---------- Kiro（AWS IDE） ---------- */

/**
 * 正向 Kiro 品牌：去掉「非kiro / kiro别拍」后再匹配。
 * 避免 includes("kiro") 把「非kiro」「Gemini…KIRO别拍」误吸进本板。
 */
function hasPositiveKiroMention(value) {
  const stripped = String(value || "")
    .replace(/非\s*kiro/g, " ")
    .replace(/不是\s*kiro/g, " ")
    .replace(/无\s*kiro/g, " ")
    .replace(/不含\s*kiro/g, " ")
    .replace(/kiro\s*不行/g, " ")
    .replace(/kiro\s*别拍/g, " ")
    .replace(/别拍[^。\n]{0,24}kiro/g, " ")
    .replace(/kiro[^。\n]{0,16}别拍/g, " ")
    .replace(/勿拍[^。\n]{0,16}kiro/g, " ")
    .replace(/kiro[^。\n]{0,12}无售后/g, " ");
  return stripped.includes("kiro");
}

/** 「kiro不行 / kiro别拍 / 非kiro」等否定 */
function isKiroNegatedMention(value) {
  if (/非\s*kiro|不是\s*kiro|无\s*kiro|不含\s*kiro/.test(value) && !hasPositiveKiroMention(value)) {
    return true;
  }
  return /kiro\s*不行|kiro\s*别拍|别拍[^。\n]{0,24}kiro|kiro[^。\n]{0,16}别拍|勿拍[^。\n]{0,16}kiro|kiro[^。\n]{0,12}无售后/.test(
    value,
  );
}

/** Claude-Kiro 渠道中转（本板商品，不是「其他平台顺带提 kiro」） */
function isKiroChannelTransitMention(value) {
  return matches(value, [
    "claude-kiro",
    "claude kiro",
    "kiro渠道",
    "kiro 渠道",
    "kiro混合",
    "kiro号池",
    "kiro 号池",
  ]);
}

/**
 * 其他平台主卖 / 多品牌合集：不得进 Kiro 订阅统计。
 * Cursor·Gemini·GPT 等与 Kiro 并列、或合集打包时排除。
 */
function isOtherPlatformPrimaryOverKiro(value) {
  if (isKiroChannelTransitMention(value)) return false;
  // API KEY / 刀额度日卡挂 Kiro 渠道 → 本板中转
  if (
    matches(value, ["api key", "apikey", "api-key", "刀额度", "美元额度"]) &&
    hasPositiveKiroMention(value)
  ) {
    return false;
  }

  const hasCursor = matches(value, ["cursor"]) && !isCursorNegatedMention(value);
  const hasGpt = matches(value, ["chatgpt", "gpt plus", "openai", "codex"]);
  const hasGemini = matches(value, ["gemini", "google ai"]);
  const hasWindsurf = matches(value, ["windsurf"]);
  const hasGrok = matches(value, ["grok", "super grok"]);
  // Claude 订阅主卖（非模型能力句、非 Claude-Kiro 渠道）
  const hasClaudeSub =
    matches(value, ["claude"]) &&
    matches(value, ["claude pro", "claude max", "claude team", "claude 普号", "claude账号", "claude 账号"]) &&
    !/可用\s*claude|支持\s*claude|调用\s*claude|claude\s*opus|claude\s*sonnet/.test(value);

  const rivals = [hasCursor, hasGpt, hasGemini, hasWindsurf, hasGrok, hasClaudeSub].filter(Boolean).length;
  if (rivals === 0) return false;

  // 合集 / 打包 / 双品牌并列 → 不独占进 Kiro 档
  if (matches(value, ["合集", "打包", "套装", "全家桶", "都行", "均可", "通用"])) return true;
  if (
    /(?:cursor|chatgpt|gpt|gemini|windsurf|grok|claude)\s*[\/与和及+|]\s*kiro/.test(value) ||
    /kiro\s*[\/与和及+|]\s*(?:cursor|chatgpt|gpt|gemini|windsurf|grok|claude)/.test(value)
  ) {
    return true;
  }
  // 「支持 A 和 Kiro」类适用性说明（虚拟卡等）
  if (matches(value, ["支持"]) && rivals >= 1 && matches(value, ["虚拟卡", "visa", "卡片"])) {
    return true;
  }
  // 主标题是其他平台订阅/成品，kiro 只是括号或尾注
  if (
    (hasCursor && matches(value, ["cursor pro", "cursor ultra", "cursor 普号", "cursor free"])) ||
    (hasGemini && matches(value, ["gemini pro", "google ai", "年卡"])) ||
    (hasGpt && matches(value, ["chatgpt", "gpt plus", "plus 月卡"]))
  ) {
    // 仅当没有明确 Kiro 档位交付时排除
    if (
      !matches(value, ["kiro pro", "kiro free", "kiro power", "kiro 普号", "kiro成品", "kiro 成品"]) &&
      kiroCreditAmount(value) == null
    ) {
      return true;
    }
  }
  return false;
}

function isKiroProduct(value) {
  if (!hasPositiveKiroMention(value)) return false;
  if (isKiroNegatedMention(value)) return false;
  // Claude-Kiro 反代等是 Claude 中转面，不是 Kiro IDE 商品
  if (isClaudeMirrorProduct(value)) return false;
  if (isOtherPlatformPrimaryOverKiro(value)) return false;
  // 虚拟卡主卖：标题里带 KIRO 只是「别拍/用不了」说明
  if (
    matches(value, ["visa", "虚拟卡", "0刀", "0 刀"]) &&
    !matches(value, [
      "成品号",
      "积分",
      "额度",
      "pro",
      "power",
      "free",
      "普号",
      "账号",
      "加油包",
      "api",
      "号池",
    ])
  ) {
    return false;
  }
  return true;
}

/** 官方积分档位数字：50 / 1000 / 2000 / 5000 / 10000 */
function kiroCreditAmount(value) {
  const m = value.match(/(\d{2,5})\s*(?:积分|额度|credits?)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** IDE 成品号 / 订阅账号交付信号（区别于 API 中转） */
function hasKiroIdeAccountDelivery(value) {
  return matches(value, [
    "成品号",
    "积分账号",
    "额度号",
    "账密",
    "首登",
    "json",
    "kirors",
    "独享",
    "个人账号",
    "学生账号",
    "学生",
  ]);
}

/**
 * Claude-Kiro 渠道 / API KEY / 号池 / 刀额度日周卡 → 中转服务。
 * 「稳定大量供应中转」挂在积分账号上不算中转 SKU。
 */
function isKiroMirrorProduct(value) {
  if (!isKiroProduct(value)) return false;
  if (matches(value, ["注册机", "生成器", "源码"])) return false;

  const apiKey = matches(value, ["api key", "apikey", "api-key", "api密钥"]);
  const pool = matches(value, ["号池"]);
  const moneyQuota =
    matches(value, ["刀额度", "美元额度", "美金额度"]) ||
    /(?:\d+\s*(?:刀|美元|美金)|\d+\s*\$)\s*额度/.test(value);
  const claudeCodeMoney = matches(value, ["claude code"]) && hasMoneyAmount(value);
  const tokenPack =
    matches(value, ["token"]) &&
    (matches(value, ["api", "10m", "100m", "1m", "有效期"]) || /\d+\s*m\s*token/.test(value));
  const dayWeekCard =
    matches(value, ["日卡", "周卡", "天卡"]) &&
    !matches(value, ["成品号", "积分账号", "首登", "账密", "json", "kirors"]);
  const channelTransit = matches(value, [
    "claude-kiro",
    "claude kiro",
    "kiro渠道",
    "kiro 渠道",
    "kiro混合",
    "混合版",
  ]) &&
    (matches(value, ["日卡", "周卡", "天卡", "额度", "api", "token", "渠道", "claude code"]) ||
      moneyQuota ||
      hasMoneyAmount(value));

  const strongTransit =
    apiKey || pool || moneyQuota || claudeCodeMoney || tokenPack || dayWeekCard || channelTransit;
  if (!strongTransit) return false;

  // 明确 IDE 订阅成品 + 无强 API 信号 → 不进中转（「供应中转」话术除外）
  if (
    hasKiroIdeAccountDelivery(value) &&
    !apiKey &&
    !pool &&
    !moneyQuota &&
    !claudeCodeMoney &&
    !tokenPack &&
    !dayWeekCard &&
    !channelTransit
  ) {
    return false;
  }
  return true;
}

/**
 * 官方 add-on credits / 加油包 → 额度充值（充到已有付费账号）。
 * 「随机超额/可超额」挂在 Pro 成品号上仍是订阅号，不是加油包。
 */
function isKiroQuotaRecharge(value) {
  if (!isKiroProduct(value)) return false;
  if (isKiroMirrorProduct(value)) return false;
  if (
    matches(value, [
      "加油包",
      "add-on",
      "addon",
      "add on credits",
      "addon credits",
      "附加积分",
      "加购积分",
      "补充积分",
      "积分包",
      "额度包",
      "credits pack",
      "credit pack",
    ])
  ) {
    // 积分账号 / 成品号主体仍走订阅档
    if (hasKiroIdeAccountDelivery(value) && !matches(value, ["加油包", "add-on", "addon", "直充", "充值到"])) {
      return false;
    }
    return true;
  }
  // 「自备账号 + 充积分/加额度」且非新开成品
  if (
    matches(value, ["自备账号", "自备号", "充到", "充自己", "直充积分", "充积分"]) &&
    matches(value, ["积分", "额度", "credits"]) &&
    !hasKiroIdeAccountDelivery(value)
  ) {
    return true;
  }
  return false;
}

function isKiroPower(value) {
  if (!isKiroProduct(value)) return false;
  if (isKiroMirrorProduct(value) || isKiroQuotaRecharge(value)) return false;
  if (matches(value, ["kiro power", "kiropower", "power"])) {
    // 避免误伤无关 power；要求与 kiro 同现或明确积分档
    if (matches(value, ["kiro"]) || kiroCreditAmount(value) === 10000) return true;
  }
  if (kiroCreditAmount(value) === 10000) return true;
  // 卖家把 Power 写成 ProMax 10000
  if (matches(value, ["promax", "pro max", "pro_max"]) && kiroCreditAmount(value) === 10000) {
    return true;
  }
  return false;
}

function isKiroProMax(value) {
  if (!isKiroProduct(value)) return false;
  if (isKiroMirrorProduct(value) || isKiroQuotaRecharge(value) || isKiroPower(value)) return false;
  if (matches(value, ["pro max", "promax", "pro_max", "kiro pro max", "kiropromax"])) return true;
  if (kiroCreditAmount(value) === 5000) return true;
  return false;
}

function isKiroProPlus(value) {
  if (!isKiroProduct(value)) return false;
  if (
    isKiroMirrorProduct(value) ||
    isKiroQuotaRecharge(value) ||
    isKiroPower(value) ||
    isKiroProMax(value)
  ) {
    return false;
  }
  return (
    matches(value, ["pro+", "pro＋", "pro plus", "proplus", "kiro pro+", "kiro pro＋"]) ||
    /pro\s*\+|pro\s*plus/.test(value) ||
    kiroCreditAmount(value) === 2000
  );
}

function hasKiroFreeSignal(value) {
  return (
    matches(value, [
      "kiro free",
      "free",
      "普号",
      "普通号",
      "白号",
      "老号",
      "今日注册",
    ]) || kiroCreditAmount(value) === 50
  );
}

function isKiroFreeAccount(value) {
  if (!isKiroProduct(value)) return false;
  if (
    isKiroMirrorProduct(value) ||
    isKiroQuotaRecharge(value) ||
    isKiroPower(value) ||
    isKiroProMax(value) ||
    isKiroProPlus(value)
  ) {
    return false;
  }
  // 明确 Pro 订阅时，普号词不抢档
  if (
    matches(value, ["pro"]) &&
    matches(value, ["月卡", "成品", "独享", "代充", "直充", "订阅", "会员", "积分", "额度"])
  ) {
    return false;
  }
  return hasKiroFreeSignal(value);
}

function isKiroPro(value) {
  if (!isKiroProduct(value)) return false;
  if (
    isKiroMirrorProduct(value) ||
    isKiroQuotaRecharge(value) ||
    isKiroPower(value) ||
    isKiroProMax(value) ||
    isKiroProPlus(value)
  ) {
    return false;
  }
  // 「协助充值/帮开 Pro」是辅助，不是 Pro 成品
  if (
    matches(value, ["协助", "帮充", "帮开", "代充服务"]) &&
    !hasKiroIdeAccountDelivery(value) &&
    !matches(value, ["成品号", "积分账号", "额度号", "月卡", "首登"])
  ) {
    return false;
  }
  if (hasKiroFreeSignal(value) && !matches(value, ["pro"]) && kiroCreditAmount(value) !== 1000) {
    return false;
  }
  // 学生年账官方按 Pro 1000/月
  if (matches(value, ["学生", "student"]) && matches(value, ["kiro"])) return true;
  if (matches(value, ["kiro pro", "pro月卡", "pro 月卡", "pro成品", "pro 成品"])) return true;
  if (matches(value, ["pro"]) && matches(value, ["kiro"])) return true;
  if (kiroCreditAmount(value) === 1000) return true;
  // 未写更高档的 Kiro 月卡/订阅/代充 → Pro（裸「成品号」无档位走 Free 兜底）
  if (
    matches(value, ["月卡", "年卡", "会员", "订阅", "代充", "直充", "充值"]) &&
    !matches(value, ["日卡", "周卡", "天卡", "协助", "退款", "接码", "加油包"]) &&
    !hasKiroFreeSignal(value)
  ) {
    return true;
  }
  return false;
}

function isKiroService(value) {
  if (!isKiroProduct(value)) return false;
  if (isKiroMirrorProduct(value) || isKiroQuotaRecharge(value)) return false;
  if (isKiroPower(value) || isKiroProMax(value) || isKiroProPlus(value) || isKiroPro(value)) {
    return false;
  }
  if (hasKiroFreeSignal(value)) return false;
  if (
    matches(value, [
      "协助充值",
      "协助开通",
      "自助退款",
      "退款",
      "教程",
      "注册机",
      "生成器",
      "导入教程",
      "帮充",
      "代充服务",
    ])
  ) {
    return true;
  }
  if (
    matches(value, ["协助", "帮充"]) &&
    !matches(value, ["成品号", "独享成品", "账密", "首登", "积分账号"])
  ) {
    return true;
  }
  return false;
}

/**
 * Kiro 分流：中转 → 额度充值 → Power → Pro Max → Pro+ → Free → 辅助 → Pro
 * （辅助先于裸 Pro，避免「协助充值帮开 Pro」进订阅档）
 */
function classifyKiroProduct(value) {
  if (!isKiroProduct(value)) return null;
  if (isVerificationService(value) || isCodexPhoneVerification(value)) return null;
  if (isKiroMirrorProduct(value)) return "kiro-mirror";
  if (isKiroQuotaRecharge(value)) return "kiro-quota-recharge";
  if (isKiroPower(value)) return "kiro-power";
  if (isKiroProMax(value)) return "kiro-pro-max";
  if (isKiroProPlus(value)) return "kiro-pro-plus";
  if (isKiroFreeAccount(value)) return "kiro-free-account";
  if (isKiroService(value)) return "kiro-service";
  if (isKiroPro(value)) return "kiro-pro";
  if (hasKiroIdeAccountDelivery(value) || matches(value, ["成品号", "账号", "账密", "直登", "首登"])) {
    return "kiro-free-account";
  }
  return "kiro-service";
}

/* ---------- Claude / Gemini / Grok ---------- */

/**
 * 其它平台主卖（Kiro / Windsurf 等）标题里夹带「可用 Claude 模型」——不是在卖 Claude。
 * 例：kiro pro+ 2000积分，可用 claude opus 5.5
 */
function isNonClaudePrimaryWithClaudeMention(value) {
  // Kiro 本身是独立工具账号/额度产品，即使写了 Claude 模型名也不进 Claude 档
  // （须正向品牌；「非kiro」不算）
  if (hasPositiveKiroMention(value) && !isOtherPlatformPrimaryOverKiro(value)) return true;
  // 「可用/支持/调用 Claude …」模型能力句，且无 Claude 订阅/账号交付信号
  const modelCapability =
    /可用\s*claude|支持\s*claude|调用\s*claude|claude\s*opus|claude\s*sonnet|claude\s*haiku|claude\s*模型|claude\s*model/.test(
      value,
    );
  if (!modelCapability) return false;
  const claudeSold = matches(value, [
    "claude pro",
    "claudepro",
    "claude max",
    "claudemax",
    "claude team",
    "claude 普号",
    "claude普号",
    "claude 账号",
    "claude账号",
    "claude 成品",
    "claude成品",
    "claude 月卡",
    "claude月卡",
    "claude 直充",
    "claude直充",
    "claude 代充",
    "claude代充",
    "克劳德 pro",
    "克劳德账号",
    "克劳德成品",
  ]);
  return !claudeSold;
}

function isClaudeProduct(value) {
  if (!matches(value, ["claude", "克劳德"])) return false;
  if (isNonClaudePrimaryWithClaudeMention(value)) return false;
  return true;
}

/** 多模型合池中转（GPT/Codex/Gemini 与 Claude 并列）→ 仍归 ChatGPT 中转 */
function isMultiModelTransitHub(value) {
  const brands = [
    matches(value, ["chatgpt", "gpt", "openai", "codex"]),
    matches(value, ["gemini", "google ai"]),
    matches(value, ["claude", "anthropic", "claude code", "克劳德"]),
  ].filter(Boolean).length;
  if (brands < 2) return false;
  return matches(value, [
    "中转",
    "api",
    "倍率",
    "号池",
    "镜像",
    "余额",
    "兑换码",
    "直充",
    "额度",
    "美元额度",
    "美金额度",
    "刀额度",
  ]);
}

/**
 * Max/Pro 档位「卖账号」：速刷号、号池专供账号、成品号等。
 * 标题里的「号池」是货源（批量出号），不是 API 中转号池。
 */
function isClaudeMaxTierAccountSale(value) {
  if (!matches(value, ["claude", "克劳德"]) && !matches(value, ["max"])) return false;
  const hasTier =
    isClaudeMax20(value) ||
    isClaudeMax5(value) ||
    matches(value, ["claude max", "claudemax", "claude pro", "claudepro", "克劳德 max", "克劳德 pro"]);
  if (!hasTier) return false;
  // 明确账号/订阅交付（速刷号、号池专供账号…）
  if (
    matches(value, [
      "速刷号",
      "速刷",
      "成品号",
      "成品账号",
      "专供账号",
      "独享账号",
      "独享",
      "账密",
      "首登",
      "质保订阅",
      "质保首登",
      "人工交付",
    ])
  ) {
    return true;
  }
  // 「Max 20x 账号 / 号池…账号」——主卖账号，排除 API/刀额度中转话术
  if (
    matches(value, ["账号", "账户"]) &&
    !matches(value, ["api", "api key", "apikey", "token", "刀额度", "日卡", "周卡", "天卡", "中转", "倍率", "余额卡"])
  ) {
    return true;
  }
    return false;
  }

/**
 * Claude 中转：Claude-Kiro 反代、Claude API KEY、Claude code 刀额度/日周卡、API 调用池。
 * Max 20x 速刷号 / 号池专供账号 → 订阅档，不是中转。
 */
function isClaudeMirrorProduct(value) {
  if (isMultiModelTransitHub(value)) return false;
  // Max/Pro 速刷号、号池专供账号等 → 走 Max/Pro 订阅归类，禁止进中转
  if (isClaudeMaxTierAccountSale(value)) return false;

  // Claude-Kiro / Kiro 渠道卖 Claude 调用
  if (
    matches(value, ["claude-kiro", "claude kiro", "kiro渠道", "kiro 渠道", "kiro混合", "混合版"]) &&
    (matches(value, ["api", "api key", "apikey", "token", "刀额度", "日卡", "周卡", "天卡", "claude code"]) ||
      hasMoneyAmount(value) ||
      /(?:\d+\s*(?:刀|美元|美金)|\d+\s*\$)\s*额度/.test(value))
  ) {
    return true;
  }

  // Claude API KEY / Token 包 / API 额度中转（纯 Claude，非多模型合池）
  if (
    matches(value, ["claude", "克劳德", "anthropic"]) &&
    (matches(value, ["api key", "apikey", "api-key"]) ||
      (matches(value, ["api"]) && matches(value, ["额度", "中转", "号池", "token"])))
  ) {
    return true;
  }

  // Claude code / Claude 刀额度日周卡（非官方订阅成品）
  if (
    matches(value, ["claude code", "claude", "克劳德"]) &&
    (matches(value, ["刀额度", "美元额度", "美金额度"]) ||
      /(?:\d+\s*(?:刀|美元|美金)|\d+\s*\$)\s*额度/.test(value) ||
      (matches(value, ["日卡", "周卡", "天卡"]) && (hasMoneyAmount(value) || matches(value, ["额度", "token"]))))
  ) {
    if (
      matches(value, ["正价", "官充", "官方会员", "质保订阅", "成品号"]) &&
      matches(value, ["pro", "max", "team", "席位"]) &&
      !matches(value, ["api", "token", "号池", "api key"])
    ) {
      return false;
    }
    return true;
  }

  // Claude API 调用池 / Max·Pro 池（无「卖账号」信号才算中转）
  if (
    matches(value, ["claude", "克劳德"]) &&
    matches(value, ["号池", "池"]) &&
    !matches(value, ["team", "团队", "席位", "seat", "成品号", "月卡", "年卡", "速刷号", "专供账号"])
  ) {
    return true;
  }

  // 「每天 N 刀 claude code」类额度中转
  if (matches(value, ["claude code"]) && hasMoneyAmount(value) && matches(value, ["每天", "有效期", "小时", "天"])) {
    return true;
  }

  return false;
}

/**
 * Claude 辅助：协助充值、退款教程、代提链等。
 * Claude KYC 认证（接码/验证）是独立类型，绝不并入本档。
 */
function isClaudeService(value) {
  if (!matches(value, ["claude", "克劳德", "anthropic"])) return false;
  if (isClaudeMirrorProduct(value)) return false;
  if (isNonClaudePrimaryWithClaudeMention(value) && !matches(value, ["代提链", "提链接", "提链"])) {
    return false;
  }
  // KYC 认证服务 → claude-kyc，禁止进辅助
  if (isClaudeKycServiceDelivery(value) || isIdentityVerificationService(value)) {
    return false;
  }
  if (
    matches(value, ["kyc", "persona", "人脸", "真人认证", "实名认证"]) &&
    !matches(value, ["代提链", "提链接", "提链", "提取kyc", "提取 kyc", "kyc链接", "kyc 链接"])
  ) {
    return false;
  }
  if (
    matches(value, [
      "代提链",
      "提链接",
      "提链",
      "kyc链接",
      "kyc 链接",
      "提取kyc",
      "提取 kyc",
      "协助充值",
      "帮充",
      "自助退款",
      "退款服务",
      "教程",
      "额度重置",
      "重置额度",
    ])
  ) {
    return true;
  }
  if (
    matches(value, ["协助", "帮充"]) &&
    !matches(value, ["成品号", "月卡", "账密", "首登", "独享", "官充", "正价"])
  ) {
    return true;
  }
  return false;
}

function classifyClaudeMirrorOrService(value) {
  if (isClaudeMirrorProduct(value)) return "claude-mirror";
  if (isClaudeService(value)) return "claude-service";
  return null;
}

/**
 * 参考站 isClaudeMax20Product — 可无「claude」字样（Max20X 成品号）。
 * 数字边界加固：禁止 120x / 50x 误命中（参考站 原版 includes 会误伤）。
 */
function isClaudeMax20(value) {
  if (
    matches(value, [
      "chatgpt",
      "gpt",
      "openai",
      "gemini",
      "grok",
      "kiro",
      "windsurf",
      "perplexity",
      "suno",
      "dreamina",
      "即梦",
      "seedance",
      "duolingo",
      "多邻国",
      "muse",
    ])
  ) {
    return false;
  }
  const hasClaude = isClaudeProduct(value);
  const hasMax = matches(value, ["max"]);
  if (!hasClaude && !hasMax) return false;
  if (
    /(?:^|[^0-9a-z])max\s*20(?:\s*x)?(?:$|[^0-9a-z])|(?:^|[^0-9])20\s*x(?:\s*max)?(?:$|[^0-9a-z])|(?:^|[^0-9a-z])x\s*20(?:$|[^0-9a-z])|(?:^|[^0-9])20\s*倍|(?:^|[^0-9a-z])20\s*max(?:$|[^0-9a-z])/.test(
      value,
    )
  ) {
    return true;
  }
  return hasMax && /(?:max.*200|200\s*(?:usd|刀|美金|美元|订阅))/.test(value);
}

/** 参考站 isClaudeMax5Product + 数字边界（禁止 max 50x） */
function isClaudeMax5(value) {
  if (
    matches(value, [
      "chatgpt",
      "gpt",
      "openai",
      "gemini",
      "grok",
      "kiro",
      "windsurf",
      "perplexity",
      "suno",
      "dreamina",
      "即梦",
      "seedance",
      "duolingo",
      "多邻国",
      "muse",
    ])
  ) {
    return false;
  }
  const hasClaude = isClaudeProduct(value);
  const hasMax = matches(value, ["max"]);
  if (!hasClaude && !hasMax) return false;
  if (isClaudeMax20(value)) return false;
  if (
    /(?:^|[^0-9a-z])max\s*5(?:\s*x)?(?:$|[^0-9a-z])|(?:^|[^0-9])5\s*x(?:\s*max)?(?:$|[^0-9a-z])|(?:^|[^0-9a-z])x\s*5(?:$|[^0-9a-z])|(?:^|[^0-9])5\s*倍|(?:^|[^0-9a-z])5\s*max(?:$|[^0-9a-z])/.test(
      value,
    )
  ) {
    return true;
  }
  return hasMax && /(?:max.*100|100\s*(?:usd|刀|美金|美元|订阅))/.test(value);
}

/** 参考站 isClaudeTeamProduct */
function isClaudeTeamProduct(value) {
  return isClaudeProduct(value) && matches(value, ["team", "团队", "席位", "seat"]);
}

/** 参考站 isClaudeTeamPremium */
function isClaudeTeamPremium(value) {
  if (!isClaudeProduct(value)) return false;
  const hasPremiumSignal = matches(value, [
    "premium",
    "高级席位",
    "高级",
    "6.25x",
    "6.25 x",
    "6.25倍",
    "6.25 倍",
  ]);
  if (!hasPremiumSignal) return false;
  return isClaudeTeamProduct(value) || matches(value, ["6.25x", "6.25 x", "6.25倍", "6.25 倍"]);
}

/** 参考站 isClaudeTeamStandard */
function isClaudeTeamStandard(value) {
  if (!isClaudeTeamProduct(value)) return false;
  if (isClaudeTeamPremium(value)) return false;
  return matches(value, [
    "team",
    "团队",
    "席位",
    "seat",
    "standard",
    "标准",
    "1.25x",
    "1.25 x",
    "1.25倍",
    "1.25 倍",
  ]);
}

/**
 * Claude 普号 / free / 白号。
 * 「可开 Pro 套餐」只是能力说明，不是 Pro 订阅本身。
 */
function isClaudeFreeAccount(value) {
  if (!isClaudeProduct(value)) return false;
  // 明确 Pro/Max/Team 成品时，不因夹带「free」误伤（极少见）；普号信号优先
  const freeSignal =
    matches(value, ["普号", "白号", "普通号", "普通账号", "空白账号", "普通帐号"]) ||
    /\bfree\b/.test(value);
  if (!freeSignal) return false;
  // 「Claude Pro 普号」这种矛盾标题极少；若同时写死 Pro 月卡/直充成品，仍以 Pro 为准
  if (
    matches(value, ["claude pro", "claudepro"]) &&
    matches(value, ["月卡", "直充", "代充", "官方直充", "成品号", "pro成品", "pro 成品"]) &&
    !matches(value, ["普号", "白号", "普通号"])
  ) {
    return false;
  }
  return true;
}

/** 去掉「可以开 pro / 可开 pro 套餐」等能力句，避免普号被拖进 Pro。 */
function stripClaudeProCapabilityMentions(value) {
  return String(value || "")
    .replace(/可以\s*开\s*pro(?:\s*套餐)?/g, " ")
    .replace(/可\s*开\s*pro(?:\s*套餐)?/g, " ")
    .replace(/能\s*开\s*pro(?:\s*套餐)?/g, " ")
    .replace(/开通\s*pro(?:\s*套餐)?/g, " ")
    .replace(/开\s*pro(?:\s*套餐|\s*会员)?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Claude Pro：pro / 尼区 / 月卡 / 直充 …（不含「可开 pro」能力句、不含普号 free） */
function isClaudeProMonth(value) {
  if (!isClaudeProduct(value)) return false;
  if (isClaudeFreeAccount(value)) return false;
  if (isClaudeMax5(value) || isClaudeMax20(value) || isClaudeTeamPremium(value) || isClaudeTeamStandard(value)) {
    return false;
  }
  const stripped = stripClaudeProCapabilityMentions(value);
  return matches(stripped, ["pro", "尼区", "月卡", "直充", "代充", "充值", "续费", "订阅", "激活码", "卡密"]);
}

function isGeminiProduct(value) {
  if (matches(value, ["失败的号", "失败号", "非gemini", "非 gemini"])) return false;
  // 虚拟卡标题夹带 Gemini 适用性说明（别拍/用不了）——不是在卖 Gemini
  if (
    matches(value, ["visa", "虚拟卡", "0刀", "0 刀"]) &&
    matches(value, ["别拍", "用不了", "无售后", "介意别拍"]) &&
    !matches(value, ["gemini pro", "google ai", "年卡", "成品号", "订阅", "会员"])
  ) {
    return false;
  }
  if (
    matches(value, ["gmail", "谷歌邮箱", "google 邮箱", "google邮箱"]) &&
    !matches(value, ["gemini", "google ai", "ai ultra", "ai pro"])
  ) {
    return false;
  }
  if (matches(value, ["gcp", "谷歌云", "反重力"]) && matches(value, ["pro12个月", "pro 12个月", "12个月", "一年"])) {
    return true;
  }
  return (
    matches(value, ["gemini", "google ai", "ai ultra"]) ||
    (matches(value, ["pixel"]) && matches(value, ["pro", "会员", "订阅"]))
  );
}

function isGeminiUltra(value) {
  if (matches(value, ["pro ultra", "pro uitra", "ai pro ultra", "ai pro uitra"])) return false;
  if (matches(value, ["google ai ultra", "gemini ultra", "ai ultra", "企业 ultra", "企业ultra"])) return true;
  if (
    matches(value, ["250美元", "250 美元", "250美金", "250 美金", "250刀", "45k", "25k"]) &&
    matches(value, ["gemini", "google ai", "ultra", "flow"])
  ) {
    return true;
  }
  if (matches(value, ["gemini pro", "google ai pro", "ai pro", "pro 12个月", "pro12个月"])) return false;
  // 纯 flow 积分号（生图/生视频）≠ Ultra 订阅；须同时有 ultra 信号
  if (matches(value, ["flow", "积分号", "flow积分"]) && !matches(value, ["ultra", "ai ultra", "gemini ultra"])) {
    return false;
  }
  return matches(value, ["flow"]) && matches(value, ["gemini", "google ai", "ultra"]);
}

/** 标题明确否定成品交付（卡密/链接加开，不是卖号） */
function isGeminiNegatedFinished(value) {
  return (
    matches(value, ["不是成品", "非成品", "不是成品号", "非成品号", "不是成品看清楚"]) ||
    /不是\s*成品|非\s*成品/.test(value)
  );
}

/**
 * 明确成品账号交付。禁止裸匹配「成品」——「不是成品」会 includes 命中。
 */
function isGeminiFinishedDelivery(value) {
  if (isGeminiNegatedFinished(value)) return false;
  if (isGeminiFamilySeatService(value)) return false;
  return (
    matches(value, [
      "成品号",
      "pixel成品",
      "会员成品",
      "成品会员",
      "成品pro",
      "成品 pro",
      "成品账号",
      "一年成品",
      "年卡成品",
      "质保首登",
      "保首登",
      "包首登",
      "老邮箱",
      "老号",
      "直登号",
      "直登",
      "账密",
      "带rt",
      "带 rt",
      "带2fa",
      "带 2fa",
      "人机验证号",
    ]) ||
    // 「一年成品 / 12个月成品」等时长+成品（已排除不是成品）
    /(?:一年|年卡|12\s*个月|18\s*个月|18月).{0,6}成品|成品.{0,6}(?:一年|年卡|号)/.test(value)
  );
}

/** 订阅/激活链接面（充自己号），不是成品号 */
function isGeminiLinkActivation(value) {
  if (isGeminiFinishedDelivery(value)) return false;
  if (
    matches(value, [
      "订阅链接",
      "兑换链接",
      "激活链接",
      "优惠链接",
      "开通链接",
      "领取链接",
      "优惠订阅链接",
      "会员开通链接",
      "开通自己账号",
      "不用账号密码",
      "点开链接即可",
    ])
  ) {
    return true;
  }
  // 「18个月/一年 + 链接」且无成品交付
  if (
    matches(value, ["链接"]) &&
    matches(value, ["18个月", "18 个月", "12个月", "12 个月", "一年", "一年半", "pro"]) &&
    !matches(value, ["成品号", "成品会员", "质保首登", "包首登", "老邮箱"])
  ) {
    return true;
  }
  return false;
}

function isGeminiSelfRecharge(value) {
  return (
    isGeminiLinkActivation(value) ||
    matches(value, [
      "自备账号",
      "自备 账号",
      "自己号",
      "自己的号",
      "充自己号",
      "充自己的号",
      "官方充值",
      "官方开通",
      "官充",
      "直充",
      "cdk",
      "优惠链接",
      "领取",
      "激活链接",
      "兑换链接",
      "订阅链接",
      "开通链接",
      "一键卡",
      "代充",
      "自助充值",
      "自助开通",
      "增加额度",
      "加额度",
    ])
  );
}

/** 成品账号交付信号（不含家庭组席位/拼车邀请；不含「不是成品」） */
function isGeminiAccount(value) {
  return isGeminiFinishedDelivery(value);
}

function isGeminiRecharge(value) {
  if (!isGeminiProduct(value) || isGeminiUltra(value)) return false;
  if (isGeminiMirrorProduct(value) || isGeminiService(value)) return false;
  // Flow 积分号是卖号，不是 Pro 兑换链接充值
  if (isGeminiFlowAccount(value)) return false;
  // 明确「不是成品」的 Pro 时长卡密/链接批次 → 充值开通
  if (isGeminiNegatedFinished(value)) return true;
  // 订阅/激活链接（无成品交付）
  if (isGeminiLinkActivation(value)) return true;

  const hasRecharge = matches(value, [
    "官方充值",
    "官方开通",
    "充值",
    "代充",
    "直充",
    "开通",
    "cdk",
    "兑换",
    "兑换码",
    "优惠链接",
    "领取",
    "激活链接",
    "兑换链接",
    "订阅链接",
    "开通链接",
    "一键卡",
    "卡密",
    "续费",
    "充自己号",
    "自备账号",
    "自己号",
    "自助充值",
    "自助开通",
    "提取",
    "增加额度",
    "加额度",
  ]);
  if (!hasRecharge) return false;
  // 「协助开通」无链接/CDK → 辅助服务，不是充值 SKU
  if (
    matches(value, ["协助开通", "协助充值", "帮开", "帮充"]) &&
    !matches(value, ["兑换链接", "激活链接", "优惠链接", "订阅链接", "cdk", "直充", "官充", "一键卡"])
  ) {
    return false;
  }
  // 已是成品号主卖（链接开通的成品会员号）→ 不进充值
  if (isGeminiFinishedDelivery(value) && !isGeminiSelfRecharge(value)) return false;
  if (isGeminiFinishedDelivery(value) && matches(value, ["成品号", "成品会员", "质保首登", "包首登", "老邮箱"])) {
    // 「链接开通成品号」仍是卖号
    return false;
  }
  return true;
}

function isGeminiYear(value) {
  if (!isGeminiProduct(value) || isGeminiUltra(value) || isGeminiRecharge(value)) return false;
  if (
    isGeminiMirrorProduct(value) ||
    isGeminiService(value) ||
    isGeminiFlowAccount(value) ||
    isGeminiFamilySeatService(value)
  ) {
    return false;
  }
  // 不是成品 / 纯订阅链接 → 绝不是年卡成品
  if (isGeminiNegatedFinished(value)) return false;
  if (isGeminiLinkActivation(value)) return false;

  // 必须有明确成品交付；禁止仅靠「18个月」把卡密/链接扫进成品号
  if (isGeminiFinishedDelivery(value)) return true;

  // 年卡本身即成品订阅档（无链接/卡密）
  if (matches(value, ["年卡"]) && !matches(value, ["卡密", "cdk", "链接", "兑换码", "席位", "拼车"])) {
    return true;
  }

  // 时长 + 账号号源（一年号/会员/一年成品）且无链接卡密
  const hasDuration = matches(value, [
    "一年",
    "12个月",
    "12 个月",
    "18个月",
    "18 个月",
    "18月",
    "一年半",
    "三个月",
    "3个月",
  ]);
  if (!hasDuration) return false;
  if (matches(value, ["卡密", "cdk", "链接", "兑换码"])) return false;
  return matches(value, ["一年号", "一年成品", "会员", "账号", "账户", "邮箱", "pixel"]);
}

/** 多品牌网页镜像（GPT/Claude/Gemini 并列）→ ChatGPT 中转，不进 Gemini 板 */
function isMultiBrandMirrorSite(value) {
  if (!matches(value, ["镜像站", "网页镜像", "镜像日卡", "镜像", "mirror"])) return false;
  const brands = [
    matches(value, ["chatgpt", "gpt", "openai", "plus"]),
    matches(value, ["claude", "anthropic", "克劳德"]),
    matches(value, ["gemini", "google ai"]),
    matches(value, ["grok", "super grok"]),
  ].filter(Boolean).length;
  if (brands >= 2) return true;
  return matches(value, ["等镜像", "等多模型", "一号多用", "全家桶"]);
}

/**
 * Gemini 中转：网页镜像 / API KEY / 号池站直连。
 * 成品号标题里的「反重力/反代/中转推荐」是账号用途说明，不是中转 SKU。
 */
function isGeminiMirrorProduct(value) {
  if (isMultiModelTransitHub(value) || isMultiBrandMirrorSite(value)) return false;
  if (!matches(value, ["gemini", "google ai", "谷歌 ai"])) return false;

  // 卖账号/年卡/席位时夹带反代·反重力 → 不是中转
  if (
    matches(value, ["成品号", "成品账号", "会员账号", "老号", "老邮箱", "家庭组", "席位", "年卡", "18个月", "12个月"]) &&
    matches(value, ["反重力", "antigravity", "反代", "中转推荐", "禁止反代"])
  ) {
    return false;
  }
  if (matches(value, ["成品号", "成品账号", "会员成品", "质保首登"]) && !matches(value, ["网页镜像", "镜像站", "api key", "apikey"])) {
    return false;
  }

  // Gemini API KEY / 官网 apikey
  if (matches(value, ["api key", "apikey", "api-key", "官网api", "官网 api", "官网apikey"])) {
    return true;
  }
  if (matches(value, ["api"]) && matches(value, ["中转", "额度", "key", "密钥"])) {
  return true;
}

  // 纯 Gemini 网页镜像（无 GPT/Claude 并列）
  if (
    matches(value, ["网页镜像", "镜像站", "镜像日卡", "镜像周卡"]) &&
    !matches(value, ["chatgpt", "gpt", "openai", "claude", "克劳德", "codex"])
  ) {
    return true;
  }

  // 号池站 / 国内直连 Gemini（兑换码面，非成品号）
  if (
    matches(value, ["号池站", "号池"]) &&
    matches(value, ["直连", "兑换码", "月会员", "国内"]) &&
    !matches(value, ["成品号", "成品账号", "质保首登", "老号"])
  ) {
    return true;
  }

  return false;
}

/**
 * Flow 积分号：卖的是带积分的账号/批发号，不是「往自备账号充 AI 点数」。
 * 官方虽有 Google One AI 点数购买，卡网现货几乎无代充入口 → 不做额度充值档，归未分档。
 */
function isGeminiFlowAccount(value) {
  if (!matches(value, ["gemini", "google ai", "flow", "谷歌生图", "谷歌生视频"])) return false;
  if (isGeminiUltra(value) && matches(value, ["家庭组", "席位", "质保订阅", "ultra"])) {
    return false;
  }
  // Pro/Ultra 成品顺带写「可刷 flow」≠ 积分号主卖
  if (matches(value, ["成品号", "成品账号", "18个月", "12个月", "年卡", "会员成品", "家庭组席位"])) {
    return false;
  }
  return (
    matches(value, ["flow积分号", "flow 积分号", "flow积分包", "flow 积分包", "积分号"]) ||
    (matches(value, ["flow"]) && matches(value, ["积分"]) && matches(value, ["批发", "生图", "生视频", "积分号"])) ||
    (/\d+\s*flow/.test(value) && matches(value, ["积分", "积分号", "批发"]))
  );
}

/**
 * 家庭组席位 / 拼车 / 自动邀请：自备 Google 号入组，对齐 GPT「周边与自助」。
 * 不是成品号，也不是兑换链接充值。
 */
function isGeminiFamilySeatService(value) {
  if (!matches(value, ["gemini", "google ai"])) return false;
  // 明确卖账号/凭证 → 成品
  if (
    matches(value, [
      "成品号",
      "成品账号",
      "质保首登",
      "保首登",
      "老邮箱",
      "老号",
      "账密",
      "直登",
      "带rt",
      "带 rt",
      "带2fa",
      "个人版",
    ])
  ) {
    return false;
  }
  // 拼车 / 自动·自助邀请入组
  if (
    matches(value, ["拼车", "自动邀请", "自助邀请", "邀请卡", "邀请码", "邀请链接", "自助邀请网站"])
  ) {
    return true;
  }
  // 家庭组席位/车位（月卡·可续期·全程质保）——自备号入组，非整号交付
  if (
    matches(value, ["家庭组席位", "家庭组车位", "家庭组"]) &&
    matches(value, ["席位", "车位", "月卡", "可续期", "全程质保", "自动邀请", "拼车"])
  ) {
    return true;
  }
  if (matches(value, ["家庭组席位", "家庭组车位"])) return true;
  return false;
}

/**
 * Gemini 周边与自助：家庭组席位邀请、协助开通、退款、教程。
 * 兑换链接/CDK/直充 → gemini-recharge；成品号 → gemini-year。
 */
function isGeminiService(value) {
  if (!matches(value, ["gemini", "google ai"])) return false;
  if (isGeminiMirrorProduct(value) || isGeminiFlowAccount(value)) return false;
  // 家庭组/拼车/自动邀请优先（可压过 Ultra 字样）
  if (isGeminiFamilySeatService(value)) return true;
  // 明确订阅交付链路优先（链接/CDK），不算「协助」空话
  if (
    matches(value, ["兑换链接", "激活链接", "优惠链接", "cdk", "一键卡", "直充", "官充", "成品号", "成品账号"])
  ) {
    return false;
  }
  if (matches(value, ["自助退款", "退款服务", "教程", "注册教程", "导入教程"])) return true;
  if (
    matches(value, ["协助开通", "协助充值", "帮开", "帮充", "协助"]) &&
    !matches(value, ["18个月", "12个月", "年卡", "链接"])
  ) {
    return true;
  }
  return false;
}

function classifyGeminiMirrorOrService(value) {
  if (isGeminiMirrorProduct(value)) return "gemini-mirror";
  if (isGeminiService(value)) return "gemini-service";
  // Flow 积分号 → 未分档（非额度充值）
  if (isGeminiFlowAccount(value)) return "gemini-pro";
  return null;
}

/** 是否为纯 X/推特会员标题（未捆绑 Grok） */
function isPureXMembershipTitle(value) {
  if (
    !matches(value, [
      "x premium",
      "xpremium",
      "x premium+",
      "xpremium+",
      "twitter premium",
      "twitter premium+",
      "推特会员",
      "推特premium",
      "推特 premium",
      "推特premium+",
      "x会员",
      "x 会员",
      "旧版 x premium",
      "旧版x premium",
    ])
  ) {
    return false;
  }
  // 捆绑 Super/Grok 仍走 Grok 订阅档
  if (/gr[o0]k|gork|xai|super\s*grok|supergrok|\bgro\s*(?:super|heavy|ultra|plus|lite)/.test(value)) {
    return false;
  }
  if (matches(value, ["super grok", "grok", "heavy", "lite", "xai"])) return false;
  return true;
}

function isPureXPremiumPlus(value) {
  if (!isPureXMembershipTitle(value)) return false;
  return (
    matches(value, ["premium+", "premium＋", "premium plus", "premiumplus", "推特premium+", "x premium+"]) ||
    /premium\s*\+|premium\s*plus/.test(value)
  );
}

/** 纯 X Premium（不含 Premium+） */
function isPureXPremium(value) {
  if (!isPureXMembershipTitle(value)) return false;
  if (isPureXPremiumPlus(value)) return false;
  return true;
}

function classifyXMembership(value) {
  if (isPureXPremiumPlus(value)) return "x-twitter-premium-plus";
  if (isPureXPremium(value)) return "x-twitter-premium";
  return null;
}

/** 「对标 SuperGrok / 替代 gro」类提及，不是在卖 Grok（如 Muse / 即梦文案） */
function isGrokMentionOnly(value) {
  if (matches(value, ["muse ai", "muse邀请", "muse成品", "muse 成品", "dreamina", "即梦", "seedance"])) {
    return true;
  }
  if (matches(value, ["对标", "替代"]) && matches(value, ["super grok", "supergrok", "grok", "gro"])) {
    return true;
  }
  return false;
}

function isGrokProduct(value) {
  if (matches(value, ["chatgpt", "gpt", "openai", "claude", "gemini"])) return false;
  // 「cursor勿拍 / 无cursor」是否定提及，不挡 Grok；真 Cursor 商品由上游 Cursor 分流
  if (matches(value, ["cursor"]) && !isCursorNegatedMention(value)) return false;
  if (isPureXMembershipTitle(value)) return false;
  // Muse / 即梦「对标 SuperGrok / 替代 gro」等文案不是在卖 Grok
  if (isGrokMentionOnly(value)) return false;
  // 含常见笔误 gro / gr0k / gork / SuperGro
  return /gr[o0]k|xai|super\s*grok|gork|supergrok|\bgro\s*(?:super|ultra|plus|premium|free|heavy|lite|普号)/.test(
    value,
  );
}

/** Ultra / 200刀 / 原 SuperGrok Heavy */
function isGrokUltra(value) {
  if (!isGrokProduct(value)) return false;
  // 否定模式必须整体分组，避免 `|` 把「无 heavy」拆成「任意 ultra」误伤
  if (hasNearbyNegation(value, "(?:heavy|ultra)")) return false;
  return (
    matches(value, [
      "heavy",
      "ultra",
      "grok ultra",
      "gro ultra",
      "gr0k ultra",
      "grokheavy",
      "grok heavy",
      "heavy grok",
      "super grok heavy",
      "supergrok heavy",
      "原 heavy",
      "原heavy",
    ]) ||
    (/(?:^|[^0-9])200\s*(?:刀|美金|美元|usd|\$)/.test(value) &&
      /gr[o0]k|gork|xai|super\s*grok|\bgro\b/.test(value)) ||
    (/heavy|ultra/.test(value) && /gr[o0]k|super grok|xai|gork|\bgro\b/.test(value))
  );
}

/** Super / 100刀 / 原 SuperGrok Plus — 须先于 Premium（旧名 Super Grok） */
function isGrokSuperTier(value) {
  if (!isGrokProduct(value)) return false;
  if (isGrokUltra(value)) return false;
  if (hasNearbyNegation(value, "(?:super(?:\\s*grok)?\\s*plus|grok\\s*super|gro\\s*super)")) return false;
  // 明确 100 刀 / 15x / SuperGrok Plus / Grok Super（非「Super Grok」旧称）
  if (
    matches(value, [
      "super grok plus",
      "supergrok plus",
      "supergrokplus",
      "grok super",
      "gro super",
      "原 super grok plus",
      "原supergrok plus",
    ])
  ) {
    return true;
  }
  if (
    /(?:^|[^0-9])100\s*(?:刀|美金|美元|usd|\$)/.test(value) &&
    /gr[o0]k|gork|xai|super\s*grok|\bgro\b/.test(value)
  ) {
    return true;
  }
  if (/(?:^|[^0-9])15\s*x(?:$|[^0-9a-z])/.test(value) && /gr[o0]k|gork|xai|\bgro\b/.test(value)) {
    return true;
  }
  // 「grok super」已在 matches；避免把「super grok」旧称误进本档
  return false;
}

/** Plus / 8刀 / 原 SuperGrok Lite */
function isGrokPlusTier(value) {
  if (!isGrokProduct(value)) return false;
  if (isGrokUltra(value) || isGrokSuperTier(value)) return false;
  if (
    matches(value, [
      "lite",
      "super grok lite",
      "supergrok lite",
      "supergro lite",
      "grok plus",
      "grokplus",
      "原 lite",
      "原lite",
      "原 super grok lite",
    ])
  ) {
    return true;
  }
  if (/(?:^|[^0-9])8\s*(?:刀|美金|美元|usd|\$)/.test(value) && /gr[o0]k|gork|xai|super\s*grok|lite/.test(value)) {
    return true;
  }
  return false;
}

/**
 * Premium / 30刀 / 原 SuperGrok（标题常写 Super Grok / SuperGrok，不含 Plus/Lite/Heavy）
 */
function isGrokPremium(value) {
  if (!isGrokProduct(value)) return false;
  if (isGrokUltra(value) || isGrokSuperTier(value) || isGrokPlusTier(value)) return false;
  if (hasGrokFreeSignal(value) && !matches(value, ["super", "premium", "超级"])) return false;
  // 辅助面不抢订阅
  if (
    matches(value, ["协助充值", "日卡", "周卡", "天卡", "自助退款", "使用教程", "充值教程"]) &&
    !matches(value, ["成品号", "独享成品", "官方直充", "官方充值", "正价", "cdk", "卡密", "正规实付"])
  ) {
    return false;
  }
  if (
    matches(value, [
      "premium",
      "超级grok",
      "超级 grok",
      "super grok",
      "supergrok",
      "super gork",
      "grok premium",
      "原 super grok",
      "原supergrok",
      "x premium super grok",
      "x premium+ super grok",
      "x-premium+super grok",
      "x-premium+ super grok",
    ])
  ) {
    return true;
  }
  if (/(?:^|[^0-9])30\s*(?:刀|美金|美元|usd|\$)/.test(value) && /gr[o0]k|gork|xai|super\s*grok/.test(value)) {
    return true;
  }
  // 泛「super + grok」且非 plus/lite/heavy → Premium（旧名 SuperGrok）
  if (/super/.test(value) && /gr[o0]k|xai|gork/.test(value)) return true;
  return false;
}

function hasGrokFreeSignal(value) {
  return (
    matches(value, [
      "普号",
      "白号",
      "普通号",
      "普通账号",
      "体验号",
      "试用号",
      "free号",
      "free 号",
      "grok free",
      "free grok",
      "free auto",
      "gro free",
    ]) || /\bfree\b/.test(value)
  );
}

function isGrokFreeAccount(value) {
  if (!isGrokProduct(value)) return false;
  if (isGrokUltra(value) || isGrokSuperTier(value) || isGrokPlusTier(value) || isGrokPremium(value)) {
    return false;
  }
  return hasGrokFreeSignal(value);
}

/** 日/周卡、协助充值、自助退款、教程等 */
function isGrokService(value) {
  if (!isGrokProduct(value)) return false;
  if (isGrokFreeAccount(value)) return false;
  if (isGrokUltra(value)) return false;
  if (
    (isGrokPremium(value) || isGrokSuperTier(value) || isGrokPlusTier(value)) &&
    matches(value, ["成品号", "独享", "正价", "官方充值", "官方直充", "正规实付", "月卡", "年卡", "直充", "代充", "cdk", "卡密"])
  ) {
    return false;
  }
  if (
    matches(value, [
      "日卡",
      "周卡",
      "天卡",
      "协助充值",
      "自助退款",
      "退款",
      "使用教程",
      "充值教程",
      "教程",
      "插件",
    ])
  ) {
    return true;
  }
  if (
    matches(value, ["协助", "帮充", "代充服务"]) &&
    !matches(value, ["成品号", "独享成品", "账密", "首登", "官方直充", "官方充值"])
  ) {
    return true;
  }
  return false;
}

/** 标题里写明的美元档：8→Plus，30/90(3个月)→Premium，100→Super，200/300→Ultra；出现多个档位不判 */
const GROK_USD_TIERS = { 8: "grok-plus", 30: "grok-premium", 90: "grok-premium", 100: "grok-super", 200: "grok-ultra", 300: "grok-ultra" };
function grokUsdTier(value) {
  const re = /\$\s*(\d+)(?![\d.])|(?:^|[^\d.])(\d+)\s*(?:刀|美金|美元|美刀|usd|\$)/g;
  const found = new Set();
  for (const m of value.matchAll(re)) {
    const tier = GROK_USD_TIERS[Number(m[1] || m[2])];
    if (tier) found.add(tier);
  }
  return found.size === 1 ? [...found][0] : null;
}

/** 标题里的订阅时长（月），读不出按 1 个月 */
function grokMonths(value) {
  if (/年卡|一年|(?:^|[^\d])1\s*年|12\s*个?月/.test(value)) return 12;
  const cn = { 一: 1, 两: 2, 二: 2, 三: 3, 六: 6 };
  const m = value.match(/(\d+|[一两二三六])\s*个?月/);
  if (m) return Number(m[1]) || cn[m[1]] || 1;
  if (/周卡|一周|(?:^|[^\d])7\s*天/.test(value)) return 0.25;
  const d = value.match(/(\d+)\s*(?:[-~～]\s*\d+\s*)?天/);
  if (d) return Math.max(Number(d[1]) / 30, 0.1);
  return 1;
}

/**
 * 「Grok Super / gro Super」可能是旧名 SuperGrok（30 刀，现 Premium），也可能是新 Super（100 刀）。
 * 没有 100 刀 / 15x / SuperGrok Plus 这类明确信号时，按报价月均价判：低于阈值算 Premium。
 */
const GROK_SUPER_MIN_MONTHLY_CNY = 350;
function isGrokSuperOldNamePremium(value, price) {
  if (matches(value, ["super grok plus", "supergrok plus", "supergrokplus"])) return false;
  if (/(?:^|[^0-9])15\s*x(?:$|[^0-9a-z])/.test(value)) return false;
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return false;
  return p / grokMonths(value) < GROK_SUPER_MIN_MONTHLY_CNY;
}

/**
 * Grok 分流（对照参考站档位）：
 * Ultra → Super → Plus → Premium → 普号 → 辅助 → 残留兜底
 */
function classifyGrokProduct(value, opts = {}) {
  if (!isGrokProduct(value)) return null;
  if (isVerificationService(value) || isCodexPhoneVerification(value)) return null;
  if (isGrokUltra(value)) return "grok-ultra";
  {
    const usdTier = grokUsdTier(value);
    if (usdTier) return usdTier;
  }
  if (isGrokSuperTier(value)) {
    return isGrokSuperOldNamePremium(value, opts.price) ? "grok-premium" : "grok-super";
  }
  if (isGrokPlusTier(value)) return "grok-plus";
  if (isGrokPremium(value)) return "grok-premium";
  if (isGrokFreeAccount(value)) return "grok-account";
  if (isGrokService(value)) return "grok-service";
  if (matches(value, ["成品号", "账号", "账密", "白号", "直登", "首登", "独享号"])) {
    return "grok-account";
  }
  // 未写档位的订阅/充值信号 → Premium（最常见旧名 Super Grok 面）
  if (matches(value, ["月卡", "年卡", "会员", "订阅", "代充", "直充", "充值", "cdk", "卡密", "激活码"])) {
    return "grok-premium";
  }
  return "grok-service";
}

function classifyMirrorSite(value) {
  // 多品牌镜像合池 → ChatGPT 中转
  if (isMultiBrandMirrorSite(value) || isMultiModelTransitHub(value)) {
    return "chatgpt-mirror";
  }
  // Grok 镜像：按档位挂订阅面（无档则 Premium）
  if (isGrokProduct(value)) {
    const grokSlug = classifyGrokProduct(value);
    if (grokSlug && grokSlug !== "grok-account" && grokSlug !== "grok-service") return grokSlug;
    return "grok-premium";
  }
  // Gemini / Claude 纯品牌网页镜像 → 各板「中转服务」
  if (isGeminiMirrorProduct(value)) return "gemini-mirror";
  if (isClaudeMirrorProduct(value)) return "claude-mirror";
  if (isGeminiProduct(value) && matches(value, ["网页镜像", "镜像站", "镜像"])) {
    return "gemini-mirror";
  }
  if (isClaudeProduct(value) && matches(value, ["网页镜像", "镜像站", "镜像"])) {
    return "claude-mirror";
  }
  // GPT 镜像站 / 网页中转 → 独立「中转服务」标准品（不再并入 Plus；对照 参考站 仍挂 Plus+facet）
  if (isChatGptPro500(value)) return "chatgpt-pro-500";
  if (isChatGptPro20(value)) return "chatgpt-pro-20x";
  if (isChatGptPro5(value)) return "chatgpt-pro-5x";
  if (isChatGptMirrorTransit(value) || isChatGptProduct(value)) return "chatgpt-mirror";
  return null;
}

/**
 * @param {string} title
 * @param {{ price?: number | null }} [opts] 报价（元），用于 Grok Super 旧名按月均价判档
 * @returns {{ productSlug: string | null, warranty: boolean }}
 */
export function classifyTitle(title, opts = {}) {
  const text = normalizeTitle(title);
  const warranty = isLongWarrantyTitle(title);
  if (!text) return { productSlug: null, warranty };

  // 参考站 order (trimmed to seeds we ship)
  if (isPriceAdjustmentListing(text)) return { productSlug: null, warranty };

  // 其他板抢先：礼品卡 / 虚拟卡 / Apple ID / TG（避免误进 GPT/Claude/邮箱）
  {
    const earlyOther = classifyOtherEarly(text);
    if (earlyOther) return { productSlug: earlyOther, warranty };
  }

  // 纯 X Premium / Premium+ → Grok 板块 X 渠道（未捆绑 Grok）
  {
    const xSlug = classifyXMembership(text);
    if (xSlug) return { productSlug: xSlug, warranty };
  }

  // 教程 / 脚本：ChatGPT / Cursor / Grok / Kiro / Gemini / Claude → 各平台辅助服务；其余不进订阅卡
  if (isTutorialOrScriptListing(text)) {
    if (matches(text, ["cursor"]) && !isCursorNegatedMention(text)) {
      return { productSlug: "cursor-service", warranty };
    }
    if (isGrokProduct(text)) {
      return { productSlug: "grok-service", warranty };
    }
    if (isKiroProduct(text)) {
      return { productSlug: "kiro-service", warranty };
    }
    if (matches(text, ["gemini", "google ai"]) && !matches(text, ["chatgpt", "gpt", "claude", "cursor", "kiro"])) {
      return { productSlug: "gemini-service", warranty };
    }
    if (matches(text, ["claude", "克劳德"]) && !matches(text, ["chatgpt", "gpt", "gemini", "cursor", "kiro"])) {
      return { productSlug: "claude-service", warranty };
    }
    if (
      matches(text, ["chatgpt", "gpt", "openai", "codex", "plus"]) &&
      !matches(text, ["claude", "gemini", "grok", "cursor", "kiro"])
    ) {
      return { productSlug: "chatgpt-codex-service", warranty };
    }
    return { productSlug: null, warranty };
  }

  // 明确卖手机号/SMS时，"Plus / 非成品号"只是服务对象/说明，不能先判成资格号。
  if (hasStandalonePhoneDeliverySignal(text)) {
    return { productSlug: classifyVerificationService(text), warranty };
  }

  // Plus 半价资格 / 非成品 Plus → 普号（必须先于 Plus 订阅匹配）
  if (isPlusQualificationAccount(text)) {
    return { productSlug: "chatgpt-free-account", warranty };
  }

  if (isCodexPhoneVerification(text) || isVerificationService(text)) {
    return { productSlug: classifyVerificationService(text), warranty };
  }

  // 其他板品牌：须先于中转 / 邮箱 / Claude Max / Grok
  // （Seedance 额度、Muse+微软邮箱、「替代 gro」等会被下游误伤）
  {
    const brandOther = classifyOtherBrands(text);
    if (brandOther) return { productSlug: brandOther, warranty };
  }

  if (isMirrorSiteProduct(text)) {
    return { productSlug: classifyMirrorSite(text), warranty };
  }

  // 无「镜像」字样但明确网页中转/共享入口的 GPT 服务
  if (isChatGptMirrorTransit(text)) {
    return { productSlug: "chatgpt-mirror", warranty };
  }

  // 账号额度/点数直充（须先于周边自助与 API 中转）
  if (isChatGptAccountQuotaRecharge(text)) {
    return { productSlug: "chatgpt-quota-recharge", warranty };
  }

  if (isChatGptPeripheralService(text)) {
    return { productSlug: "chatgpt-codex-service", warranty };
  }

  // Claude 中转 / 辅助：须在 Kiro 与通用 API 中转之前
  // （Claude-Kiro 反代、Claude API KEY → claude-mirror，不是 Kiro IDE）
  {
    const claudeExtra = classifyClaudeMirrorOrService(text);
    if (claudeExtra) return { productSlug: claudeExtra, warranty };
  }

  // Gemini 中转 / Flow 额度 / 辅助：须在通用 API 中转之前（避免 Gemini API KEY 进 ChatGPT 中转）
  {
    const geminiExtra = classifyGeminiMirrorOrService(text);
    if (geminiExtra) return { productSlug: geminiExtra, warranty };
  }

  // Kiro IDE 订阅档（Claude-Kiro 已在上面分流）
  {
    const kiroSlug = classifyKiroProduct(text);
    if (kiroSlug) return { productSlug: kiroSlug, warranty };
  }

  // API 额度 / 号池倍率 / 中转线路 → ChatGPT「中转服务」（多模型合池等）
  if (isApiCredit(text)) {
    return { productSlug: "chatgpt-mirror", warranty };
  }

  // 纯邮箱优先于 ChatGPT「母号/Team」宽匹配（对照 参考站 isPureEmail → 五档）
  if (isPureEmailProduct(text)) {
    return { productSlug: classifyEmailProduct(text), warranty };
  }

  if (isGeminiProduct(text)) {
    // 周边自助 / 中转须先于 Ultra（家庭组车位常带 Ultra 字样）
    {
      const geminiExtra = classifyGeminiMirrorOrService(text);
      if (geminiExtra) return { productSlug: geminiExtra, warranty };
    }
    if (isGeminiUltra(text)) return { productSlug: "gemini-ultra", warranty };
    if (isGeminiRecharge(text)) return { productSlug: "gemini-recharge", warranty };
    if (isGeminiYear(text)) return { productSlug: "gemini-year", warranty };
    return { productSlug: "gemini-pro", warranty };
  }

  // Claude：Team → Max → 普号(free) → Pro → 默认普号（API/接码已在前面分流）
  if (isClaudeProduct(text)) {
    if (isClaudeTeamPremium(text)) return { productSlug: "claude-team-premium", warranty };
    if (isClaudeTeamStandard(text)) return { productSlug: "claude-team-standard", warranty };
    if (isClaudeMax20(text)) return { productSlug: "claude-max-20x", warranty };
    if (isClaudeMax5(text)) return { productSlug: "claude-max-5x", warranty };
    // 普号 / free 必须先于 Pro（标题常带「可开 pro 套餐」）
    if (isClaudeFreeAccount(text)) return { productSlug: "claude-account", warranty };
    if (isClaudeProMonth(text)) return { productSlug: "claude-pro-month", warranty };
    return { productSlug: "claude-account", warranty };
  }

  // 参考站：无 Claude 字样的 Max5X / Max20X 成品仍归 Claude Max
  if (isClaudeMax20(text)) return { productSlug: "claude-max-20x", warranty };
  if (isClaudeMax5(text)) return { productSlug: "claude-max-5x", warranty };

  {
    const grokSlug = classifyGrokProduct(text, opts);
    if (grokSlug) return { productSlug: grokSlug, warranty };
  }

  // Cursor：须在 ChatGPT Pro 之前（避免「Cursor Pro 20刀」误进 chatgpt-pro-20x）
  {
    const cursorSlug = classifyCursorProduct(text);
    if (cursorSlug) return { productSlug: cursorSlug, warranty };
  }

  // 普号 / Team 席位优先于 Pro 倍率（避免 Free号+版本号、Team 5x 车误进 Pro）
  if (isChatGptProduct(text) && (isChatGptFreeAccount(text) || isNegatedPlus(text))) {
    return { productSlug: "chatgpt-free-account", warranty };
  }
  if (isChatGptProduct(text) && isChatGptTeamDominant(text)) {
    return { productSlug: "chatgpt-team", warranty };
  }

  if (isMixedChatGptProTier(text)) return { productSlug: null, warranty };
  if (isChatGptPro500(text)) return { productSlug: "chatgpt-pro-500", warranty };
  if (isChatGptPro20(text)) return { productSlug: "chatgpt-pro-20x", warranty };
  if (isChatGptPro5(text)) return { productSlug: "chatgpt-pro-5x", warranty };

  if (isChatGptProduct(text)) {
    if (isChatGptPro500(text)) return { productSlug: "chatgpt-pro-500", warranty };
    if (isChatGptPro20(text)) return { productSlug: "chatgpt-pro-20x", warranty };
    if (isChatGptPro5(text)) return { productSlug: "chatgpt-pro-5x", warranty };
    if (isChatGptFreeAccount(text) || isNegatedPlus(text)) {
      return { productSlug: "chatgpt-free-account", warranty };
    }
    if (isMixedChatGptProTier(text)) return { productSlug: null, warranty };
    if (isChatGptGoProduct(text)) return { productSlug: "chatgpt-go", warranty };
    if (isChatGptTeamDominant(text)) return { productSlug: "chatgpt-team", warranty };
    if (isChatGptPlusRecharge(text) && !isChatGptTeamDominant(text)) {
      return { productSlug: "chatgpt-plus-recharge", warranty };
    }
    if (isChatGptPlus(text) && !isChatGptTeamDominant(text)) {
      return { productSlug: "chatgpt-plus", warranty };
    }
    if (isChatGptTeam(text)) return { productSlug: "chatgpt-team", warranty };
    if (isChatGptPlus(text)) return { productSlug: "chatgpt-plus", warranty };
    if (isChatGptAccountTitle(text)) return { productSlug: "chatgpt-free-account", warranty };
  }

  // 参考站：无法分档的裸 Pro → 不进订阅卡
  if (isBarePro(text)) return { productSlug: null, warranty };

  // 其他板兜底（Perplexity / Suno / Muse / 即梦 / 多邻国 / 杂项）
  {
    const otherSlug = classifyOtherProduct(text);
    if (otherSlug) return { productSlug: otherSlug, warranty };
  }

  return { productSlug: null, warranty };
}

/** 礼品卡 / 虚拟卡 / Apple ID / Telegram——须先于 AI 订阅与邮箱 */
function classifyOtherEarly(value) {
  if (isGiftCardProduct(value)) return "gift-card";
  if (isVirtualCardProduct(value)) return "virtual-card";
  if (isAppleIdProduct(value)) return "apple-id-account";
  if (isTelegramPremiumProduct(value)) return "telegram-premium";
  if (isTelegramAccountProduct(value)) return "telegram-account";
  return null;
}

function isGiftCardProduct(value) {
  if (matches(value, ["礼品卡", "gift card", "giftcard", "app store 卡", "appstore卡"])) {
    return true;
  }
  // 「claude pro 礼品卡」等
  return matches(value, ["礼品"]) && matches(value, ["卡"]);
}

function isVirtualCardProduct(value) {
  return (
    matches(value, ["虚拟卡", "0刀卡", "0 刀卡", "0刀虚拟", "0 刀虚拟"]) ||
    (matches(value, ["visa", "mastercard", "master card"]) &&
      matches(value, ["0刀", "0 刀", "虚拟", "卡号", "4859", "485954"]))
  );
}

function isAppleIdProduct(value) {
  if (
    matches(value, [
      "apple id",
      "appleid",
      "苹果id",
      "苹果账号",
      "美区id",
      "港区id",
      "日区id",
      "土耳其id",
      "香港id",
    ])
  ) {
    return true;
  }
  // 【香港ID】【美区ID】类；排除纯邮箱商品
  if (matches(value, ["美区id", "港区id", "日区id", "香港id", "美国区老号", "带密保"])) {
    if (matches(value, ["可下app", "小火箭", "shadowrocket", "已过检", "开通ic", "没开ic"])) {
      return true;
    }
  }
  return false;
}

function isTelegramPremiumProduct(value) {
  const tg =
    matches(value, ["telegram", "电报", "纸飞机", "tg premium", "tg会员", "飞机会员"]) ||
    (/\btg\b/.test(value) && matches(value, ["premium", "会员", "stars"]));
  if (!tg) return false;
  return matches(value, ["premium", "会员", "stars", "代开", "订阅"]);
}

function isTelegramAccountProduct(value) {
  if (isTelegramPremiumProduct(value)) return false;
  if (matches(value, ["telegram", "电报号", "纸飞机号", "tg账号", "tg 账号"])) return true;
  // TG🌎 / TG💥 地区号
  if (/\btg\b/.test(value) && matches(value, ["直登", "协议号", "新号", "实卡账号", "亚洲", "欧美", "非洲"])) {
    return true;
  }
  return false;
}

function isPerplexityProduct(value) {
  return matches(value, ["perplexity"]);
}

function isSunoProduct(value) {
  return matches(value, ["suno"]);
}

function isMuseAiProduct(value) {
  // 接码/接马归接码板，不进 Muse
  if (matches(value, ["接码", "接马", "sms", "验证码渠道", "自动换号"])) return false;
  return (
    matches(value, ["muse ai", "muse邀请", "muse成品", "muse 邀请", "muse 成品", "muse成品号"]) ||
    (matches(value, ["muse"]) &&
      matches(value, ["邀请码", "token", "成品号", "成品", "meta", "微软邮箱", "验证码登录"]))
  );
}

function isDreaminaProduct(value) {
  return matches(value, ["dreamina", "即梦", "seedance"]);
}

function isDuolingoSuperProduct(value) {
  return matches(value, ["duolingo", "多邻国"]);
}

/**
 * 其他板品牌分档（接码之后、中转/邮箱/Claude/Grok 之前）。
 * @returns {string | null}
 */
function classifyOtherBrands(value) {
  if (isPerplexityProduct(value)) return "perplexity-account";
  if (isSunoProduct(value)) return "suno-account";
  if (isMuseAiProduct(value)) return "muse-ai-account";
  if (isDreaminaProduct(value)) return "dreamina-account";
  if (isDuolingoSuperProduct(value)) return "duolingo-super";
  return null;
}

/** 明确杂项；不含 Cursor/Kiro/Windsurf/X（已独立或挂 Grok） */
function isOtherCatchallProduct(value) {
  if (
    matches(value, [
      "售前说明",
      "给新顾客的信",
      "补差价",
      "steam白号",
      "steam 白号",
      "国内地区宽带",
      "宽带办理",
    ])
  ) {
    return true;
  }
  // 店铺公告类
  if (matches(value, ["可不下单", "禁止拍", "联系客服咨询"]) && !matches(value, ["chatgpt", "claude", "gemini", "grok"])) {
    return true;
  }
  return false;
}

/**
 * 其他板分档（对照参考站；Cursor/Kiro/Windsurf/X 不进此板）。
 * @returns {string | null}
 */
function classifyOtherProduct(value) {
  // early / brands 已处理的再兜底一次
  const early = classifyOtherEarly(value);
  if (early) return early;
  const brands = classifyOtherBrands(value);
  if (brands) return brands;
  if (isOtherCatchallProduct(value)) return "other-product";
  return null;
}

function isEmailOnlyForAiAccountSetup(value) {
  if (!hasEmailSignal(value)) return false;
  if (!matches(value, ["plus", "chatgpt", "gpt", "openai"])) return false;
  const setupUsageSignal = matches(value, [
    "配合plus",
    "配合 plus",
    "plus自助充值使用",
    "plus 自助充值使用",
    "plus使用",
    "plus 使用",
    "自助充值使用",
    "充值使用",
    "注册gpt专用",
    "注册 gpt 专用",
    "适用于gpt",
    "适用于 gpt",
    "可开gpt",
    "可开 gpt",
    "可注册gpt",
    "可注册 gpt",
    "注册专用",
    "注册用",
  ]);
  if (!setupUsageSignal) return false;
  return !matches(value, [
    "plus 成品",
    "plus成品",
    "plus 独享成品",
    "plus独享成品",
    "plus 会员",
    "plus会员",
    "plus 账号",
    "plus账号",
    "成品号",
    "成品账号",
    "成品会员",
    "独享账号",
    "独享成品",
    "会员",
    "月卡",
    "年卡",
    "订阅",
    "首登",
    "直登",
    "账密",
    "rt",
    "凭证",
    "json",
    "cpa",
    "直充",
    "代充",
    "卡密",
    "自助开通",
    "自动发货",
  ]);
}

function isEmailBackedAiAccountProduct(value) {
  if (!hasEmailSignal(value)) return false;
  if (isEmailOnlyForAiAccountSetup(value)) return false;
  const hasChatGptSignal = matches(value, ["chatgpt", "gpt", "openai", "codex"]);
  if (isChatGptTeamDominant(value) || isChatGptTeam(value)) return true;
  if (isChatGptPlus(value)) return true;
  if (hasChatGptSignal && isChatGptAccountTitle(value)) return true;
  if (!hasChatGptSignal) return false;
  if (
    matches(value, [
      "注册gpt专用",
      "注册 gpt 专用",
      "适用于gpt",
      "适用于 gpt",
      "接收邮件",
      "可开gpt",
      "可开 gpt",
      "可开chatgpt",
      "可开 chatgpt",
      "可注册gpt",
      "可注册 gpt",
    ])
  ) {
    return false;
  }
  return matches(value, [
    "成品号",
    "成品账号",
    "成品",
    "账号",
    "账户",
    "账密",
    "rt",
    "凭证",
    "json",
    "cpa",
    "反代",
    "sub2api",
    "access token",
    "access_token",
    "质保首登",
    "首登",
    "未接码",
    "已接码",
    "at发货",
    "k12",
  ]);
}

/** 纯邮箱商品；对照 参考站 isPureEmail（Team/Plus/Claude 成品不算邮箱）。 */
function isPureEmailProduct(value) {
  const explicitEmail = matches(value, [
    "gmail",
    "谷歌邮箱",
    "google 邮箱",
    "google邮箱",
    "谷歌gmail",
    "谷歌账号",
    "google 账号",
    "google账号",
    "hotmail",
    "outlook",
    "微软邮箱",
    "微软主邮箱",
    "微软长效邮箱",
    "icloud",
    "苹果隐私邮箱",
    "ic隐私邮箱",
    "ic 隐私邮箱",
    "ic邮箱",
    "ic 邮箱",
    "教育邮箱",
    "edu邮箱",
    "edu 邮箱",
    "校友邮箱",
    "mail.com",
    "163邮箱",
    "163 邮箱",
    "域名邮箱",
    "人机邮箱",
    "雅虎邮箱",
    "yahoo",
    "邮箱账号",
    "邮箱成品",
  ]);
  if (!explicitEmail) return false;
  // X/推特成品号常写 outlook 注册，不进邮箱板
  if (
    matches(value, ["twitter", "推特", "x账号", "x 账号", "x/推特", "推特账号"]) &&
    !matches(value, ["邮箱带令牌", "oauth", "graph令牌", "隐私邮箱"])
  ) {
    return false;
  }
  // Grok 普号常写「微软邮箱注册 / 附赠邮箱」，仍归 Grok
  if (isGrokProduct(value)) return false;
  // Muse / 即梦成品号常附邮箱描述，不进邮箱板
  if (isMuseAiProduct(value) || isDreaminaProduct(value) || isPerplexityProduct(value)) {
    return false;
  }
  if (isEmailOnlyForAiAccountSetup(value)) return true;
  if (isEmailBackedAiAccountProduct(value)) return false;
  if (
    matches(value, [
      "plus 成品",
      "plus成品",
      "plus 独享成品",
      "plus独享成品",
      "plus 会员",
      "plus会员",
      "plus 账号",
      "plus账号",
      "plus 已接码",
      "plus已接码",
      "直接登录codex",
    ])
  ) {
    return false;
  }
  const blockedByAiBrand = matches(value, [
    "chatgpt",
    "gpt free",
    "gpt 普号",
    "gpt 白号",
    "gpt 普通",
    "gpt plus",
    "openai 普号",
    "claude",
    "gemini pro",
    "gemini ultra",
    "grok",
    "gpt 账号",
    "gpt账号",
    "gpt专用",
    "gpt 专用",
    "gptplus",
    "k12",
    "team",
    "business",
    "codex",
  ]);
  if (!blockedByAiBrand) return true;
  // 谷歌/微软/iCloud 邮箱「注册某业务专用」仍是邮箱（对照参考站 谷歌邮箱API【注册claude专用】）
  const emailForServiceSignup =
    (isGmailEmailProduct(value) ||
      isOutlookEmailProduct(value) ||
      isIcloudEmailProduct(value)) &&
    matches(value, ["注册", "专用", "api"]) &&
    !matches(value, [
      "成品号",
      "成品账号",
      "普号",
      "质保首登",
      "已接码",
      "未接码",
      "账密",
    ]);
  return emailForServiceSignup;
}

/** 教育邮箱（强信号）；「企业 Edu 谷歌」无「教育」字样仍归 Gmail。 */
function isEducationEmailProduct(value) {
  if (matches(value, ["教育邮箱", "edu邮箱", "edu 邮箱", "校友邮箱", "大学邮箱"])) {
    return true;
  }
  if (/\b[\w.-]+\.edu\b/i.test(value)) return true;
  // Gmail EDU教育… / edu邮箱教育邮箱
  if (matches(value, ["edu"]) && matches(value, ["教育"])) return true;
  return false;
}

function isOutlookEmailProduct(value) {
  if (matches(value, ["outlook", "hotmail"])) return true;
  // 微软邮箱 + 令牌/OAuth 形态（对照参考站 outlook 货）
  if (
    matches(value, ["微软邮箱"]) &&
    matches(value, ["oauth", "令牌", "graph", "imap", "双令牌", "refresh_token"])
  ) {
    return true;
  }
  return false;
}

function isIcloudEmailProduct(value) {
  if (
    matches(value, [
      "icloud",
      "苹果隐私邮箱",
      "ic隐私邮箱",
      "ic 隐私邮箱",
      "icloud隐私",
      "苹果icloud",
    ])
  ) {
    return true;
  }
  // 「ic邮箱」口语；排除 microsoft/outlook 误伤
  if (matches(value, ["ic邮箱", "ic 邮箱"]) && !matches(value, ["outlook", "hotmail", "microsoft"])) {
    return true;
  }
  return false;
}

function isGmailEmailProduct(value) {
  return matches(value, [
    "gmail",
    "谷歌邮箱",
    "google 邮箱",
    "google邮箱",
    "谷歌gmail",
    "谷歌账号",
    "google 账号",
    "google账号",
    "企业edu谷歌",
    "企业谷歌邮箱",
    "谷歌企业邮箱",
  ]);
}

/**
 * 纯邮箱五档（对照参考站 slug）：
 * education-email → outlook-account → icloud-email → gmail-account → email-account
 */
function classifyEmailProduct(value) {
  if (isEducationEmailProduct(value)) return "education-email";
  if (isOutlookEmailProduct(value)) return "outlook-account";
  if (isIcloudEmailProduct(value)) return "icloud-email";
  if (isGmailEmailProduct(value)) return "gmail-account";
  return "email-account";
}

export function seedProducts() {
  return PRODUCT_SEED.map(({ slug, name, platform, deliveryType, summary }) => ({
    slug,
    name,
    platform,
    deliveryType,
    ...(summary ? { summary } : {}),
  }));
}
