import { NEUTRAL_PALETTE, type Palette } from "./variation";

/** Below this mean saturation the photo counts as grey and gets the neutral palette. */
export const GREY_SATURATION = 0.08;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  return [h / 6, s, l];
}

function hue2rgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToHex(h: number, s: number, l: number): string {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const toHex = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
  return `#${toHex(hue2rgb(p, q, h + 1 / 3))}${toHex(hue2rgb(p, q, h))}${toHex(hue2rgb(p, q, h - 1 / 3))}`;
}

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
