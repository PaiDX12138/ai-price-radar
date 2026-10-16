/**
 * Fire-and-forget: spawn a one-shot worker to collect a single shop.
 * Keeps HTTP request off the collect path (separate Node process).
 *
 * Windows: 不要用 detached（会弹独立 node.exe 黑窗）；靠 windowsHide + unref 静默跑。
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORKER_SCRIPT = join(root, "scripts/worker.mjs");
const IS_WIN = process.platform === "win32";

/**
 * @param {string} shopId
 * @returns {{ kicked: boolean, reason?: string }}
 */
export function kickImmediateShopCollect(shopId) {
  const id = String(shopId || "").trim();
  if (!id) return { kicked: false, reason: "empty_id" };

  try {
    const child = spawn(
      process.execPath,
      [WORKER_SCRIPT, "--once", `--shop=${id}`],
      {
        cwd: root,
        // Unix: detach so Next 重启不连带杀掉；Windows: detach 会开控制台窗
        detached: !IS_WIN,
        stdio: "ignore",
        env: process.env,
        windowsHide: true,
        shell: false,
      },
    );
    child.unref();
    return { kicked: true };
  } catch (err) {
    return {
      kicked: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
