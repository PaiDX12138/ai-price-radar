#!/usr/bin/env node
import Database from "better-sqlite3";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = process.argv.slice(2);
const value = (key, fallback = null) => { const index = args.indexOf(key); return index < 0 ? fallback : args[index + 1]; };
const path = resolve(value("--db", "data/official-prices.sqlite"));
const reportPath = resolve(value("--report", "work/official-prices-audit.json"));
const apply = args.includes("--apply");
if (value("--snapshot")) process.env.OFFICIAL_SNAPSHOT_PATH = resolve(value("--snapshot"));
const { auditOfficialPrices, applyOfficialPriceEvidence } = await import("../collectors/official-pricing-audit.mjs");
const api = await import("../collectors/official-prices-db.mjs");
const db = apply ? api.openOfficialDb(path) : new Database(path, { readonly: true });
try {
  const report = { capturedAt: new Date().toISOString(), mode: apply ? "apply" : "read-only", before: auditOfficialPrices(db) };
  if (apply) {
    report.backup = `${path}.before-full-audit-${Date.now()}.sqlite`;
    db.prepare("VACUUM INTO ?").run(report.backup);
    if (value("--evidence")) {
      const evidence = JSON.parse(readFileSync(resolve(value("--evidence")), "utf8"));
      if (evidence.fx?.rates?.USD !== 1 || !Number.isFinite(evidence.fx?.rates?.CNY) || !(evidence.fx?.rates?.CNY > 0)) throw new Error("Evidence must include valid USD-based FX");
      api.upsertFx(db, evidence.fx);
      report.migration = api.migrateOfficialPrices(db);
      report.applied = applyOfficialPriceEvidence(db, evidence);
    } else report.migration = api.migrateOfficialPrices(db);
    const fx = api.getFx(db);
    api.refreshAllCny(db, fx.rates, fx.date);
    api.writeOfficialPricesSnapshot(db);
  }
  report.after = auditOfficialPrices(db);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ report: reportPath, mode: report.mode, rows: report.after.rows, issues: report.after.issues.length, apps: report.after.apps, applied: report.applied }, null, 2));
  if (report.after.issues.length) process.exitCode = 1;
} finally { db.close(); }
