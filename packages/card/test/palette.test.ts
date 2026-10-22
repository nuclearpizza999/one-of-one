import { describe, expect, it } from "vitest";
import { paletteFromPixels } from "../src/palette";
import { NEUTRAL_PALETTE } from "../src/variation";

type Rgb = [number, number, number];

/** A width × height RGBA image: `ring` colour on the outer eighth, `centre` inside. */
function image(width: number, height: number, ring: Rgb, centre: Rgb, alpha = 255): Uint8ClampedArray {
  const r = Math.max(1, Math.round(Math.min(width, height) / 8));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inRing = x < r || x >= width - r || y < r || y >= height - r;
      const [cr, cg, cb] = inRing ? ring : centre;
      const i = (y * width + x) * 4;
      data[i] = cr; data[i + 1] = cg; data[i + 2] = cb; data[i + 3] = alpha;
    }
  }
  return data;
}

const channels = (hex: string): Rgb => [1, 3, 5].map((k) => Number.parseInt(hex.slice(k, k + 2), 16)) as Rgb;

describe("paletteFromPixels", () => {
  it("takes its hue from the outer ring, not the centre", () => {
    const p = paletteFromPixels(image(32, 32, [40, 80, 220], [220, 40, 40]), 32, 32);
    expect(p).not.toBeNull();
    const [r, g, b] = channels(p!.tint);
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
    const light = channels(p!.foil[0]).reduce((a, c) => a + c, 0);
    const dark = channels(p!.foil[1]).reduce((a, c) => a + c, 0);
    expect(light).toBeGreaterThan(dark);
  });
  it("ignores the centre entirely", () => {
    const a = paletteFromPixels(image(32, 32, [40, 80, 220], [220, 40, 40]), 32, 32);
    const b = paletteFromPixels(image(32, 32, [40, 80, 220], [10, 200, 10]), 32, 32);
    expect(a).toEqual(b);
  });
  it("returns the neutral palette for a grey photo", () => {
    expect(paletteFromPixels(image(32, 32, [128, 128, 128], [200, 200, 200]), 32, 32)).toEqual(NEUTRAL_PALETTE);
  });
  it("returns null when the ring is transparent", () => {
    expect(paletteFromPixels(image(32, 32, [40, 80, 220], [220, 40, 40], 0), 32, 32)).toBeNull();
  });
  it("returns null for an empty or short buffer", () => {
    expect(paletteFromPixels(new Uint8ClampedArray(0), 0, 0)).toBeNull();
    expect(paletteFromPixels(new Uint8ClampedArray(8), 32, 32)).toBeNull();
  });
  it("keeps the tint mat-friendly rather than fully saturated", () => {
    const p = paletteFromPixels(image(32, 32, [255, 0, 0], [255, 0, 0]), 32, 32)!;
    expect(p.tint).not.toBe("#ff0000");
    const [r, g, b] = channels(p.tint);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(160);
  });
  it("is deterministic", () => {
    const img = image(24, 40, [200, 160, 40], [0, 0, 0]);
    expect(paletteFromPixels(img, 24, 40)).toEqual(paletteFromPixels(img, 24, 40));
  });
});
