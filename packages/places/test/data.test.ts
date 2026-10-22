import { describe, expect, it } from "vitest";
import { CITIES, LANDMARKS } from "../src/data";

describe("landmarks", () => {
  it("has the prototype's 28 landmarks with finite coordinates and sane radii", () => {
    expect(LANDMARKS).toHaveLength(28);
    for (const l of LANDMARKS) {
      expect(Number.isFinite(l.lat)).toBe(true);
      expect(Number.isFinite(l.lng)).toBe(true);
      expect(l.radiusM).toBeGreaterThanOrEqual(250);
      expect(l.radiusM).toBeLessThanOrEqual(1500);
      expect(l.name.length).toBeGreaterThan(0);
      expect(l.region.length).toBeGreaterThan(0);
    }
  });
  it("starts with the Golden Gate Bridge and ends with Petra", () => {
    expect(LANDMARKS[0]).toEqual({ name: "Golden Gate Bridge", region: "San Francisco", lat: 37.8199, lng: -122.4783, radiusM: 1500 });
    expect(LANDMARKS[27]).toEqual({ name: "Petra", region: "Jordan", lat: 30.3285, lng: 35.4444, radiusM: 1500 });
  });
});

describe("cities", () => {
  it("has the prototype's 10,379 cities with finite coordinates, largest first", () => {
    expect(CITIES).toHaveLength(10379);
    for (const [name, region, lat, lng] of CITIES) {
      expect(name.length).toBeGreaterThan(0);
      expect(typeof region).toBe("string");
      expect(Number.isFinite(lat)).toBe(true);
      expect(Number.isFinite(lng)).toBe(true);
    }
    expect(CITIES[0]).toEqual(["Shanghai", "China", 31.222, 121.458]);
  });
  it("city keys are unique", () => {
    expect(new Set(CITIES.map(([n, r, la, ln]) => `${n}, ${r}@${la},${ln}`)).size).toBe(CITIES.length);
  });
  it("carries US cities with their state as the region", () => {
    expect(CITIES.find(([name, region]) => name === "San Francisco" && region === "California")).toBeDefined();
    expect(CITIES.find(([name, region]) => name === "Seoul" && region === "South Korea")).toBeDefined();
  });
});
