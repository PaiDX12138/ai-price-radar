import type {TransitStation, TransitGroup, TransitOffer, TransitPerformanceSnapshot} from "./snapshot";
export type TransitSite = {
  station: TransitStation;
  groups: {group: TransitGroup; offers: TransitOffer[]}[];
  performance?: TransitPerformanceSnapshot;
};
