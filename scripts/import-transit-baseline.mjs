import {readFileSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {loadEnvLocal} from './load-env-local.mjs';
import {openTransitDb,closeTransitDb,resolveTransitSnapshotPath,exportTransitSnapshot} from '../collectors/transit-db.mjs';
import {decodeBaseline,mergeBaseline} from '../collectors/transit/baseline.mjs';
loadEnvLocal();
const dir=resolve('config/transit-baseline'),manifest=JSON.parse(readFileSync(join(dir,'manifest.json'),'utf8'));
const bundle=decodeBaseline(readFileSync(join(dir,'latest.json.gz')),manifest),check=process.argv.includes('--check');
if(check){console.log(JSON.stringify({verified:true,...manifest},null,2));}
else{
  const db=openTransitDb();
  try{
    const dryRun=process.argv.includes('--dry-run');
    const plan=mergeBaseline(db,bundle,{dryRun:true});console.log(JSON.stringify(plan));
    if(!dryRun){
      const snapshot=resolveTransitSnapshotPath(),catalogPath=process.env.TRANSIT_MODEL_CATALOG_PATH||resolve('data/transit/model-catalog.json');
      const result=mergeBaseline(db,bundle);
      exportTransitSnapshot(db,snapshot);
      let oldCatalog;try{oldCatalog=JSON.parse(readFileSync(catalogPath,'utf8'));}catch{/* no local catalog */}
      if(bundle.modelCatalog&&(!oldCatalog||oldCatalog.generatedAt<bundle.modelCatalog.generatedAt)){
        mkdirSync(dirname(catalogPath),{recursive:true});writeFileSync(catalogPath+'.tmp',JSON.stringify(bundle.modelCatalog));renameSync(catalogPath+'.tmp',catalogPath);
      }
      console.log(JSON.stringify({...result,snapshot},null,2));
    }
  }finally{closeTransitDb();}
}
