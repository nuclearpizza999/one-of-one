import { CARD } from "./layout";
import { type BorderDraw, TEXTURES } from "./textures";
import { TIERS, type Variation } from "./variation";

/** Width of the outer band, in card units, that carries foil, wear and the sheen. */
export const BAND_UNITS = 2;

/** Small, fast, deterministic PRNG in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number): string => Number(n.toFixed(3)).toString();

/**
 * The border as one SVG document in card units (viewBox 0 0 100 H). Everything
 * drawn sits in one of two clip groups: the mat minus the photo box, or the
 * outer band. The photo box is never painted. Both painters render this
 * same document, so screen and print match by construction.
 */
export function borderSvg(v: Variation, cardHeightUnits: number): string {
  const H = Number(cardHeightUnits.toFixed(3));
  const photo = {
    x: CARD.mat,
    y: CARD.mat,
    w: CARD.photoWidth,
    h: Number((H - CARD.mat - CARD.stripHeight).toFixed(3)),
  };
  const d: BorderDraw = {
    seed: v.seed >>> 0,
    rng: mulberry32(v.seed),
    palette: v.palette,
    tier: TIERS[v.tier],
    width: 100,
    height: H,
    band: BAND_UNITS,
    photo,
  };
  const frag = TEXTURES[v.texture].draw(d);
  const B = BAND_UNITS;
  const matClip = `<clipPath id="mat"><path clip-rule="evenodd" d="M0 0H100V${f(H)}H0Z M${f(photo.x)} ${f(photo.y)}h${f(photo.w)}v${f(photo.h)}h-${f(photo.w)}Z"/></clipPath>`;
  const bandClip = `<clipPath id="band"><path clip-rule="evenodd" d="M0 0H100V${f(H)}H0Z M${B} ${B}H${100 - B}V${f(H - B)}H${B}Z"/></clipPath>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ${f(H)}" width="100" height="${f(H)}">` +
    `<defs>${matClip}${bandClip}${frag.defs}</defs>` +
    `<g clip-path="url(#mat)">${frag.mat}</g>` +
    `<g clip-path="url(#band)">${frag.band}</g>` +
    `</svg>`
  );
}

/** The document as an image URL for an <img> or a canvas drawImage. */
export function borderDataUrl(v: Variation, cardHeightUnits: number): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(borderSvg(v, cardHeightUnits))}`;
}
