import {randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {upsertTransitCollection,recordTransitSourceSnapshot,upsertTransitPerformance} from '../transit-db.mjs';
import {describeTransitError} from './transport.mjs';
import {CHICKENER_PARSER_VERSION,chickenerHash,parseChickenerCatalog,parseChickenerMetadata,parseChickenerPerformance} from './chickener-parser.mjs';
import {saveChickenerCatalog,saveChickenerMetadata,syncChickenerSubjects,saveChickenerChargeItems} from './chickener-storage.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'../..');
export async function collectChickenerSource(db,config,options,runtime){
  if(!config.enabled)return {id:config.id,status:'skipped'};
  const {fetchPublic,claimTransit,finishTransit}=runtime,owner=options.owner??randomUUID(),now=()=>options.now??new Date().toISOString(),started=now();
  const claims=db.transaction(()=>{
    const other=db.prepare(`SELECT 1 FROM transit_collect_schedule WHERE station_id=? AND lease_until>? AND lease_owner<>?
      UNION ALL SELECT 1 FROM transit_performance_schedule WHERE station_id=? AND lease_until>? AND lease_owner<>? LIMIT 1`).get(config.id,started,owner,config.id,started,owner);
    if(other)return {pricing:false,performance:false};
    return {pricing:claimTransit(db,config,{owner,now:started,force:options.force}),performance:options.includePerformance!==false&&claimTransit(db,config,{owner,now:started,force:options.force,task:'performance'})};
  }).immediate();
  if(!claims.pricing&&!claims.performance)return {id:config.id,status:'skipped'};
  const deadline=Date.now()+(config.collectionBudgetMs??180000),warnings=[],priceRun=`transit-${config.id}-${randomUUID()}`,perfRun=priceRun+'-monitor';
  let requestDeadline=deadline;
  let pricingStatus='skipped',performanceStatus='skipped',models,offers,rows=0,requests=0,blocked=null;
  let oldMeta={};try{oldMeta=JSON.parse(db.prepare('SELECT raw_meta_json FROM transit_stations WHERE id=?').get(config.id)?.raw_meta_json??'{}');}catch{/* first run */}
  const audit=(stage,status,error=null,count=0)=>db.prepare(`INSERT OR REPLACE INTO transit_collection_runs
    (run_id,station_id,collector_kind,stage,status,started_at,finished_at,offer_count,error_message) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(stage==='pricing'?priceRun:perfRun,config.id,config.collectorKind,stage,status,started,now(),count,error);
  const get=async(url,kind,runId)=>{
    if(blocked)throw blocked;const left=requestDeadline-Date.now();if(left<1000)throw Error('chickener_collection_budget');
    let result;try{result=await fetchPublic(url,{...config,timeoutMs:Math.min(config.timeoutMs??20000,left)},options.fetchImpl);}
    catch(error){if([401,403,429].includes(error.httpStatus))blocked=error;throw error;}
    const hash=chickenerHash(result.bytes),path=join(options.rawDir??join(root,'data/transit/raw'),config.id,`${kind}-${hash}.txt`);
    mkdirSync(dirname(path),{recursive:true});if(!existsSync(path))writeFileSync(path,result.bytes);
    recordTransitSourceSnapshot(db,{...result,stationId:config.id,runId,sourceKind:kind,sourceUrl:url,payloadPath:path,payloadHash:hash,
      payloadText:kind==='logo'?null:result.text,capturedAt:now(),parseStatus:'captured'});
    return {...result,hash,path};
  };
  if(claims.pricing)try{
    const response=await get(config.pricingUrl,'pricing',priceRun),payload=JSON.parse(response.text);
    const previous=db.prepare(`SELECT COUNT(DISTINCT raw_model) n FROM transit_offers o JOIN transit_groups g ON g.id=o.group_id WHERE g.station_id=? AND g.status='active' AND o.status='active'`).get(config.id).n;
    const parsed=parseChickenerCatalog(payload,config,{observedAt:now(),previousModels:previous});warnings.push(...parsed.warnings);
    const metadataResponse=await get(config.metadataUrl,'metadata',priceRun),metadata=parseChickenerMetadata(JSON.parse(metadataResponse.text));
    let logo=oldMeta.logo??null,logoLocalPath=db.prepare('SELECT logo_local_path FROM transit_stations WHERE id=?').get(config.id)?.logo_local_path??null;
    const publicRoot=options.publicRoot??join(root,'public');
    if(options.force||!logoLocalPath||!existsSync(join(publicRoot,logoLocalPath))||Date.parse(now())-Date.parse(logo?.checkedAt??0)>86400000)try{
      const image=await get(config.logoUrl,'logo',priceRun),b=image.bytes;
      if(!image.contentType?.includes('image/png')||b.length>1048576||b.length<24||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||b.readUInt32BE(16)<16||b.readUInt32BE(16)>2048||b.readUInt32BE(20)<16||b.readUInt32BE(20)>2048)throw Error('chickener_invalid_logo');
      const path=join(publicRoot,config.logoLocalPath.replace(/^\//,''));mkdirSync(dirname(path),{recursive:true});writeFileSync(path+'.tmp',b);renameSync(path+'.tmp',path);
      logoLocalPath=config.logoLocalPath;logo={sha256:image.hash,checkedAt:now()};
    }catch(error){warnings.push(`logo: ${describeTransitError(error)}`);}
      if(!logoLocalPath)throw Error('chickener_first_logo_missing');
      const operationalWarnings=warnings.filter(w=>!w.startsWith('endpoint_declaration_conflict:'));
    const at=now();db.transaction(()=>{
      upsertTransitCollection(db,{station:{...config,status:'published',sourceType:'official_public',config,recharge:null,logoLocalPath,
        rawMeta:{...oldMeta,currencyKind:'cny_credit',priceBasis:'station_nominal_credit',logo,capabilities:{pricing:'public',performance:'public',recharge:'unverified'},
          pricingCollection:{status:'success',observedAt:at,sourceUrl:config.pricingUrl,inventory:parsed.inventory},publicMetadata:metadata}},
        groups:parsed.groups,offers:parsed.offers,collectionComplete:true,observedAt:at,
        run:{runId:priceRun,collectorKind:config.collectorKind,stage:'pricing',status:'success',startedAt:started,finishedAt:at,httpStatus:200,rawSnapshotPath:response.path,errorMessage:warnings.join('; ')||null}});
      saveChickenerCatalog(db,{stationId:config.id,hash:response.hash,sourceUrl:config.pricingUrl,parserVersion:CHICKENER_PARSER_VERSION,inventory:parsed.inventory,payload,at});
      saveChickenerChargeItems(db,config.id,parsed.offers,at);
      saveChickenerMetadata(db,{stationId:config.id,kind:'public_config',hash:metadataResponse.hash,sourceUrl:config.metadataUrl,payload:metadata,at});
      syncChickenerSubjects(db,config.id,payload.data.map(m=>m.model_name),at);
      finishTransit(db,config.id,owner,{ok:true,at,intervalMs:operationalWarnings.length?900000:options.intervalMs??21600000});
    }).immediate();pricingStatus='success';models=parsed.modelCount;offers=parsed.offers.length;
  }catch(error){pricingStatus='failed';const message=describeTransitError(error);warnings.push(`pricing: ${message}`);audit('pricing','failed',message);
    finishTransit(db,config.id,owner,{ok:false,at:now(),error:message,retryAfter:error.retryAfter});}
  if(claims.performance){
    const failures=[];let consecutive=0;
    try{
      const members=db.prepare(`SELECT DISTINCT raw_model model,group_key FROM transit_offers o JOIN transit_groups g ON g.id=o.group_id WHERE g.station_id=? AND g.status='active' AND o.status='active'`).all(config.id),identities=new Map();
      for(const m of members)identities.set(m.model,[...(identities.get(m.model)??[]),m.group_key]);
      if(!identities.size)throw Error('chickener_monitor_catalog_missing');
      db.transaction(()=>syncChickenerSubjects(db,config.id,[...identities.keys()],now())).immediate();
      const queue=db.prepare('SELECT * FROM transit_chickener_metric_subjects WHERE station_id=? AND active=1 AND next_attempt_at<=? ORDER BY next_attempt_at,model').all(config.id,options.force?'9999-01-01':now());
      const perfDeadline=Math.min(deadline,Date.now()+(config.performanceBudgetMs??120000));
      requestDeadline=perfDeadline;
      for(const subject of queue){
        if(blocked||Date.now()>perfDeadline-1000){failures.push('performance_pending');break;}
        if(subject.fail_count&&subject.next_attempt_at>now())continue;
        const url=config.performanceUrl.replace('{model}',encodeURIComponent(subject.model));requests++;
        try{
          const response=await get(url,'performance-'+chickenerHash(subject.model).slice(0,16),perfRun),parsed=parseChickenerPerformance(JSON.parse(response.text),subject.model,identities.get(subject.model),now()),at=now();
          db.transaction(()=>{
            rows+=upsertTransitPerformance(db,{stationId:config.id,rows:parsed.rows,sourceUrl:url,sourceSchema:parsed.sourceSchema,observedAt:at,windowHours:360});
            db.prepare('UPDATE transit_chickener_metric_subjects SET next_attempt_at=?,last_success_at=?,fail_count=0,last_error=NULL WHERE station_id=? AND model=?')
              .run(new Date(Date.parse(at)+(config.performanceIntervalMs??3600000)).toISOString(),at,config.id,subject.model);
          }).immediate();consecutive=0;
        }catch(error){
          const message=describeTransitError(error);failures.push(`${subject.model}: ${message}`);consecutive++;
          db.prepare('UPDATE transit_chickener_metric_subjects SET fail_count=fail_count+1,next_attempt_at=?,last_error=? WHERE station_id=? AND model=?')
            .run(new Date(Date.parse(now())+Math.min(3600000,900000*2**Math.min(subject.fail_count,2))).toISOString(),message,config.id,subject.model);
          if(blocked||consecutive>=3)break;
        }
        if(!options.fetchImpl)await new Promise(resolve=>setTimeout(resolve,250));
      }
      if(!blocked&&Date.now()<deadline-1000)try{
        const response=await get(config.performanceSummaryUrl,'performance-summary',perfRun),payload=JSON.parse(response.text);
        if(payload.success!==true||!Array.isArray(payload.data?.models)||payload.data.models.length>5000)throw Error('chickener_invalid_summary');
        saveChickenerMetadata(db,{stationId:config.id,kind:'summary_360',hash:response.hash,sourceUrl:config.performanceSummaryUrl,payload,at:now()});
      }catch(error){failures.push(`summary: ${describeTransitError(error)}`);}
      const next=db.prepare('SELECT MIN(next_attempt_at) at FROM transit_chickener_metric_subjects WHERE station_id=? AND active=1').get(config.id).at;
      if(next<=now())failures.push('performance_subjects_pending');
      performanceStatus=failures.length?'failed':'success';audit('performance',performanceStatus,failures.join('; ')||null,rows);
      finishTransit(db,config.id,owner,{ok:!failures.length,at:now(),task:'performance',error:failures.join('; ')||null,retryAfter:blocked?.retryAfter,
        intervalMs:next?Math.max(60000,Date.parse(next)-Date.parse(now())):3600000});
      db.prepare('DELETE FROM transit_performance_observations WHERE station_id=? AND bucket_at<?').run(config.id,new Date(Date.parse(now())-35*86400000).toISOString());
    }catch(error){performanceStatus='failed';failures.push(describeTransitError(error));audit('performance','failed',failures.join('; '),rows);
      finishTransit(db,config.id,owner,{ok:false,at:now(),task:'performance',error:failures.join('; '),retryAfter:blocked?.retryAfter});}
    warnings.push(...failures);
  }
  return {id:config.id,status:pricingStatus==='failed'||performanceStatus==='failed'?'failed':'success',pricingStatus,performanceStatus,models,offers,performanceRows:rows,performanceRequests:requests,warnings};
}
