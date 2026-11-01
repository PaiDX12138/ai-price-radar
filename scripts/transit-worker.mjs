#!/usr/bin/env node
/** Optional transit-only service. Normal pnpm worker already includes the same dispatcher. */
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEnvLocal} from './load-env-local.mjs';
import {openTransitDb,closeTransitDb} from '../collectors/transit-db.mjs';
import {createTransitDispatcher} from '../collectors/transit/worker.mjs';
loadEnvLocal();
const root=join(dirname(fileURLToPath(import.meta.url)),'..'),dispatcher=createTransitDispatcher({db:openTransitDb(),root});
dispatcher.tick();
if(process.argv.includes('--once')){await dispatcher.runOnce();dispatcher.stop();closeTransitDb();}
else{
  const timer=setInterval(()=>dispatcher.tick(),30000);
  const stop=()=>{clearInterval(timer);dispatcher.stop();setTimeout(()=>{closeTransitDb();process.exit(0);},500).unref();};
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  console.log('[worker] transit service active: 30s poll; pricing + performance; durable leases/heartbeat');
}
