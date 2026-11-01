/** Lower-concurrency build for small servers; no data/service/system mutation. */
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {totalmem,freemem} from 'node:os';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const cgroup={};
for(const file of ['/sys/fs/cgroup/memory.max','/sys/fs/cgroup/memory.current','/sys/fs/cgroup/memory.events','/sys/fs/cgroup/memory/memory.limit_in_bytes']){
  try{cgroup[file.split('/').at(-1)]=readFileSync(file,'utf8').trim();}catch{/* Windows or non-cgroup host */}
}
const requested=Number(process.env.RADAR_BUILD_HEAP_MB??1024);
if(!Number.isSafeInteger(requested)||requested<512||requested>2048)throw new Error('RADAR_BUILD_HEAP_MB must be an integer between 512 and 2048');
const options=(process.env.NODE_OPTIONS??'').replace(/--max[-_]old[-_]space[-_]size(?:=|\s+)\d+/g,'').trim();
console.log(JSON.stringify({build:'webpack-low-memory',heapLimitMiB:requested,totalMiB:Math.round(totalmem()/1048576),freeMiB:Math.round(freemem()/1048576),cgroup,
  note:'Heap limit is per Node process, not the whole build RSS. No swap or OS limit is changed.'}));
if(!process.argv.includes('--diagnose')){
  const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'build','--webpack'],{stdio:'inherit',env:{...process.env,
    RADAR_LOW_MEMORY_BUILD:'1',RAYON_NUM_THREADS:'1',
    NODE_OPTIONS:`${options} --max-old-space-size=${requested}`.trim(),
  }});
  child.on('error',error=>{console.error(error.message);process.exitCode=1;});
  child.on('exit',(code,signal)=>{
    if(signal||code!==0)console.error(`Server build failed (code=${code}, signal=${signal??'none'}). Do not restart the website with an incomplete build.`);
    process.exitCode=code??(signal==='SIGKILL'?137:1);
  });
}
