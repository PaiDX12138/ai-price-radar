#!/usr/bin/env node
/**
 * Grok 分档回归用例：档位按美元档 / 月均价划分，改写标题（Gr.ok、G/rok、gr-ok、gro）要能认出，
 * 普号带「微软邮箱」仍归 Grok 普号。每条带报价（元），与采集器调用 classifyTitle(title, { price }) 一致。
 */
import { classifyTitle } from "../collectors/classify.mjs";

/** @type {[string, number, string | null][]} */
const cases = [
  // 30 刀档：标题写 Super 也归 Premium
  ["gro-Super gro $30 【30天质保】秒冲不排队", 157.59, "grok-premium"],
  ["Grok-Super Grok 30刀1个月卡 【30天质保订阅，不质保封号】", 209, "grok-premium"],
  ["Grok Super 30美刀iOS渠道一个月官方正规充值，旧版不是最新三合一", 158, "grok-premium"],
  ["Grok-Super Grok 90刀3个月卡 【90天质保订阅，不质保封号】", 500, "grok-premium"],
  ["Super gro 正规IOS充值 （30刀/2月）自助开通卡密/支持续费-ID充值", 221.45, "grok-premium"],
  // 无美元档的「Grok Super」按月均价判
  ["Grok Super直充卡密（1个月）", 150, "grok-premium"],
  ["Grok Super直充卡密（3个月）", 248, "grok-premium"],
  ["Gro_k Super 官方正规充值1年 质保 正规美区 同步 X Premium+ 12个月", 1060, "grok-premium"],
  ["Grok Super 8-10天订阅账号【 质保3天】只保订阅", 39, "grok-premium"],
  // 真 Super：100 刀 / 15x / SuperGrok Plus
  ["Gro super 15x 1个月", 450, "grok-super"],
  ["Gro super 15x 1个月 100刀正规充值", 620, "grok-super"],
  ["【正规实付IOS美区】Supergro Plus 100美金 官方充值月卡【质保订阅30天】", 705, "grok-super"],
  // Plus：8 刀 / Lite
  ["【正规实付】Supergro Lite 6个月 质保订阅180天（包含同时长X Premium会员）【官方直充】", 180.7, "grok-plus"],
  // Ultra：Heavy / 200·300 刀
  ["Super gr-ok heavy 速刷号（活2天左右，接受再下单）", 111.24, "grok-ultra"],
  ["G.rok Heavy 速刷成品号（质保首登，当日抛用 介意不要下单！）", 80, "grok-ultra"],
  ["Super G r o k Heavy 特殊渠道 月卡直充服务（质保激活，人工代发）", 276.95, "grok-ultra"],
  ["Super heavy gro 300美刀代充/成品账号1个月", 473, "grok-ultra"],
  // 改写标题
  ["Super Gr.ok三个月直充 【质保90天订阅】", 313.5, "grok-premium"],
  ["Super G/rok三个月直充 【质保90天订阅】", 290, "grok-premium"],
  ["【质保一个月】Super Gro网页镜像", 44, "grok-premium"],
  ["Super Gro 周卡 CDK", 37.08, "grok-premium"],
  // 普号带邮箱仍归 Grok 普号
  ["gro-Free成品号 | 可用gro Build 4.6/4.7 有sso|CPA格式 | 微软邮箱注册", 0.04, "grok-account"],
  ["gro 长效微软邮箱注册 无会员普通号 附赠微软邮箱", 1.85, "grok-account"],
  ["普号 gro AI 长效 微软邮箱 账密 SSO 支持 web/build/con ole", 0.43, "grok-account"],
  ["G_rok稳定普号(botFlag：0) 长效微软邮箱注册 无会员普通号 附赠微软邮箱，没有被人机标记", 1.55, "grok-account"],
  // 不是 Grok → 其他板 Muse
  ["Muse AI成品号 带10亿token（对标SuperGro-k）bot", 13.2, "muse-ai-account"],
];

let fail = 0;
for (const [title, price, expected] of cases) {
  const got = classifyTitle(title, { price }).productSlug;
  if (got !== expected) {
    fail += 1;
    console.error(`[assert-classify-grok] ${title} (¥${price}) expected=${expected} got=${got}`);
  }
}
// Groq 不是 Grok
{
  const got = classifyTitle("Groq API key 10刀", { price: 10 }).productSlug;
  if (got && got.startsWith("grok")) {
    fail += 1;
    console.error(`[assert-classify-grok] Groq misread as ${got}`);
  }
}

if (fail) {
  console.error("[assert-classify-grok] failed", fail);
  process.exit(1);
}
console.log("[assert-classify-grok] OK cases=", cases.length + 1);
