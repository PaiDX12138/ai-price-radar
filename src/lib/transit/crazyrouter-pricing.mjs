// Independent CrazyRouter len/param/tier grammar. All source expressions are data.
// Reuse only decimal arithmetic; never execute downloaded JavaScript.
import {decimal,multiply} from './runapi-pricing.mjs';
const charges={p:'prompt',c:'completion',cr:'cache_read',cc:'cache_write_5m',cc1h:'cache_write_1h',cc12h:'cache_write_12h',ai:'audio_input'};
const operators={'==':1,'<=':2,'+':3,'*':4};
export function parseCrazyExpression(source) {
  if(typeof source!=='string'||source.length>8000)throw new Error('crazy_expression_size');
  const tokens=[];let offset=0,index=0,depth=0;
  while(offset<source.length){
    if(/\s/.test(source[offset])){offset++;continue;}
    const match=/^(?:\d+(?:\.\d+)?|[a-zA-Z_][\w]*|"(?:\\.|[^"\\])*"|<=|==|[()+*?:,])/.exec(source.slice(offset));
    if(!match||tokens.length>1500)throw new Error('crazy_expression_token');tokens.push(match[0]);offset+=match[0].length;
  }
  const take=value=>{if(tokens[index++]!==value)throw new Error('crazy_expression_syntax');};
  const expression=(min=0)=>{
    if(++depth>50)throw new Error('crazy_expression_depth');
    const token=tokens[index++];let node;
    if(token==='('){node=expression();take(')');}
    else if(/^\d/.test(token??''))node={t:'number',value:decimal(token)};
    else if(token?.startsWith('"'))node={t:'string',value:JSON.parse(token)};
    else if(token==='true'||token==='false')node={t:'boolean',value:token==='true'};
    else if(token==='len'||Object.hasOwn(charges,token))node={t:'variable',name:token};
    else if(token==='tier'||token==='param'){
      take('(');const args=[expression()];while(tokens[index]===','){index++;args.push(expression());}take(')');
      if(args[0]?.t!=='string'||(token==='tier'?args.length!==2:args.length!==1||args[0].value!=='enable_thinking'))throw new Error('crazy_expression_call');
      node={t:'call',name:token,args};
    }else throw new Error('crazy_expression_identifier');
    while(operators[tokens[index]]>=min){const op=tokens[index++];node={t:'binary',op,left:node,right:expression(operators[op]+1)};}
    if(min===0&&tokens[index]==='?'){index++;const yes=expression();take(':');node={t:'condition',test:node,yes,no:expression()};}
    depth--;return node;
  };
  const ast=expression();if(index!==tokens.length)throw new Error('crazy_expression_trailing');return ast;
}
function predicate(node,len,thinking){
  if(node.t==='boolean')return node.value;
  if(node.t==='number')return Number(node.value);
  if(node.t==='variable'&&node.name==='len')return len;
  if(node.t==='call'&&node.name==='param')return thinking;
  if(node.t==='binary'&&['<=','=='].includes(node.op)){
    const a=predicate(node.left,len,thinking),b=predicate(node.right,len,thinking);return node.op==='<='?a<=b:a===b;
  }
  throw new Error('crazy_unsupported_condition');
}
function sum(a,b){
  const list=[a,b].map(decimal),scale=Math.max(...list.map(s=>(s.split('.')[1]??'').length));
  const n=list.reduce((n,s)=>n+BigInt(s.replace('.','')+'0'.repeat(scale-(s.split('.')[1]??'').length)),0n);
  const digits=String(n).padStart(scale+1,'0');return decimal(scale?digits.slice(0,-scale)+'.'+digits.slice(-scale):digits);
}
function linear(node,len,thinking){
  if(node.t==='number')return {scalar:node.value};
  if(node.t==='variable'&&Object.hasOwn(charges,node.name))return {rates:{[node.name]:'1'}};
  if(node.t==='condition')return linear(predicate(node.test,len,thinking)?node.yes:node.no,len,thinking);
  if(node.t==='call'&&node.name==='tier')return {...linear(node.args[1],len,thinking),label:node.args[0].value};
  if(node.t==='binary'&&['+','*'].includes(node.op)){
    const a=linear(node.left,len,thinking),b=linear(node.right,len,thinking);
    if(!a.rates&&!b.rates)return {scalar:node.op==='+'?sum(a.scalar,b.scalar):multiply(a.scalar,b.scalar)};
    if(node.op==='*'){
      if(a.rates&&b.rates)throw new Error('crazy_nonlinear_cost');
      const rates=a.rates??b.rates,factor=a.rates?b.scalar:a.scalar;
      return {rates:Object.fromEntries(Object.entries(rates).map(([key,v])=>[key,multiply(v,factor)]))};
    }
    if(!a.rates||!b.rates)throw new Error('crazy_fixed_token_surcharge');
    const rates={...a.rates};for(const[key,v]of Object.entries(b.rates))rates[key]=sum(rates[key]??0,v);return {rates};
  }
  throw new Error('crazy_unsupported_cost');
}
export function crazyExpressionPrices(source,factor){
  const ast=parseCrazyExpression(source),bounds=new Set();let hasThinking=false;
  const walk=node=>{
    if(node.t==='binary'&&node.op==='<='){
      if(node.left.t!=='variable'||node.left.name!=='len'||node.right.t!=='number'||!Number.isSafeInteger(Number(node.right.value)))throw new Error('crazy_unknown_length_condition');
      bounds.add(Number(node.right.value));
    }
    if(node.t==='call'&&node.name==='param')hasThinking=true;
    for(const child of Object.values(node))if(child&&typeof child==='object'){if(Array.isArray(child))child.forEach(walk);else walk(child);}
  };walk(ast);if(bounds.size>12)throw new Error('crazy_tier_limit');
  const boundaries=[...bounds].sort((a,b)=>a-b),points=[0,...boundaries.map(n=>n+1)],tiers=[];
  for(const thinking of hasThinking?[false,true]:[false])for(let i=0;i<points.length;i++){
    const v=linear(ast,points[i],thinking);if(!v.rates||!Object.keys(v.rates).length)throw new Error('crazy_empty_cost');
    const prices=Object.fromEntries(Object.entries(v.rates).map(([k,p])=>[k,multiply(p,factor)]));
    if(Object.values(prices).some(p=>!Number.isFinite(Number(p))||Number(p)>1e12))throw new Error('crazy_price_bounds');
    const min=points[i],max=boundaries[i]??null;
    tiers.push({label:`${v.label??'基础'}${hasThinking?thinking?' · 思考开启':' · 思考关闭':''}${bounds.size?` · 长度${min}–${max??'无上限'}`:''}`,prices,
      triggers:[{kind:'source_length_range',minInclusive:min,maxInclusive:max},...(hasThinking?[{kind:'body_field_matches',field:'enable_thinking',pattern:String(thinking)}]:[])]});
  }
  const rates=tiers[0].prices,num=key=>Object.hasOwn(rates,key)?Number(rates[key]):null;
  return {tiers,inputPrice:num('p'),outputPrice:num('c'),cacheReadPrice:num('cr'),cacheWritePrice:num('cc'),cacheWrite1hPrice:num('cc1h'),
    chargeItems:Object.entries(rates).map(([key,v])=>({key:charges[key],unit:'per_M_tokens',creditPrice:v,basePrice:v,baseCurrency:'USD_CREDIT',multiplier:decimal(factor)}))};
}
export function crazyTimePrices(rule,factor,at=Date.now()){
  if(rule?.timezone!=='Asia/Shanghai'||!Array.isArray(rule.peak_windows)||!rule.off_peak||!rule.peak)throw new Error('crazy_unknown_time_rule');
  const parse=value=>{if(!/^\d{2}:\d{2}$/.test(value??''))throw new Error('crazy_invalid_time_window');const [h,m]=value.split(':').map(Number);if(h>23||m>59)throw new Error('crazy_invalid_time_window');return h*60+m;};
  const date=new Date(at+8*3600000),minute=date.getUTCHours()*60+date.getUTCMinutes();
  const windows=rule.peak_windows.map(w=>[parse(w.start),parse(w.end)]);if(windows.some(([a,b])=>a>=b))throw new Error('crazy_invalid_time_window');
  const peak=windows.some(([a,b])=>minute>=a&&minute<b),tier=peak?'peak':'off_peak';
  const keys={input_per_1m_tokens:'p',output_per_1m_tokens:'c',cache_read_per_1m_tokens:'cr'};
  const tiers=['off_peak','peak'].map(key=>({label:key==='peak'?'高峰':'非高峰',description:`北京时间${key==='peak'?rule.peak_windows.map(w=>w.start+'–'+w.end).join('、'):'其余时段'}：${Object.entries(keys).map(([field,k])=>`${{p:'输入',c:'输出',cr:'缓存读'}[k]} $${multiply(rule[key][field],factor)}`).join('、')} / 百万Token`,
    prices:Object.fromEntries(Object.entries(keys).map(([field,k])=>[k,multiply(rule[key][field],factor)]))}));
  const rates=tiers[peak?1:0].prices;
  return {tiers,currentTier:tier,inputPrice:Number(rates.p),outputPrice:Number(rates.c),cacheReadPrice:Number(rates.cr),cacheWritePrice:null,cacheWrite1hPrice:null,
    chargeItems:Object.entries(rates).map(([k,v])=>({key:charges[k],unit:'per_M_tokens',creditPrice:v,basePrice:v,baseCurrency:'USD_CREDIT',multiplier:decimal(factor)}))};
}
/** Source current_tier is six-hour stale at boundaries: calculate current public
 * schedule locally. No network and no inferred weekend exclusion. */
export function refreshCrazyOffer(offer,at=Date.now()){
  let d;try{d=JSON.parse(offer.effective_price_json??'{}');}catch{return offer;}
  if(d.basis!=='crazyrouter_public_usd_credit'||!d.timePricing)return offer;
  try{const v=crazyTimePrices(d.timePricing,d.totalFactor,at);return {...offer,input_price:v.inputPrice,output_price:v.outputPrice,cache_read_price:v.cacheReadPrice,
    effective_price_json:JSON.stringify({...d,currentTier:v.currentTier,tiers:v.tiers,chargeItems:v.chargeItems})};}
  catch{return {...offer,input_price:null,output_price:null,cache_read_price:null};}
}
