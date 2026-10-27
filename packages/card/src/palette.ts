import { GREY_SATURATION, hslToHex, rgbToHsl } from "./colour";
import { NEUTRAL_PALETTE, type Palette } from "./variation";

export { GREY_SATURATION } from "./colour";

/**
 * The photo's edge colours as a border palette. Reads the outer ring (one eighth
 * of the smaller dimension on each side), averages hue as a saturation-weighted
 * vector, and returns a mat-friendly tint plus light and dark foil stops.
 * Null when the ring is transparent or the buffer is too small; neutral for grey.
 */
export function paletteFromPixels(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Palette | null {
  if (width <= 0 || height <= 0 || rgba.length < width * height * 4) return null;
  const ring = Math.max(1, Math.round(Math.min(width, height) / 8));
  let vx = 0;
  let vy = 0;
  let sumS = 0;
  let n = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= ring && x < width - ring && y >= ring && y < height - ring) continue;
      const i = (y * width + x) * 4;
      if (rgba[i + 3]! < 128) continue;
      const [h, s] = rgbToHsl(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!);
      vx += Math.cos(2 * Math.PI * h) * s;
      vy += Math.sin(2 * Math.PI * h) * s;
      sumS += s;
      n += 1;
    }
  }
  if (n === 0) return null;
  const meanS = sumS / n;
  if (meanS < GREY_SATURATION) return NEUTRAL_PALETTE;
  let hue = Math.atan2(vy, vx) / (2 * Math.PI);
  if (hue < 0) hue += 1;
  const sat = Math.min(0.45, Math.max(0.15, meanS * 0.7));
  return { tint: hslToHex(hue, sat, 0.5), foil: [hslToHex(hue, sat, 0.84), hslToHex(hue, sat, 0.58)] };
}
