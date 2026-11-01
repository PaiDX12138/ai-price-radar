// Pure, bounded parser for the observed RunAPI billing DSL. No downloaded code executes.
const variables = new Set(['p','c','cr','cc','cc1h','img','img_o','ai','ao']);
const precedence = {'||':1,'&&':2,'==':3,'!=':3,'<':4,'<=':4,'>':4,'>=':4,'+':5,'-':5,'*':6,'/':6};
const cache = new Map();
export function parseRunExpression(source) {
  if(cache.has(source))return cache.get(source);
  if(typeof source!=='string'||source.length>8000)throw new Error('runapi_expression_size');
  const tokens=[];let pos=0;
  while(pos<source.length){
    if(/\s/.test(source[pos])){pos++;continue;}
    const match=source.slice(pos).match(/^(?:\d+(?:\.\d+)?|[A-Za-z_][A-Za-z_0-9]*|"(?:\\.|[^"\\])*"|&&|\|\||<=|>=|==|!=|[()+*/?:,<>!\-])/);
    if(!match||tokens.length>=1500)throw new Error('runapi_expression_token');tokens.push(match[0]);pos+=match[0].length;
  }
  let index=0,depth=0;
  const take=s=>{if(tokens[index++]!==s)throw new Error('runapi_expression_syntax');};
  const expression=(min=0)=>{
    if(++depth>60)throw new Error('runapi_expression_depth');
    let left;const token=tokens[index++];
    if(token==='('){left=expression();take(')');}
    else if(['!','-','+'].includes(token))left={t:'unary',op:token,arg:expression(7)};
    else if(/^\d/.test(token??''))left={t:'number',value:decimal(token)};
    else if(token?.startsWith('"'))left={t:'string',value:JSON.parse(token)};
    else if(['tier','hour','weekday'].includes(token)){
      take('(');const args=[expression()];while(tokens[index]===','){index++;args.push(expression());}take(')');
      if(token==='tier'?(args.length!==2||args[0].t!=='string'):(args.length!==1||args[0].t!=='string'||!['Asia/Shanghai','UTC'].includes(args[0].value)))throw new Error('runapi_expression_call');
      left={t:'call',name:token,args};
    }else if(variables.has(token))left={t:'variable',name:token};
    else throw new Error('runapi_expression_identifier');
    while(precedence[tokens[index]]>=min){const op=tokens[index++];left={t:'binary',op,left,right:expression(precedence[op]+1)};}
    if(min===0&&tokens[index]==='?'){index++;const yes=expression();take(':');left={t:'condition',test:left,yes,no:expression()};}
    depth--;return left;
  };
  const ast=expression();if(index!==tokens.length)throw new Error('runapi_expression_trailing');
  // Cache is local and bounded; expressions are data and never JavaScript functions.
  if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(source,ast);return ast;
}

export function decimal(value){
  const text=String(value),m=text.match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
  if(!m||text.length>100)throw new Error('runapi_decimal');
  const fraction=m[2]??'',exponent=Number(m[3]??0);if(Math.abs(exponent)>30||fraction.length>30)throw new Error('runapi_decimal_scale');
  let digits=(m[1]+fraction).replace(/^0+(?=\d)/,''),scale=fraction.length-exponent;
  if(scale<0){digits+='0'.repeat(-scale);scale=0;}digits=digits.padStart(scale+1,'0');
  const result=scale?`${digits.slice(0,-scale)}.${digits.slice(-scale)}`:digits;
  return result.replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');
}
export function multiply(a,b){
  const parts=[a,b].map(decimal).map(s=>({n:BigInt(s.replace('.','')),scale:(s.split('.')[1]??'').length}));
  const scale=parts[0].scale+parts[1].scale,digits=String(parts[0].n*parts[1].n).padStart(scale+1,'0');
  return decimal(scale?digits.slice(0,-scale)+'.'+digits.slice(-scale):digits);
}
function add(a,b){
  const values=[a,b].map(decimal),scale=Math.max(...values.map(s=>(s.split('.')[1]??'').length));
  const n=values.reduce((sum,s)=>sum+BigInt(s.replace('.','')+'0'.repeat(scale-(s.split('.')[1]??'').length)),0n);
  const digits=String(n).padStart(scale+1,'0');return decimal(scale?digits.slice(0,-scale)+'.'+digits.slice(-scale):digits);
}
const clock=(at,zone)=>{const d=new Date(at+(zone==='Asia/Shanghai'?8*3600000:0));return {hour:d.getUTCHours(),weekday:d.getUTCDay()||7};};
function number(node,p,at){
  if(node.t==='number')return Number(node.value);
  if(node.t==='variable'){if(node.name!=='p')throw new Error('runapi_non_prompt_condition');return p;}
  if(node.t==='call'&&node.name!=='tier')return clock(at,node.args[0].value)[node.name];
  if(node.t==='condition')return number(node.test,p,at)?number(node.yes,p,at):number(node.no,p,at);
  if(node.t==='unary'){const n=number(node.arg,p,at);return node.op==='!'?!n:node.op==='-'?-n:n;}
  if(node.t==='binary'){
    const a=number(node.left,p,at),b=number(node.right,p,at);
    const ops={'+':()=>a+b,'-':()=>a-b,'*':()=>a*b,'/':()=>a/b,'<':()=>a<b,'<=':()=>a<=b,'>':()=>a>b,'>=':()=>a>=b,'==':()=>a===b,'!=':()=>a!==b,'&&':()=>Boolean(a&&b),'||':()=>Boolean(a||b)};
    return ops[node.op]();
  }throw new Error('runapi_non_numeric_condition');
}
// Linear Token prices only. Nonlinear, negative or unsupported costs are quarantined.
function linear(node,p,at){
  if(node.t==='number')return {scalar:node.value};
  if(node.t==='variable')return {rates:{[node.name]:'1'}};
  if(node.t==='condition')return linear(number(node.test,p,at)?node.yes:node.no,p,at);
  if(node.t==='call'&&node.name==='tier')return {...linear(node.args[1],p,at),label:node.args[0].value};
  if(node.t==='binary'&&['+','*'].includes(node.op)){
    const a=linear(node.left,p,at),b=linear(node.right,p,at);
    if(!a.rates&&!b.rates)return {scalar:node.op==='+'?add(a.scalar,b.scalar):multiply(a.scalar,b.scalar)};
    if(node.op==='*'){
      if(a.rates&&b.rates)throw new Error('runapi_nonlinear_cost');const rates=a.rates??b.rates,factor=a.rates?b.scalar:a.scalar;
      return {label:a.label??b.label,rates:Object.fromEntries(Object.entries(rates).map(([key,value])=>[key,multiply(value,factor)]))};
    }
    if(!a.rates||!b.rates)throw new Error('runapi_fixed_token_surcharge');
    const rates={...a.rates};for(const[key,value]of Object.entries(b.rates))rates[key]=add(rates[key]??'0',value);
    return {rates,label:a.label??b.label};
  }throw new Error('runapi_unsupported_cost');
}
export function expressionPrices(source,groupRate,at=Date.now()){
  const ast=parseRunExpression(source),thresholds=new Set();let timeDependent=false;
  const walk=node=>{
    if(node.t==='binary'&&['<','<=','>','>=','==','!='].includes(node.op)
      &&(node.left.t==='variable'||node.right.t==='variable')
      &&!(node.op==='<='&&node.left.t==='variable'&&node.left.name==='p'&&node.right.t==='number'))throw new Error('runapi_unsupported_tier_condition');
    if(node.t==='binary'&&['<','<=','>','>='].includes(node.op)&&node.left.t==='variable'&&node.left.name==='p'&&node.right.t==='number')thresholds.add(Number(node.right.value));
    if(node.t==='call'&&node.name!=='tier')timeDependent=true;
    for(const value of Object.values(node)){if(value&&typeof value==='object'){if(Array.isArray(value))value.forEach(walk);else walk(value);}}
  };walk(ast);
  if(thresholds.size>12)throw new Error('runapi_too_many_tiers');
  const boundaries=[...thresholds].sort((a,b)=>a-b),points=[0,...boundaries.map(n=>n+1)];
  const tiers=points.map((p,index)=>{
    const value=linear(ast,p,at);if(!value.rates||!Object.keys(value.rates).length)throw new Error('runapi_empty_cost');
    const prices=Object.fromEntries(Object.entries(value.rates).map(([key,v])=>[key,multiply(v,groupRate)]));
    if(Object.values(prices).some(v=>!Number.isFinite(Number(v))||Number(v)>1e12))throw new Error('runapi_price_bounds');
    return {label:`${value.label??'基准'}${boundaries.length?` · 输入${index===0?'≤'+boundaries[0]:index===boundaries.length?'>'+boundaries.at(-1):'>'+boundaries[index-1]+'且≤'+boundaries[index]}`:''}`,
      prices,triggers:[{kind:'input_token_range',minExclusive:index?boundaries[index-1]:null,maxInclusive:boundaries[index]??null}]};
  });
  return {tiers,timeDependent,prices:tiers[0].prices};
}
export const runChargeKeys={p:'prompt',c:'completion',cr:'cache_read',cc:'cache_write_5m',cc1h:'cache_write_1h',img:'image_input',img_o:'image_output',ai:'audio_input',ao:'audio_output'};
export function runPriceProjection(expression,groupRate,at=Date.now()){
  const result=expressionPrices(expression,groupRate,at),prices=result.prices;
  const amount=key=>Object.hasOwn(prices,key)?Number(prices[key]):null;
  return {...result,tiers:[...result.tiers,...(result.timeDependent?[{label:'时段计费',description:'按源时区自动切换；当前价格已含时段系数'}]:[])],inputPrice:amount('p'),outputPrice:amount('c'),cacheReadPrice:amount('cr'),cacheWritePrice:amount('cc'),cacheWrite1hPrice:amount('cc1h'),
    chargeItems:Object.entries(prices).map(([key,price])=>({key:runChargeKeys[key],unit:'per_M_tokens',creditPrice:price,basePrice:price,baseCurrency:'USD_CREDIT',multiplier:decimal(groupRate)}))};
}
/** Re-evaluate persisted time rules locally at render/export; no network, SQLite or stale 6h peak price. */
export function refreshRunApiOffer(offer,at=Date.now()){
  let details;try{details=JSON.parse(offer.effective_price_json??'{}');}catch{return offer;}
  if(details.basis!=='runapi_public_usd_credit'||!details.billingExpr)return offer;
  try{
    const value=runPriceProjection(details.billingExpr,details.groupRate,at);
    return {...offer,input_price:value.inputPrice,output_price:value.outputPrice,cache_read_price:value.cacheReadPrice,
      cache_write_price:value.cacheWritePrice,cache_write_1h_price:value.cacheWrite1hPrice,
      effective_price_json:JSON.stringify({...details,chargeItems:value.chargeItems,tiers:value.tiers})};
  }catch{return {...offer,input_price:null,output_price:null,cache_read_price:null,cache_write_price:null,cache_write_1h_price:null};}
}
