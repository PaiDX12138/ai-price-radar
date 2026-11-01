/** Portable PUBLIC transit facts, not a machine/database backup. No schedules,
 * leases, env, transport bodies, private shop data or local absolute paths. */
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
export const BASELINE_TABLES=[
  'transit_stations','transit_groups','transit_offers',
  'transit_monitor_identities','transit_monitor_probes','transit_monitor_hourly','transit_monitor_summaries','transit_service_states',
  'transit_model_catalog_versions','transit_model_detail_state','transit_offer_charge_items','transit_fx_observations',
  'transit_model_probe_observations','transit_model_probe_hourly','transit_model_metric_summaries',
  'transit_runapi_catalog_versions','transit_runapi_billing_versions','transit_runapi_metadata_observations','transit_runapi_memberships',
  'transit_runapi_probe_targets','transit_runapi_probe_observations','transit_runapi_probe_hourly','transit_runapi_monitor_summaries',
  'transit_cubence_catalog_versions','transit_cubence_metadata_observations',
  'transit_crazyrouter_catalog_versions','transit_crazyrouter_metadata_versions','transit_crazyrouter_metric_summaries',
  'transit_sudocode_catalog_versions','transit_sudocode_metadata_versions','transit_sudocode_tier_hourly',
  'transit_performance_observations',
];
const CURRENT=new Set(['transit_stations','transit_groups','transit_offers','transit_model_detail_state','transit_offer_charge_items','transit_runapi_memberships','transit_runapi_probe_targets','transit_monitor_identities']);
const IMMUTABLE=new Set(['transit_monitor_probes','transit_model_probe_observations','transit_runapi_probe_observations']);
const blocked=/^(?:password|passwd|secret|client_secret|api_key|apikey|access_token|refresh_token|token|authorization|cookie|set-cookie|proxy|http_proxy|proxy_url)$/i;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const pick=(v,keys)=>Object.fromEntries(keys.filter(k=>v?.[k]!==undefined).map(k=>[k,v[k]]));
export function publicValue(value){
  if(Array.isArray(value))return value.map(publicValue);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!blocked.test(k)).map(([k,v])=>[k,publicValue(v)]));
  if(typeof value==='string'){
    if(/\b(?:sk-[a-zA-Z0-9_-]{12,}|gh[pousr]_[a-zA-Z0-9_]{20,}|Bearer\s+\S+)/.test(value))throw new Error('baseline_credential_detected');
    if(/^[A-Za-z]:[\\/]|^\/(?:www|home|Users|root|tmp)\//.test(value))throw new Error('baseline_local_path_detected');
    if(/^https?:\/\//i.test(value)){const u=new URL(value);if(u.username||u.password||[...u.searchParams.keys()].some(k=>blocked.test(k)))throw new Error('baseline_private_url_detected');}
  }
  return value;
}
function cleanRow(table,row,at){
  const out={...row};
  if(table==='transit_performance_observations')delete out.id; // local autoincrement, NOT source identity
  for(const k of Object.keys(out)){
    if(['config_json','error_message','last_error','parse_error'].includes(k)){out[k]=null;continue;}
    if(k.endsWith('_json')&&typeof out[k]==='string')out[k]=JSON.stringify(publicValue(JSON.parse(out[k])));
    else out[k]=publicValue(out[k]);
  }
  if(table==='transit_stations'){
    const m=JSON.parse(row.raw_meta_json??'{}');
    const safe=pick(m,['currencyKind','creditBasisVerified','priceBasis','groupOrigin','service','billingConfiguration']);
    if(m.logo)safe.logo=pick(m.logo,['sha256','checkedAt']);
    if(m.pricingCollection)safe.pricingCollection=pick(m.pricingCollection,['status','observedAt','sourceUrl','inventory','policyUrl','policyHash','normalizationDenominator']);
    out.raw_meta_json=JSON.stringify(publicValue(safe));out.config_json=null;
  }
  if(table==='transit_model_detail_state'){
    out.fail_count=0;out.last_error=null;out.next_attempt_at=at;out.last_attempt_at=null;
  }
  return out;
}
export function createBaseline(db,{modelCatalog=null,createdAt=new Date().toISOString()}={}){
  return db.transaction(()=>{
    const stations=db.prepare("SELECT * FROM transit_stations WHERE status='published' ORDER BY id").all();
    const ids=new Set(stations.map(s=>s.id)),groups=db.prepare('SELECT id,station_id FROM transit_groups').all(),groupStation=new Map(groups.map(g=>[g.id,g.station_id]));
    const offerStation=new Map(db.prepare('SELECT id,group_id FROM transit_offers').all().map(o=>[o.id,groupStation.get(o.group_id)]));
    const tables={};
    for(const table of BASELINE_TABLES){
      const rows=db.prepare(`SELECT * FROM ${table}`).all().filter(row=>ids.has(row.station_id??(table==='transit_stations'?row.id:row.group_id?groupStation.get(row.group_id):offerStation.get(row.offer_id))));
      tables[table]=rows.map(row=>cleanRow(table,row,createdAt));
    }
    const bundle={schemaVersion:1,kind:'public_transit_baseline',createdAt,tables,modelCatalog:publicValue(modelCatalog)};
    const bytes=gzipSync(Buffer.from(JSON.stringify(bundle)),{level:9});
    const manifest={schemaVersion:1,kind:bundle.kind,createdAt,sha256:hash(bytes),bytes:bytes.length,
      sourceTimesPreserved:true,notLiveData:true,stations:stations.map(s=>{
        const gs=new Set(tables.transit_groups.filter(g=>g.station_id===s.id&&g.status==='active').map(g=>g.id)),offers=tables.transit_offers.filter(o=>gs.has(o.group_id)&&o.status==='active');
        return {id:s.id,groups:gs.size,models:new Set(offers.map(o=>o.raw_model)).size,offers:offers.length,collectedAt:s.last_collected_at};
      }),rows:Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,v.length]))};
    return {bytes,manifest};
  }).deferred();
}
export function decodeBaseline(bytes,manifest){
  if(bytes.length>32*1024*1024||hash(bytes)!==manifest.sha256)throw new Error('baseline_checksum_or_size');
  const bundle=JSON.parse(gunzipSync(bytes,{maxOutputLength:128*1024*1024}).toString());
  if(bundle.schemaVersion!==1||bundle.kind!=='public_transit_baseline'||bundle.createdAt!==manifest.createdAt)throw new Error('baseline_invalid_header');
  for(const [table,rows]of Object.entries(bundle.tables??{})){
    if(!BASELINE_TABLES.includes(table)||!Array.isArray(rows)||rows.length!==manifest.rows[table])throw new Error('baseline_invalid_table');
    for(const row of rows)if(!row||typeof row!=='object'||Array.isArray(row)||Object.values(row).some(v=>v!==null&&!['string','number'].includes(typeof v)))throw new Error('baseline_invalid_row');
  }
  if(BASELINE_TABLES.some(t=>!bundle.tables[t]))throw new Error('baseline_missing_table');
  return bundle;
}
/** Merge a dated baseline. Newer server catalogs/points and all server schedules
 * stay authoritative; absent rows are inactivated, never deleted. */
export function mergeBaseline(db,bundle,{dryRun=false}={}){
  return db.transaction(()=>mergeBaselineLocked(db,bundle,{dryRun})).immediate();
}
function mergeBaselineLocked(db,bundle,{dryRun}){
  const groupStation=new Map(bundle.tables.transit_groups.map(g=>[g.id,g.station_id]));
  const offerStation=new Map(bundle.tables.transit_offers.map(o=>[o.id,groupStation.get(o.group_id)]));
  const stationOf=(table,row)=>row.station_id??(table==='transit_stations'?row.id:row.group_id?groupStation.get(row.group_id):offerStation.get(row.offer_id));
  const plans=bundle.tables.transit_stations.map(s=>{
    const incoming=bundle.tables.transit_offers.filter(o=>offerStation.get(o.id)===s.id&&o.status==='active');
    const local=db.prepare(`SELECT o.family,o.observed_at FROM transit_offers o JOIN transit_groups g ON g.id=o.group_id WHERE g.station_id=? AND o.status='active' AND g.status='active'`).all(s.id);
    const incomingAt=incoming.map(o=>o.observed_at).sort().at(-1)??'',localAt=local.map(o=>o.observed_at).sort().at(-1)??'';
    const families=new Set(incoming.map(o=>o.family)),localFamilies=new Set(local.map(o=>o.family));
    const core=['Claude','GPT','Gemini','DeepSeek'].filter(f=>families.has(f));
    const state=db.prepare('SELECT last_collect_ok FROM transit_stations WHERE id=?').get(s.id);
    const incompleteFailed=state?.last_collect_ok!==1&&core.some(f=>!localFamilies.has(f));
    const complete=local.length>0&&!incompleteFailed;
    return {id:s.id,applyCatalog:!(localAt>=incomingAt&&complete),incomingAt,localAt};
  });
  // Existing archive IDs must not be relabelled to a different monitored subject.
  for(const m of bundle.tables.transit_monitor_identities){
    const old=db.prepare('SELECT model_name,scope_kind FROM transit_monitor_identities WHERE station_id=? AND monitor_id=?').get(m.station_id,m.monitor_id);
    if(old&&(old.model_name!==m.model_name||old.scope_kind!==m.scope_kind))throw new Error('baseline_monitor_identity_conflict:'+m.station_id);
  }
  const applied=new Set(plans.filter(p=>p.applyCatalog).map(p=>p.id)),counts={};
  const schemas=new Map(BASELINE_TABLES.map(table=>[table,db.prepare(`PRAGMA table_info(${table})`).all()]));
  for(const [table,rows]of Object.entries(bundle.tables))for(const row of rows){
    const valid=new Set(schemas.get(table).map(c=>c.name));if(Object.keys(row).some(k=>!valid.has(k)))throw new Error('baseline_unknown_column:'+table);
    if(!plans.some(p=>p.id===stationOf(table,row)))throw new Error('baseline_unknown_station');
  }
  if(dryRun)return {dryRun:true,createdAt:bundle.createdAt,stations:plans};
  db.transaction(()=>{
    for(const table of BASELINE_TABLES){
      const rows=bundle.tables[table];if(!rows.length)continue;
      const schema=schemas.get(table),columns=Object.keys(rows[0]);
      if(rows.some(r=>Object.keys(r).join(',')!==columns.join(',')))throw new Error('baseline_inconsistent_columns');
      const keys=table==='transit_performance_observations'?['station_id','model_name','group_key','bucket_at','window_hours']:schema.filter(c=>c.pk).sort((a,b)=>a.pk-b.pk).map(c=>c.name);
      const fields=columns.filter(c=>!keys.includes(c));
      const clock=['source_snapshot_at','last_observed_at','last_seen_at','observed_at','updated_at','last_success_at'].find(c=>columns.includes(c));
      let where=clock?` WHERE excluded.${clock}>${table}.${clock} OR ${table}.${clock} IS NULL`:'';
      if(columns.includes('is_partial'))where=` WHERE (${clock?`excluded.${clock}>${table}.${clock}`:'1=1'}) AND (${table}.is_partial=1 OR excluded.is_partial=0)`;
      if(table==='transit_performance_observations')where+=` AND (excluded.source_generated_at IS NULL OR transit_performance_observations.source_generated_at IS NULL OR excluded.source_generated_at>=transit_performance_observations.source_generated_at)`;
      const changes=fields.map(c=>`${c}=excluded.${c}`);
      if(table==='transit_stations'){
        changes[fields.indexOf('listed_at')]='listed_at=MIN(transit_stations.listed_at,excluded.listed_at)';
        changes[fields.indexOf('status')]=`status=CASE WHEN transit_stations.status IN ('paused','dead') THEN transit_stations.status ELSE excluded.status END`;
        // Catalog completeness can override a recent failed/partial collection.
        where='';
      }else if(CURRENT.has(table))where='';
      const conflict=IMMUTABLE.has(table)||!fields.length?'DO NOTHING':`DO UPDATE SET ${changes.join(',')}${where}`;
      const stmt=db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')}) ON CONFLICT(${keys.join(',')}) ${conflict}`);
      counts[table]=0;
      for(const row of rows){
        if(CURRENT.has(table)&&!applied.has(stationOf(table,row))){
          // Preserve an old subject for its historical FK, but never reactivate it.
          if(table==='transit_monitor_identities'&&!db.prepare('SELECT 1 FROM transit_monitor_identities WHERE station_id=? AND monitor_id=?').get(row.station_id,row.monitor_id)){
            counts[table]+=stmt.run(...columns.map(c=>c==='active'?0:row[c])).changes;
          }
          continue;
        }
        counts[table]+=stmt.run(...columns.map(c=>row[c])).changes;
      }
    }
    for(const id of applied){
      const at=bundle.tables.transit_stations.find(s=>s.id===id).updated_at;
      const keepGroups=new Set(bundle.tables.transit_groups.filter(g=>g.station_id===id).map(g=>g.id));
      const keepOffers=new Set(bundle.tables.transit_offers.filter(o=>offerStation.get(o.id)===id).map(o=>o.id));
      for(const g of db.prepare('SELECT id FROM transit_groups WHERE station_id=?').all(id))if(!keepGroups.has(g.id))db.prepare("UPDATE transit_groups SET status='inactive',updated_at=? WHERE id=?").run(at,g.id);
      for(const o of db.prepare('SELECT o.id FROM transit_offers o JOIN transit_groups g ON g.id=o.group_id WHERE g.station_id=?').all(id))if(!keepOffers.has(o.id))db.prepare("UPDATE transit_offers SET status='inactive',updated_at=? WHERE id=?").run(at,o.id);
    }
  }).immediate();
  return {dryRun:false,createdAt:bundle.createdAt,stations:plans,mergedRows:counts};
}
