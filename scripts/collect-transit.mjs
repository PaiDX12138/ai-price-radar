#!/usr/bin/env node
import {loadEnvLocal} from "./load-env-local.mjs";
import {openTransitDb,closeTransitDb} from "../collectors/transit-db.mjs";
import {runTransitCollection,TRANSIT_INTERVAL_MS,loadTransitSources} from "../collectors/transit/collect.mjs";
import {refreshTransitModelCatalog} from "../collectors/transit/model-catalog.mjs";
loadEnvLocal();
const stationArg = process.argv.find(value => value.startsWith("--station="))?.slice(10);
const sources = loadTransitSources().filter(source => !stationArg || source.id === stationArg);
if (!sources.length) throw new Error("unknown_transit_station");
// The existing independent worker calls this CLI every tick; model metadata has its own 6h schedule.
console.log(JSON.stringify({modelCatalog:await refreshTransitModelCatalog().catch(error=>({status:"failed",error:error.message}))}));
const db=openTransitDb();
try {
  const hours=Number(process.env.TRANSIT_COLLECT_INTERVAL_HOURS??6);
  const intervalMs=[6,12,24].includes(hours)?hours*3600000:TRANSIT_INTERVAL_MS;
  const results=await runTransitCollection(db,{sources,force:!process.argv.includes("--due"),intervalMs,includePerformance:!process.argv.includes("--pricing-only")});
  console.log(JSON.stringify({ok:!results.some(r=>r.status==="failed"),results}));
  if(results.some(r=>r.status==="failed")) process.exitCode=1;
} finally {closeTransitDb();}
