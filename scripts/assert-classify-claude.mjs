#!/usr/bin/env node
import assert from "node:assert/strict";
import { classifyTitle } from "../collectors/classify.mjs";
import { reclassifyOffer } from "../collectors/persist.mjs";

const cases = [];
// Screenshot: Pro belongs to the upstream pool, not to the item being sold.
for (const amount of [0.2, 1, 5, 10, 20]) {
  cases.push([`耀耀中转站 ${amount}USD 【永不过期】0.1不降智6a，claude，codex plus/pro大模型API卡密`, "chatgpt-mirror"]);
}
for (const brands of ["Claude/Codex", "Claude/GPT/Gemini", "Claude Gemini", "克劳德 OpenAI"]) {
  for (const delivery of ["中转站 API卡密", "API KEY 余额充值", "中转服务 月卡", "API额度兑换码"]) {
    cases.push([`${brands} plus/pro ${delivery}`, "chatgpt-mirror"]);
  }
}
for (const tier of ["Pro", "Max 5x", "Max 20x", "Team Standard", "Team Premium"]) {
  for (const delivery of ["中转站 充值卡", "API卡密 独享", "API KEY 质保订阅", "API额度 月卡", "反代服务 周卡", "API 月卡 非成品号"]) {
    cases.push([`Claude ${tier} ${delivery}`, "claude-mirror"]);
  }
}
cases.push(
  ["Claude中转站", "claude-mirror"],
  ["Claude API Token充值卡", "claude-mirror"],
  ["Claude API卡密 非账号", "claude-mirror"],
  ["Claude-Kiro API KEY 100M Token", "claude-mirror"],
  ["Claude code 每天50刀额度 有效期7天", "claude-mirror"],
  ["Claude Pro 官方直充 非API 月卡", "claude-pro-month"],
  ["Claude Pro 不含API KEY 月卡", "claude-pro-month"],
  ["Claude Pro 无API KEY 官方订阅", "claude-pro-month"],
  ["Claude Pro 不支持API KEY 月卡", "claude-pro-month"],
  ["Claude Pro 不提供API KEY 月卡", "claude-pro-month"],
  ["Claude Pro 订阅 不提供中转服务", "claude-pro-month"],
  ["Claude Pro 独享成品号 支持API调用", "claude-pro-month"],
  ["Claude Pro 成品号 可导入中转站", "claude-pro-month"],
  ["Claude Pro 订阅 可用于中转站", "claude-pro-month"],
  ["Claude Pro 成品号 支持反代 质保首登", "claude-pro-month"],
  ["Claude Pro 成品号 支持镜像站", "claude-pro-month"],
  ["Claude Pro 成品号 支持中转服务", "claude-pro-month"],
  ["Claude Pro 成品号 支持API KEY导出", "claude-pro-month"],
  ["Claude Pro 成品号 中转站专供账号", "claude-pro-month"],
  ["Claude Pro-三人车", "claude-pro-month"],
  ["Claude Pro 自助卡密（一个月）", "claude-pro-month"],
  ["Claude Max 20x 号池专供账号", "claude-max-20x"],
  ["Claude Max 5x 独享成品号 可反代", "claude-max-5x"],
  ["Claude Team Premium 席位 官方订阅", "claude-team-premium"],
  ["Claude Team Standard 席位 官方订阅", "claude-team-standard"],
  ["Claude Pro KYC认证服务", "claude-kyc"],
  ["Claude 协助充值 Pro", "claude-service"],
  ["Claude 普号 free 可开Pro", "claude-account"],
  ["GPT/Claude 官方代充 会员月卡", "claude-pro-month"],
  ["Kiro Pro+ 2000积分 可用Claude Opus", "kiro-pro-plus"],
  ["谷歌邮箱API【注册claude专用】", "gmail-account"],
);

for (const [title, expected] of cases) {
  assert.equal(classifyTitle(title).productSlug, expected, title);
  // Existing offers, including offers merged by a long-running worker, use the same rule.
  const offer = { sourceTitle: title, productSlug: "claude-pro-month", price: 0.2,
    status: "in_stock", stockCount: 995, capturedAt: "2026-11-02T10:37:00Z", lifecycle: "active" };
  const reclassified = reclassifyOffer(offer);
  assert.equal(reclassified.productSlug, expected, `persist: ${title}`);
  const { productSlug, warranty, classified, ...unchanged } = reclassified;
  const { productSlug: oldSlug, ...original } = offer;
  assert.ok(productSlug && oldSlug && classified && typeof warranty === "boolean");
  assert.deepEqual(unchanged, original);
}
console.log(`[assert-classify-claude] OK cases=${cases.length} (classifier + persisted offers)`);
