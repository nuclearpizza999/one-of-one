import { describe, expect, it } from "vitest";
import { distanceM } from "../src/geo";

describe("distanceM", () => {
  it("is zero for the same point", () => {
    expect(distanceM(37.5563, 126.9236, 37.5563, 126.9236)).toBe(0);
  });
  it("matches a known pair within a metre per kilometre", () => {
    // Golden Gate Bridge to the Eiffel Tower, 8,949 km by haversine on a 6,371 km sphere.
    const d = distanceM(37.8199, -122.4783, 48.8584, 2.2945);
    expect(d).toBeGreaterThan(8_940_000);
    expect(d).toBeLessThan(8_970_000);
  });
  it("is about 111.2 km per degree of latitude", () => {
    expect(distanceM(0, 0, 1, 0)).toBeCloseTo(111_195, -2);
  });
  it("is symmetric", () => {
    expect(distanceM(10, 20, 30, 40)).toBeCloseTo(distanceM(30, 40, 10, 20), 6);
  });
});
