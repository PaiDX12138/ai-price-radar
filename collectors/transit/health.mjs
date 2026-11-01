import {transitHasPerformance} from './worker.mjs';
import {statfsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
export function transitRuntimeHealth(db,configs,{now=Date.now(),staleMs=180000,overdueMs=180000}={}){
  const table=name=>Boolean(db?.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
  const issues=[],at=new Date(now).toISOString();
  let availableDiskMiB=null;
  try{const disk=statfsSync(dirname(resolve(db?.name??'data/transit.sqlite')));availableDiskMiB=Math.floor(Number(disk.bavail)*Number(disk.bsize)/1048576);
    if(availableDiskMiB<64)issues.push('transit_disk_space_low');
  }catch{/* database/path issue is reported by caller */}
  const workers=table('transit_worker_heartbeats')?db.prepare('SELECT owner,pid,hostname,started_at,heartbeat_at,stopped_at,active_children,last_error FROM transit_worker_heartbeats ORDER BY heartbeat_at DESC LIMIT 10').all():[];
  const alive=workers.filter(w=>!w.stopped_at&&now-Date.parse(w.heartbeat_at)>=0&&now-Date.parse(w.heartbeat_at)<=staleMs);
  if(configs.length&&!alive.length)issues.push('transit_worker_heartbeat_missing_or_stale');
  const schedules=[];
  for(const config of configs)for(const task of ['pricing',...(transitHasPerformance(config)?['performance']:[])]){
    const name=task==='pricing'?'transit_collect_schedule':'transit_performance_schedule';
    const row=table(name)?db.prepare(`SELECT * FROM ${name} WHERE station_id=?`).get(config.id):null;
    const leased=Boolean(row?.lease_until>at),late=row?Math.max(0,now-Date.parse(row.next_collect_at)):null;
    if(!row)issues.push(`schedule_missing:${config.id}:${task}`);
    else if(!leased&&late>overdueMs)issues.push(`schedule_overdue:${config.id}:${task}`);
    const closed=row?.last_error?.startsWith('source_service_closed:');
    if(closed){if(!issues.includes(`source_closed:${config.id}`))issues.push(`source_closed:${config.id}`);}
    else if(row?.last_error)issues.push(`task_failed:${config.id}:${task}`);
    schedules.push({stationId:config.id,task,state:!row?'missing':leased?'leased':closed?'source_closed':row.last_error?'retrying':late>overdueMs?'overdue':row.next_collect_at<=at?'due':'scheduled',
      nextCollectAt:row?.next_collect_at??null,lastAttemptAt:row?.last_attempt_at??null,lastSuccessAt:row?.last_success_at??null,overdueSeconds:late===null?null:Math.floor(late/1000),leaseUntil:row?.lease_until??null});
  }
  return {ok:issues.length===0,checkedAt:at,availableDiskMiB,workerStatus:alive.length?'running':'missing_or_stale',workers,schedules,issues};
}
