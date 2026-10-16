#!/usr/bin/env node
/**
 * One-command: website + collect worker.
 *
 *   pnpm dev:all     → next dev  + worker
 *   pnpm start:all   → next start + worker  (run pnpm build first)
 *
 * Ctrl+C stops both. Logs are prefixed [web] / [worker].
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv.includes("--start") ? "start" : "dev";

const shopsDb = process.env.SHOPS_DB_PATH || join(root, "data", "shops.sqlite");
if (!existsSync(shopsDb)) {
  console.warn(`[run] missing ${shopsDb}`);
  console.warn("[run] run once: pnpm shops:migrate");
}

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];
let shuttingDown = false;

function prefixLines(prefix, chunk, write) {
  const text = chunk.toString();
  for (const line of text.split(/\r?\n/)) {
    if (line.length) write(`${prefix}${line}\n`);
  }
  if (text.endsWith("\n") || text.endsWith("\r\n")) {
    /* already handled */
  }
}

function start(name, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    env: process.env,
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  const tag = `[${name}] `;
  child.stdout?.on("data", (c) => prefixLines(tag, c, (s) => process.stdout.write(s)));
  child.stderr?.on("data", (c) => prefixLines(tag, c, (s) => process.stderr.write(s)));
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.log(`[run] ${name} exited code=${code} signal=${signal || ""}`);
    shutdown(code ?? 1);
  });
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    try {
      if (!child.killed) child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  // Windows: ensure tree dies
  setTimeout(() => process.exit(code), 500);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// Open-source default: worker can prewarm the local site without extra config.
if (!process.env.PREWARM_BASE_URL && !process.env.NEXT_PUBLIC_SITE_URL) {
  process.env.PREWARM_BASE_URL = "http://localhost:3000";
} else if (!process.env.PREWARM_BASE_URL && process.env.NEXT_PUBLIC_SITE_URL) {
  process.env.PREWARM_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL;
}

console.log(`[run] mode=${mode} — starting web + worker (Ctrl+C to stop both)`);
start("web", "pnpm", [mode]);
start("worker", "pnpm", ["worker"]);
