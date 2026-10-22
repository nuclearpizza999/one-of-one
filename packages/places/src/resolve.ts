import { CITIES, LANDMARKS, type City, type Landmark } from "./data";
import { distanceM } from "./geo";

export type PlaceKind = "venue" | "landmark" | "neighborhood" | "city";

export interface PlaceMatch {
  kind: PlaceKind;
  name: string;
  region: string;
  /** The caption's place line. */
  label: string;
  /** Stable id for numbering: kind, label and the place's own coordinates, so two places with one name never share a pool. */
  key: string;
  /** The place's own coordinates, never the photo's. */
  lat: number;
  lng: number;
  /** Photo to place, in metres. */
  distanceM: number;
}

/**
 * The two tiers that need a places or geocoding API. Step 3 ships only the stub.
 * A provider that rejects is treated as no match, so an API outage still resolves to a landmark or city.
 */
export interface PlaceProvider {
  venueNear(lat: number, lng: number, radiusM: number): Promise<PlaceMatch | null>;
  neighborhoodAt(lat: number, lng: number): Promise<PlaceMatch | null>;
}

export const noProvider: PlaceProvider = {
  venueNear: async () => null,
  neighborhoodAt: async () => null,
};

export interface PlaceData {
  landmarks: readonly Landmark[];
  cities: readonly City[];
}

const DEFAULT_DATA: PlaceData = { landmarks: LANDMARKS, cities: CITIES };

export const VENUE_RADIUS_M = 75;
export const CITY_RADIUS_M = 60_000;

export function placeLabel(name: string, region: string): string {
  return `${name}, ${region}`;
}

export function placeKey(kind: PlaceKind, label: string, lat: number, lng: number): string {
  return `${kind}:${label}@${lat},${lng}`;
}

function match(kind: PlaceKind, name: string, region: string, lat: number, lng: number, d: number): PlaceMatch {
  const label = placeLabel(name, region);
  return { kind, name, region, label, key: placeKey(kind, label, lat, lng), lat, lng, distanceM: d };
}

/**
 * SPEC.md's place hierarchy, top-down, first hit wins:
 * venue (provider, 75 m) → landmark (own radius) → neighborhood (provider) → city (60 km) → null.
 */
export async function resolvePlace(
  lat: number,
  lng: number,
  provider: PlaceProvider = noProvider,
  data: PlaceData = DEFAULT_DATA,
): Promise<PlaceMatch | null> {
  const venue = await provider.venueNear(lat, lng, VENUE_RADIUS_M).catch(() => null);
  if (venue) return venue;

  for (const l of data.landmarks) {
    const d = distanceM(lat, lng, l.lat, l.lng);
    if (d <= l.radiusM) return match("landmark", l.name, l.region, l.lat, l.lng, d);
  }

  const hood = await provider.neighborhoodAt(lat, lng).catch(() => null);
  if (hood) return hood;

  let best: City | null = null;
  let bestD = Infinity;
  for (const c of data.cities) {
    const d = distanceM(lat, lng, c[2], c[3]);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (best && bestD <= CITY_RADIUS_M) return match("city", best[0], best[1], best[2], best[3], bestD);
  return null;
}
