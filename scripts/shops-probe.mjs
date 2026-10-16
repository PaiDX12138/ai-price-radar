#!/usr/bin/env node
/**
 * Probe a shop homepage URL (no DB write).
 * Usage: pnpm shops:probe -- --url https://www.16688.com.cn/shop/S687067
 */
import { probeShopUrl } from "../collectors/probe-shop-url.mjs";

function parseArgs(argv) {
  const out = { url: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--url") out.url = argv[++i] || null;
    else if (arg?.startsWith("--url=")) out.url = arg.slice(6);
    else if (!arg.startsWith("-") && !out.url) out.url = arg;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.url) {
    console.log(`Usage:
  pnpm shops:probe -- --url <shop-homepage-url>`);
    process.exit(args.help ? 0 : 1);
  }

  const result = await probeShopUrl(args.url);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
