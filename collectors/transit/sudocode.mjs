import {randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {upsertTransitCollection,recordTransitSourceSnapshot} from '../transit-db.mjs';
import {describeTransitError} from './transport.mjs';
import {sudoHash,parseSudoCatalog,parseSudoPolicy,parseSudoMetadata,parseSudoPerformance,sudoAssetUrl} from './sudocode-parser.mjs';
import {saveSudoCatalog,saveSudoMetadata,latestSudoCatalog,saveSudoPerformance,pruneSudoHistory} from './sudocode-storage.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'../..');
export async function collectSudoCodeSource(db,config,options,runtime){
  if(!config.enabled)return {id:config.id,status:'skipped'};
  const {fetchPublic,claimTransit,finishTransit}=runtime,owner=options.owner??randomUUID(),now=()=>options.now??new Date().toISOString(),started=now();
  const claims=db.transaction(()=>{
    if(db.prepare(`SELECT 1 FROM transit_collect_schedule WHERE station_id=? AND lease_until>? AND lease_owner<>?
      UNION ALL SELECT 1 FROM transit_performance_schedule WHERE station_id=? AND lease_until>? AND lease_owner<>? LIMIT 1`).get(config.id,started,owner,config.id,started,owner))return {};
    return {pricing:claimTransit(db,config,{owner,now:started,force:options.force}),
      performance:options.includePerformance!==false&&claimTransit(db,config,{owner,now:started,force:options.force,task:'performance'})};
  }).immediate();
  if(!claims.pricing&&!claims.performance)return {id:config.id,status:'skipped'};
  const priceRun=`transit-${config.id}-${randomUUID()}`,perfRun=`transit-${config.id}-monitor-${randomUUID()}`;
  const rawDir=options.rawDir??join(root,'data/transit/raw'),deadline=Date.now()+(config.collectionBudgetMs??120000),warnings=[];
  let requests=0,lastRequestAt=0,blocked=null,parsed,pricingStatus='skipped',performanceStatus='skipped',written=0;
  const get=async(url,kind,runId,format='json')=>{
    if(blocked)throw blocked;
    if(!options.fetchImpl&&lastRequestAt)await new Promise(r=>setTimeout(r,Math.max(0,(config.requestIntervalMs??350)-(Date.now()-lastRequestAt))));
    const left=deadline-Date.now();if(left<1000)throw new Error('sudo_collection_budget');
    let response;try{requests++;lastRequestAt=Date.now();response=await fetchPublic(url,{...config,timeoutMs:Math.min(config.timeoutMs??20000,left),maxBytes:format==='binary'?1048576:config.maxBytes},options.fetchImpl);}
    catch(error){if([401,403,429].includes(error.httpStatus))blocked=error;throw error;}
    const body=format==='binary'?response.bytes:Buffer.from(response.text),hash=sudoHash(body),path=join(rawDir,config.id,`${kind}-${hash}.gz`);
    mkdirSync(dirname(path),{recursive:true});if(!existsSync(path)){const tmp=path+'.tmp-'+process.pid;writeFileSync(tmp,gzipSync(body));renameSync(tmp,path);}
    recordTransitSourceSnapshot(db,{...response,stationId:config.id,runId,sourceKind:kind,sourceUrl:url,payloadHash:hash,payloadText:'',payloadPath:path,capturedAt:now()});
    return {response,hash,path,value:format==='json'?JSON.parse(response.text):null};
  };
  if(claims.pricing){
    let price;
    const old=db.prepare('SELECT raw_meta_json FROM transit_stations WHERE id=?').get(config.id);let oldMeta={};try{oldMeta=JSON.parse(old?.raw_meta_json??'{}');}catch{/* legacy */}
    try{
      price=await get(config.pricingUrl,'pricing',priceRun);
      const metadataResult=await get(config.metadataUrl,'metadata',priceRun),metadata=parseSudoMetadata(metadataResult.value);
      const home=await get(config.siteUrl,'home',priceRun,'text'),policyUrl=sudoAssetUrl(home.response.text,config.siteUrl);
      const script=await get(policyUrl,'policy',priceRun,'text'),policy=parseSudoPolicy(script.response.text);
      const previous=db.prepare(`SELECT COUNT(DISTINCT o.raw_model) models,COUNT(DISTINCT g.id) groups,COUNT(*) offers FROM transit_offers o JOIN transit_groups g ON g.id=o.group_id WHERE g.station_id=? AND g.status='active' AND o.status='active'`).get(config.id);
      parsed=parseSudoCatalog(price.value,config,{policy,previousModels:previous.models,observedAt:now(),policyUrl});
      if(parsed.inventory.offers<previous.offers*(config.minimumCatalogFraction??.8)||parsed.inventory.groups<previous.groups*(config.minimumCatalogFraction??.8))throw new Error('sudo_group_memberships_shrank');
      let notice=null;try{notice=await get(config.noticeUrl,'notice',priceRun);}catch(error){warnings.push('notice: '+describeTransitError(error));}
      const publicRoot=options.publicRoot??join(root,'public'),file=join(publicRoot,config.logoLocalPath.replace(/^\//,''));let logo=oldMeta.logo??null,logoLocalPath=existsSync(file)?config.logoLocalPath:null;
      if(options.force||!logoLocalPath||!logo?.checkedAt||Date.parse(now())-Date.parse(logo.checkedAt)>86400000)try{
        if(metadata.logo!==config.logoUrl)throw new Error('sudo_logo_source_changed');
        const source=await get(config.logoUrl,'logo',priceRun,'binary'),bytes=source.response.bytes;
        if(bytes.length<24||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.subarray(12,16).toString()!=='IHDR'||!bytes.readUInt32BE(16)||!bytes.readUInt32BE(20)||bytes.readUInt32BE(16)>4096||bytes.readUInt32BE(20)>4096)throw new Error('sudo_invalid_png');
        mkdirSync(dirname(file),{recursive:true});writeFileSync(file+'.tmp-'+process.pid,bytes);renameSync(file+'.tmp-'+process.pid,file);
        logoLocalPath=config.logoLocalPath;logo={checkedAt:now(),sha256:source.hash};
      }catch(error){warnings.push('logo: '+describeTransitError(error));}
      const at=now();db.transaction(()=>{
        upsertTransitCollection(db,{station:{...config,config,sourceType:'official_public',sourceFingerprint:sudoHash({catalog:parsed.catalog,policy}),logoLocalPath,recharge:null,
          rawMeta:{...oldMeta,currencyKind:'usd_credit',billingConfiguration:metadata,logo,pricingCollection:{status:'success',observedAt:at,sourceUrl:config.pricingUrl,inventory:parsed.inventory,
            policyUrl,policyHash:policy.sourceHash,normalizationDenominator:policy.denominator,warnings}}},groups:parsed.groups,offers:parsed.offers,collectionComplete:true,observedAt:at,
          run:{runId:priceRun,collectorKind:config.collectorKind,status:'success',startedAt:started,finishedAt:at,httpStatus:200,rawSnapshotPath:price.path,errorMessage:warnings.join('; ')||null}});
        saveSudoCatalog(db,config,parsed,{policy,policyUrl,sourceHash:price.hash,observedAt:at});
        saveSudoMetadata(db,config.id,metadata,notice?.value??null,{sourceHash:metadataResult.hash,noticeHash:notice?.hash,observedAt:at});
        finishTransit(db,config.id,owner,{ok:true,at,intervalMs:options.intervalMs??6*3600000});
      }).immediate();pricingStatus='success';
    }catch(error){const message=describeTransitError(error);warnings.push(message);upsertTransitCollection(db,{station:{...config,status:'candidate',sourceType:'official_public',config},
      run:{runId:priceRun,collectorKind:config.collectorKind,status:'failed',startedAt:started,finishedAt:now(),rawSnapshotPath:price?.path,errorMessage:message}});
      finishTransit(db,config.id,owner,{ok:false,at:now(),error:message,retryAfter:error.retryAfter});pricingStatus='failed';}
  }
  if(claims.performance){
    try{
      const catalog=latestSudoCatalog(db,config.id);if(!catalog)throw new Error('sudo_monitor_catalog_required');
      const result=await get(config.performanceUrl,'performance',perfRun),at=now();
      const points=parseSudoPerformance(result.value,{observedAt:at,knownModels:new Set(catalog.data.map(m=>m.model_name)),knownTiers:new Set(Object.keys(catalog.tier_groups))});
      db.transaction(()=>{
        written=saveSudoPerformance(db,config.id,points,{sourceHash:result.hash,observedAt:at});
        db.prepare(`INSERT INTO transit_collection_runs (run_id,station_id,collector_kind,stage,status,started_at,finished_at,raw_snapshot_path,offer_count)
          VALUES (?,?,?,'performance','success',?,?,?,?)`).run(perfRun,config.id,config.collectorKind,started,at,result.path,written);
        finishTransit(db,config.id,owner,{ok:true,at,task:'performance',intervalMs:config.performanceIntervalMs});
      }).immediate();performanceStatus='success';
    }catch(error){const message=describeTransitError(error);warnings.push('performance: '+message);
      db.prepare(`INSERT INTO transit_collection_runs (run_id,station_id,collector_kind,stage,status,started_at,finished_at,error_message)
        VALUES (?,?,?,'performance','failed',?,?,?)`).run(perfRun,config.id,config.collectorKind,started,now(),message);
      finishTransit(db,config.id,owner,{ok:false,at:now(),task:'performance',error:message,retryAfter:error.retryAfter});performanceStatus='failed';}
  }
  try{pruneSudoHistory(db,config,rawDir,now());}catch(error){warnings.push('retention: '+describeTransitError(error));}
  return {id:config.id,status:[pricingStatus,performanceStatus].includes('failed')?'failed':'success',pricingStatus,performanceStatus,inventory:parsed?.inventory,requests,performanceRows:written,warnings};
}
