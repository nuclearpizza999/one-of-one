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
import { hslToHex } from "../src/colour";
import { NEUTRAL_PALETTE, TONES, type Tone, paletteFor } from "../src/variation";

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
  it("returns the same palette when both foil stops and the wash already clear the floor", () => {
    const light = { tint: "#b08860", foil: ["#f3d9a4", "#b8864a"] as const, wash: "#f1ebe4" };
    expect(withCaptionContrast(light)).toBe(light);
    const noWash = { tint: "#b08860", foil: ["#f3d9a4", "#b8864a"] as const };
    expect(withCaptionContrast(noWash)).toBe(noWash);
  });
  it("leaves the neutral grey as written", () => {
    expect(withCaptionContrast(NEUTRAL_PALETTE)).toBe(NEUTRAL_PALETTE);
  });
  it("lightens a dark wash and keeps a palette without one without one", () => {
    const p = withCaptionContrast({ tint: "#223355", foil: ["#c8d4ee", "#8899bb"], wash: "#223355" });
    expect(contrastRatio(p.wash!, CAPTION_INK)).toBeGreaterThanOrEqual(CAPTION_MIN_CONTRAST);
    expect(contrastRatio(p.wash!, COORDS_INK)).toBeGreaterThanOrEqual(COORDS_MIN_CONTRAST);
    expect("wash" in withCaptionContrast({ tint: "#223355", foil: ["#8899bb", "#223355"] })).toBe(false);
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

describe("the caption floor over every tone", () => {
  it("holds for the wash and both foil stops across a sweep of sampled colours", () => {
    for (let hue = 0; hue < 360; hue += 15) {
      for (const s of [0.15, 0.3, 0.45]) {
        for (const l of [0.3, 0.5, 0.7]) {
          const h = hue / 360;
          const sample = { tint: hslToHex(h, s, l), foil: [hslToHex(h, s, 0.84), hslToHex(h, s, l * 0.9)] as const };
          for (const tone of Object.keys(TONES) as Tone[]) {
            const p = paletteFor(tone, sample);
            for (const c of [p.wash!, ...p.foil]) {
              const label = `${tone} ${hue}/${s}/${l} ${c}`;
              expect(contrastRatio(c, CAPTION_INK), label).toBeGreaterThanOrEqual(CAPTION_MIN_CONTRAST);
              expect(contrastRatio(c, COORDS_INK), label).toBeGreaterThanOrEqual(COORDS_MIN_CONTRAST);
            }
          }
        }
      }
    }
  });
});
