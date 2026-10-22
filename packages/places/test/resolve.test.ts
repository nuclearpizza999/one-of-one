import { describe, expect, it } from "vitest";
import type { City, Landmark } from "../src/data";
import {
  CITY_RADIUS_M,
  type PlaceData,
  type PlaceMatch,
  type PlaceProvider,
  VENUE_RADIUS_M,
  noProvider,
  placeLabel,
  resolvePlace,
} from "../src/resolve";

// A tiny world: one landmark at the origin with a 500 m radius, one city 10 km east.
const tiny: PlaceData = {
  landmarks: [{ name: "Obelisk", region: "Nowhere", lat: 0, lng: 0, radiusM: 500 } satisfies Landmark],
  cities: [["Eastville", "Nowhere", 0, 0.09] satisfies City],
};
const KM_PER_DEG_LAT = 111.195;

function stub(venue: PlaceMatch | null, neighborhood: PlaceMatch | null): PlaceProvider {
  return {
    venueNear: async () => venue,
    neighborhoodAt: async () => neighborhood,
  };
}
const venue: PlaceMatch = {
  kind: "venue", name: "Zuni Café", region: "San Francisco", label: "Zuni Café, San Francisco",
  key: "venue:Zuni Café, San Francisco", lat: 0, lng: 0, distanceM: 20,
};
const hood: PlaceMatch = {
  kind: "neighborhood", name: "Hongdae", region: "Seoul", label: "Hongdae, Seoul",
  key: "neighborhood:Hongdae, Seoul", lat: 0, lng: 0, distanceM: 0,
};

describe("placeLabel", () => {
  it("joins name and region with a comma", () => {
    expect(placeLabel("Seoul", "South Korea")).toBe("Seoul, South Korea");
  });
});

describe("resolvePlace with real data", () => {
  it("finds the Golden Gate Bridge from a point on it", async () => {
    const m = await resolvePlace(37.8199, -122.4783);
    expect(m).toMatchObject({ kind: "landmark", label: "Golden Gate Bridge, San Francisco", key: "landmark:Golden Gate Bridge, San Francisco@37.8199,-122.4783" });
    expect(m!.distanceM).toBeLessThan(5);
  });
  it("finds Seoul from a street in Hongdae", async () => {
    const m = await resolvePlace(37.5563, 126.9236);
    expect(m).toMatchObject({ kind: "city", name: "Seoul", region: "South Korea", label: "Seoul, South Korea", key: "city:Seoul, South Korea@37.566,126.978" });
    expect(m!.lat).toBeCloseTo(37.5, 0);
  });
  it("gives the state for a US city", async () => {
    const m = await resolvePlace(37.7749, -122.4194);
    expect(m).toMatchObject({ kind: "city", label: "San Francisco, California" });
  });
  it("finds nothing in the middle of the Pacific", async () => {
    expect(await resolvePlace(0, -140)).toBeNull();
  });
});

describe("resolvePlace tiers with a tiny world", () => {
  it("prefers a landmark inside its radius", async () => {
    const m = await resolvePlace(0.002, 0, noProvider, tiny);
    expect(m).toMatchObject({ kind: "landmark", label: "Obelisk, Nowhere" });
    expect(m!.distanceM).toBeCloseTo(222, -1);
  });
  it("falls to the city just outside the landmark radius", async () => {
    const m = await resolvePlace(0.006, 0, noProvider, tiny);
    expect(m).toMatchObject({ kind: "city", label: "Eastville, Nowhere", lat: 0, lng: 0.09 });
  });
  it("accepts a city 59 km away and rejects one 61 km away", async () => {
    const near = await resolvePlace(59 / KM_PER_DEG_LAT, 0.09, noProvider, tiny);
    expect(near).toMatchObject({ kind: "city", name: "Eastville" });
    expect(near!.distanceM).toBeLessThan(CITY_RADIUS_M);
    const far = await resolvePlace(61 / KM_PER_DEG_LAT, 0.09, noProvider, tiny);
    expect(far).toBeNull();
  });
  it("lets a venue from the provider win over a landmark at the same point", async () => {
    const m = await resolvePlace(0, 0, stub(venue, null), tiny);
    expect(m).toBe(venue);
  });
  it("asks the provider for a venue within 75 m", async () => {
    let asked: number | null = null;
    const p: PlaceProvider = { venueNear: async (_a, _b, r) => { asked = r; return null; }, neighborhoodAt: async () => null };
    await resolvePlace(0, 0, p, tiny);
    expect(asked).toBe(VENUE_RADIUS_M);
  });
  it("lets a neighborhood win over the city when no landmark matches", async () => {
    const m = await resolvePlace(0.006, 0, stub(null, hood), tiny);
    expect(m).toBe(hood);
  });
  it("does not ask for a neighborhood when a landmark already matched", async () => {
    let askedHood = false;
    const p: PlaceProvider = { venueNear: async () => null, neighborhoodAt: async () => { askedHood = true; return hood; } };
    const m = await resolvePlace(0.001, 0, p, tiny);
    expect(m!.kind).toBe("landmark");
    expect(askedHood).toBe(false);
  });
  it("a rejecting venue provider falls through to the landmark", async () => {
    const p: PlaceProvider = { venueNear: () => Promise.reject(new Error("outage")), neighborhoodAt: async () => null };
    const m = await resolvePlace(0.001, 0, p, tiny);
    expect(m!.kind).toBe("landmark");
  });
  it("a provider that throws synchronously falls through", async () => {
    const p = { venueNear: () => { throw new Error("boom"); }, neighborhoodAt: async () => null } as unknown as PlaceProvider;
    const m = await resolvePlace(0.001, 0, p, tiny);
    expect(m!.kind).toBe("landmark");
  });
  it("a rejecting neighborhood provider falls through to the city", async () => {
    const p: PlaceProvider = { venueNear: async () => null, neighborhoodAt: () => Promise.reject(new Error("outage")) };
    const m = await resolvePlace(0.006, 0, p, tiny);
    expect(m!.kind).toBe("city");
  });
});
