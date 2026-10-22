import landmarksJson from "../data/landmarks.json";
import citiesJson from "../data/cities.json";

export interface Landmark {
  name: string;
  region: string;
  lat: number;
  lng: number;
  /** Match radius: a photo within it is "at" the landmark. */
  radiusM: number;
}

/** [name, region, lat, lng]; region is the country, or the state for US cities. Largest first. */
export type City = readonly [name: string, region: string, lat: number, lng: number];

export const LANDMARKS: readonly Landmark[] = landmarksJson as Landmark[];
export const CITIES: readonly City[] = citiesJson as unknown as City[];
