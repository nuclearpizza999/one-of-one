import { describe, expect, it } from "vitest";
import { captureInstant, sunElevation } from "../src/sun";

const SEOUL = { lat: 37.5563, lng: 126.9236 };
const SYDNEY = { lat: -33.8688, lng: 151.2093 };
const TROMSO = { lat: 69.6492, lng: 18.9553 };
const elevation = (d: Date, offset: number, p: { lat: number; lng: number }) => sunElevation(captureInstant(d, offset), p.lat, p.lng);

describe("captureInstant", () => {
  it("subtracts the offset from the zone-free wall-clock", () => {
    expect(captureInstant(new Date(2026, 6, 1, 14, 30), 540)).toBe(Date.UTC(2026, 6, 1, 5, 30));
    expect(captureInstant(new Date(2026, 6, 1, 14, 30), -330)).toBe(Date.UTC(2026, 6, 1, 20, 0));
    expect(captureInstant(new Date(2026, 6, 1, 14, 30), 0)).toBe(Date.UTC(2026, 6, 1, 14, 30));
  });
});

describe("sunElevation", () => {
  it("is nearly overhead at an equinox noon on the equator", () => {
    let max = -90;
    for (let m = 0; m < 1440; m += 1) max = Math.max(max, sunElevation(Date.UTC(2026, 2, 20, 0, m), 0, 0));
    expect(max).toBeGreaterThan(89.5);
  });
  it("is 90 − lat + 23.44 at Seoul's June solstice noon and lat + 23.44 − 90 at its midnight", () => {
    expect(Math.abs(elevation(new Date(2026, 5, 21, 12, 34), 540, SEOUL) - 75.88)).toBeLessThan(0.5);
    expect(Math.abs(elevation(new Date(2026, 5, 21, 0, 34), 540, SEOUL) - -29.0)).toBeLessThan(0.5);
  });
  it("is low at a southern-hemisphere winter noon", () => {
    expect(Math.abs(elevation(new Date(2026, 5, 21, 11, 57), 600, SYDNEY) - 32.69)).toBeLessThan(0.5);
  });
  it("stays above the horizon at a polar summer midnight", () => {
    expect(Math.abs(elevation(new Date(2026, 5, 22, 0, 46), 120, TROMSO) - 3.09)).toBeLessThan(0.5);
  });
  it("is negative in the middle of the night and positive mid-afternoon", () => {
    expect(elevation(new Date(2026, 2, 15, 2, 0), 540, SEOUL)).toBeLessThan(-20);
    expect(elevation(new Date(2026, 2, 15, 15, 0), 540, SEOUL)).toBeGreaterThan(20);
  });
});
