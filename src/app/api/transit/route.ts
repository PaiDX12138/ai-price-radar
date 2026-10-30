import { connection, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { loadTransitSnapshot } from "@/lib/transit/snapshot";

/** Actual website process snapshot; public counts only, never DB/config paths or raw data. */
export async function GET() {
  await connection();
  const snapshot=loadTransitSnapshot();
  const stations=(snapshot?.stations??[]).map(station=>{
    const groups=snapshot!.groups.filter(g=>g.station_id===station.id),ids=new Set(groups.map(g=>g.id));
    const offers=snapshot!.offers.filter(o=>ids.has(o.group_id));
    const families:Record<string,number>={};
    for(const offer of offers)families[offer.family??"其他"]=(families[offer.family??"其他"]??0)+1;
    return {id:station.id,name:station.name,lastCollectOk:station.last_collect_ok,lastCollectedAt:station.last_collected_at,
      groups:groups.length,models:new Set(offers.map(o=>o.raw_model)).size,offers:offers.length,families};
  });
  return NextResponse.json({ok:Boolean(snapshot),readerVersion:"transit-observability-v1",generatedAt:snapshot?.generatedAt??null,
    snapshotFingerprint:snapshot?createHash("sha256").update(JSON.stringify(snapshot)).digest("hex").slice(0,16):null,stations},
    {headers:{"Cache-Control":"no-store, max-age=0"}});
}
