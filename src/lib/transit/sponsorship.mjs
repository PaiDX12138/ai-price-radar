/** Explicit, local editorial metadata. Never infer sponsorship from rank or URL.
 * @returns {{affiliateUrl?:string,code?:string,benefit?:string}|null}
 */
export function normalizeTransitSponsorship(value) {
  if(value==null)return null;
  if(typeof value!=='object'||Array.isArray(value))throw new Error('invalid_transit_sponsorship');
  const result={};
  if(value.affiliateUrl!=null){
    const url=new URL(value.affiliateUrl);
    if(url.protocol!=='https:'||url.username||url.password)throw new Error('invalid_transit_affiliate_url');
    result.affiliateUrl=url.href;
  }
  for(const key of ['code','benefit']){
    if(value[key]!=null){
      if(typeof value[key]!=='string'||!value[key].trim()||value[key].length>160)throw new Error('invalid_transit_sponsorship_'+key);
      result[key]=value[key].trim();
    }
  }
  return result;
}
