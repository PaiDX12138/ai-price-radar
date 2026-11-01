import {randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {upsertTransitCollection,recordTransitSourceSnapshot} from '../transit-db.mjs';
import {describeTransitError} from './transport.mjs';
import {soleHash,soleData,parseSoleCatalog,parseSoleFx,parseSoleDetail,buildSoleQuotes,normalizeSoleLogo} from './soleapi-parser.mjs';
import {loadSoleDetails,syncSoleSubjects,saveSolePrices,saveSoleSummary,saveSoleDetail,failSoleDetail,rebuildSoleHours,pruneSoleHistory} from './soleapi-storage.mjs';

const root=join(dirname(fileURLToPath(import.meta.url)),'../..');
const run=(db,config,runId,stage,status,startedAt,at,error=null,count=0)=>db.prepare(`INSERT OR REPLACE INTO transit_collection_runs
  (run_id,station_id,collector_kind,stage,status,started_at,finished_at,offer_count,error_message) VALUES (?,?,?,?,?,?,?,?,?)`)
  .run(runId,config.id,config.collectorKind,stage,status,startedAt,at,count,error);

export async function collectSoleApiSource(db,config,options,runtime) {
  if(!config.enabled)return {id:config.id,status:'skipped'};
  const {fetchPublic,claimTransit,finishTransit}=runtime,owner=options.owner??randomUUID();
  const now=()=>options.now??new Date().toISOString(),startedAt=now();
  // The two schedules are independent, but one station actor owns both while
  // doing detail requests. A manual price run cannot race an hourly worker.
  const {pricingClaim,performanceClaim}=db.transaction(()=>{
    const other=db.prepare(`SELECT 1 FROM transit_collect_schedule WHERE station_id=? AND lease_until>? AND lease_owner<>?
      UNION ALL SELECT 1 FROM transit_performance_schedule WHERE station_id=? AND lease_until>? AND lease_owner<>? LIMIT 1`)
      .get(config.id,startedAt,owner,config.id,startedAt,owner);
    if(other)return {pricingClaim:false,performanceClaim:false};
    return {pricingClaim:claimTransit(db,config,{owner,now:startedAt,force:options.force}),
      performanceClaim:options.includePerformance!==false&&claimTransit(db,config,{owner,now:startedAt,force:options.force,task:'performance'})};
  }).immediate();
  if(!pricingClaim&&!performanceClaim)return {id:config.id,status:'skipped'};
  const priceRun=`transit-${config.id}-${randomUUID()}`,perfRun=`transit-${config.id}-monitor-${randomUUID()}`;
  const rawDir=options.rawDir??join(root,'data/transit/raw'),deadline=Date.now()+(config.collectionBudgetMs??180000);
  const warnings=[],detailErrors=[];let rawPath,catalog,fx=null,logoLocalPath=null,inserted=0,detailCount=0,pricingStatus='skipped',performanceStatus='skipped',retryAfter=null,blockedError=null;
  const old=db.prepare('SELECT * FROM transit_stations WHERE id=?').get(config.id);
  let oldMeta={};try{oldMeta=JSON.parse(old?.raw_meta_json??'{}')??{};}catch{/* old metadata */}
  const get=async(url,kind,json=true)=>{
    if(blockedError)throw blockedError;
    const left=deadline-Date.now();if(left<1000)throw new Error('sole_collection_budget');
    let response;
    try{response=await fetchPublic(url,{...config,timeoutMs:Math.min(config.timeoutMs??20000,left)},options.fetchImpl);}
    catch(error){if([403,429].includes(error.httpStatus)){blockedError=error;retryAfter=error.retryAfter;}throw error;}
    const hash=soleHash(response.text),path=join(rawDir,config.id,`${kind}-${hash}.txt`);mkdirSync(dirname(path),{recursive:true});
    if(!existsSync(path))writeFileSync(path,response.text,'utf8');
    recordTransitSourceSnapshot(db,{...response,stationId:config.id,runId:pricingClaim?priceRun:perfRun,sourceKind:kind,sourceUrl:url,
      payloadHash:hash,payloadText:response.text,payloadPath:path,capturedAt:now()});
    return {value:json?JSON.parse(response.text):response.text,hash,path};
  };
  try {
    const source=await get(config.pricingUrl,'pricing');rawPath=source.path;
    catalog=parseSoleCatalog(source.value,config);
    const previous=db.prepare(`SELECT COUNT(DISTINCT o.raw_model) AS models,COUNT(DISTINCT g.id) AS groups,COUNT(*) AS offers
      FROM transit_offers o JOIN transit_groups g ON g.id=o.group_id WHERE g.station_id=? AND g.status='active' AND o.status='active'`).get(config.id);
    const inventory={models:catalog.list.length,groups:catalog.channels.length,offers:catalog.list.reduce((n,m)=>n+m.channels.length,0)};
    for(const key of Object.keys(inventory))if(previous[key]&&inventory[key]<previous[key]*(config.minimumCatalogFraction??0.8))throw new Error(`sole_catalog_shrank:${key}:${inventory[key]}/${previous[key]}`);
    // Only accepted whole catalogs may change the detail subject set.
    db.transaction(()=>syncSoleSubjects(db,config.id,catalog,now())).immediate();
    if(performanceClaim)for(const m of catalog.list)try{saveSoleSummary(db,config.id,m,config.pricingUrl,now());}catch(error){warnings.push(`summary:${m.canonicalName}: ${describeTransitError(error)}`);}
    if(pricingClaim){
      try{fx=parseSoleFx((await get(config.fxUrl,'fx')).value,now());}catch(error){warnings.push(`fx: ${describeTransitError(error)}`);}
      try{const vendors=soleData((await get(config.vendorsUrl,'vendors')).value);if(!Array.isArray(vendors.list))throw new Error('invalid_sole_vendors');}catch(error){warnings.push(`vendors: ${describeTransitError(error)}`);}
      logoLocalPath=old?.logo_local_path??null;
      try{
        const logo=await get(config.logoUrl,'logo',false);
        const svg=normalizeSoleLogo(logo.value);
        const path=join(options.publicRoot??join(root,'public'),config.logoLocalPath.replace(/^\//,''));mkdirSync(dirname(path),{recursive:true});
        writeFileSync(`${path}.${process.pid}.tmp`,svg);renameSync(`${path}.${process.pid}.tmp`,path);logoLocalPath=config.logoLocalPath;
      }catch(error){warnings.push(`logo: ${describeTransitError(error)}`);}
    }
    let details=loadSoleDetails(db,config.id);
    const states=db.prepare('SELECT * FROM transit_model_detail_state WHERE station_id=? AND active=1 ORDER BY next_attempt_at,canonical_model').all(config.id);
    const subjects=new Map(catalog.list.map(m=>[m.canonicalName,m]));
    for(const state of states){
      const name=state.canonical_model,cached=details.get(name),m=subjects.get(name);if(!m)continue;
      const monitored=Boolean(m.health||cached?.model.health);
      const interval=monitored&&performanceClaim?config.performanceIntervalMs:config.detailIntervalMs;
      const age=cached?Date.parse(now())-Date.parse(cached.observedAt):Infinity;
      if(age<interval&&!options.force)continue;
      // Manual force does not bypass an explicit failure cooldown.
      if(state.fail_count>0&&state.next_attempt_at>now()){if(monitored||pricingClaim)detailErrors.push(`detail_retry_pending:${name}`);continue;}
      if(Date.now()>deadline-1000){detailErrors.push('detail_budget_pending');break;}
      const sourceUrl=config.modelDetailUrl.replace('{model}',encodeURIComponent(name));
      try{
        const response=await get(sourceUrl,`detail-${soleHash(name).slice(0,16)}`,false);
        const detail=parseSoleDetail(response.value,name),observedAt=now();
        inserted+=saveSoleDetail(db,config.id,detail,{sourceUrl,observedAt,intervalMs:interval,rawHash:response.hash,includePerformance:performanceClaim});
        detailCount++;details.set(name,{...detail,observedAt});
      }catch(error){const message=describeTransitError(error);detailErrors.push(`${name}: ${message}`);
        failSoleDetail(db,config.id,name,message,now(),error.retryAfter);
        if([403,429].includes(error.httpStatus)){retryAfter=error.retryAfter;break;}
        if(detailErrors.length>=3)break;
      }
      if(!options.fetchImpl&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,config.requestIntervalMs??350));
    }
    details=loadSoleDetails(db,config.id);
    const basis=[...details.values()].some(d=>d.creditBasisVerified&&Date.parse(now())-Date.parse(d.observedAt)<7*86400000);
    if(pricingClaim){
      // The UI's ¥ shorthand is permitted only with current public Credit evidence.
      if(!basis)throw new Error('sole_credit_basis_unverified_last_good_retained');
      const parsed=buildSoleQuotes(catalog,config,{details,fx,creditBasisVerified:basis,observedAt:now()});
      const unfinished=catalog.list.filter(m=>!details.has(m.canonicalName)).length;
      if(unfinished)warnings.push(`detail_metadata_pending:${unfinished}`);
      const at=now(),priceIdentity=parsed.offers.map(o=>({model:o.rawModel,group:o.groupKey,charges:o.chargeItems,tiers:o.tiers,discount:o.discount?.ratio??null}));
      const meta={...oldMeta,currencyKind:'cny_credit',creditBasisVerified:basis,
        pricingCollection:{status:'success',observedAt:at,sourceUrl:config.pricingUrl,inventory,detailModels:details.size,
          multiplierMismatches:parsed.warnings,fxUpdatedAt:fx?.updatedAt??null,detailsPending:unfinished}};
      db.transaction(()=>{
        upsertTransitCollection(db,{station:{...config,config,logoLocalPath,sourceType:'official_public',rawMeta:meta,
          recharge:basis?{ratioCnyPerCredit:1,sourceUrl:config.modelDetailUrl.replace('{model}',encodeURIComponent(catalog.list.find(m=>details.get(m.canonicalName)?.creditBasisVerified)?.canonicalName??catalog.list[0].canonicalName)),observedAt:at,scope:'public_credit_basis'}:null,
          sourceFingerprint:soleHash(priceIdentity),description:'SoleAPI · 公开渠道报价与模型探测'},...parsed,collectionComplete:true,observedAt:at,
          run:{runId:priceRun,collectorKind:config.collectorKind,status:'success',startedAt,finishedAt:at,httpStatus:200,rawSnapshotPath:rawPath,errorMessage:[...warnings,...detailErrors].join('; ')||null}});
        saveSolePrices(db,config.id,catalog,parsed,fx,config.pricingUrl,at);
        finishTransit(db,config.id,owner,{ok:true,at,retryAfter,intervalMs:blockedError?3600000:warnings.length||detailErrors.length?15*60000:options.intervalMs});
      }).immediate();pricingStatus='success';
    }
    if(performanceClaim){
      rebuildSoleHours(db,config.id,now());
      const pending=catalog.list.filter(m=>Boolean(m.health)&&!details.has(m.canonicalName)).length;
      const ok=!detailErrors.length&&!pending&&!blockedError;
      performanceStatus=ok?'success':'failed';
      const error=ok?null:[...detailErrors,...(pending?[`monitor_metadata_pending:${pending}`]:[]),...(blockedError?[describeTransitError(blockedError)]:[])].join('; ');
      run(db,config,perfRun,'performance',performanceStatus,startedAt,now(),error,inserted);
      finishTransit(db,config.id,owner,{ok,at:now(),task:'performance',error,retryAfter,intervalMs:config.performanceIntervalMs});
    }
  }catch(error){
    const message=describeTransitError(error);warnings.push(message);
    if(pricingClaim&&pricingStatus!=='success'){
      upsertTransitCollection(db,{station:{...config,status:'candidate',sourceType:'official_public',config},
        run:{runId:priceRun,collectorKind:config.collectorKind,status:'failed',startedAt,finishedAt:now(),errorMessage:message,rawSnapshotPath:rawPath}});
      finishTransit(db,config.id,owner,{ok:false,at:now(),error:message,retryAfter:error.retryAfter});pricingStatus='failed';
    }
    if(performanceClaim&&performanceStatus==='skipped'){
      run(db,config,perfRun,'performance','failed',startedAt,now(),message);
      finishTransit(db,config.id,owner,{ok:false,at:now(),task:'performance',error:message,retryAfter:error.retryAfter});performanceStatus='failed';
    }
  }
  try{pruneSoleHistory(db,config.id,now(),rawDir,config.retentionDays);}catch(error){warnings.push(`retention: ${describeTransitError(error)}`);}
  return {id:config.id,status:[pricingStatus,performanceStatus].includes('failed')?'failed':'success',pricingStatus,performanceStatus,
    models:catalog?.list.length,groups:catalog?.channels.length,offers:catalog?.list.reduce((s,m)=>s+m.channels.length,0),detailModels:detailCount,performanceRows:inserted,warnings:[...warnings,...detailErrors]};
}
