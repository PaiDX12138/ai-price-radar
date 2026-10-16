#!/usr/bin/env node
/**
 * 自建站 favicon 同步（采集后也可单独跑）。
 *   pnpm sync:favicons
 *   pnpm sync:favicons -- --force
 */
import { loadCatalogSnapshot } from "../collectors/persist.mjs";
import { syncHostFavicons, writeHostFaviconManifest } from "../collectors/favicon.mjs";

function parseArgs(argv) {
  return { force: argv.includes("--force"), help: argv.includes("--help") || argv.includes("-h") };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:
  pnpm sync:favicons
  pnpm sync:favicons -- --force`);
    process.exit(0);
  }

  const catalog = loadCatalogSnapshot();
  const sources = catalog?.sources || [];
  if (!sources.length) {
    writeHostFaviconManifest();
    console.log("[favicon] no catalog sources; wrote disk scan manifest only");
    return;
  }

  const result = await syncHostFavicons(sources, { force: args.force, concurrency: 3 });
  console.log(
    `[favicon] done hosts=${result.hosts} saved=${result.saved} manifest=${Object.keys(result.manifest.hosts || {}).length}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
