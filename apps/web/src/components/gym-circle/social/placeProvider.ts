export type PlaceProvider =
  | "registered"
  | "nominatim"
  | "overpass"
  | "google"
  | "apple"
  | "mapbox"
  | "community"
  | "manual"
  | "current";

export type CatalogPlaceInput = {
  name: string;
  address?: string | null;
  neighborhood?: string | null;
  city: string;
  state?: string | null;
  latitude: number;
  longitude: number;
  provider: PlaceProvider;
  providerId: string;
  kind: string;
};
