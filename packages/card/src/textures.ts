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
  /** Outer band width. */
  band: number;
  photo: { x: number; y: number; w: number; h: number };
}

/** SVG fragments: `defs` go in <defs>; `mat` is clipped to the mat minus the photo; `band` is clipped to the outer band. */
export interface TextureFragments {
  defs: string;
  mat: string;
  band: string;
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
export function grainFilter(id: string, d: BorderDraw, alpha: number, baseFrequency = 2.5): { def: string; use: string } {
  const [r, g, b] = hexToRgb01(d.palette.tint);
  const seed = d.seed % 10000;
  const def =
    `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${baseFrequency}" numOctaves="3" seed="${seed}" stitchTiles="stitch" result="noise"/>` +
    `<feColorMatrix in="noise" type="matrix" values="0 0 0 0 ${r.toFixed(3)} 0 0 0 0 ${g.toFixed(3)} 0 0 0 0 ${b.toFixed(3)} 0 0 0 ${alpha} 0"/>` +
    `</filter>`;
  const use = `<rect x="0" y="0" width="${f(d.width)}" height="${f(d.height)}" fill="#fff" filter="url(#${id})"/>`;
  return { def, use };
}

/** Short, faint strokes along the edges, like a worn paper border. Every point stays inside the band. */
export function wearStrokes(d: BorderDraw, count = 40): string {
  const parts: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const side = Math.floor(d.rng() * 4);
    const along = d.rng();
    const depth = d.band * (0.15 + d.rng() * 0.7);
    const len = 0.8 + d.rng() * 2.2;
    const opacity = (0.08 + d.rng() * 0.14).toFixed(3);
    let x1: number;
    let y1: number;
    let x2: number;
    let y2: number;
    if (side === 0) {
      x1 = along * d.width; y1 = depth; x2 = Math.min(d.width, x1 + len); y2 = depth;
    } else if (side === 2) {
      x1 = along * d.width; y1 = d.height - depth; x2 = Math.min(d.width, x1 + len); y2 = y1;
    } else if (side === 3) {
      x1 = depth; y1 = along * d.height; x2 = depth; y2 = Math.min(d.height, y1 + len);
    } else {
      x1 = d.width - depth; y1 = along * d.height; x2 = x1; y2 = Math.min(d.height, y1 + len);
    }
    parts.push(
      `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${d.palette.tint}" stroke-opacity="${opacity}" stroke-width="0.22" stroke-linecap="round"/>`,
    );
  }
  return parts.join("");
}

/** A foil gradient between the palette's two stops, at a seeded angle. Fills the card; the caller clips it to the band. */
export function foilBand(id: string, d: BorderDraw): { def: string; use: string } {
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
 * function that returns fragments for the mat and the band. The dev panel, the
 * gallery page and the equivalence test read this table.
 */
export const TEXTURES = {
  paper: {
    id: "paper",
    label: "Paper",
    draw: (d) => {
      const g = grainFilter(`grain-${d.seed}`, d, 0.05, 3);
      return { defs: g.def, mat: g.use, band: "" };
    },
  },
  grain: {
    id: "grain",
    label: "Grain",
    draw: (d) => {
      const g = grainFilter(`grain-${d.seed}`, d, 0.09);
      const e = grainFilter(`edge-${d.seed}`, d, 0.06, 1.2);
      return { defs: g.def + e.def, mat: g.use, band: e.use };
    },
  },
  worn: {
    id: "worn",
    label: "Worn",
    draw: (d) => {
      const g = grainFilter(`grain-${d.seed}`, d, 0.09);
      return { defs: g.def, mat: g.use, band: wearStrokes(d) };
    },
  },
  foil: {
    id: "foil",
    label: "Foil",
    draw: (d) => {
      const g = grainFilter(`grain-${d.seed}`, d, 0.07);
      const fo = foilBand(`foil-${d.seed}`, d);
      return { defs: g.def + fo.def, mat: g.use, band: fo.use };
    },
  },
} as const satisfies Record<string, TextureDef>;

export type Texture = keyof typeof TEXTURES;
