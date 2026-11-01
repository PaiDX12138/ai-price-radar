import Database from 'better-sqlite3';
import {readFileSync,existsSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {loadEnvLocal} from './load-env-local.mjs';
import {createBaseline,decodeBaseline} from '../collectors/transit/baseline.mjs';
loadEnvLocal();
const dir=resolve('config/transit-baseline'),db=new Database(process.env.TRANSIT_DB_PATH||'data/transit.sqlite',{readonly:true});
try{
  const path=process.env.TRANSIT_MODEL_CATALOG_PATH||'data/transit/model-catalog.json';
  const modelCatalog=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null;
  const {bytes,manifest}=createBaseline(db,{modelCatalog});decodeBaseline(bytes,manifest);
  mkdirSync(dir,{recursive:true});
  for(const [name,body]of [['latest.json.gz',bytes],['manifest.json',JSON.stringify(manifest,null,2)+'\n']]){
    writeFileSync(join(dir,name+'.tmp'),body);renameSync(join(dir,name+'.tmp'),join(dir,name));
  }
  console.log(JSON.stringify(manifest,null,2));
}finally{db.close();}
