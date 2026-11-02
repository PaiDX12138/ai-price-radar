import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
/** Explicit local retirement wins over old snapshots and imported history. */
export function inactiveTransitIds(directory=join(process.cwd(),'config/transit')){
  const ids=new Set();
  for(const name of readdirSync(directory).filter(n=>/^[a-z0-9-]+\.json$/.test(n)))try{
    const c=JSON.parse(readFileSync(join(directory,name),'utf8'));
    if(c.id===name.slice(0,-5)&&(c.enabled===false||['paused','dead'].includes(c.status)))ids.add(c.id);
  }catch{/* One broken config does not remove unrelated sites. */}
  return ids;
}
export function syncTransitLifecycle(db,ids=inactiveTransitIds()){
  for(const id of ids){
    db.prepare("UPDATE transit_stations SET status='paused' WHERE id=? AND status<>'dead'").run(id);
    for(const table of ['transit_collect_schedule','transit_performance_schedule'])db.prepare(`DELETE FROM ${table} WHERE station_id=?`).run(id);
  }
}
