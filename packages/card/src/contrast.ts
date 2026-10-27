import { CARD } from "./layout";
import type { Palette } from "./variation";

/*
 * The caption contrast floor (SPEC.md, "Card variation"). A texture may put any
 * of its colours under the caption, so the darkest colour a palette can paint
 * must keep the caption readable: WCAG body-text contrast for the place and
 * date lines in the caption ink, large-text contrast for the lighter
 * coordinates line. The neutral grey clears it as written; a palette made from
 * a photo's colours, nudged or not, is lightened until it does.
 */

export const CAPTION_INK = CARD.ink;
export const COORDS_INK = CARD.inkCoords;
export const CAPTION_MIN_CONTRAST = 4.5;
export const COORDS_MIN_CONTRAST = 3;

function channels(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function linear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a hex colour: 0 for black, 1 for white. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio between two hex colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** True when both caption inks keep their floor over this colour. */
export function clearsCaptionFloor(hex: string): boolean {
  return contrastRatio(hex, CAPTION_INK) >= CAPTION_MIN_CONTRAST && contrastRatio(hex, COORDS_INK) >= COORDS_MIN_CONTRAST;
}

const toHex = (v: number): string => Math.round(v).toString(16).padStart(2, "0");

/** The colour mixed toward white in hundredths until it clears the floor; unchanged when it already does. Mixing keeps the hue. */
export function lightenToCaptionFloor(hex: string): string {
  if (clearsCaptionFloor(hex)) return hex;
  const [r, g, b] = channels(hex);
  for (let step = 1; step < 100; step += 1) {
    const t = step / 100;
    const mixed = `#${toHex(r + (255 - r) * t)}${toHex(g + (255 - g) * t)}${toHex(b + (255 - b) * t)}`;
    if (clearsCaptionFloor(mixed)) return mixed;
  }
  return "#ffffff";
}

/**
 * The palette with both foil stops and the wash clearing the floor: the same
 * object when they already do, lightened copies otherwise. A palette without a
 * wash stays without one. The tint only ever colours noise and pattern ink at
 * low opacity over the mat, so it is left as sampled.
 */
export function withCaptionContrast(p: Palette): Palette {
  const foil = [lightenToCaptionFloor(p.foil[0]), lightenToCaptionFloor(p.foil[1])] as const;
  const wash = p.wash === undefined ? undefined : lightenToCaptionFloor(p.wash);
  if (foil[0] === p.foil[0] && foil[1] === p.foil[1] && wash === p.wash) return p;
  return wash === undefined ? { tint: p.tint, foil } : { tint: p.tint, foil, wash };
}
