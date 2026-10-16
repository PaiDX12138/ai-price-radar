#!/usr/bin/env node
/**
 * Probe shop homepage URL; on success upsert into shops.sqlite (listed_at immutable).
 * Usage: pnpm shops:upsert -- --url https://www.16688.com.cn/shop/S687067
 */
import { getShop, openShopsDb, closeShopsDb } from "../collectors/shops-db.mjs";
import { probeShopUrl, upsertShopFromProbe } from "../collectors/probe-shop-url.mjs";

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
  pnpm shops:upsert -- --url <shop-homepage-url>`);
    process.exit(args.help ? 0 : 1);
  }

  const probe = await probeShopUrl(args.url);
  if (!probe.ok) {
    console.error("[shops:upsert] probe failed:", probe.error);
    if (probe.expectedHints) console.error("hints:", probe.expectedHints.join(" | "));
    process.exit(1);
  }

  const db = openShopsDb();
  const before = probe.id ? getShop(db, probe.id) : null;
  const listedBefore = before?.listed_at || null;

  const upsert = upsertShopFromProbe(probe, {
    db,
    submittedBy: "user",
    inputUrl: args.url,
  });

  const after = getShop(db, upsert.id);
  console.log(
    JSON.stringify(
      {
        probe: {
          ok: probe.ok,
          id: probe.id,
          collectorKind: probe.collectorKind,
          platform: probe.platform,
          name: probe.name,
        },
        upsert,
        listedAtBefore: listedBefore,
        listedAtAfter: after?.listed_at || null,
        listedAtUnchanged: listedBefore != null && listedBefore === after?.listed_at,
      },
      null,
      2,
    ),
  );
  closeShopsDb();
  process.exit(upsert.action === "rejected" ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
