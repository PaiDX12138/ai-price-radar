/** Explicit transit egress, bounded redirects and useful (credential-free) failures. */
const proxyAgents=new Map();
export function transitProxySetting(config={}) {
  const station=config.id?`TRANSIT_${config.id.toUpperCase().replace(/-/g,'_')}_HTTP_PROXY`:null;
  for(const key of [station,'TRANSIT_HTTP_PROXY','PROXY_URL','COLLECTOR_HTTP_PROXY']) {
    if(!key||!process.env[key]?.trim())continue;
    const value=process.env[key].trim();
    return {key,value:value==='direct'?'':value,mode:value==='direct'?'direct':'proxy'};
  }
  return {key:null,value:'',mode:'direct'};
}
export function redactTransitError(value) {
  return String(value??'unknown_error')
    .replace(/(?:https?|socks5?):\/\/[^\s"'<>]+/gi,url=>{try{const u=new URL(url);return `${u.protocol}//${u.hostname}${u.port?`:${u.port}`:''}${u.pathname}`;}catch{return '[url]';}})
    .replace(/\bBearer\s+[^\s"']+/gi,'Bearer [redacted]')
    .replace(/\b(sk-[a-zA-Z0-9_-]{12,}|gh[pousr]_[a-zA-Z0-9_]{20,})\b/g,'[redacted]')
    .slice(0,700);
}
export function describeTransitError(error) {
  const parts=[],seen=new Set();
  const visit=(value,depth=0)=>{
    if(!value||depth>3||seen.has(value))return;seen.add(value);
    const text=[value.code,value.message].filter(Boolean).join(': ');
    if(text&&!parts.includes(text))parts.push(text);
    visit(value.cause,depth+1);
    if(Array.isArray(value.errors))for(const child of value.errors.slice(0,3))visit(child,depth+1);
  };
  visit(error);
  return redactTransitError(parts.join(' <- ')||error);
}
async function networkFetch(url,init,config,fetchImpl) {
  if(fetchImpl)return fetchImpl(url,init);
  const setting=transitProxySetting(config);
  if(!setting.value)return fetch(url,init);
  let proxy;
  try{proxy=new URL(setting.value);}catch{throw new Error(`invalid_transit_proxy:${setting.key}`);}
  if(!['http:','https:','socks5:','socks:'].includes(proxy.protocol))throw new Error(`unsupported_transit_proxy:${setting.key}`);
  const {ProxyAgent,fetch:proxyFetch}=await import('undici');
  if(!proxyAgents.has(setting.value))proxyAgents.set(setting.value,new ProxyAgent(setting.value));
  return proxyFetch(url,{...init,dispatcher:proxyAgents.get(setting.value)});
}
export async function fetchTransitPublic(url,config,fetchImpl) {
  const initial=new URL(url),allowed=new Set([initial.origin,...(config.allowedRedirectOrigins??[])]);
  const signal=AbortSignal.timeout(config.timeoutMs??20000);
  let current=initial;
  try{
    for(let redirects=0;redirects<=3;redirects++) {
      const response=await networkFetch(current.href,{signal,redirect:'manual',headers:{
        accept:'application/json,text/html,image/svg+xml',
        'user-agent':'AI-Price-Radar/1.0 (public pricing collector)',
      }},config,fetchImpl);
      if([301,302,303,307,308].includes(response.status)) {
        const location=response.headers.get('location');await response.body?.cancel();
        if(!location)throw new Error('redirect_without_location');
        const next=new URL(location,current);
        if(next.protocol!=='https:'||next.username||next.password||!allowed.has(next.origin))
          throw new Error(`unapproved_transit_redirect:${next.hostname}`);
        current=next;continue;
      }
      const reader=response.body?.getReader(),chunks=[];let size=0;
      if(reader){try{while(true){const row=await reader.read();if(row.done)break;size+=row.value.byteLength;
        if(size>(config.maxBytes??2097152))throw new Error('response_too_large');chunks.push(Buffer.from(row.value));}}
        catch(error){await reader.cancel().catch(()=>{});throw error;}}
      const bytes=Buffer.concat(chunks),text=bytes.toString('utf8');
      if(!response.ok){const error=new Error(`HTTP ${response.status}`);error.httpStatus=response.status;
        error.retryAfter=response.headers.get('retry-after');throw error;}
      return {text,bytes,httpStatus:response.status,contentType:response.headers.get('content-type'),
        etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified'),resolvedUrl:current.href};
    }
    throw new Error('too_many_transit_redirects');
  }catch(error){
    const wrapped=new Error(`${current.hostname}${current.pathname}: ${describeTransitError(error)}`);
    wrapped.httpStatus=error.httpStatus;wrapped.retryAfter=error.retryAfter;throw wrapped;
  }
}
