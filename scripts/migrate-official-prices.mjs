#!/usr/bin/env node
/**
 * Migrate / seed official regional prices SQLite.
 *
 *   pnpm official:migrate
 *   pnpm official:migrate -- --force-seed
 *   pnpm official:migrate -- --db path/to/official-prices.sqlite
 */
import {
  closeOfficialDb,
  migrateOfficialPrices,
  openOfficialDb,
  resolveOfficialDbPath,
} from "../collectors/official-prices-db.mjs";

function parseArgs(argv) {
  const out = { forceSeed: false, db: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--force-seed") out.forceSeed = true;
    else if (arg === "--db") out.db = argv[++i] || null;
    else if (arg?.startsWith("--db=")) out.db = arg.slice(5);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Usage: pnpm official:migrate [--force-seed] [--db path]`);
  process.exit(0);
}

const dbPath = resolveOfficialDbPath(args.db);
const db = openOfficialDb(dbPath);
try {
  const stats = migrateOfficialPrices(db, { forceSeed: args.forceSeed });
  console.log(
    `[official:migrate] ${dbPath}\n  apps=${stats.apps} plans=${stats.plans} regions=${stats.regions} prices=${stats.prices}`,
  );
} finally {
  closeOfficialDb();
}
