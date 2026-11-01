/** No sponsorship, station ID, marketing benefit or collection timestamp weight. */
export function compareTransitStationOrder(left,right,leftHasQuotes=true,rightHasQuotes=true) {
  if(leftHasQuotes!==rightHasQuotes)return leftHasQuotes?-1:1;
  const time=value=>{const n=Date.parse(value??'');return Number.isFinite(n)?n:Infinity;};
  const a=time(left.listed_at),b=time(right.listed_at);
  if(a!==b)return a<b?-1:1;
  const name=String(left.name??'').toLowerCase().localeCompare(String(right.name??'').toLowerCase(),'en');
  return name||String(left.id??'').localeCompare(String(right.id??''),'en');
}

export function hasTransitQuote(offer) {
  return [offer.input_price,offer.output_price,offer.fixed_price,offer.model_price_min,offer.model_price_max]
    .some(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0);
}

/** One ordering contract for exported snapshots, public APIs and server views. */
export function orderTransitStations(stations,groups,offers) {
  const groupStations=new Map(groups.map(g=>[g.id,g.station_id]));
  const priced=new Set(offers.filter(hasTransitQuote).map(o=>groupStations.get(o.group_id)));
  return [...stations].sort((a,b)=>compareTransitStationOrder(a,b,priced.has(a.id),priced.has(b.id)));
}
