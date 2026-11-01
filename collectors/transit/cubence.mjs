import {randomUUID} from 'node:crypto';
import {existsSync,readFileSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {upsertTransitCollection,recordTransitSourceSnapshot} from '../transit-db.mjs';
import {describeTransitError} from './transport.mjs';
import {CUBENCE_PARSER_VERSION,cubenceHash,parseCubenceCatalog,parseCubenceSettings,validateCubenceLogo} from './cubence-parser.mjs';
import {saveCubenceCatalog,saveCubenceSettings,pruneCubenceArchives} from './cubence-storage.mjs';

const root=join(dirname(fileURLToPath(import.meta.url)),'../..');
function references(path,at) {
  for(const file of [path,path+'.last-good'])try{
    const data=JSON.parse(readFileSync(file,'utf8')),age=Date.parse(at)-Date.parse(data.generatedAt);
    if(data.schemaVersion===1&&age>=-300000&&age<7*86400000&&data.models)return data.models;
  }catch{/* optional exact official input-price references */}
  return {};
}
export async function collectCubenceSource(db,config,options,runtime) {
  const {fetchPublic,claimTransit,finishTransit}=runtime,owner=options.owner??randomUUID(),now=()=>options.now??new Date().toISOString(),startedAt=now();
  if(!config.enabled||!claimTransit(db,config,{owner,now:startedAt,force:options.force}))return {id:config.id,status:'skipped'};
  const runId=`transit-${config.id}-${randomUUID()}`,rawDir=options.rawDir??join(root,'data/transit/raw');
  const deadline=Date.now()+(config.collectionBudgetMs??100000),warnings=[];
  const old=db.prepare('SELECT * FROM transit_stations WHERE id=?').get(config.id);
  let oldMeta={};try{oldMeta=JSON.parse(old?.raw_meta_json??'{}')??{};}catch{/* legacy metadata */}
  let parsed,rawPath,priceResponse,retryAfter,blocked=false,lastRequestAt=0;
  const get=async(url,kind)=>{
    if(blocked)throw new Error('cubence_optional_requests_blocked');
    if(!options.fetchImpl&&lastRequestAt)await new Promise(resolve=>setTimeout(resolve,Math.max(0,(config.requestIntervalMs??350)-(Date.now()-lastRequestAt))));
    const remaining=deadline-Date.now();if(remaining<1000)throw new Error('cubence_collection_budget');
    let response;
    try{lastRequestAt=Date.now();response=await fetchPublic(url,{...config,timeoutMs:Math.min(config.timeoutMs??20000,remaining),maxBytes:kind==='logo'?128*1024:config.maxBytes},options.fetchImpl);}
    catch(error){if([403,429].includes(error.httpStatus)){blocked=true;retryAfter=error.retryAfter;}throw error;}
    const hash=cubenceHash(response.text),path=join(rawDir,config.id,`${kind}-${hash}.txt.gz`);
    mkdirSync(dirname(path),{recursive:true});
    if(!existsSync(path)){
      const tmp=`${path}.${process.pid}.tmp`;writeFileSync(tmp,gzipSync(Buffer.from(response.text),{level:6}));renameSync(tmp,path);
    }
    recordTransitSourceSnapshot(db,{...response,stationId:config.id,runId,sourceKind:kind,sourceUrl:url,payloadText:'',payloadPath:path,payloadHash:hash,capturedAt:now()});
    return {response,hash,path};
  };
  try{
    priceResponse=await get(config.pricingUrl,'pricing');rawPath=priceResponse.path;
    const previous=db.prepare(`SELECT COUNT(DISTINCT o.raw_model) AS models FROM transit_offers o JOIN transit_groups g ON g.id=o.group_id
      WHERE g.station_id=? AND g.status='active' AND o.status='active'`).get(config.id);
    parsed=parseCubenceCatalog(priceResponse.response.text,config,{previousModels:previous.models,
      references:references(options.modelCatalogPath??process.env.TRANSIT_MODEL_CATALOG_PATH??join(root,'data/transit/model-catalog.json'),startedAt),observedAt:startedAt});
    let settings=null,settingsHash=null,settingsSourceHash=null;
    try{const result=await get(config.metadataUrl,'metadata');settings=parseCubenceSettings(JSON.parse(result.response.text));settingsHash=cubenceHash(settings);settingsSourceHash=result.hash;}
    catch(error){warnings.push(`metadata: ${describeTransitError(error)}`);}
    const publicRoot=options.publicRoot??join(root,'public'),logoPath=join(publicRoot,config.logoLocalPath.replace(/^\//,''));
    let logoLocalPath=existsSync(logoPath)?config.logoLocalPath:null,logo=oldMeta.logo??null;
    if(options.force||!logoLocalPath||!logo?.checkedAt||Date.parse(startedAt)-Date.parse(logo.checkedAt)>(config.assetIntervalMs??86400000)){
      try{
        const result=await get(config.logoUrl,'logo'),svg=validateCubenceLogo(result.response.text);
        if(!result.response.contentType?.includes('image/svg+xml'))throw new Error('cubence_invalid_logo_content_type');
        mkdirSync(dirname(logoPath),{recursive:true});writeFileSync(`${logoPath}.${process.pid}.tmp`,svg);renameSync(`${logoPath}.${process.pid}.tmp`,logoPath);
        logoLocalPath=config.logoLocalPath;logo={url:config.logoUrl,sha256:result.hash,checkedAt:startedAt};
      }catch(error){warnings.push(`logo: ${describeTransitError(error)}`);}
    }
    const at=now();
    const rawMeta={...oldMeta,groupOrigin:'synthetic_public_catalog',currencyKind:'usd_base',priceBasis:'base',logo,
      capabilities:{catalog:'public',groupPricing:'login_required',monitoring:'login_required',rechargeConversion:'unverified'},
      pricingCollection:{status:'success',sourceUrl:config.pricingUrl,observedAt:at,parserVersion:CUBENCE_PARSER_VERSION,inventory:parsed.inventory},
      metadataCollection:{status:settings?'success':'failed',observedAt:at,lastSuccessAt:settings?at:oldMeta.metadataCollection?.lastSuccessAt??null,
        values:settings??oldMeta.metadataCollection?.values??null,error:settings?null:warnings.find(w=>w.startsWith('metadata:'))},
      monitoringCollection:{status:'unavailable',reason:'login_required',pollingEnabled:false}};
    db.transaction(()=>{
      upsertTransitCollection(db,{station:{...config,config,sourceType:'official_public',logoLocalPath,recharge:null,rawMeta,
        description:'Cubence · USD公开基础报价，不含分组与峰谷倍率',sourceFingerprint:cubenceHash(parsed.catalog)},
        groups:parsed.groups,offers:parsed.offers,collectionComplete:true,observedAt:at,
        run:{runId,collectorKind:config.collectorKind,stage:'pricing',status:'success',startedAt,finishedAt:at,httpStatus:200,rawSnapshotPath:rawPath,errorMessage:warnings.join('; ')||null}});
      saveCubenceCatalog(db,{stationId:config.id,hash:cubenceHash(parsed.catalog),sourcePayloadHash:priceResponse.hash,catalog:parsed.catalog,inventory:parsed.inventory,
        sourceUrl:config.pricingUrl,parserVersion:CUBENCE_PARSER_VERSION,observedAt:at});
      if(settings)saveCubenceSettings(db,{stationId:config.id,hash:settingsHash,sourcePayloadHash:settingsSourceHash,settings,sourceUrl:config.metadataUrl,observedAt:at});
      finishTransit(db,config.id,owner,{ok:true,at,retryAfter,intervalMs:blocked?3600000:warnings.length?15*60000:options.intervalMs??6*3600000});
    }).immediate();
    try{pruneCubenceArchives(db,config.id,rawDir,at);}catch(error){warnings.push(`retention: ${describeTransitError(error)}`);}
    return {id:config.id,status:'success',...parsed.inventory,priceBasis:'base',monitoringStatus:'login_required',warnings};
  }catch(error){
    const at=now(),message=describeTransitError(error);
    db.transaction(()=>{
      upsertTransitCollection(db,{station:{...config,status:'candidate',sourceType:'official_public',config,rawMeta:{...oldMeta,
        pricingCollection:{...oldMeta.pricingCollection,status:'failed',lastAttemptAt:at,error:message}}},
        run:{runId,collectorKind:config.collectorKind,stage:'pricing',status:'failed',startedAt,finishedAt:at,httpStatus:error.httpStatus??priceResponse?.response.httpStatus,
          rawSnapshotPath:rawPath,errorCode:'cubence_pricing_failed',errorMessage:message}});
      finishTransit(db,config.id,owner,{ok:false,at,error:message,retryAfter:error.retryAfter??retryAfter});
    }).immediate();
    return {id:config.id,status:'failed',error:message,lastGoodRetained:true,warnings};
  }
}
