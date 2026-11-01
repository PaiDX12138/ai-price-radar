import {randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {upsertTransitCollection,upsertTransitPerformance,recordTransitSourceSnapshot} from '../transit-db.mjs';
import {describeTransitError} from './transport.mjs';
import {CRAZY_PARSER_VERSION,crazyHash,parseCrazyCatalog,parseCrazyMetadata,parseCrazySummary,parseCrazyPerformance} from './crazyrouter-parser.mjs';
import {saveCrazyCatalog,saveCrazyMetadata,saveCrazySummary,finishCrazySubject,pruneCrazyHistory} from './crazyrouter-storage.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'../..');
function audit(db,config,id,status,start,end,error,count){db.prepare(`INSERT INTO transit_collection_runs
 (run_id,station_id,collector_kind,stage,status,started_at,finished_at,error_message,offer_count) VALUES (?,?,?,'performance',?,?,?,?,?)`)
 .run(id,config.id,config.collectorKind,status,start,end,error,count);}
export async function collectCrazyRouterSource(db,config,options,runtime){
  if(!config.enabled)return {id:config.id,status:'skipped'};
  const {fetchPublic,claimTransit,finishTransit}=runtime,owner=options.owner??randomUUID(),now=()=>options.now??new Date().toISOString(),started=now();
  const claims=db.transaction(()=>{
    if(db.prepare(`SELECT 1 FROM transit_collect_schedule WHERE station_id=? AND lease_until>? AND lease_owner<>?
      UNION ALL SELECT 1 FROM transit_performance_schedule WHERE station_id=? AND lease_until>? AND lease_owner<>? LIMIT 1`).get(config.id,started,owner,config.id,started,owner))return {};
    return {pricing:claimTransit(db,config,{owner,now:started,force:options.force}),performance:options.includePerformance!==false&&claimTransit(db,config,{owner,now:started,force:options.force,task:'performance'})};
  }).immediate();
  if(!claims.pricing&&!claims.performance)return {id:config.id,status:'skipped'};
  const priceRun=`transit-${config.id}-${randomUUID()}`,perfRun=`transit-${config.id}-monitor-${randomUUID()}`,rawDir=options.rawDir??join(root,'data/transit/raw');
  const deadline=Date.now()+(config.collectionBudgetMs??180000),warnings=[];let requests=0,lastRequestAt=0,blocked=null,parsed,pricingStatus='skipped',performanceStatus='skipped',written=0;
  const get=async(url,kind,runId,binary=false)=>{
    if(blocked)throw blocked;
    if(!options.fetchImpl&&lastRequestAt)await new Promise(r=>setTimeout(r,Math.max(0,(config.requestIntervalMs??350)-(Date.now()-lastRequestAt))));
    const left=deadline-Date.now();if(left<1000)throw new Error('crazy_collection_budget');
    let response;try{lastRequestAt=Date.now();requests++;response=await fetchPublic(url,{...config,timeoutMs:Math.min(config.timeoutMs??20000,left),maxBytes:binary?128*1024:config.maxBytes},options.fetchImpl);}
    catch(error){if([401,403,429].includes(error.httpStatus))blocked=error;throw error;}
    const hash=crazyHash(binary?response.bytes:response.text),path=join(rawDir,config.id,`${kind}-${hash}.gz`);mkdirSync(dirname(path),{recursive:true});
    if(!existsSync(path)){const tmp=path+'.tmp-'+process.pid;writeFileSync(tmp,gzipSync(binary?response.bytes:Buffer.from(response.text),{level:6}));renameSync(tmp,path);}
    recordTransitSourceSnapshot(db,{...response,stationId:config.id,runId,sourceKind:kind,sourceUrl:url,payloadHash:hash,payloadText:'',payloadPath:path,capturedAt:now()});
    return {response,hash,path,value:binary?null:JSON.parse(response.text)};
  };
  if(claims.pricing){
    let price;
    const old=db.prepare('SELECT * FROM transit_stations WHERE id=?').get(config.id);let oldMeta={};try{oldMeta=JSON.parse(old?.raw_meta_json??'{}');}catch{/* first collection */}
    try{
      price=await get(config.pricingUrl,'pricing',priceRun);const metadataResult=await get(config.metadataUrl,'metadata',priceRun),metadata=parseCrazyMetadata(metadataResult.value);
      const previous=db.prepare(`SELECT COUNT(DISTINCT o.raw_model) n FROM transit_offers o JOIN transit_groups g ON g.id=o.group_id WHERE g.station_id=? AND g.status='active' AND o.status='active'`).get(config.id).n;
      parsed=parseCrazyCatalog(price.value,config,{previousModels:previous,observedAt:now()});warnings.push(...parsed.warnings);
      const publicRoot=options.publicRoot??join(root,'public'),file=join(publicRoot,config.logoLocalPath.replace(/^\//,''));let logo=oldMeta.logo??null,logoLocalPath=existsSync(file)?config.logoLocalPath:null;
      if(options.force||!logoLocalPath||!logo?.checkedAt||Date.parse(now())-Date.parse(logo.checkedAt)>86400000)try{
        const source=await get(config.logoUrl,'logo',priceRun,true),bytes=source.response.bytes;
        if(bytes.length<24||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.subarray(12,16).toString()!=='IHDR'||!bytes.readUInt32BE(16)||!bytes.readUInt32BE(20)||bytes.readUInt32BE(16)>2048||bytes.readUInt32BE(20)>2048)throw new Error('crazy_invalid_png');
        mkdirSync(dirname(file),{recursive:true});writeFileSync(file+'.tmp-'+process.pid,bytes);renameSync(file+'.tmp-'+process.pid,file);logoLocalPath=config.logoLocalPath;logo={checkedAt:now(),sha256:source.hash};
      }catch(error){warnings.push('logo: '+describeTransitError(error));}
      const at=now();db.transaction(()=>{
        upsertTransitCollection(db,{station:{...config,config,sourceType:'official_public',sourceFingerprint:crazyHash(parsed.catalog),logoLocalPath,recharge:null,
          rawMeta:{...oldMeta,currencyKind:'usd_credit',billingConfiguration:metadata,logo,pricingCollection:{status:'success',observedAt:at,sourceUrl:config.pricingUrl,inventory:parsed.inventory,warnings:parsed.warnings}}},
          groups:parsed.groups,offers:parsed.offers,collectionComplete:true,observedAt:at,
          run:{runId:priceRun,collectorKind:config.collectorKind,status:'success',startedAt:started,finishedAt:at,httpStatus:200,rawSnapshotPath:price.path,errorMessage:warnings.join('; ')||null}});
        saveCrazyCatalog(db,config,parsed,{sourceHash:price.hash,sourceUrl:config.pricingUrl,parserVersion:CRAZY_PARSER_VERSION,observedAt:at});
        saveCrazyMetadata(db,config.id,metadata,{sourceHash:metadataResult.hash,sourceUrl:config.metadataUrl,observedAt:at});
        finishTransit(db,config.id,owner,{ok:true,at,intervalMs:options.intervalMs??6*3600000});
      }).immediate();pricingStatus='success';
    }catch(error){const message=describeTransitError(error);warnings.push(message);upsertTransitCollection(db,{station:{...config,status:'candidate',sourceType:'official_public',config},
      run:{runId:priceRun,collectorKind:config.collectorKind,status:'failed',startedAt:started,finishedAt:now(),rawSnapshotPath:price?.path,errorMessage:message}});
      finishTransit(db,config.id,owner,{ok:false,at:now(),error:message,retryAfter:error.retryAfter});pricingStatus='failed';}
  }
  if(claims.performance){
    let errors=[],pending=false;
    try{
      const summary=await get(config.performanceSummaryUrl,'summary',perfRun),rows=parseCrazySummary(summary.value);
      db.transaction(()=>saveCrazySummary(db,config,rows,config.performanceSummaryUrl,now())).immediate();
      const subjects=db.prepare(`SELECT * FROM transit_crazyrouter_metric_subjects WHERE station_id=? AND active=1
        AND next_attempt_at<=? ORDER BY has_traffic DESC,next_attempt_at,model`).all(config.id,options.force?'9999-01-01T00:00:00.000Z':now());
      if(!subjects.length&&!db.prepare('SELECT 1 FROM transit_crazyrouter_metric_subjects WHERE station_id=? AND active=1').get(config.id))throw new Error('crazy_monitor_catalog_missing');
      let failures=0;
      for(const subject of subjects){
        // Explicit source cooldown survives --force and worker/process restarts.
        if(subject.fail_count&&subject.next_attempt_at>now())continue;
        if(Date.now()>deadline-1000){pending=true;break;}
        const url=config.performanceUrl.replace('{model}',encodeURIComponent(subject.model));
        try{
          const result=await get(url,'model-'+crazyHash(subject.model).slice(0,16),perfRun),at=now();
          const points=parseCrazyPerformance(result.value,{model:subject.model,groups:JSON.parse(subject.groups_json),observedAt:at});
          db.transaction(()=>{
            written+=upsertTransitPerformance(db,{stationId:config.id,rows:points,sourceUrl:url,sourceSchema:'crazyrouter_bucket_7d',observedAt:at,windowHours:360});
            finishCrazySubject(db,config,subject.model,{ok:true,observedAt:at,hasTraffic:subject.has_traffic===1});
          }).immediate();failures=0;
        }catch(error){const message=describeTransitError(error);errors.push(`${subject.model}: ${message}`);failures++;
          finishCrazySubject(db,config,subject.model,{ok:false,error:message,observedAt:now(),retryAfter:error.retryAfter});
          if(blocked||failures>=3){pending=true;break;}
        }
      }
      const at=now(),ok=!errors.length&&!pending;performanceStatus=ok?'success':'failed';
      const error=ok?null:[...errors,...(pending?['monitor_subjects_pending']:[])].join('; ');
      audit(db,config,perfRun,performanceStatus,started,at,error,written);
      const next=db.prepare('SELECT MIN(next_attempt_at) at FROM transit_crazyrouter_metric_subjects WHERE station_id=? AND active=1').get(config.id)?.at;
      const delay=next?Math.max(60000,Math.min(config.performanceIntervalMs,Date.parse(next)-Date.parse(at))):config.performanceIntervalMs;
      finishTransit(db,config.id,owner,{ok,at,task:'performance',error,retryAfter:blocked?.retryAfter,intervalMs:delay});
      warnings.push(...errors);if(pending)warnings.push('monitor_subjects_pending');
    }catch(error){const message=describeTransitError(error);warnings.push('performance: '+message);audit(db,config,perfRun,'failed',started,now(),message,written);
      finishTransit(db,config.id,owner,{ok:false,at:now(),task:'performance',error:message,retryAfter:error.retryAfter});performanceStatus='failed';}
  }
  try{pruneCrazyHistory(db,config,rawDir,now());}catch(error){warnings.push('retention: '+describeTransitError(error));}
  return {id:config.id,status:[pricingStatus,performanceStatus].includes('failed')?'failed':'success',pricingStatus,performanceStatus,inventory:parsed?.inventory,requests,performanceRows:written,warnings};
}
