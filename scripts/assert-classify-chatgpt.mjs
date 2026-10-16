#!/usr/bin/env node
/**
 * Classification fixtures — core cases from 参考站 scripts/test-catalog.mjs
 * (slug names mapped to this repo’s PRODUCT_SEED).
 */
import { classifyTitle, PRODUCT_SEED, isLongWarrantyTitle } from "../collectors/classify.mjs";

const cases = [
  // Plus vs Team disambiguation (参考站)
  ["ChatGPT Plus 拼车｜专属席位｜月付", "chatgpt-plus"],
  ["UPI渠道-PLUS成品号30天（iCloud高权重母号邮箱）", "chatgpt-plus"],
  ["UPI渠道-PLUS独享成品号30天（iCloud高权重母号邮箱）", "chatgpt-plus"],
  ["渠道7 Chatgpt Plus(质保首登) （较稳定款）目前不知道能活多久 要稳买我的team，不保codex接码", "chatgpt-plus"],
  ["GPT Team 席位 k12", "chatgpt-team"],
  ["ChatGPT Business 母号 自动拉", "chatgpt-team"],
  ["#plus直营店#--全新Team RT 凭证，购卡一小时内质保首登", "chatgpt-team"],
  ["【反代-JSON】k12 子号 成品", "chatgpt-team"],

  // Peripheral / self-service（不含正价 Plus 充值；邀请增额在周边）
  ["ChatGPT Plus 直充 卡密自助", "chatgpt-codex-service"],
  ["ChatGPT自助卡密（ios土区）", "chatgpt-codex-service"],
  ["GPT Plus 24小时自动充值 质保订阅", "chatgpt-codex-service"],
  ["ChatGPT Plus 自动充值 非成品需自备账号", "chatgpt-codex-service"],
  ["GPT UPI 提炼服务", "chatgpt-codex-service"],
  ["ChatGPT 提取链接服务", "chatgpt-codex-service"],
  ["kakao自助充值", "chatgpt-codex-service"],
  ["Codex 支付链接提取", "chatgpt-codex-service"],
  ["Codex 好友邀请奖励 | 额度增加 | 卡密自助邀请", "chatgpt-codex-service"],
  ["codex邀请好友每月三次", "chatgpt-codex-service"],
  ["Codex邀请1次卡", "chatgpt-codex-service"],
  // Codex / GPT 破甲工具 → 辅助；纯 Cursor 破甲仍归 Cursor 辅助
  ["codex破甲兑换卡", "chatgpt-codex-service"],
  ["Codex/Cursor破甲合卡", "chatgpt-codex-service"],
  ["GPT 破甲工具 codex破甲工具【Windows/Mac通用】【GPT cyber效果】", "chatgpt-codex-service"],
  ["G.PT 破甲工具 codex破甲工具【Windows/Mac通用】【G.PT cyber效果】", "chatgpt-codex-service"],
  ["[联系改价]codex破甲工具[支持windows][mac需要有一定的能力]", "chatgpt-codex-service"],
  ["Cursor破甲兑换卡", "cursor-service"],
  // 官方/正价 Plus + 自助 → 正价代充，不进周边
  ["GPT Plus 官方代充 CDK 【24 小时自助充值】【质保全程不掉订阅】", "chatgpt-plus-recharge"],
  ["Codex Plus 官方充值 CDK 【24 小时自助充值】【质保全程不掉订阅】", "chatgpt-plus-recharge"],
  ["Gplus官方充值【菲区】质保30天订阅，24h自助充值cdk", "chatgpt-plus-recharge"],
  ["GPT PLUS 官方渠道-质保订阅-24小时自动充值【源头】", "chatgpt-plus-recharge"],

  // Plus account stays Plus (not peripheral)
  ["ChatGPT Plus 成品号 独享账号", "chatgpt-plus"],
  ["ChatGPT Plus 成品号 独享账号 自动充值", "chatgpt-plus"],
  ["ChatGPT Plus 成品号 独享账号 自助开通", "chatgpt-plus"],
  ["PLUS-成品-已接码rt-微软邮箱-支持登录网页端，支持直接登录codex-质保首登", "chatgpt-plus"],
  ["plus成品号，未接码（质保首登）", "chatgpt-plus"],
  ["GPT Plus 成品号 日抛 账密", "chatgpt-plus"],
  ["plus 日抛", "chatgpt-plus"],
  ["GPT PLUS镜像站(天卡)", "chatgpt-mirror"],
  ["GPTPLUS镜像站【周卡】", "chatgpt-mirror"],
  ["【质保一个月】ChatGPT Plus网页镜像", "chatgpt-mirror"],
  ["G PLUS 镜像站(天卡)", "chatgpt-mirror"],
  ["号池站 1件也是代理价 ChatGPT Plus国内直连-月会员兑换码【质保30天】", "chatgpt-mirror"],
  ["号池站 ChatGPT Plus 国内直连", "chatgpt-mirror"],
  ["号池站 ChatGPT Plus国内直连-月会员兑换码", "chatgpt-mirror"],
  ["OpenAI Pro 20X 额度 | 10美金 | OpenAI-6-astra | image-2.5-flare", "chatgpt-mirror"],
  ["🔥 OpenAI Pro 20X 额度 | 10美金 | OpenAI-6-astra | image-2.5-flare", "chatgpt-mirror"],
  ["纯plus＋pro—10刀—1倍率", "chatgpt-mirror"],
  ["codex-api 100刀/1000刀不限时 PRO plus号池 非team free", "chatgpt-mirror"],
  // 号池站兑换码 ≠ Plus 成品；成品号仍归试用订阅
  ["Plus成品号 质保30天", "chatgpt-plus"],
  ["ChatGPT Plus 独享成品号 质保首登", "chatgpt-plus"],
  // 账号额度直充（非 API 中转、非成品号）
  ["【官方充值】Codex 250额度 非Api", "chatgpt-quota-recharge"],
  ["【官方充值】Codex 250额度 充个人账号 非Api", "chatgpt-quota-recharge"],
  ["【官方直充】Codex 250点使用额度｜非API额度｜直充自己号｜官方点数补充", "chatgpt-quota-recharge"],
  ["Codex 250点数额度充值 (Free账号勿下)", "chatgpt-quota-recharge"],
  ["【官方充值】ChatGPT Codex 额度点 CDK / 规格1", "chatgpt-quota-recharge"],
  // 邀请增额仍是周边，不是额度直充
  ["Codex 好友邀请奖励 | 额度增加 | 卡密自助邀请", "chatgpt-codex-service"],
  ["GPT Plus试用pix充值【巴西渠道】【官方试用】", "chatgpt-plus"],
  ["ChatGPT Plus 官方渠道", "chatgpt-plus"],
  ["ChatGPT Plus 支持登录Codex 官方充值", "chatgpt-plus"],
  ["谷歌渠道PLUS代充 月卡CDK【精品渠道～质保订阅】可覆盖，任何账号可充！", "chatgpt-plus"],

  // Official recharge
  ["ChatGPT Plus 官方直充 正价", "chatgpt-plus-recharge"],
  ["正规官方 Plus 充值", "chatgpt-plus-recharge"],
  ["【质保-菲区卡冲】GPT Plus官方直充月卡【可开发票】", "chatgpt-plus-recharge"],
  ["菲律宾区 ChatGPT Plus 官方充值 月卡", "chatgpt-plus-recharge"],
  ["菲区 GPT Plus 官方充值", "chatgpt-plus-recharge"],
  ["ChatGPT Plus 正价代充【Google内购】质保订阅 可覆盖秒冲", "chatgpt-plus-recharge"],
  ["GPT Plus 官方直充月卡【真实付费开通！保证正规充值】", "chatgpt-plus-recharge"],
  ["埃及区 ChatGPT Plus 正规卡付带账单", "chatgpt-plus-recharge"],

  // Pro / Go / Free（真订阅，非额度中转）— 无「未分倍率」卡；裸 Pro → null
  ["ChatGPT Pro 20x 月卡", "chatgpt-pro-20x"],
  ["ChatGPT Pro 20倍 官方充值", "chatgpt-pro-20x"],
  ["【菲区】卡充Codex Pro 20x （200刀档） 官网正规充值(带账单) 可开发票", "chatgpt-pro-20x"],
  ["GPT PRO 20x正规代充【美区ios渠道】 200刀", "chatgpt-pro-20x"],
  ["【正规秒充】GPT Pro 200 官方充值", "chatgpt-pro-20x"],
  ["免手续费【质保一个月】OpenAI Pro $200正价充值【带官方账单】", "chatgpt-pro-20x"],
  ["GPT Pro 5倍 官方", "chatgpt-pro-5x"],
  ["ChatGPT Pro 5倍 官方充值", "chatgpt-pro-5x"],
  ["【正规秒充】GPT Pro 100 官方充值", "chatgpt-pro-5x"],
  ["ChatGPT Pro 100 美金 成品号/账号代充", "chatgpt-pro-5x"],
  ["【正规秒充】GPT Pro 500 官方充值", "chatgpt-pro-500"],
  ["Codex Pro 500 月卡官方直充 【质保30天】", "chatgpt-pro-500"],
  ["ChatGPT PRO 50X 智利卡付代充（官网500美金套餐同步官方售后）", "chatgpt-pro-500"],
  ["【美区IOS】JPT Codex Pro 50X 官方充值 质保30天", "chatgpt-pro-500"],
  ["GPT ProMax 500刀 1个月丨正规代充丨带账单丨质保", "chatgpt-pro-500"],
  ["ChatGPT PRO 5X/20X", null],
  ["ChatGPT Pro 月卡", null],
  ["Codex Pro 10× 成品号｜独家渠道", null],
  // 显式 10x 不得因标题里的 200$ 误进 Pro 20x；也不得进普号
  ["PRO 10X 200$ 官方充值月卡(质保30天) 直冲个人账号", null],
  ["【Pro 10x】200刀版正价直冲，质保订阅", null],
  ["GPT PRO10x200刀 月费 正规菲区成品号 可续费 质保", null],
  ["(镇店之宝)Codex 10x 正价卡充成品号/续费|质保订阅一个月", null],
  ["Codex 15x 卡充成品号 质保订阅", null],
  ["Codex 正价卡充成品号 质保订阅一个月", null],
  // 「须账号为 Free 状态」是代充说明，不是普号
  ["【正规秒充】Plus 官方充值（须账号为Free状态）", "chatgpt-plus-recharge"],
  // Pro 20x 续费/资格号卡充仍是 Pro，不是普号
  ["【pro 20x】G JPT 【菲区20x资格号续费】 CDK 24小时充值 20x续费", "chatgpt-pro-20x"],
  ["成品-普号 Codex Pro 20x充值专用 资格号", "chatgpt-pro-20x"],
  // 代提长链接 → 周边，不是 Team 席位
  ["两次任意地区代提长链接48team", "chatgpt-codex-service"],
  ["GPT 普号 长效", "chatgpt-free-account"],
  ["非plus 白号", "chatgpt-free-account"],
  ["长效【微软邮箱交付】GPT账号（白号）FREE普通号含access_token", "chatgpt-free-account"],
  // Free号 + 模型版本号不得进 Pro 5x（codex 5.6 ≠ 5x）
  ["【G Free号】JSON含RT｜支持Codex/5.6-Terra", "chatgpt-free-account"],
  // Plus 接码手机号 → OpenAI 接码，不是 Plus 订阅
  ["G Plus 接马手机号 可接1~3个号", "sms-openai"],
  // Team 提链 / 长链提取 → 周边辅助
  ["Team提链 开通母号专用 支持多国 --次卡", "chatgpt-codex-service"],
  ["48Team长链接提取 | CDK｜1次卡", "chatgpt-codex-service"],
  ["Team 支付长链提取CDK次卡 | 主页稳定Team5x 不会用勿拍", "chatgpt-codex-service"],
  // Team 5x 车位归 Team，不进 Pro 5x
  ["codex 5x Team账号 2号23.59点踢 不保证降智限流", "chatgpt-team"],
  // Plus 半价资格 / 非成品 → 普号（绝不是 Plus 试用订阅）
  ["Plus半价资格账号，试用1-3个月随机(不是成品Plus!!!)，mail系列邮箱+iCloud邮箱混合发货，介意勿拍！", "chatgpt-free-account"],
  ["G Plus 半价资格账号 两月 注意只是资格不是成品 【可以换绑为自己的邮箱】", "chatgpt-free-account"],
  ["(源头) Plus半价资格账号，试用1-3月不等 (不是成品Plus!!!) iCloud邮箱，无代充，无售后", "chatgpt-free-account"],
  ["(源头)Plus半价资格账号，试用1个月(不是成品Plus!!!)，可以自己换绑", "chatgpt-free-account"],
  ["G（Plus特别优惠 首月 $10/月）——仅Plus半价名额｜iCloud｜不是成品Plus｜不是代充｜无售后", "chatgpt-free-account"],
  ["🔥G​PT Plus 半价资格老号⚡1个月-3个月不等⚠️注意只是✅资格号 ❌不是成品号", "chatgpt-free-account"],
  // 教程/脚本 → 周边辅助，不进 Plus
  ["puls 充值教程 全套流程附带自动化脚本", "chatgpt-codex-service"],
  ["ChatGPT Plus 充值教程", "chatgpt-codex-service"],
  ["ChatGPT Go 月卡", "chatgpt-go"],
  ["GO 自助充值卡密-月卡（卡密自助）", "chatgpt-go"],
  ["GTP GO六个月成品号，全网最稳的号源，质保一个月", "chatgpt-go"],

  // SMS / verification
  ["高收码率 GP Plus/codex短信一次性接码（100%收码）", "sms-openai"],
  ["美国实卡长效接马【质保不来码】PLUS接马", "sms-openai"],
  ["OpenAI ChatGPT 手机接码", "sms-openai"],
  ["GPT Plus | 接码服务 | 页面手动操作 | 非 API 取号", "sms-openai"],
  ["ChatGPT Codex-日本 接码自助卡密", "sms-openai"],
  ["#plus成品号#--Codex接码（美区）单次接码", "sms-openai"],
  ["巴西 PayPal 【 一次性接马 】售出不退 只负责100%接马", "sms-paypal"],
  ["Gmail 邮箱接马 （三次码|OpenAI业务|看清楚商品说明）", "sms-google"],
  ["【全球自助短信接马系统】Google/Gmail/YouTube短信接马 高质量 单次接马", "sms-google"],
  ["Microsoft 微软 接马 美区【长效30天】", "sms-generic"],
  ["Cursor 接马 美区【长效60天】", "sms-generic"],
  ["Claude KYC认证", "claude-kyc"],
  ["Claude KYC 认证服务【秒封不收费】", "claude-kyc"],
  ["Claude KYC认证服务 24h接批量过KYC", "claude-kyc"],
  ["批量过KYC Claude", "claude-kyc"],
  ["【欧美版】Claude Persona 人脸验证KYC", "claude-kyc"],
  ["Claude真人认证", "claude-kyc"],
  ["克劳德/Claude kyc认证 kyc主动触发", "claude-kyc"],
  ["Claude KYC（代认证）", "claude-kyc"],
  // 已过/免 KYC 的成品 ≠ KYC 认证服务
  ["【已过kyc】claude普号【微软邮箱】", "claude-account"],
  ["云自营 Claude Pro | 7天成品号 | 免KYC认证", "claude-pro-month"],

  // API / 号池 → 中转服务（参考站 openai-api-cdk）
  ["麦门Codex API 不限时 Plus和Pro号池 非Free和Team / 50$余额兑换码", "chatgpt-mirror"],
  ["余额充值：100刀【不限时间,可用claude、gemini、gpt】", "chatgpt-mirror"],
  ["GPT/Claude api 30刀", "chatgpt-mirror"],
  ["AI 平台 直充 10000美元额度 -Claude Opus 4.7 / Codex / Gemini", "chatgpt-mirror"],
  ["直供实验室庞大稳定 Claude Max / Pro 池", "claude-mirror"],
  ["【24小时有效期】每天100刀claude code", "claude-mirror"],
  ["【总共50刀】30天有效期-老Plus渠道", "chatgpt-mirror"],
  ["【总共100刀】30天有效期-老Plus渠道", "chatgpt-mirror"],
  ["ChatGPT 蜗的AI-中转-官方plus号池-100$", "chatgpt-mirror"],
  ["中转站额度58刀余额卡密", "chatgpt-mirror"],

  // Plus 成品不得被「实卡渠道+未接码」误进接码；Team 不得被 gmail 误进邮箱
  ["超级稳-越南实卡渠道-GPT PLUS 未接码 gmail邮箱 可反代可网页（质保30天）拿到后立刻改密码 2fa", "chatgpt-plus"],
  ["GPT K12 team 只支持谷歌邮箱 gmail", "chatgpt-team"],
  ["谷歌邮箱 GPT Team K12 成品 JSON 反代 发cpa 质保首登", "chatgpt-team"],
  ["谷歌邮箱 GPT Team K12 成品 cpa格式 质保首登", "chatgpt-team"],
  ["k12 json 格式 质保首登 gmail", "chatgpt-team"],

  // Claude 渠道（对照 参考站 catalog.ts + test-catalog.mjs）
  ["Claude Pro 官充", "claude-pro-month"],
  ["Claude Pro 月卡 直充", "claude-pro-month"],
  ["Claude 充值", "claude-pro-month"],
  // Kiro IDE / 额度充值 / 辅助（Claude-Kiro 反代 → claude-mirror）
  ["kiro pro+ 2000积分，可用 claude opus 5.5，速度飞快。10月新开", "kiro-pro-plus"],
  ["kiro pro+ 可用claude opus，积分账号", "kiro-pro-plus"],
  ["Kiro Pro 额度号 支持 Claude Sonnet", "kiro-pro"],
  ["Windsurf 账号 可用 Claude 模型", null],
  ["小易AI kiro pro+ 2000积分，可用 claude opus 5.5", "kiro-pro-plus"],
  ["【KIRO】Kiro Free 50额度 JSON", "kiro-free-account"],
  ["【KIRO free】 KIRO 普号 -固定50额度 -kirors导入格式", "kiro-free-account"],
  ["【KIRO】2026/10/10 今日注册 Gmail JSON Free", "kiro-free-account"],
  ["Kiro Pro 1000积分账号（随机超额）源头", "kiro-pro"],
  ["【1个月】Kiro Pro 1000额度 质保首登 账密2f或JSON都可", "kiro-pro"],
  ["kiro 一年学生账号 每月1000额度", "kiro-pro"],
  ["Kiro Student---Kiro pro 学生账号，每月1000额度，可持续使用12个月", "kiro-pro"],
  ["纯手搓Kiro Pro+ 2000额度，客户反馈质量稳定、可靠，服务到位～～～", "kiro-pro-plus"],
  ["Kiro Pro+ 2000额度 【1个月，质保首登】", "kiro-pro-plus"],
  ["Kiro pro+成品号(个人账号)", "kiro-pro-plus"],
  ["Kiro ProMax 5000 积分账号 源头 稳定大量供应中转", "kiro-pro-max"],
  ["Kiro ProMax 10000 积分账号 源头 稳定大量供应中转", "kiro-power"],
  ["【15.48开us 和eu 混合】kiro power 10000 积分 无质保 小白勿拍！！！", "kiro-power"],
  ["kiro成品号（支持claude-opus-4.8） / 规格1", "kiro-free-account"],
  ["Kiro 加油包 125积分 add-on credits 直充", "kiro-quota-recharge"],
  ["Kiro Pro 账号加油包积分包 自备账号充值", "kiro-quota-recharge"],
  ["Kiro 协助充值 帮开 Pro", "kiro-service"],
  // Claude 中转 / 辅助（含原误挂 Kiro 的 Claude-Kiro）
  ["kiro混合版PRO-ClaudeCode-200刀-30天有效", "claude-mirror"],
  ["Claude Kiro渠道 50刀额度日卡", "claude-mirror"],
  ["Claude-Kiro API KEY 10M Token （1天有效期，支持opus4.7/4.8/5）", "claude-mirror"],
  ["Claude-Kiro API KEY 100M Token （3天有效期，支持opus4.7/4.8/5）", "claude-mirror"],
  ["Claude API KEY 号池 Opus", "claude-mirror"],
  ["Claude code 每天50刀额度 有效期7天", "claude-mirror"],
  ["Claude KYC 代提链", "claude-service"],
  ["Claude 协助充值 Pro", "claude-service"],
  // 虚拟卡标题夹带 kiro 勿拍 → 其他板虚拟卡，不进 Kiro
  ["485954 0刀 visa虚拟卡 (Gemini KIRO G PAYPAL别拍 无售后）", "virtual-card"],
  ["Visa 0 刀虚拟卡 485954(G 需要手法)kiro不行无3ds介意别拍只包卡号正确不包能过验证", "virtual-card"],
  // 跨平台隔离：其他平台同档 / 非kiro / 合集 → 不得进 Kiro 统计
  ["Cursor Pro 1000额度 月卡", "cursor-pro"],
  ["Cursor Pro+ 2000额度", "cursor-pro-plus"],
  ["Claude Pro 官充", "claude-pro-month"],
  ["Gemini Pro 年卡 非kiro", "gemini-year"],
  ["Cursor/Kiro Pro 账号合集", "cursor-pro"],
  ["加油包 125积分 add-on credits 直充", null],
  ["纯手搓 Pro+ 2000额度", null],
  ["ProMax 5000 积分账号 无kiro", "chatgpt-pro-500"],
  ["power 10000 积分", null],
  ["Claude 日卡 50刀额度", "claude-mirror"],
  ["Claude Team Premium 席位", "claude-team-premium"],
  ["Claude Team Standard 席位", "claude-team-standard"],
  ["Claude Team 1.25x 30天质保订阅", "claude-team-standard"],
  ["Claude Team 6.25x 30天质保订阅", "claude-team-premium"],
  ["claude pro team标准席位额度是pro的1.25倍", "claude-team-standard"],
  ["claude pro team高级席位额度是pro的6.25倍", "claude-team-premium"],
  ["claude team（封号也质保2次）", "claude-team-standard"],
  ["Claude Standard Seat | 25USD | 31天质保 | 官方订阅", "claude-team-standard"],
  ["Claude Premium Seat | 125USD | 31天质保 | 官方订阅", "claude-team-premium"],
  ["🥨Claude 6.25X【质保订阅】", "claude-team-premium"],
  ["Claude Max 20x", "claude-max-20x"],
  ["Claude Max 5x", "claude-max-5x"],
  ["Claude Max 5X直充月卡", "claude-max-5x"],
  ["Claude Max 20X 成品号", "claude-max-20x"],
  ["claude max x20 速刷号", "claude-max-20x"],
  ["claude max x20 速刷号！真的有！号池专供账号，差不多1天内，但是不打包票！个人勿拍！", "claude-max-20x"],
  ["Claude Max 20x 号池专供账号", "claude-max-20x"],
  ["【20x质保一次掉订阅】cluade 20x成品", "claude-max-20x"],
  ["Claude 20✖️Max成品号 无质保", "claude-max-20x"],
  ["Claude max💲100订阅人工交付", "claude-max-5x"],
  ["Claude max💲200订阅人工交付", "claude-max-20x"],
  ["claude max 5X 独享成品号已过KYC", "claude-max-5x"],
  ["claude 20x成品号（免kyc验证）", "claude-max-20x"],
  ["Max20X 成品号", "claude-max-20x"],
  ["Max5X 成品号", "claude-max-5x"],
  ["Max5X 成品号(质保掉订阅)", "claude-max-5x"],
  ["Max20X 成品号(质保掉订阅)人工交付", "claude-max-20x"],
  ["Claude Max 50x 成品号", "claude-account"],
  ["Claude Max 50x 号池", "claude-mirror"],
  ["Claude API 额度中转", "claude-mirror"],
  ["直供实验室庞大稳定 Claude Max / Pro 池", "claude-mirror"],
  ["Claude 普号 白号", "claude-account"],
  ["Claude普通账号（雅虎邮箱，imap登录，网易邮箱大师接码）", "claude-account"],
  // 普号 / free 可开 Pro ≠ Claude Pro 订阅
  ["Claude 普号free | outlook邮箱【质保首登】(免kyc可以开pro套餐)", "claude-account"],
  ["Claude 普号free｜outlook邮箱 【质保首登】（免kyc可以开pro套餐）", "claude-account"],
  ["Claude free 账号 可开pro", "claude-account"],
  ["可以开pro套餐 Claude 普号", "claude-account"],
  ["Claude pro 7天号", "claude-pro-month"],
  ["Claude Pro【官方直充|月卡】", "claude-pro-month"],
  ["Claude Pro-三人车", "claude-pro-month"],
  ["USDT-1个月Claude PRO代充", "claude-pro-month"],
  // Claude KYC → Claude 页渠道（参考站 identity-verification 在本站挂 Claude）
  ["Claude KYC 认证", "claude-kyc"],
  ["Claude KYC 认证服务【秒封不收费】", "claude-kyc"],
  ["【欧美版】Claude Persona 人脸验证KYC", "claude-kyc"],
  ["Claude真人认证", "claude-kyc"],
  ["克劳德/Claude kyc认证 kyc主动触发", "claude-kyc"],
  // 非 Claude 的 KYC → 接码板 sms-kyc；Claude SMS → 通用接码
  ["G Cyber认证【Persona认证】", "sms-kyc"],
  ["G Codex OpenAI Cyber Kyc认证（欧美地区 包过）｜人工发货 OpenAI", "sms-kyc"],
  ["Claude SMS 接码-泰国 接码自助卡密", "sms-generic"],
  // Cursor：普号 / Plus / Pro / Pro+ / Ultra / 辅助（接码仍走通用接码）
  ["Cursor Free Auto 白号，库存清仓", "cursor-free-account"],
  ["cursor微软长效小白号", "cursor-free-account"],
  ["Cursor普号微软长效【带 Token-携带手机号】", "cursor-free-account"],
  ["【官方会员】Cursor Plus 月卡成品号 质保订阅", "cursor-plus"],
  ["Cursor Plus 独享成品号 8刀", "cursor-plus"],
  ["cursor plus代充 官网正规", "cursor-plus"],
  ["Cursor 8刀 月卡成品号", "cursor-plus"],
  ["【正规实付】Cursor Pro月卡成品号，质保订阅 28 天【官方会员】", "cursor-pro"],
  ["【官方会员】Cursor Pro 20刀 质保订阅 独享成品号", "cursor-pro"],
  ["【官方会员】Cursor Pro 40刀 质保订阅 独享成品号", "cursor-pro"],
  ["Cursor Premium 月卡成品号", "cursor-pro"],
  ["【官方会员】Cursor Pro+ 独享成品号 质保25天", "cursor-pro-plus"],
  ["Cursor Super 月卡成品号", "cursor-pro-plus"],
  ["【正规实付】Cursor ultra月卡成品号，质保订阅28天【官方会员】", "cursor-ultra"],
  ["【官方会员】Cursor ultra 正价代充，带账单，质保订阅30天", "cursor-ultra"],
  ["Cursor 自助退款 2.5元/次", "cursor-service"],
  ["cursor月卡-插件计费 一天200额度", "cursor-service"],
  ["cursor日卡-不换号-插件【先下单有问题售后联系CQ-alvin】", "cursor-service"],
  ["Cursor AI 20 美金月付会员协助充值｜官网正规充值｜到期可续费", "cursor-service"],
  ["🔥 美国实卡长效Cursor注册接马可以二次 10-24天【质保不来码】", "sms-generic"],
  // Grok：对照参考站 Plus/Premium/Super/Ultra；纯 X Premium → 其他；接码走接码页
  ["SupergroK 7天会员号-bot勿拍,cursor勿拍，质保6天网页正常，发现货", "grok-premium"],
  ["Super Grok 官方充值", "grok-premium"],
  ["【正规实付】Super Grok 月卡成品号，质保订阅 28 天", "grok-premium"],
  ["【IOS渠道】30刀 SuperGro 官充 一个月卡【质保订阅30天】", "grok-premium"],
  ["超级Grok 官方直充月卡", "grok-premium"],
  ["Grok Premium 月卡成品", "grok-premium"],
  ["【直充】X-Premium+Super Grok一个月", "grok-premium"],
  ["Grok Super 独享成品号 质保首登", "grok-super"],
  ["Gro super 15x 1个月", "grok-super"],
  ["SuperGrok Plus 100刀 官方充值", "grok-super"],
  ["Grok Heavy月卡直充/成品号", "grok-ultra"],
  ["SuperGrok Heavy月卡", "grok-ultra"],
  ["【官方会员】SuperGrok Heavy 正价代充，带账单", "grok-ultra"],
  ["Gr0k Ultra （原HEAVY）速刷號", "grok-ultra"],
  ["【正规实付】Supergro Lite 6个月 质保订阅180天（包含同时长X Premium会员）【官方直充】", "grok-plus"],
  ["Grok Plus 8刀 月卡", "grok-plus"],
  ["SuperGrok Lite 成品号", "grok-plus"],
  ["【普号】Grok", "grok-account"],
  ["Grok Free 白号 体验号", "grok-account"],
  ["Grok普号 微软长效", "grok-account"],
  ["X Premium 推特会员 月卡", "x-twitter-premium"],
  ["【旧版】X Premium 月卡充值1个月", "x-twitter-premium"],
  ["【旧版】X Premium 正规充值 一个月", "x-twitter-premium"],
  ["X Premium 3个月", "x-twitter-premium"],
  ["X Premium+ 年卡", "x-twitter-premium-plus"],
  ["Twitter Premium+ 月卡", "x-twitter-premium-plus"],
  // 对标文案 / Muse → 其他板，不得进 Grok
  ["Muse AI成品号 带10亿token-对标 SuperGro-k bot", "muse-ai-account"],
  ["【质保首登】Gro Super Heavy一个月 成品号", "grok-ultra"],
  ["gro Heavy 速刷号｜只保首登", "grok-ultra"],
  ["【旧版】【质保订阅】SuperGro 30刀 正规充值 一个月", "grok-premium"],
  ["Grok 自助退款 2元/次", "grok-service"],
  ["Grok 日卡-网页共享", "grok-service"],
  ["Super Grok 协助充值｜到期可续费", "grok-service"],
  ["Grok 使用教程", "grok-service"],
  ["🔥 美国实卡长效Grok注册接马【质保不来码】", "sms-generic"],
  ["Google AI Ultra 家庭组席位一个月 Gemini Ultra", "gemini-service"],
  ["【拼车】Gemini pro家庭组席位（月卡）【自动邀请】【全程质保】【可续期】", "gemini-service"],
  ["【独享】Gemini pro家庭组席位（月卡）【自动邀请】【全程质保】【可续期】", "gemini-service"],
  ["【家庭组车位】Google AI Ultra 5x 【质保订阅30天】", "gemini-service"],
  ["Gemini Ultra个人版 / 规格1", "gemini-ultra"],
  ["Gemini Pro 18个月兑换链接 无需绑卡", "gemini-recharge"],
  ["JIO Gemini Pro 18个月订阅链接 | 无需绑卡 | 反重力", "gemini-recharge"],
  ["Google AI Pro (Gemini Pro) 18个月优惠订阅链接", "gemini-recharge"],
  ["Gemini 18个月 pro 特价出一批 群友特供 不是成品看清楚", "gemini-recharge"],
  ["【开通自己账号】Gemini Pro 18个月会员开通链接（不用账号密码点开链接即可开通）", "gemini-recharge"],
  ["【直充】Gemini Pro 1年充值订阅", "gemini-recharge"],
  ["提取12个月优惠链接 一次 gemin pro（不会用别买不退不换，小白别买）", "gemini-recharge"],
  ["geminipro一年成品(美区包GCP)", "gemini-year"],
  ["Gemini PRO会员成品 随机地区", "gemini-year"],
  ["Gemini Pro 12个月pixel成品号需要绑定手机", "gemini-year"],
  ["Gemini 成品Pro 18个月链接开通，成品会员号 包首登", "gemini-year"],
  ["人机验证号Gemini pro一年 登陆被封号申诉无售后", "gemini-year"],
  ["Gemini 使用教程", "gemini-service"],
  ["Gemini 协助开通 Pro", "gemini-service"],
  ["Gemini 自助退款", "gemini-service"],
  ["【质保一个月】Gemini Pro网页镜像", "gemini-mirror"],
  ["gemini 2.5 pro 官网apikey", "gemini-mirror"],
  ["Gemini API KEY", "gemini-mirror"],
  ["Google AI 中转 api", "gemini-mirror"],
  ["号池站 Gemini Pro 国内直连 月会员兑换码【质保30天】", "gemini-mirror"],
  ["【免梯直连镜像日卡】GPT/Claude/Gemini等镜像站｜一号多用｜稳定镜像免翻墙使用", "chatgpt-mirror"],
  ["Gemini 1000flow积分号批发（ 谷歌生图生视频，15 积分可以生成10秒）", "gemini-pro"],
  ["Gemini Pro【成品账号丨18个月｜不可使用反重力/可刷 flow积分】", "gemini-year"],
  ["Gemini Pro 稳定特殊渠道3个月老号成品号1（支持反重力 中转推荐，随机地区老帐号2022-2025，质保首登）", "gemini-year"],
  ["GPT注册专用谷歌Gmai邮箱母号api可裂变!", "gmail-account"],

  // 邮箱五档（对照参考站 gmail / outlook / icloud / education / other）
  ["【长效随机地区】全新未使用gmail个人谷歌带2fa", "gmail-account"],
  ["企业Edu谷歌账号(短效号.可用3天，全新注册)", "gmail-account"],
  ["谷歌邮箱API【注册claude专用】", "gmail-account"],
  ["Outlook_长效 OAuth2【未触发7天，英文名+随机数字】", "outlook-account"],
  ["hotmail 邮箱带令牌 | 全新 | 已开 graph imap", "outlook-account"],
  ["【全新】微软长效邮箱-outlook-Graph/OAuth2双令牌号-支持IMAP-POP3", "outlook-account"],
  ["iCloud邮箱丨苹果隐私邮箱丨邮箱+取码链接（json格式+收件箱）", "icloud-email"],
  ["iCloud隐私邮箱【极稳 全新一手 无限收件 质保5天】", "icloud-email"],
  ["9pt专用ic邮箱(质保三天)五秒内来码！", "icloud-email"],
  ["Gmail EDU教育邮箱短租（可用来注册）", "education-email"],
  ["美国东北大学校友邮箱后缀 @northeastern.edu 微软托管 edu邮箱教育邮箱", "education-email"],
  ["域名邮箱丨买一送一丨邮箱+取码链接", "email-account"],
  ["▁▂▃▅▆█ Mail.com █▆▅▃▂▁ | 邮箱MAIL.COM账号。", "email-account"],
  ["全新163邮箱", "email-account"],
  ["微软主邮箱二手令牌号（自己跑完业务的，很干净）", "email-account"],
  // AI 成品附带邮箱 ≠ 邮箱板
  ["超级稳-越南实卡渠道-GPT PLUS 未接码 gmail邮箱 可反代可网页（质保30天）", "chatgpt-plus"],
  ["Claude 普号free | outlook邮箱【质保首登】(免kyc可以开pro套餐)", "claude-account"],
  ["codex free成品号-iCloud注册-1号1ip高权重美国家宽-账密2fa-可生图", "chatgpt-free-account"],

  // 其他板（对照参考站；无 Cursor/Kiro/Windsurf/X）
  ["Perplexity Pro 自助充值月卡(无积分)", "perplexity-account"],
  ["Perplexity max 1-1.4W积分 官方200刀月卡CDK在线充值|无质保，已稳定三个多月", "perplexity-account"],
  ["Suno Pro Premier Plan单月订阅", "suno-account"],
  ["muse邀请码+meta+muse成品号量大联系", "muse-ai-account"],
  ["Muse AI邀请码 10亿token免费拿（对标SuperGro-k bot）", "muse-ai-account"],
  ["Muse 成品号（微软邮箱·验证码登录）", "muse-ai-account"],
  ["Seedance 2.5｜视频生成渠道合集", "dreamina-account"],
  ["🔥Seedance2.5额度｜8000美金｜seedance 2.5｜seedance2.0 pro", "dreamina-account"],
  ["即梦基础会员周卡", "dreamina-account"],
  ["Dreamina Basic 海外即梦｜成品账号7天（900-1200积分）质保1天-替代gro可用", "dreamina-account"],
  ["Duolingo Super 多邻国超级会员｜只保激活不保使用时间", "duolingo-super"],
  ["【香港ID】【半年/hotmail后缀/带密保/可下APP】", "apple-id-account"],
  ["Apple ID(日本）", "apple-id-account"],
  ["TG🌎亚洲国家-✈️直登号+协议号，出库的订单不退换，所有账号保首登", "telegram-account"],
  ["【人工发货】电报 Premium 三个月订阅", "telegram-premium"],
  ["VISA 0刀虚拟卡 485954", "virtual-card"],
  ["港区礼品卡Apple Gift Card(App store)", "gift-card"],
  ["OpenAI ChatGPT Gift Card 美国区礼品卡", "gift-card"],
  ["claude pro 礼品卡", "gift-card"],
  ["【售前说明】正价代充相关问题", "other-product"],
  // Muse 接码仍归接码板
  ["Meta/Muse 接马 美区【自动换号】2-4天", "sms-generic"],

  // Price / deposit noise
  ["GPT Plus 正规充值定金，下单后联系客服", null],
  ["ChatGPT Plus 官方直充 无需补差价", "chatgpt-plus-recharge"],
];

const warrantyCases = [
  ["plus成品号，未接码（质保首登）", false],
  ["Plus月卡★成品号【质保3天】", false],
  ["GPT Plus 官方充值 质保30天", true],
  ["ChatGPT Plus 正价代充【Google内购】质保订阅", true],
  ["无质保 Plus 成品号", false],
];

let fail = 0;
for (const [title, expect] of cases) {
  const got = classifyTitle(title).productSlug;
  if (got !== expect) {
    fail += 1;
    console.error("[assert-classify] FAIL", title, "=>", got, "expected", expect);
  }
}

for (const [title, expect] of warrantyCases) {
  const got = isLongWarrantyTitle(title);
  if (got !== expect) {
    fail += 1;
    console.error("[assert-classify] WARRANTY", title, "=>", got, "expected", expect);
  }
}

const chatgpt = PRODUCT_SEED.filter((p) => p.platform === "chatgpt");
const required = [
  "chatgpt-free-account",
  "chatgpt-plus",
  "chatgpt-plus-recharge",
  "chatgpt-go",
  "chatgpt-team",
  "chatgpt-pro-5x",
  "chatgpt-pro-20x",
  "chatgpt-pro-500",
  "chatgpt-codex-service",
  "chatgpt-quota-recharge",
  "chatgpt-mirror",
];
for (const slug of required) {
  if (!chatgpt.some((p) => p.slug === slug)) {
    fail += 1;
    console.error("[assert-classify] missing seed", slug);
  }
}
if (chatgpt.some((p) => p.slug === "chatgpt-pro")) {
  fail += 1;
  console.error("[assert-classify] unexpected seed chatgpt-pro (未分倍率已移除)");
}
if (chatgpt.length !== 11) {
  fail += 1;
  console.error("[assert-classify] expected exactly 11 chatgpt seeds, got", chatgpt.length);
}
const quotaSeed = chatgpt.find((p) => p.slug === "chatgpt-quota-recharge");
if (!quotaSeed || quotaSeed.deliveryType !== "额度充值") {
  fail += 1;
  console.error("[assert-classify] chatgpt-quota-recharge must be deliveryType 额度充值");
}
const cursor = PRODUCT_SEED.filter((p) => p.platform === "cursor");
const cursorRequired = [
  "cursor-free-account",
  "cursor-plus",
  "cursor-pro",
  "cursor-pro-plus",
  "cursor-ultra",
  "cursor-service",
];
for (const slug of cursorRequired) {
  if (!cursor.some((p) => p.slug === slug)) {
    fail += 1;
    console.error("[assert-classify] missing seed", slug);
  }
}
if (cursor.some((p) => p.slug === "cursor-account")) {
  fail += 1;
  console.error("[assert-classify] unexpected seed cursor-account (已拆分为多档)");
}
if (cursor.length !== 6) {
  fail += 1;
  console.error("[assert-classify] expected exactly 6 cursor seeds, got", cursor.length);
}
if (!cursor.every((p) => ["成品账号", "订阅/会员", "辅助服务"].includes(p.deliveryType))) {
  fail += 1;
  console.error("[assert-classify] cursor deliveryType must be 成品账号|订阅/会员|辅助服务");
}

const kiro = PRODUCT_SEED.filter((p) => p.platform === "kiro");
const kiroRequired = [
  "kiro-free-account",
  "kiro-pro",
  "kiro-pro-plus",
  "kiro-pro-max",
  "kiro-power",
  "kiro-quota-recharge",
  "kiro-mirror",
  "kiro-service",
];
for (const slug of kiroRequired) {
  if (!kiro.some((p) => p.slug === slug)) {
    fail += 1;
    console.error("[assert-classify] missing seed", slug);
  }
}
if (kiro.some((p) => p.slug === "kiro-account" || p.slug === "kiro-pro-account")) {
  fail += 1;
  console.error("[assert-classify] unexpected legacy kiro seed (已拆分为多档)");
}
if (kiro.length !== 8) {
  fail += 1;
  console.error("[assert-classify] expected exactly 8 kiro seeds, got", kiro.length);
}
if (
  !kiro.every((p) =>
    ["成品账号", "订阅/会员", "额度充值", "中转服务", "辅助服务"].includes(p.deliveryType),
  )
) {
  fail += 1;
  console.error(
    "[assert-classify] kiro deliveryType must be 成品账号|订阅/会员|额度充值|中转服务|辅助服务",
  );
}
const kiroQuota = kiro.find((p) => p.slug === "kiro-quota-recharge");
if (!kiroQuota || kiroQuota.deliveryType !== "额度充值") {
  fail += 1;
  console.error("[assert-classify] kiro-quota-recharge must be deliveryType 额度充值");
}
const kiroMirror = kiro.find((p) => p.slug === "kiro-mirror");
if (!kiroMirror || kiroMirror.deliveryType !== "中转服务") {
  fail += 1;
  console.error("[assert-classify] kiro-mirror must be deliveryType 中转服务");
}

const claude = PRODUCT_SEED.filter((p) => p.platform === "claude");
const claudeRequired = [
  "claude-account",
  "claude-kyc",
  "claude-pro-month",
  "claude-max-5x",
  "claude-max-20x",
  "claude-team-premium",
  "claude-team-standard",
  "claude-mirror",
  "claude-service",
];
for (const slug of claudeRequired) {
  if (!claude.some((p) => p.slug === slug)) {
    fail += 1;
    console.error("[assert-classify] missing seed", slug);
  }
}
if (claude.length !== 9) {
  fail += 1;
  console.error("[assert-classify] expected exactly 9 claude seeds, got", claude.length);
}
if (
  !claude.every((p) =>
    ["成品账号", "接码/验证", "订阅/会员", "中转服务", "辅助服务"].includes(p.deliveryType),
  )
) {
  fail += 1;
  console.error(
    "[assert-classify] claude deliveryType must be 成品账号|接码/验证|订阅/会员|中转服务|辅助服务",
  );
}
const claudeKyc = claude.find((p) => p.slug === "claude-kyc");
if (!claudeKyc || claudeKyc.deliveryType !== "接码/验证") {
  fail += 1;
  console.error("[assert-classify] claude-kyc must be deliveryType 接码/验证");
}
const claudeMirror = claude.find((p) => p.slug === "claude-mirror");
if (!claudeMirror || claudeMirror.deliveryType !== "中转服务") {
  fail += 1;
  console.error("[assert-classify] claude-mirror must be deliveryType 中转服务");
}
const claudeService = claude.find((p) => p.slug === "claude-service");
if (!claudeService || claudeService.deliveryType !== "辅助服务") {
  fail += 1;
  console.error("[assert-classify] claude-service must be deliveryType 辅助服务");
}

const gemini = PRODUCT_SEED.filter((p) => p.platform === "gemini");
const geminiRequired = [
  "gemini-year",
  "gemini-recharge",
  "gemini-ultra",
  "gemini-pro",
  "gemini-mirror",
  "gemini-service",
];
for (const slug of geminiRequired) {
  if (!gemini.some((p) => p.slug === slug)) {
    fail += 1;
    console.error("[assert-classify] missing seed", slug);
  }
}
if (gemini.some((p) => p.slug === "gemini-quota-recharge")) {
  fail += 1;
  console.error("[assert-classify] unexpected seed gemini-quota-recharge（卡网无 AI 点数代充，已撤档）");
}
if (gemini.length !== 6) {
  fail += 1;
  console.error("[assert-classify] expected exactly 6 gemini seeds, got", gemini.length);
}
if (
  !gemini.every((p) =>
    ["成品账号", "充值/开通", "订阅/会员", "中转服务", "辅助服务"].includes(p.deliveryType),
  )
) {
  fail += 1;
  console.error(
    "[assert-classify] gemini deliveryType must be 成品账号|充值/开通|订阅/会员|中转服务|辅助服务",
  );
}
const geminiRecharge = gemini.find((p) => p.slug === "gemini-recharge");
if (!geminiRecharge || geminiRecharge.deliveryType !== "充值/开通") {
  fail += 1;
  console.error("[assert-classify] gemini-recharge must be deliveryType 充值/开通");
}
const geminiMirror = gemini.find((p) => p.slug === "gemini-mirror");
if (!geminiMirror || geminiMirror.deliveryType !== "中转服务") {
  fail += 1;
  console.error("[assert-classify] gemini-mirror must be deliveryType 中转服务");
}

const grok = PRODUCT_SEED.filter((p) => p.platform === "grok");
const grokRequired = [
  "grok-account",
  "grok-plus",
  "grok-premium",
  "grok-super",
  "grok-ultra",
  "x-twitter-premium",
  "x-twitter-premium-plus",
  "grok-service",
];
for (const slug of grokRequired) {
  if (!grok.some((p) => p.slug === slug)) {
    fail += 1;
    console.error("[assert-classify] missing seed", slug);
  }
}
if (grok.length !== 8) {
  fail += 1;
  console.error("[assert-classify] expected exactly 8 grok seeds, got", grok.length);
}
if (!grok.every((p) => ["成品账号", "订阅/会员", "辅助服务"].includes(p.deliveryType))) {
  fail += 1;
  console.error("[assert-classify] grok deliveryType must be 成品账号|订阅/会员|辅助服务");
}
if (grok.some((p) => p.slug === "super-grok" || p.slug === "super-grok-heavy")) {
  fail += 1;
  console.error("[assert-classify] unexpected legacy grok seed (已升级为 plus/premium/super/ultra)");
}
const xPremium = PRODUCT_SEED.find((p) => p.slug === "x-twitter-premium");
if (!xPremium || xPremium.platform !== "grok" || xPremium.name !== "X Premium") {
  fail += 1;
  console.error("[assert-classify] x-twitter-premium must be name=X Premium platform=grok");
}
const xPremiumPlus = PRODUCT_SEED.find((p) => p.slug === "x-twitter-premium-plus");
if (!xPremiumPlus || xPremiumPlus.platform !== "grok" || xPremiumPlus.name !== "X Premium+") {
  fail += 1;
  console.error("[assert-classify] x-twitter-premium-plus must be name=X Premium+ platform=grok");
}

const email = PRODUCT_SEED.filter((p) => p.platform === "email");
const emailRequired = [
  "gmail-account",
  "outlook-account",
  "icloud-email",
  "education-email",
  "email-account",
];
for (const slug of emailRequired) {
  if (!email.some((p) => p.slug === slug)) {
    fail += 1;
    console.error("[assert-classify] missing seed", slug);
  }
}
if (email.length !== 5) {
  fail += 1;
  console.error("[assert-classify] expected exactly 5 email seeds, got", email.length);
}
if (!email.every((p) => p.deliveryType === "邮箱/账号")) {
  fail += 1;
  console.error("[assert-classify] email deliveryType must be 邮箱/账号");
}

const sms = PRODUCT_SEED.filter((p) => p.platform === "sms");
const smsRequired = [
  "sms-openai",
  "sms-paypal",
  "sms-google",
  "sms-generic",
  "sms-kyc",
];
for (const slug of smsRequired) {
  if (!sms.some((p) => p.slug === slug)) {
    fail += 1;
    console.error("[assert-classify] missing seed", slug);
  }
}
if (sms.length !== 5) {
  fail += 1;
  console.error("[assert-classify] expected exactly 5 sms seeds, got", sms.length);
}
if (sms.some((p) => p.slug === "sms-verification")) {
  fail += 1;
  console.error("[assert-classify] unexpected seed sms-verification（已拆为五档）");
}
if (!sms.every((p) => p.deliveryType === "接码/验证")) {
  fail += 1;
  console.error("[assert-classify] sms deliveryType must be 接码/验证");
}

const other = PRODUCT_SEED.filter((p) => p.platform === "other");
const otherRequired = [
  "perplexity-account",
  "suno-account",
  "muse-ai-account",
  "dreamina-account",
  "duolingo-super",
  "apple-id-account",
  "telegram-account",
  "telegram-premium",
  "virtual-card",
  "gift-card",
  "other-product",
];
for (const slug of otherRequired) {
  if (!other.some((p) => p.slug === slug)) {
    fail += 1;
    console.error("[assert-classify] missing seed", slug);
  }
}
if (other.some((p) => ["cursor-account", "kiro-account", "windsurf-account", "x-twitter-account"].includes(p.slug))) {
  fail += 1;
  console.error("[assert-classify] other board must not include cursor/kiro/windsurf/x seeds");
}
if (other.length !== 11) {
  fail += 1;
  console.error("[assert-classify] expected exactly 11 other seeds, got", other.length);
}

if (fail) {
  console.error("[assert-classify] failed", fail);
  process.exit(1);
}

console.log(
  "[assert-classify] OK cases=",
  cases.length,
  "warrantyCases=",
  warrantyCases.length,
  "chatgptSeeds=",
  chatgpt.length,
  "kiroSeeds=",
  kiro.length,
  "cursorSeeds=",
  cursor.length,
  "claudeSeeds=",
  claude.length,
  "geminiSeeds=",
  gemini.length,
  "grokSeeds=",
  grok.length,
  "emailSeeds=",
  email.length,
  "smsSeeds=",
  sms.length,
  "otherSeeds=",
  other.length,
);
