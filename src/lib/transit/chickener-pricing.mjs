// Chickener's bounded billing grammar. Source expressions are data, never JavaScript.
import {decimal,multiply} from './runapi-pricing.mjs';
const charges={p:'prompt',c:'completion',cr:'cache_read',cc:'cache_write',cc1h:'cache_write_1h'};
const ops={'||':1,'&&':2,'==':3,'!=':3,'<':4,'<=':4,'>':4,'>=':4,'+':5,'*':6},cache=new Map();
export function parseChickenerExpression(source){
  if(cache.has(source))return cache.get(source);
  if(typeof source!=='string'||source.length>8000)throw Error('chickener_expression_size');
  const tokens=[];let pos=0,i=0,depth=0;
  while(pos<source.length){
    if(/\s/.test(source[pos])){pos++;continue;}
    const m=/^(?:\d+(?:\.\d+)?|[A-Za-z_][\w]*|"(?:\\.|[^"\\])*"|&&|\|\||<=|>=|==|!=|[()+*?:,<>])/.exec(source.slice(pos));
    if(!m||tokens.length>=1500)throw Error('chickener_expression_token');tokens.push(m[0]);pos+=m[0].length;
  }
  const take=x=>{if(tokens[i++]!==x)throw Error('chickener_expression_syntax');};
  const expr=(min=0)=>{
    if(++depth>60)throw Error('chickener_expression_depth');const t=tokens[i++];let a;
    if(t==='('){a=expr();take(')');}
    else if(/^\d/.test(t??''))a={type:'number',value:decimal(t)};
    else if(t?.startsWith('"'))a={type:'string',value:JSON.parse(t)};
    else if(Object.hasOwn(charges,t)||t==='len')a={type:'variable',name:t};
    else if(['tier','hour','weekday','param'].includes(t)){
      take('(');const args=[expr()];while(tokens[i]===','){i++;args.push(expr());}take(')');
      if(args[0].type!=='string'||(t==='tier'?args.length!==2:args.length!==1))throw Error('chickener_expression_call');
      if(t==='param'&&args[0].value!=='service_tier')throw Error('chickener_expression_parameter');
      if(['hour','weekday'].includes(t)&&args[0].value!=='Asia/Shanghai')throw Error('chickener_expression_timezone');
      a={type:'call',name:t,args};
    }else throw Error('chickener_expression_identifier');
    while(ops[tokens[i]]>=min){const op=tokens[i++];a={type:'binary',op,left:a,right:expr(ops[op]+1)};}
    if(min===0&&tokens[i]==='?'){i++;const yes=expr();take(':');a={type:'condition',test:a,yes,no:expr()};}
    depth--;return a;
  };
  const ast=expr();if(i!==tokens.length)throw Error('chickener_expression_trailing');
  if(cache.size>=128)cache.delete(cache.keys().next().value);cache.set(source,ast);return ast;
}
function value(a,ctx){
  if(a.type==='number')return Number(a.value);if(a.type==='string')return a.value;
  if(a.type==='variable'){if(a.name!=='len')throw Error('chickener_cost_in_condition');return ctx.len;}
  if(a.type==='condition')return value(a.test,ctx)?value(a.yes,ctx):value(a.no,ctx);
  if(a.type==='call'){
    if(a.name==='param')return ctx.serviceTier;
    if(a.name==='tier')throw Error('chickener_tier_in_condition');
    const date=new Date(ctx.at+8*3600000);return a.name==='hour'?date.getUTCHours():date.getUTCDay()||7;
  }
  const l=value(a.left,ctx),r=value(a.right,ctx);
  switch(a.op){case'+':return l+r;case'*':return l*r;case'<':return l<r;case'<=':return l<=r;case'>':return l>r;case'>=':return l>=r;case'==':return l===r;case'!=':return l!==r;case'&&':return Boolean(l&&r);case'||':return Boolean(l||r);default:throw Error('chickener_condition');}
}
function add(a,b){
  const values=[a,b].map(decimal),scale=Math.max(...values.map(v=>(v.split('.')[1]??'').length));
  const n=values.reduce((sum,s)=>sum+BigInt(s.replace('.','')+'0'.repeat(scale-(s.split('.')[1]??'').length)),0n),digits=String(n).padStart(scale+1,'0');
  return decimal(scale?digits.slice(0,-scale)+'.'+digits.slice(-scale):digits);
}
function linear(a,ctx){
  if(a.type==='number')return {scalar:a.value};
  if(a.type==='variable'&&Object.hasOwn(charges,a.name))return {rates:{[a.name]:'1'}};
  if(a.type==='condition')return linear(value(a.test,ctx)?a.yes:a.no,ctx);
  if(a.type==='call'&&a.name==='tier')return {...linear(a.args[1],ctx),label:a.args[0].value};
  if(a.type==='binary'&&['+','*'].includes(a.op)){
    const l=linear(a.left,ctx),r=linear(a.right,ctx);
    if(!l.rates&&!r.rates)return {scalar:a.op==='+'?add(l.scalar,r.scalar):multiply(l.scalar,r.scalar)};
    if(a.op==='*'){
      if(l.rates&&r.rates)throw Error('chickener_nonlinear_cost');const factor=l.rates?r.scalar:l.scalar,rates=l.rates??r.rates;
      return {label:l.label??r.label,rates:Object.fromEntries(Object.entries(rates).map(([k,v])=>[k,multiply(v,factor)]))};
    }
    if(!l.rates||!r.rates)throw Error('chickener_fixed_surcharge');
    const rates={...l.rates};for(const[k,v]of Object.entries(r.rates))rates[k]=add(rates[k]??'0',v);return {rates,label:l.label??r.label};
  }throw Error('chickener_unsupported_cost');
}
export function chickenerExpressionPrices(source,factor,at=Date.now(),{length=0,serviceTier='default'}={}){
  const ast=parseChickenerExpression(source),bounds=new Set(),hours=new Set([0]);let timeDependent=false,priority=false;
  function walk(a){
    if(a.type==='binary'&&(a.left?.name==='len'||a.right?.name==='len')){
      if(a.op!=='<='||a.left.type!=='variable'||a.left.name!=='len'||a.right.type!=='number')throw Error('chickener_unknown_length_condition');
      const n=Number(a.right.value);if(!Number.isSafeInteger(n)||n<0||n>1e9)throw Error('chickener_length_bounds');bounds.add(n);
    }
    if(a.type==='call'&&['hour','weekday'].includes(a.name))timeDependent=true;
    if(a.type==='binary'&&a.left?.type==='call'&&a.left.name==='hour'&&a.right?.type==='number'){
      const h=Number(a.right.value);if(!Number.isInteger(h)||h<0||h>24)throw Error('chickener_hour_bounds');if(h<24)hours.add(h);
    }
    if(a.type==='call'&&a.name==='param')priority=true;
    for(const child of Object.values(a))if(child&&typeof child==='object'){if(Array.isArray(child))child.forEach(walk);else walk(child);}
  }walk(ast);if(bounds.size>12||!Number.isFinite(at)||!Number.isSafeInteger(length)||length<0)throw Error('chickener_projection_bounds');
  if(timeDependent){
    const flat=source.replace(/\s+/g,'');
    const window=(start,end)=>`(weekday("Asia/Shanghai")>=1&&weekday("Asia/Shanghai")<6&&hour("Asia/Shanghai")>=${start}&&hour("Asia/Shanghai")<${end}?2:1)`;
    if(!flat.endsWith('*'+window(9,12)+'*'+window(14,18)))throw Error('chickener_unknown_time_rule');
  }
  const project=(len,tier,clock)=>{
    const v=linear(ast,{len,serviceTier:tier,at:clock});if(!v.rates)throw Error('chickener_missing_rates');
    const rates=Object.fromEntries(Object.entries(v.rates).map(([k,v])=>[k,multiply(v,factor)]));
    if(Object.values(rates).some(v=>!Number.isFinite(Number(v))||Number(v)>1e12))throw Error('chickener_price_bounds');return {label:v.label,rates,baseRates:v.rates};
  };
  const boundaries=[...bounds].sort((a,b)=>a-b),points=[0,...boundaries.map(n=>n+1)],tiers=[];
  // Include all observed time branches without replacing the current projection.
  const local=new Date(at+8*3600000),dayStart=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate())-8*3600000;
  const clocks=timeDependent?[at,...Array.from({length:7},(_,day)=>[...hours].map(hour=>dayStart+day*86400000+hour*3600000)).flat()]:[at];
  for(const clock of clocks)for(const tier of priority?['default','priority','fast']:['default'])for(let i=0;i<points.length;i++){
    const d=new Date(clock+8*3600000),h=d.getUTCHours(),peak=d.getUTCDay()>0&&d.getUTCDay()<6&&(h>=9&&h<12||h>=14&&h<18);
    const v=project(points[i],tier,clock),rule={label:`${v.label??'基础'}${timeDependent?peak?' · 峰时':' · 谷时':''} · ${tier==='default'?'普通服务':tier} · 长度${points[i]}–${boundaries[i]??'无上限'}`,
      prices:v.rates,triggers:[{kind:'source_length_range',minInclusive:points[i],maxInclusive:boundaries[i]??null},{kind:'service_tier',value:tier}],...(timeDependent?{description:'峰谷规则以原始表达式及Asia/Shanghai时区为准；当前价格自动重算。'}:{})};
    if(!tiers.some(t=>JSON.stringify(t.prices)===JSON.stringify(rule.prices)&&JSON.stringify(t.triggers)===JSON.stringify(rule.triggers)))tiers.push(rule);
  }
  if(timeDependent)tiers.push({label:'时段规则',description:'北京时间周一至周五09:00–12:00、14:00–18:00为峰时，其余及周末为谷时；峰时2倍。',sourceExpression:source});
  const current=project(length,serviceTier,at),num=k=>Object.hasOwn(current.rates,k)?Number(current.rates[k]):null;
  return {inputPrice:num('p'),outputPrice:num('c'),cacheReadPrice:num('cr'),cacheWritePrice:num('cc'),cacheWrite1hPrice:num('cc1h'),tiers,timeDependent,
    chargeItems:Object.entries(current.rates).map(([k,v])=>({key:charges[k],unit:'per_M_tokens',creditPrice:v,basePrice:current.baseRates[k],baseCurrency:'CNY_CREDIT',multiplier:decimal(factor)}))};
}
export function refreshChickenerOffer(offer,at=Date.now()){
  let d;try{d=JSON.parse(offer.effective_price_json??'{}');}catch{return offer;}
  if(d.basis!=='chickener_public_credit_v1'||!d.billingExpr)return offer;
  try{const v=chickenerExpressionPrices(d.billingExpr,d.groupRate,at);return {...offer,input_price:v.inputPrice,output_price:v.outputPrice,cache_read_price:v.cacheReadPrice,
    cache_write_price:v.cacheWritePrice,cache_write_1h_price:v.cacheWrite1hPrice,tiers_json:JSON.stringify(v.tiers),
    effective_price_json:JSON.stringify({...d,tiers:v.tiers,chargeItems:v.chargeItems})};}
  catch{return {...offer,input_price:null,output_price:null,cache_read_price:null,cache_write_price:null,cache_write_1h_price:null};}
}
