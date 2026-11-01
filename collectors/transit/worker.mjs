import {spawn} from 'node:child_process';
import {readFileSync,readdirSync,statfsSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {hostname} from 'node:os';
import {describeTransitError} from './transport.mjs';

export function transitHasPerformance(config){
  return config.collectorKind!=='cubence_v1'&&(config.collectorKind==='soleapi_v1'||Boolean(config.performanceUrl));
}
/** Read-only due check; child still atomically claims the real leases. */
export function transitStationDue(db,config,now){
  const tables=['transit_collect_schedule',...(transitHasPerformance(config)?['transit_performance_schedule']:[])];
  const rows=tables.map(table=>db.prepare(`SELECT * FROM ${table} WHERE station_id=?`).get(config.id));
  if(rows.some(row=>row?.lease_until>now))return false;
  return rows.some(row=>!row||row.next_collect_at<=now);
}

/** Bounded station actors + durable heartbeats, independent of shop batches.
 * Sources are reloaded every tick. Broken one-site config never stops other sites. */
export function createTransitDispatcher({db,root,env=process.env,spawnImpl=spawn,clock=()=>new Date().toISOString(),log=console,
  concurrency=Number(env.TRANSIT_WORKER_CONCURRENCY)||2,timeoutMs=240000}={}){
  concurrency=Math.max(1,Math.min(4,Math.trunc(concurrency)));
  const owner=`transit-worker-${randomUUID()}`,started=clock(),children=new Map(),retryAt=new Map();let stopping=false,lastError=null;
  const note=error=>{lastError=describeTransitError(error);log.warn('[worker] transit',lastError);};
  const beat=()=>db.prepare(`INSERT INTO transit_worker_heartbeats(owner,pid,hostname,started_at,heartbeat_at,active_children,last_error,stopped_at)
    VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET heartbeat_at=excluded.heartbeat_at,active_children=excluded.active_children,last_error=excluded.last_error,stopped_at=excluded.stopped_at`)
    .run(owner,process.pid,hostname(),started,clock(),children.size,lastError,stopping?clock():null);
  function tick(){
    if(stopping)return;
    try{
      lastError=null;
      beat();
      const disk=statfsSync(root),free=Number(disk.bavail)*Number(disk.bsize);
      if(free<64*1048576){note(new Error('transit_disk_space_low: less than 64MiB available; retaining last-good data'));beat();return;}
      const sources=[];
      for(const file of readdirSync(join(root,'config/transit')).filter(f=>/^[a-z0-9-]+\.json$/.test(f)).sort())try{
        const source=JSON.parse(readFileSync(join(root,'config/transit',file),'utf8'));
        if(source.enabled===true&&/^[a-z0-9-]+$/.test(source.id))sources.push(source);
      }catch(error){note(new Error(`invalid_transit_config:${file}: ${error.message}`));}
      // Rotate fairly after failures, instead of repeatedly giving the first site every slot.
      for(const source of sources.filter(c=>!children.has(c.id)&&!(retryAt.get(c.id)>clock())&&transitStationDue(db,c,clock()))){
        if(children.size>=concurrency)break;
        let child;try{
          child=spawnImpl(process.execPath,[join(root,'scripts/collect-transit.mjs'),'--due',`--station=${source.id}`],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
        }catch(error){retryAt.set(source.id,new Date(Date.parse(clock())+60000).toISOString());note(error);continue;}
        children.set(source.id,child);let settled=false;
        const timeout=setTimeout(()=>{note(new Error(`transit_timeout:${source.id}`));child.kill();},timeoutMs);timeout.unref?.();
        const hardKill=setTimeout(()=>{if(!settled)child.kill('SIGKILL');},timeoutMs+5000);hardKill.unref?.();
        child.stdout?.on('data',data=>log.log(`[worker] transit:${source.id}`,String(data).trim()));
        child.stderr?.on('data',data=>log.warn(`[worker] transit:${source.id}`,describeTransitError(String(data).trim())));
        const done=(code,error)=>{
          if(settled)return;settled=true;clearTimeout(timeout);clearTimeout(hardKill);children.delete(source.id);
          if(error||code){note(error??new Error(`transit_child_exit:${source.id}:${code}`));retryAt.set(source.id,new Date(Date.parse(clock())+60000).toISOString());}
          try{beat();}catch(e){log.warn('[worker] transit heartbeat failed',e.message);}
        };
        child.once('error',error=>done(1,error));child.once('close',code=>done(code??1));
      }
      beat();
    }catch(error){note(error);}
  }
  async function drain(){while(children.size)await new Promise(resolve=>setTimeout(resolve,50));}
  async function runOnce(){while(!stopping){tick();if(!children.size)break;await drain();}}
  function stop(){stopping=true;for(const child of children.values())child.kill();beat();}
  return {tick,drain,runOnce,stop,owner,children};
}
