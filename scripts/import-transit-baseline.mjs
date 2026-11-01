import {readFileSync,existsSync,mkdirSync,copyFileSync,writeFileSync,renameSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {loadEnvLocal} from './load-env-local.mjs';
import {openTransitDb,closeTransitDb,resolveTransitDbPath,resolveTransitSnapshotPath,exportTransitSnapshot} from '../collectors/transit-db.mjs';
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
      // Online SQLite backup, never copy an active main file without its WAL.
      const backup=join(dirname(resolveTransitDbPath()),'transit-backups','before-baseline-'+new Date().toISOString().replace(/[:.]/g,'-'));
      mkdirSync(backup,{recursive:true});await db.backup(join(backup,'transit.sqlite'));
      const snapshot=resolveTransitSnapshotPath(),catalogPath=process.env.TRANSIT_MODEL_CATALOG_PATH||resolve('data/transit/model-catalog.json');
      for(const [src,name]of [[snapshot,'latest.json'],[catalogPath,'model-catalog.json']])if(existsSync(src))copyFileSync(src,join(backup,name));
      const result=mergeBaseline(db,bundle);
      exportTransitSnapshot(db,snapshot);
      let oldCatalog;try{oldCatalog=JSON.parse(readFileSync(catalogPath,'utf8'));}catch{/* no local catalog */}
      if(bundle.modelCatalog&&(!oldCatalog||oldCatalog.generatedAt<bundle.modelCatalog.generatedAt)){
        mkdirSync(dirname(catalogPath),{recursive:true});writeFileSync(catalogPath+'.tmp',JSON.stringify(bundle.modelCatalog));renameSync(catalogPath+'.tmp',catalogPath);
      }
      console.log(JSON.stringify({...result,backup,snapshot},null,2));
    }
  }finally{closeTransitDb();}
}
