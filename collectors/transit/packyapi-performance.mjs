import {randomUUID,createHash} from 'node:crypto';
import {join} from 'node:path';
import {upsertTransitPerformance} from '../transit-db.mjs';
import {packyApiConfigs} from './packyapi.mjs';
import {describeTransitError} from './transport.mjs';

/** Monitoring runs hourly even when pricing is fresh or fails. Per-model due state
 * makes a bounded scan resume rather than always restarting at the first model. */
export async function collectPackyPerformance(db,config,options,runtime){
  const {fetchPublic,claimTransit,finishTransit,performanceRows,archive}=runtime;
  const now=()=>options.now??new Date().toISOString(),started=now(),owner=options.owner??randomUUID();
  if(!config.enabled||options.includePerformance===false||!claimTransit(db,config,{owner,now:started,force:options.force,task:'performance'}))return {status:'skipped',rows:0,warnings:[]};
  const runId=`transit-${config.id}-performance-${randomUUID()}`,warnings=[];
  let rows=0,requests=0,blocked=null;
  const deadline=Date.now()+(options.budgetMs??config.performanceBudgetMs??120000);
  try{
    let meta={};try{meta=JSON.parse(db.prepare('SELECT raw_meta_json FROM transit_stations WHERE id=?').get(config.id)?.raw_meta_json??'{}');}catch{/* use configured source */}
    const sources=packyApiConfigs(config),source=sources.find(c=>c.apiOrigin===meta.pricingCollection?.selectedOrigin)??sources[0];
    const subjects=db.prepare(`SELECT DISTINCT o.raw_model model,g.group_key FROM transit_offers o JOIN transit_groups g ON g.id=o.group_id
      WHERE g.station_id=? AND o.status='active' AND g.status='active' ORDER BY o.raw_model`).all(config.id);
    if(!subjects.length)throw new Error('packy_monitor_catalog_missing');
    const identities=new Map();for(const row of subjects){const groups=identities.get(row.model)??new Set();groups.add(row.group_key);identities.set(row.model,groups);}
    db.transaction(()=>{
      const insert=db.prepare('INSERT OR IGNORE INTO transit_packy_metric_subjects(station_id,model,next_attempt_at) VALUES (?,?,?)');
      for(const model of identities.keys())insert.run(config.id,model,started);
      for(const row of db.prepare('SELECT model FROM transit_packy_metric_subjects WHERE station_id=?').all(config.id))if(!identities.has(row.model))db.prepare('DELETE FROM transit_packy_metric_subjects WHERE station_id=? AND model=?').run(config.id,row.model);
    }).immediate();
    const queue=db.prepare('SELECT * FROM transit_packy_metric_subjects WHERE station_id=? AND next_attempt_at<=? ORDER BY next_attempt_at,model').all(config.id,options.force?'9999-01-01':now());
    let failures=0;
    for(const subject of queue){
      if(subject.fail_count&&subject.next_attempt_at>now())continue;
      if(Date.now()>deadline-1000){warnings.push('performance_budget_pending');break;}
      const url=source.performanceUrl.replace('{model}',encodeURIComponent(subject.model));
      try{
        requests++;
        const response=await fetchPublic(url,{...source,timeoutMs:Math.min(source.timeoutMs??20000,Math.max(1,deadline-Date.now()))},options.fetchImpl);
        archive(db,source,runId,`performance-model-${createHash('sha256').update(subject.model).digest('hex').slice(0,16)}`,response,options.rawDir??join(options.root,'data/transit/raw'),now(),'captured',url);
        const payload=JSON.parse(response.text);
        if(payload.success!==true||payload.data?.model_name!==subject.model||!Array.isArray(payload.data.groups))throw new Error('invalid_performance_model');
        const points=payload.data.groups.filter(g=>identities.get(subject.model).has(g.group)).flatMap(g=>performanceRows(g,{modelName:subject.model,groupKey:g.group,observedAt:now()}));
        const at=now();db.transaction(()=>{
          rows+=upsertTransitPerformance(db,{stationId:config.id,rows:points,sourceUrl:url,sourceSchema:payload.data.series_schema,observedAt:at,windowHours:360});
          db.prepare('UPDATE transit_packy_metric_subjects SET next_attempt_at=?,last_success_at=?,fail_count=0,last_error=NULL WHERE station_id=? AND model=?')
            .run(new Date(Date.parse(at)+(config.performanceIntervalMs??3600000)).toISOString(),at,config.id,subject.model);
        }).immediate();failures=0;
      }catch(error){
        const message=describeTransitError(error);warnings.push(`${subject.model}: ${message}`);failures++;
        const delay=Math.min(3600000,15*60000*2**Math.min(subject.fail_count,2));
        db.prepare('UPDATE transit_packy_metric_subjects SET next_attempt_at=?,fail_count=fail_count+1,last_error=? WHERE station_id=? AND model=?')
          .run(new Date(Date.parse(now())+delay).toISOString(),message,config.id,subject.model);
        if([401,403,429].includes(error.httpStatus)){blocked=error;break;}if(failures>=3)break;
      }
      if(!options.fetchImpl)await new Promise(resolve=>setTimeout(resolve,100));
    }
    const next=db.prepare('SELECT MIN(next_attempt_at) at FROM transit_packy_metric_subjects WHERE station_id=?').get(config.id)?.at;
    const pending=next&&next<=now();if(pending)warnings.push('performance_subjects_pending');
    const ok=!warnings.length,at=now(),message=warnings.join('; ')||null;
    db.prepare(`INSERT INTO transit_collection_runs(run_id,station_id,collector_kind,stage,status,started_at,finished_at,offer_count,error_message)
      VALUES (?,?,?,'performance',?,?,?,?,?)`).run(runId,config.id,config.collectorKind,ok?'success':'failed',started,at,rows,message);
    finishTransit(db,config.id,owner,{ok,at,task:'performance',error:message,retryAfter:blocked?.retryAfter,
      intervalMs:next?Math.max(60000,Math.min(config.performanceIntervalMs??3600000,Date.parse(next)-Date.parse(at))):3600000});
    db.prepare('DELETE FROM transit_performance_observations WHERE station_id=? AND bucket_at<?').run(config.id,new Date(Date.parse(at)-35*86400000).toISOString());
    return {status:ok?'success':'failed',rows,requests,warnings};
  }catch(error){
    const message=describeTransitError(error),at=now();
    db.prepare(`INSERT OR REPLACE INTO transit_collection_runs(run_id,station_id,collector_kind,stage,status,started_at,finished_at,error_message)
      VALUES (?,?,?,'performance','failed',?,?,?)`).run(runId,config.id,config.collectorKind,started,at,message);
    finishTransit(db,config.id,owner,{ok:false,at,task:'performance',error:message,retryAfter:error.retryAfter});
    return {status:'failed',rows,requests,warnings:[...warnings,message]};
  }
}
