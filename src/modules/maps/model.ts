export interface ParcelQuery {
  city: string;
  district: string;
  neighbourhood: string;
  block: string;
  parcel: string;
}
export interface GeoPoint {
  latitude: number;
  longitude: number;
}
export interface ParcelBoundary {
  query: ParcelQuery;
  coordinates: GeoPoint[];
  source: string;
}
