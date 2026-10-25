import type { Palette, TierDef } from "./variation";

/** What a texture's draw function receives. Everything is in card units (the card is 100 wide). */
export interface BorderDraw {
  seed: number;
  /** Seeded generator in [0, 1): the only source of randomness. */
  rng: () => number;
  palette: Palette;
  tier: TierDef;
  width: number;
  height: number;
  /** The photo box: the one area the border never paints. */
  photo: { x: number; y: number; w: number; h: number };
}

/** SVG fragments: `defs` go in <defs>; `mat` is clipped to the whole mat, around the photo and under the caption, minus the photo box. */
export interface TextureFragments {
  defs: string;
  mat: string;
}

export interface TextureDef {
  id: string;
  label: string;
  draw(d: BorderDraw): TextureFragments;
}

const f = (n: number): string => Number(n.toFixed(3)).toString();

function hexToRgb01(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Seeded fractal noise over the whole card, coloured with the palette tint and scaled to `alpha`. */
function noiseFilter(id: string, d: BorderDraw, alpha: number, baseFrequency: number, numOctaves: number): { def: string; use: string } {
  const [r, g, b] = hexToRgb01(d.palette.tint);
  const seed = d.seed % 10000;
  const def =
    `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${baseFrequency}" numOctaves="${numOctaves}" seed="${seed}" stitchTiles="stitch" result="noise"/>` +
    `<feColorMatrix in="noise" type="matrix" values="0 0 0 0 ${r.toFixed(3)} 0 0 0 0 ${g.toFixed(3)} 0 0 0 0 ${b.toFixed(3)} 0 0 0 ${alpha} 0"/>` +
    `</filter>`;
  const use = `<rect x="0" y="0" width="${f(d.width)}" height="${f(d.height)}" fill="#fff" filter="url(#${id})"/>`;
  return { def, use };
}

/** Fine noise, 2.5 cycles per card unit: paper tooth that reads at print size. */
export function grainFilter(id: string, d: BorderDraw, alpha: number, baseFrequency = 2.5): { def: string; use: string } {
  return noiseFilter(id, d, alpha, baseFrequency, 3);
}

/** Coarse noise, features a few units wide: soft mottling that reads on a phone, where the fine grain is smaller than a pixel. */
export function mottleFilter(id: string, d: BorderDraw, alpha: number, baseFrequency = 0.45): { def: string; use: string } {
  return noiseFilter(id, d, alpha, baseFrequency, 2);
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The mat as four boxes around the photo: above it, left and right of it, and the caption strip below. */
function matRegions(d: BorderDraw): Box[] {
  const { photo: p, width: W, height: H } = d;
  return [
    { x: 0, y: 0, w: W, h: p.y },
    { x: 0, y: p.y, w: p.x, h: p.h },
    { x: p.x + p.w, y: p.y, w: W - p.x - p.w, h: p.h },
    { x: 0, y: p.y + p.h, w: W, h: H - p.y - p.h },
  ];
}

/**
 * Short, faint strokes scattered over the mat, like handling marks on a paper
 * border, weighted by area so the caption strip carries its share. Each stroke
 * stays inside one mat box, so none crosses the photo.
 */
export function wearStrokes(d: BorderDraw, count = 60): string {
  const regions = matRegions(d);
  const areas = regions.map((r) => r.w * r.h);
  const total = areas.reduce((a, b) => a + b, 0);
  const parts: string[] = [];
  for (let i = 0; i < count; i += 1) {
    let pick = d.rng() * total;
    let box = regions[regions.length - 1]!;
    for (let k = 0; k < regions.length; k += 1) {
      if (pick < areas[k]!) {
        box = regions[k]!;
        break;
      }
      pick -= areas[k]!;
    }
    const x1 = box.x + d.rng() * box.w;
    const y1 = box.y + d.rng() * box.h;
    const angle = d.rng() * Math.PI;
    const len = 0.8 + d.rng() * 2.7;
    const x2 = Math.min(box.x + box.w, Math.max(box.x, x1 + Math.cos(angle) * len));
    const y2 = Math.min(box.y + box.h, Math.max(box.y, y1 + Math.sin(angle) * len));
    const opacity = (0.08 + d.rng() * 0.16).toFixed(3);
    parts.push(
      `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${d.palette.tint}" stroke-opacity="${opacity}" stroke-width="0.22" stroke-linecap="round"/>`,
    );
  }
  return parts.join("");
}

/** A foil gradient between the palette's two stops at a seeded angle, filling the card; the mat clip keeps it off the photo. */
export function foilFill(id: string, d: BorderDraw): { def: string; use: string } {
  const angle = Math.round(d.rng() * 360);
  const [light, dark] = d.palette.foil;
  const def =
    `<linearGradient id="${id}" gradientTransform="rotate(${angle} 0.5 0.5)">` +
    `<stop offset="0" stop-color="${light}"/><stop offset="0.5" stop-color="${dark}"/><stop offset="1" stop-color="${light}"/>` +
    `</linearGradient>`;
  const use = `<rect x="0" y="0" width="${f(d.width)}" height="${f(d.height)}" fill="url(#${id})"/>`;
  return { def, use };
}

/**
 * The texture registry. Adding a texture is one entry: an id, a label and a draw
 * function that returns SVG fragments for the mat. Every texture layers a coarse
 * mottle (seen on screen) under a fine grain (seen in print). The design panel, the
 * gallery page and the equivalence test read this table.
 */
export const TEXTURES = {
  paper: {
    id: "paper",
    label: "Paper",
    draw: (d) => {
      const m = mottleFilter(`mottle-${d.seed}`, d, 0.1);
      const g = grainFilter(`grain-${d.seed}`, d, 0.07, 3);
      return { defs: m.def + g.def, mat: m.use + g.use };
    },
  },
  grain: {
    id: "grain",
    label: "Grain",
    draw: (d) => {
      const m = mottleFilter(`mottle-${d.seed}`, d, 0.12, 0.6);
      const g = grainFilter(`grain-${d.seed}`, d, 0.18);
      return { defs: m.def + g.def, mat: m.use + g.use };
    },
  },
  worn: {
    id: "worn",
    label: "Worn",
    draw: (d) => {
      const m = mottleFilter(`mottle-${d.seed}`, d, 0.14, 0.35);
      const g = grainFilter(`grain-${d.seed}`, d, 0.16);
      return { defs: m.def + g.def, mat: m.use + g.use + wearStrokes(d) };
    },
  },
  foil: {
    id: "foil",
    label: "Foil",
    draw: (d) => {
      const fo = foilFill(`foil-${d.seed}`, d);
      const m = mottleFilter(`mottle-${d.seed}`, d, 0.08);
      const g = grainFilter(`grain-${d.seed}`, d, 0.1);
      return { defs: fo.def + m.def + g.def, mat: fo.use + m.use + g.use };
    },
  },
} as const satisfies Record<string, TextureDef>;

export type Texture = keyof typeof TEXTURES;
