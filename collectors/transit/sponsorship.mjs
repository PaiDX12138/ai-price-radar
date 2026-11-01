import {readFileSync,readdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeTransitSponsorship} from '../../src/lib/transit/sponsorship.mjs';
const directory=join(dirname(fileURLToPath(import.meta.url)),'../../config/transit');
export function configuredTransitSponsors(){
  return readdirSync(directory).filter(name=>/^[a-z0-9-]+\.json$/.test(name))
    .map(name=>JSON.parse(readFileSync(join(directory,name),'utf8')));
}
/** Sync without source HTTP success or changing observed data/timestamps. */
export function syncTransitSponsorships(db,sources=configuredTransitSponsors()){
  const values=sources.map(source=>{
    if(!/^[a-z0-9-]+$/.test(source.id))throw new Error('invalid_transit_station_id');
    const sponsor=normalizeTransitSponsorship(source.sponsorship);
    return {id:source.id,json:sponsor===null?null:JSON.stringify(sponsor)};
  });
  return db.transaction(()=>{
    const update=db.prepare('UPDATE transit_stations SET sponsorship_json=? WHERE id=? AND sponsorship_json IS NOT ?');
    let count=0;for(const row of values)count+=update.run(row.json,row.id,row.json).changes;
    return count;
  })();
}
