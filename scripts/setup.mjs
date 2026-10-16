#!/usr/bin/env node
/**
 * One-click local bootstrap for contributors and self-hosters.
 * Usage: pnpm bootstrap
 * Note: prefer `pnpm bootstrap` — bare `pnpm setup` is a pnpm CLI builtin.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function log(message) {
  console.log(`[setup] ${message}`);
}

function ensureCopy(fromRel, toRel) {
  const from = join(root, fromRel);
  const to = join(root, toRel);
  if (!existsSync(from)) {
    log(`skip missing template: ${fromRel}`);
    return;
  }
  if (existsSync(to)) {
    log(`keep existing ${toRel}`);
    return;
  }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  log(`created ${toRel}`);
}

function run(command, args) {
  log(`${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

log("AI Price Radar bootstrap");
ensureCopy(".env.example", ".env.local");
ensureCopy("config/sources.shopapi.example.json", "config/sources.shopapi.json");
run("pnpm", ["install"]);

const shopsDb = join(root, "data", "shops.sqlite");
if (!existsSync(shopsDb)) {
  log("shops.sqlite missing — run: pnpm shops:migrate");
  log("(imports sources.shopapi.json / sources.16688.json / collectors.json hosts)");
} else {
  log(`keep existing data/shops.sqlite`);
}

const officialDb = join(root, "data", "official-prices.sqlite");
if (!existsSync(officialDb)) {
  log("official-prices.sqlite missing — run: pnpm official:migrate");
} else {
  log(`keep existing data/official-prices.sqlite`);
}

log("Done.");
log("Next:");
log("  1. pnpm shops:migrate      # shop archive → data/shops.sqlite");
log("  2. pnpm official:migrate   # GPT official regional prices SQLite");
log("  3. pnpm dev:all            # website + worker (one command)");
log("     (production: pnpm build && pnpm start:all)");
log("  4. Open http://localhost:3000");
log("Docs: docs/collect-schedule.md , docs/shops-sqlite.md , docs/official-prices.md");
log("Tip: use `pnpm bootstrap` (not bare `pnpm setup`, which is a pnpm builtin).");
