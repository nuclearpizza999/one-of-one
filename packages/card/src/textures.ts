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

/* ---------- Flower patterns ---------- */

/** The colour mixed toward white by `t` (0 keeps it, 1 is white): lighter with the same hue, so it stays above the caption floor. */
export function lighten(hex: string, t: number): string {
  const [r, g, b] = hexToRgb01(hex);
  const ch = (v: number) => Math.round((v + (1 - v) * t) * 255).toString(16).padStart(2, "0");
  return `#${ch(r)}${ch(g)}${ch(b)}`;
}

/**
 * Opacity ceilings for flower ink: filled shapes and thin strokes. The tint
 * already clears the caption floor at full strength, and ink of one colour
 * never composites darker than that colour; these keep the pattern quiet.
 */
export const FLOWER_FILL_MAX = 0.35;
export const FLOWER_STROKE_MAX = 0.5;

const op = (lo: number, hi: number, d: BorderDraw): string => f(lo + d.rng() * (hi - lo));

/** A point in the mat, picked by area so every part of the mat gets its share. */
function matPoint(d: BorderDraw): { x: number; y: number } {
  const regions = matRegions(d);
  const areas = regions.map((r) => r.w * r.h);
  let pick = d.rng() * areas.reduce((a, b) => a + b, 0);
  let box = regions[regions.length - 1]!;
  for (let k = 0; k < regions.length; k += 1) {
    if (pick < areas[k]!) {
      box = regions[k]!;
      break;
    }
    pick -= areas[k]!;
  }
  return { x: box.x + d.rng() * box.w, y: box.y + d.rng() * box.h };
}

/** Moves a shape of radius `r` at (x, y) out of the photo box, to the nearest side, so all of it sits in the mat. */
function clearOfPhoto(d: BorderDraw, x: number, y: number, r: number): { x: number; y: number } {
  const p = d.photo;
  const left = p.x - r;
  const right = p.x + p.w + r;
  const top = p.y - r;
  const bottom = p.y + p.h + r;
  if (x <= left || x >= right || y <= top || y >= bottom) return { x, y };
  const moves = [
    { dist: x - left, x: left, y },
    { dist: right - x, x: right, y },
    { dist: y - top, x, y: top },
    { dist: bottom - y, x, y: bottom },
  ].sort((a, b) => a.dist - b.dist);
  return { x: moves[0]!.x, y: moves[0]!.y };
}

/** An ellipse whose long axis points along `angle` (degrees, 0 is up), written at its true centre so the centre is readable. */
function petal(x: number, y: number, rx: number, ry: number, angle: number, paint: string): string {
  return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" transform="rotate(${f(angle)} ${f(x)} ${f(y)})" ${paint}/>`;
}

/** A small flower `size` units across: `n` petals at a seeded rotation around a centre dot. */
function smallFlower(d: BorderDraw, cx: number, cy: number, size: number, n: number, petalColor: string, petalOpacity: string): string {
  const r = size / 2;
  const rot = d.rng() * 360;
  const paint =
    `fill="${petalColor}" fill-opacity="${petalOpacity}" stroke="${d.palette.tint}" ` +
    `stroke-opacity="${op(0.18, 0.3, d)}" stroke-width="${f(Math.max(0.05, size * 0.025))}"`;
  const parts: string[] = [];
  for (let k = 0; k < n; k += 1) {
    const a = rot + (k * 360) / n;
    const rad = (a * Math.PI) / 180;
    parts.push(petal(cx + Math.sin(rad) * r * 0.5, cy - Math.cos(rad) * r * 0.5, r * (n === 4 ? 0.3 : 0.24), r * 0.48, a, paint));
  }
  parts.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.2)}" fill="${d.palette.tint}" fill-opacity="${op(0.24, 0.34, d)}"/>`);
  return parts.join("");
}

/** Daisies: 20 to 30 five-petal flowers, 1.6 to 3.2 units across, scattered over the mat by area. */
export function daisies(d: BorderDraw): string {
  const count = 20 + Math.floor(d.rng() * 11);
  const pale = lighten(d.palette.tint, 0.45);
  const parts: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const size = 1.6 + d.rng() * 1.6;
    const at = matPoint(d);
    const { x, y } = clearOfPhoto(d, at.x, at.y, size / 2);
    parts.push(smallFlower(d, x, y, size, 5, pale, op(0.2, 0.32, d)));
  }
  return parts.join("");
}

/** A meadow: 80 to 120 tiny four-petal florets and seed dots, 0.6 to 1.4 units across. */
export function meadow(d: BorderDraw): string {
  const count = 80 + Math.floor(d.rng() * 41);
  const pale = lighten(d.palette.tint, 0.35);
  const parts: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const size = 0.6 + d.rng() * 0.8;
    const at = matPoint(d);
    const { x, y } = clearOfPhoto(d, at.x, at.y, size / 2);
    if (d.rng() < 0.65) {
      parts.push(smallFlower(d, x, y, size, 4, d.rng() < 0.5 ? pale : d.palette.tint, op(0.16, 0.3, d)));
    } else {
      parts.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(size * 0.18)}" fill="${d.palette.tint}" fill-opacity="${op(0.16, 0.3, d)}"/>`);
    }
  }
  return parts.join("");
}

/** A point given in a petal's own frame (-y along the petal) turned by `a` radians about (cx, cy). */
const turn = (cx: number, cy: number, a: number, lx: number, ly: number): string =>
  `${f(cx + lx * Math.cos(a) - ly * Math.sin(a))} ${f(cy + lx * Math.sin(a) + ly * Math.cos(a))}`;

/** A large line-drawn flower `size` units across: outlined petals with a vein each, a ring centre and stamen dots. */
function lineFlower(d: BorderDraw, cx: number, cy: number, size: number): string {
  const R = size / 2;
  const n = 5 + Math.floor(d.rng() * 3);
  const rot = d.rng() * Math.PI * 2;
  const ink =
    `fill="none" stroke="${d.palette.tint}" stroke-opacity="${op(0.32, 0.42, d)}" ` +
    `stroke-width="0.2" stroke-linecap="round" stroke-linejoin="round"`;
  const parts: string[] = [];
  for (let k = 0; k < n; k += 1) {
    const a = rot + (k * Math.PI * 2) / n;
    const len = R * (0.88 + d.rng() * 0.12);
    const wide = R * (0.36 + d.rng() * 0.08);
    const s = R * 0.2;
    const p = (x: number, y: number) => turn(cx, cy, a, x, y);
    parts.push(
      `<path d="M${p(0, -s)}C${p(-wide, -len * 0.35)} ${p(-wide * 0.7, -len * 0.95)} ${p(0, -len)}` +
        `C${p(wide * 0.7, -len * 0.95)} ${p(wide, -len * 0.35)} ${p(0, -s)}" ${ink}/>`,
    );
    parts.push(`<path d="M${p(0, -s * 1.6)}Q${p(wide * 0.12, -len * 0.5)} ${p(0, -len * 0.72)}" ${ink}/>`);
  }
  parts.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R * 0.14)}" ${ink}/>`);
  const dots = 5 + Math.floor(d.rng() * 4);
  for (let k = 0; k < dots; k += 1) {
    const a = rot + (k * Math.PI * 2) / dots + 0.3;
    const rr = R * (0.2 + d.rng() * 0.06);
    parts.push(
      `<circle cx="${f(cx + Math.cos(a) * rr)}" cy="${f(cy + Math.sin(a) * rr)}" r="0.16" fill="${d.palette.tint}" fill-opacity="${op(0.24, 0.34, d)}"/>`,
    );
  }
  return parts.join("");
}

/**
 * Blooms: three or four large line-drawn flowers, 8 to 14 units across, one in
 * the caption strip's right half and the rest in seeded corners of the mat.
 * Each is centred in the mat; the card edge and the photo box clip the rest.
 */
export function blooms(d: BorderDraw): string {
  const { width: W, height: H, photo: p } = d;
  const stripTop = p.y + p.h;
  const corners = [
    { x: 0.5 + d.rng() * 3, y: 0.5 + d.rng() * 3 },
    { x: W - 0.5 - d.rng() * 3, y: 0.5 + d.rng() * 3 },
    { x: 0.5 + d.rng() * 3, y: H - 0.5 - d.rng() * 3 },
    { x: W - 0.5 - d.rng() * 3, y: H - 0.5 - d.rng() * 3 },
  ];
  for (let i = corners.length - 1; i > 0; i -= 1) {
    const k = Math.floor(d.rng() * (i + 1));
    [corners[i], corners[k]] = [corners[k]!, corners[i]!];
  }
  const strip = { x: W * 0.62 + d.rng() * W * 0.22, y: stripTop + 2.5 + d.rng() * Math.max(0, H - stripTop - 5) };
  const spots = [strip, ...corners.slice(0, 2 + Math.floor(d.rng() * 2))];
  return spots.map((s) => lineFlower(d, s.x, s.y, 8 + d.rng() * 6)).join("");
}

/** A point on a quadratic curve and the unit tangent there. */
function onQuad(p0: [number, number], c: [number, number], p1: [number, number], t: number) {
  const u = 1 - t;
  const x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0];
  const y = u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1];
  const dx = 2 * u * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0]);
  const dy = 2 * u * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1]);
  const len = Math.hypot(dx, dy) || 1;
  return { x, y, tx: dx / len, ty: dy / len };
}

/**
 * Sprigs: 12 to 18 leafy stems laid along the card's edges, each a curved stem
 * with three to five leaves, spaced around the perimeter with a seeded jitter.
 */
export function sprigs(d: BorderDraw): string {
  const { width: W, height: H } = d;
  const count = 12 + Math.floor(d.rng() * 7);
  const perimeter = 2 * (W + H);
  const offset = d.rng() * perimeter;
  const pale = lighten(d.palette.tint, 0.3);
  const parts: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const L = 3.6 + d.rng() * 2.4;
    const e = 1.5 + d.rng() * 1.1;
    const t = (((offset + ((i + (d.rng() - 0.5) * 0.5) * perimeter) / count) % perimeter) + perimeter) % perimeter;
    const along = (v: number, side: number) => Math.min(side - L / 2 - 0.5, Math.max(L / 2 + 0.5, v));
    let cx: number;
    let cy: number;
    let dir: [number, number];
    let inward: [number, number];
    if (t < W) [cx, cy, dir, inward] = [along(t, W), e, [1, 0], [0, 1]];
    else if (t < W + H) [cx, cy, dir, inward] = [W - e, along(t - W, H), [0, 1], [-1, 0]];
    else if (t < 2 * W + H) [cx, cy, dir, inward] = [along(2 * W + H - t, W), H - e, [-1, 0], [0, -1]];
    else [cx, cy, dir, inward] = [e, along(perimeter - t, H), [0, -1], [1, 0]];
    if (d.rng() < 0.5) dir = [-dir[0], -dir[1]];
    const bend = (d.rng() - 0.5) * 1.8;
    const p0: [number, number] = [cx - (dir[0] * L) / 2, cy - (dir[1] * L) / 2];
    const p1: [number, number] = [cx + (dir[0] * L) / 2, cy + (dir[1] * L) / 2];
    const c: [number, number] = [cx + inward[0] * bend, cy + inward[1] * bend];
    parts.push(
      `<path d="M${f(p0[0])} ${f(p0[1])}Q${f(c[0])} ${f(c[1])} ${f(p1[0])} ${f(p1[1])}" fill="none" ` +
        `stroke="${d.palette.tint}" stroke-opacity="${op(0.32, 0.44, d)}" stroke-width="0.14" stroke-linecap="round"/>`,
    );
    const leaves = 3 + Math.floor(d.rng() * 3);
    for (let k = 0; k < leaves; k += 1) {
      const last = k === leaves - 1;
      const at = onQuad(p0, c, p1, last ? 1 : 0.22 + (k / (leaves - 1)) * 0.68);
      const size = 0.9 + d.rng() * 0.5;
      const side = k % 2 === 0 ? 1 : -1;
      const vx = last ? at.tx : at.tx * 0.7 - at.ty * side * 0.7;
      const vy = last ? at.ty : at.ty * 0.7 + at.tx * side * 0.7;
      const vl = Math.hypot(vx, vy);
      const [ux, uy] = [vx / vl, vy / vl];
      const angle = (Math.atan2(ux, -uy) * 180) / Math.PI;
      const paint =
        `fill="${pale}" fill-opacity="${op(0.2, 0.32, d)}" stroke="${d.palette.tint}" ` +
        `stroke-opacity="${op(0.2, 0.3, d)}" stroke-width="0.06"`;
      parts.push(petal(at.x + ux * size * 0.5, at.y + uy * size * 0.5, size * 0.24, size * 0.5, angle, paint));
    }
  }
  return parts.join("");
}

/** The quiet ground under every flower pattern: a light mottle and the paper grain. */
function flowerTexture(pattern: (d: BorderDraw) => string): (d: BorderDraw) => TextureFragments {
  return (d) => {
    const m = mottleFilter(`mottle-${d.seed}`, d, 0.08);
    const g = grainFilter(`grain-${d.seed}`, d, 0.07, 3);
    return { defs: m.def + g.def, mat: m.use + g.use + pattern(d) };
  };
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
  daisy: { id: "daisy", label: "Daisy", draw: flowerTexture(daisies) },
  meadow: { id: "meadow", label: "Meadow", draw: flowerTexture(meadow) },
  bloom: { id: "bloom", label: "Bloom", draw: flowerTexture(blooms) },
  sprig: { id: "sprig", label: "Sprig", draw: flowerTexture(sprigs) },
} as const satisfies Record<string, TextureDef>;

export type Texture = keyof typeof TEXTURES;
