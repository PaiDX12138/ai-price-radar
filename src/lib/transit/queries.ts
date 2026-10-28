import "server-only";
import {loadTransitSnapshot} from "./snapshot";
import type {TransitSite} from "./types";
import {toTransitView} from "./view";
import {loadTransitModelCatalog} from "./model-catalog";

export function listTransitSites(): TransitSite[] {
  const snapshot=loadTransitSnapshot();
  if(!snapshot) return [];
  const offersByGroup=new Map<string,typeof snapshot.offers>();
  for(const offer of snapshot.offers) {
    const rows=offersByGroup.get(offer.group_id)??[];rows.push(offer);offersByGroup.set(offer.group_id,rows);
  }
  const groupsByStation=new Map<string,TransitSite["groups"]>();
  for(const group of snapshot.groups) {
    const rows=groupsByStation.get(group.station_id)??[];
    const offers=offersByGroup.get(group.id)??[];
    if(offers.length) rows.push({group,offers});
    groupsByStation.set(group.station_id,rows);
  }
  const performance=snapshot.performance??[];
  return snapshot.stations.map(station=>({station,groups:groupsByStation.get(station.id)??[],performance:performance.find(row=>row.stationId===station.id)}));
}
export function listTransitViews() {const catalog=loadTransitModelCatalog();return listTransitSites().map(site=>toTransitView(site,catalog));}
export function getTransitSite(id:string) {
  const site=listTransitSites().find(s=>s.station.id===id);
  return site?toTransitView(site,loadTransitModelCatalog(),{includeModelMonitors:true}):undefined;
}
