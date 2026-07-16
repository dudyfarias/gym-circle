import { appleProvider } from "./apple.mjs";
import { googleProvider } from "./google.mjs";
import { mapboxProvider } from "./mapbox.mjs";
import { osmProvider } from "./osm.mjs";

export const providers = new Map(
  [appleProvider, googleProvider, mapboxProvider, osmProvider].map((provider) => [
    provider.id,
    provider,
  ]),
);
