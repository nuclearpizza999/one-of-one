import { describe, expect, it } from "vitest";
import {
  CAPTION_INK,
  CAPTION_MIN_CONTRAST,
  COORDS_INK,
  COORDS_MIN_CONTRAST,
  contrastRatio,
  relativeLuminance,
  withCaptionContrast,
} from "../src/contrast";
import { TONES } from "../src/variation";

const channels = (hex: string) => [1, 3, 5].map((k) => Number.parseInt(hex.slice(k, k + 2), 16));

describe("relativeLuminance", () => {
  it("is 0 for black, 1 for white, and sRGB-linear in between", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 6);
    expect(relativeLuminance("#808080")).toBeCloseTo(0.2159, 3);
    expect(relativeLuminance("#111")).toBeCloseTo(relativeLuminance("#111111"), 10);
  });
});

describe("contrastRatio", () => {
  it("follows WCAG: 21 for black on white, symmetric, 4.5 at the familiar grey", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 6);
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21, 6);
    expect(contrastRatio("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#777777", "#ffffff")).toBeLessThan(4.5);
  });
});

describe("withCaptionContrast", () => {
  it("returns the same palette when both foil stops already clear the floor", () => {
    const warm = { tint: TONES.warm.tint, foil: TONES.warm.foil };
    expect(withCaptionContrast(warm)).toBe(warm);
  });
  it("leaves every preset tone as written", () => {
    for (const t of Object.values(TONES)) {
      if (t.source !== "preset") continue;
      const p = { tint: t.tint, foil: t.foil };
      expect(withCaptionContrast(p), t.id).toBe(p);
      expect(contrastRatio(t.foil[1], CAPTION_INK), t.id).toBeGreaterThanOrEqual(CAPTION_MIN_CONTRAST);
      expect(contrastRatio(t.foil[1], COORDS_INK), t.id).toBeGreaterThanOrEqual(COORDS_MIN_CONTRAST);
    }
  });
  it("lightens a dark stop just enough to clear both floors and keeps its hue and the tint", () => {
    const dark = { tint: "#223355", foil: ["#8899bb", "#223355"] as const };
    const p = withCaptionContrast(dark);
    expect(p.tint).toBe(dark.tint);
    expect(p.foil[0]).toBe(dark.foil[0]);
    expect(p.foil[1]).not.toBe(dark.foil[1]);
    expect(contrastRatio(p.foil[1], CAPTION_INK)).toBeGreaterThanOrEqual(CAPTION_MIN_CONTRAST);
    expect(contrastRatio(p.foil[1], COORDS_INK)).toBeGreaterThanOrEqual(COORDS_MIN_CONTRAST);
    // Just enough: one step darker would fail a floor.
    expect(contrastRatio(p.foil[1], CAPTION_INK)).toBeLessThan(CAPTION_MIN_CONTRAST + 0.2);
    const [r, g, b] = channels(p.foil[1]);
    expect(b).toBeGreaterThan(r!);
    expect(b).toBeGreaterThan(g!);
  });
  it("lightens the light stop too when a palette is dark all over", () => {
    const p = withCaptionContrast({ tint: "#102030", foil: ["#203040", "#101820"] });
    for (const stop of p.foil) {
      expect(contrastRatio(stop, CAPTION_INK)).toBeGreaterThanOrEqual(CAPTION_MIN_CONTRAST);
      expect(contrastRatio(stop, COORDS_INK)).toBeGreaterThanOrEqual(COORDS_MIN_CONTRAST);
    }
  });
});
