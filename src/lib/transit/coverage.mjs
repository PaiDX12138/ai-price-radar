const aliases={
  chatgpt:["gpt","chatgpt","openai","codex"],claude:["claude","anthropic"],gemini:["gemini","google","imagen","banana","veo"],
  grok:["grok","xai"],glm:["glm","智谱","zhipu"],deepseek:["deepseek"],kimi:["kimi","moonshot"],qwen:["qwen","千问"],
};
export function matchesLiveOffer(offer,id) {
  if(id==="all")return true;
  if(id==="image"||id==="video")return offer.modality===id;
  if(offer.modality!=="text")return false;
  const text=`${offer.family??""} ${offer.raw_model??""}`.toLowerCase();
  const match=k=>(aliases[k]??[]).some(a=>text.includes(a));
  return id==="other"?!Object.keys(aliases).some(match):match(id);
}
export function availableTransitTabIds(offers) {
  return ["all",...Object.keys(aliases),"image","video","other"].filter(id=>id==="all"||offers.some(o=>matchesLiveOffer(o,id)));
}
