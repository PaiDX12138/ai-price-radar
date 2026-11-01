import {randomUUID} from 'node:crypto';
import {mkdirSync,existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {upsertTransitCollection,recordTransitSourceSnapshot} from '../transit-db.mjs';
import {describeTransitError} from './transport.mjs';
import {runHash,parseRunMetadata,parseRunCatalog,parseRunMonitoring} from './runapi-parser.mjs';
import {saveRunCatalog,currentRunCatalog,saveRunMonitoring,pruneRunHistory} from './runapi-storage.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'../..');
const recordRun=(db,config,runId,status,start,at,error,count)=>db.prepare(`INSERT INTO transit_collection_runs
 (run_id,station_id,collector_kind,stage,status,started_at,finished_at,error_message,offer_count) VALUES (?,?,?,'performance',?,?,?,?,?)`)
 .run(runId,config.id,config.collectorKind,status,start,at,error,count);
function references(){try{const value=JSON.parse(readFileSync(process.env.TRANSIT_MODEL_CATALOG_PATH??join(root,'data/transit/model-catalog.json'),'utf8'));return Date.now()-Date.parse(value.generatedAt)<7*86400000?value.models??{}:{};}catch{return {};}}
export async function collectRunApiSource(db,config,options,runtime){
  if(!config.enabled)return {id:config.id,status:'skipped'};
  const {fetchPublic,claimTransit,finishTransit}=runtime,owner=options.owner??randomUUID(),now=()=>options.now??new Date().toISOString(),started=now();
  const claims=db.transaction(()=>{
    const busy=db.prepare(`SELECT 1 FROM transit_collect_schedule WHERE station_id=? AND lease_until>? AND lease_owner<>?
      UNION ALL SELECT 1 FROM transit_performance_schedule WHERE station_id=? AND lease_until>? AND lease_owner<>? LIMIT 1`).get(config.id,started,owner,config.id,started,owner);
    if(busy)return {};
    return {pricing:claimTransit(db,config,{owner,now:started,force:options.force}),performance:options.includePerformance!==false&&claimTransit(db,config,{owner,now:started,force:options.force,task:'performance'})};
  }).immediate();
  if(!claims.pricing&&!claims.performance)return {id:config.id,status:'skipped'};
  const rawDir=options.rawDir??join(root,'data/transit/raw'),deadline=Date.now()+(config.collectionBudgetMs??180000),warnings=[],attempts=[];
  let priceStatus='skipped',performanceStatus='skipped',parsed,inserted=0;
  const priceRun=`transit-${config.id}-${randomUUID()}`,perfRun=`transit-${config.id}-monitor-${randomUUID()}`;
  const get=async(url,kind,runId,binary=false)=>{
    const left=deadline-Date.now();if(left<1000)throw new Error('runapi_collection_budget');
    const response=await fetchPublic(url,{...config,timeoutMs:Math.min(config.timeoutMs??20000,left)},options.fetchImpl);
    const hash=runHash(binary?response.bytes:response.text);
    const previous=db.prepare('SELECT payload_path FROM transit_source_snapshots WHERE station_id=? AND source_kind=? AND payload_hash=? LIMIT 1').get(config.id,kind,hash);
    const path=previous?.payload_path??join(rawDir,config.id,`${kind}-${hash}.${binary?'bin':'json.gz'}`);
    mkdirSync(dirname(path),{recursive:true});if(!existsSync(path))writeFileSync(path,binary?response.bytes:gzipSync(Buffer.from(response.text),{level:6}));
    // Exact response is in the content-addressed compressed file. Do not duplicate
    // every 170KB five-minute dashboard in both SQLite TEXT and a disk file.
    recordTransitSourceSnapshot(db,{...response,stationId:config.id,runId,sourceKind:kind,sourceUrl:url,payloadText:'',
      payloadHash:hash,payloadPath:path,capturedAt:now()});
    return {response,hash,path,value:binary?null:JSON.parse(response.text)};
  };
  if(claims.pricing){
    let lastError,selection;
    const old=db.prepare('SELECT * FROM transit_stations WHERE id=?').get(config.id);
    let oldMeta={};try{oldMeta=JSON.parse(old?.raw_meta_json??'{}');}catch{/* no valid previous metadata */}
    const previous=db.prepare('SELECT inventory_json FROM transit_runapi_catalog_versions WHERE station_id=? ORDER BY observed_at DESC,rowid DESC LIMIT 1').get(config.id);
    const inventoryBefore=previous?JSON.parse(previous.inventory_json):null;
    for(const origin of config.apiOrigins){
      try{
        if(!['https://runapi.host','https://runapi.co'].includes(origin))throw new Error('invalid_runapi_origin');
        const price=await get(origin+'/api/pricing','pricing',priceRun),meta=await get(origin+'/api/status','metadata',priceRun);
        const metadata=parseRunMetadata(meta.value),sourceConfig={...config,pricingUrl:origin+'/api/pricing'};
        const value=parseRunCatalog(price.value,sourceConfig,{metadata,observedAt:now(),references:references()});
        if(metadata.mainlandPolicy&&metadata.isMainland)throw new Error('runapi_regional_catalog_requires_full_source');
        for(const key of ['models','groups','offers'])if(inventoryBefore?.[key]&&value.inventory[key]<inventoryBefore[key]*(config.minimumCatalogFraction??0.8))throw new Error(`runapi_catalog_shrank:${key}`);
        attempts.push({origin,status:'accepted',inventory:value.inventory});selection={price,metadata,metadataHash:meta.hash,metadataUrl:origin+'/api/status',sourceUrl:sourceConfig.pricingUrl};parsed=value;break;
      }catch(error){lastError=error;attempts.push({origin,status:'rejected',error:describeTransitError(error)});if([403,429].includes(error.httpStatus))break;}
    }
    try{
      if(!selection)throw lastError??new Error('runapi_no_complete_catalog');
      let logoLocalPath=old?.logo_local_path??(existsSync(join(options.publicRoot??join(root,'public'),config.logoLocalPath.replace(/^\//,'')))?config.logoLocalPath:null);
      // Public PNG, validated by signature and bounded dimensions; no external SVG/CSS paint dependencies.
      try{
        const logo=await get(config.logoUrl,'logo',priceRun,true),bytes=logo.response.bytes;
        if(bytes.length<24||bytes.length>128*1024||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.subarray(12,16).toString()!=='IHDR'
          ||bytes.readUInt32BE(16)>2048||bytes.readUInt32BE(20)>2048||!bytes.readUInt32BE(16)||!bytes.readUInt32BE(20))throw new Error('invalid_runapi_logo_png');
        const path=join(options.publicRoot??join(root,'public'),config.logoLocalPath.replace(/^\//,''));mkdirSync(dirname(path),{recursive:true});writeFileSync(path+'.tmp-'+process.pid,bytes);renameSync(path+'.tmp-'+process.pid,path);logoLocalPath=config.logoLocalPath;
      }catch(error){warnings.push(`logo: ${describeTransitError(error)}`);}
      const at=now(),metadata=selection.metadata;
      db.transaction(()=>{
        upsertTransitCollection(db,{station:{...config,config,recharge:null,sourceType:'official_public',logoLocalPath,
          sourceFingerprint:selection.price.hash,rawMeta:{...oldMeta,currencyKind:'usd_credit',pricingCollection:{status:'success',observedAt:at,sourceUrl:selection.sourceUrl,inventory:parsed.inventory,attempts},billingConfiguration:metadata},description:'RunAPI · 公开模型报价与对话探测'},
          ...parsed,collectionComplete:true,observedAt:at,run:{runId:priceRun,collectorKind:config.collectorKind,status:'success',startedAt:started,finishedAt:at,httpStatus:200,rawSnapshotPath:selection.price.path,errorMessage:parsed.warnings.join('; ')||null}});
        saveRunCatalog(db,config.id,selection.price.value,parsed,metadata,{sourceUrl:selection.sourceUrl,metadataUrl:selection.metadataUrl,observedAt:at});
        db.prepare("UPDATE transit_source_snapshots SET parse_status='validated' WHERE station_id=? AND payload_hash IN (?,?)").run(config.id,selection.price.hash,selection.metadataHash);
        finishTransit(db,config.id,owner,{ok:true,at,intervalMs:parsed.warnings.length?15*60000:options.intervalMs});
      }).immediate();priceStatus='success';warnings.push(...parsed.warnings);
    }catch(error){
      const message=describeTransitError(error);
      upsertTransitCollection(db,{station:{...config,config,status:'candidate',sourceType:'official_public'},run:{runId:priceRun,collectorKind:config.collectorKind,status:'failed',startedAt:started,finishedAt:now(),errorMessage:message}});
      finishTransit(db,config.id,owner,{ok:false,at:now(),error:message,retryAfter:error.retryAfter});priceStatus='failed';warnings.push(`pricing: ${message}`);
    }
  }
  if(claims.performance){
    const at=now();
    try{
      const source=await get(config.performanceUrl,'dashboard',perfRun),observedAt=now(),data=parseRunMonitoring(source.value,{observedAt});
      const previous=db.prepare('SELECT COUNT(*) AS n FROM transit_runapi_probe_targets WHERE station_id=? AND active=1').get(config.id).n;
      if(previous&&data.targets.length<previous*0.5)throw new Error('runapi_monitor_inventory_shrank');
      const catalog=currentRunCatalog(db,config.id);
      const saved=saveRunMonitoring(db,config.id,data,catalog,{observedAt,sourceUrl:config.performanceUrl,rawHash:source.hash});inserted=saved.inserted;
      db.prepare("UPDATE transit_source_snapshots SET parse_status='validated' WHERE station_id=? AND payload_hash=?").run(config.id,source.hash);
      recordRun(db,config,perfRun,'success',at,observedAt,null,saved.returned);
      finishTransit(db,config.id,owner,{ok:true,at:now(),task:'performance',intervalMs:config.performanceIntervalMs});performanceStatus='success';
    }catch(error){const message=describeTransitError(error);recordRun(db,config,perfRun,'failed',at,now(),message,0);
      finishTransit(db,config.id,owner,{ok:false,at:now(),task:'performance',error:message,retryAfter:error.retryAfter});performanceStatus='failed';warnings.push(`performance: ${message}`);}
  }
  try{pruneRunHistory(db,config.id,now(),rawDir,config.retentionDays);}catch(error){warnings.push(`retention: ${describeTransitError(error)}`);}
  return {id:config.id,status:[priceStatus,performanceStatus].includes('failed')?'failed':'success',pricingStatus:priceStatus,performanceStatus,
    models:parsed?.modelCount,groups:parsed?.inventory.groups,offers:parsed?.offers.length,performanceRows:inserted,warnings};
}
