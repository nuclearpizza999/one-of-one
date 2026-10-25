import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../src/border";
import { clearsCaptionFloor } from "../src/contrast";
import {
  type BorderDraw,
  FLOWER_FILL_MAX,
  FLOWER_STROKE_MAX,
  TEXTURES,
  blooms,
  daisies,
  foilFill,
  grainFilter,
  lighten,
  meadow,
  mottleFilter,
  sprigs,
  wearStrokes,
} from "../src/textures";
import { TIERS } from "../src/variation";

const PHOTO = { x: 5, y: 5, w: 90, h: 120 };

function draw(seed = 12345): BorderDraw {
  return {
    seed,
    rng: mulberry32(seed),
    palette: { tint: "#b08860", foil: ["#f3d9a4", "#b8864a"] },
    tier: TIERS.fine,
    width: 100,
    height: 141,
    photo: { ...PHOTO },
  };
}

const insidePhoto = (x: number, y: number) => x > PHOTO.x && x < PHOTO.x + PHOTO.w && y > PHOTO.y && y < PHOTO.y + PHOTO.h;

describe("TEXTURES registry", () => {
  it("has ids equal to keys, labels, and a draw function", () => {
    for (const [key, t] of Object.entries(TEXTURES)) {
      expect(t.id).toBe(key);
      expect(t.label.length).toBeGreaterThan(0);
      expect(typeof t.draw).toBe("function");
    }
  });
  it("draws a mat fragment with defs for every texture, and nothing else", () => {
    for (const t of Object.values(TEXTURES)) {
      const f = t.draw(draw());
      expect(Object.keys(f).sort()).toEqual(["defs", "mat"]);
      expect(f.mat.length).toBeGreaterThan(0);
      expect(f.defs.length).toBeGreaterThan(0);
    }
  });
  it("gives every texture a coarse mottle that reads at phone size and a fine grain for print", () => {
    for (const t of Object.values(TEXTURES)) {
      const freqs = [...t.draw(draw()).defs.matchAll(/baseFrequency="([\d.]+)"/g)].map((m) => Number(m[1]));
      expect(freqs.some((v) => v <= 0.8), `${t.id} has a coarse layer`).toBe(true);
      expect(freqs.some((v) => v >= 2), `${t.id} has a fine layer`).toBe(true);
    }
  });
  it("is deterministic per seed and differs across seeds", () => {
    for (const t of Object.values(TEXTURES)) {
      expect(t.draw(draw(7))).toEqual(t.draw(draw(7)));
      expect(t.draw(draw(7))).not.toEqual(t.draw(draw(8)));
    }
  });
});

describe("grainFilter", () => {
  it("seeds feTurbulence from the variation seed and tints with the palette", () => {
    const g = grainFilter("g", draw(12345), 0.09);
    expect(g.def).toContain('seed="2345"');
    expect(g.def).toContain("feTurbulence");
    expect(g.def).toContain('baseFrequency="2.5"');
    // #b08860 is rgb(176, 136, 96): 0.690, 0.533, 0.376 as fractions.
    expect(g.def).toContain('values="0 0 0 0 0.690 0 0 0 0 0.533 0 0 0 0 0.376 0 0 0 0.09 0"');
    expect(g.use).toContain('filter="url(#g)"');
    expect(g.use).toContain('width="100" height="141"');
  });
});

describe("mottleFilter", () => {
  it("is the same seeded, tinted noise at a low frequency", () => {
    const m = mottleFilter("m", draw(12345), 0.1);
    expect(m.def).toContain('seed="2345"');
    expect(m.def).toMatch(/baseFrequency="0\.\d+"/);
    expect(m.def).toContain('values="0 0 0 0 0.690 0 0 0 0 0.533 0 0 0 0 0.376 0 0 0 0.1 0"');
    expect(m.use).toContain('filter="url(#m)"');
    expect(m.use).toContain('width="100" height="141"');
  });
});

describe("wearStrokes", () => {
  it("scatters strokes over every part of the mat and never into the photo", () => {
    const d = draw(99);
    const svg = wearStrokes(d);
    const lines = [...svg.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)];
    expect(lines.length).toBe(60);
    const regions = { above: 0, left: 0, right: 0, strip: 0 };
    for (const m of lines) {
      const [x1, y1, x2, y2] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
      for (const [x, y] of [[x1, y1], [x2, y2]] as const) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(d.width);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(d.height);
        expect(insidePhoto(x, y), `point ${x},${y} is inside the photo`).toBe(false);
      }
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      if (my <= PHOTO.y) regions.above += 1;
      else if (my >= PHOTO.y + PHOTO.h) regions.strip += 1;
      else if (mx <= PHOTO.x) regions.left += 1;
      else regions.right += 1;
    }
    for (const [name, n] of Object.entries(regions)) expect(n, `${name} has strokes`).toBeGreaterThan(0);
  });
  it("uses the palette tint and low opacity", () => {
    const svg = wearStrokes(draw(5), 3);
    expect(svg.match(/stroke="#b08860"/g)).toHaveLength(3);
    for (const m of svg.matchAll(/stroke-opacity="([\d.]+)"/g)) expect(Number(m[1])).toBeLessThan(0.3);
  });
});

describe("foilFill", () => {
  it("builds a gradient between the two foil stops at a seeded angle, over the whole card", () => {
    const f = foilFill("foil", draw(321));
    expect(f.def).toContain('stop-color="#f3d9a4"');
    expect(f.def).toContain('stop-color="#b8864a"');
    expect(f.def).toMatch(/rotate\(\d+ 0\.5 0\.5\)/);
    expect(f.use).toBe('<rect x="0" y="0" width="100" height="141" fill="url(#foil)"/>');
    expect(foilFill("foil", draw(321))).toEqual(f);
  });
});

describe("flower textures", () => {
  const FLOWERS = ["daisy", "meadow", "bloom", "sprig"] as const;
  const patterns = { daisy: daisies, meadow, bloom: blooms, sprig: sprigs };
  const count = (svg: string, re: RegExp) => (svg.match(re) ?? []).length;
  /** How many flowers (or sprigs) each pattern drew: daisies by centre dot, meadow by floret centre or seed dot, blooms by ring, sprigs by stem. */
  const flowersIn = {
    daisy: (s: string) => count(s, /<circle/g),
    meadow: (s: string) => count(s, /<circle/g),
    bloom: (s: string) => count(s, /<circle[^>]*fill="none"/g),
    sprig: (s: string) => count(s, /<path/g),
  };
  const ranges = { daisy: [20, 30], meadow: [80, 120], bloom: [3, 4], sprig: [12, 18] } as const;

  it("are registered", () => {
    for (const id of FLOWERS) expect(TEXTURES[id].id).toBe(id);
  });
  it("are deterministic per seed and differ across seeds", () => {
    for (const id of FLOWERS) {
      expect(patterns[id](draw(7))).toBe(patterns[id](draw(7)));
      expect(patterns[id](draw(7))).not.toBe(patterns[id](draw(8)));
    }
  });
  it("draw the specified number of flowers", () => {
    for (const id of FLOWERS) {
      for (let seed = 1; seed <= 40; seed += 1) {
        const n = flowersIn[id](patterns[id](draw(seed)));
        expect(n, `${id} seed ${seed}`).toBeGreaterThanOrEqual(ranges[id][0]);
        expect(n, `${id} seed ${seed}`).toBeLessThanOrEqual(ranges[id][1]);
      }
    }
  });
  it("draw nothing whose centre or start lies inside the photo box", () => {
    for (const id of FLOWERS) {
      for (let seed = 1; seed <= 40; seed += 1) {
        const svg = patterns[id](draw(seed));
        const points = [
          ...[...svg.matchAll(/<(?:circle|ellipse) cx="([\d.-]+)" cy="([\d.-]+)"/g)].map((m) => [Number(m[1]), Number(m[2])]),
          ...[...svg.matchAll(/<path d="M([\d.-]+) ([\d.-]+)/g)].map((m) => [Number(m[1]), Number(m[2])]),
        ];
        expect(points.length, id).toBeGreaterThan(0);
        for (const [x, y] of points) expect(insidePhoto(x!, y!), `${id} seed ${seed}: ${x},${y}`).toBe(false);
      }
    }
  });
  it("ink only in the tint and lighter mixes of it, under the opacity ceilings, never in the foil stops", () => {
    const d = draw(3);
    const allowed = new Set([d.palette.tint, lighten(d.palette.tint, 0.45), lighten(d.palette.tint, 0.35), lighten(d.palette.tint, 0.3), "none"]);
    for (const id of FLOWERS) {
      for (let seed = 1; seed <= 20; seed += 1) {
        const svg = patterns[id](draw(seed));
        for (const stop of d.palette.foil) expect(svg.includes(stop), `${id} uses a foil stop`).toBe(false);
        for (const m of svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)) expect(allowed.has(m[1]!), `${id} colour ${m[1]}`).toBe(true);
        for (const m of svg.matchAll(/fill-opacity="([\d.]+)"/g)) expect(Number(m[1])).toBeLessThanOrEqual(0.35);
        for (const m of svg.matchAll(/stroke-opacity="([\d.]+)"/g)) expect(Number(m[1])).toBeLessThanOrEqual(0.5);
        for (const el of svg.match(/<[a-z]+ [^>]*>/g) ?? []) {
          if (/fill="#/.test(el)) expect(el, `${id} fill without opacity`).toMatch(/fill-opacity=/);
          if (/stroke="#/.test(el)) expect(el, `${id} stroke without opacity`).toMatch(/stroke-opacity=/);
        }
      }
    }
    expect(FLOWER_FILL_MAX).toBe(0.35);
    expect(FLOWER_STROKE_MAX).toBe(0.5);
  });
  it("lighten keeps the hue toward white, so a mix of a tint that clears the caption floor clears it too", () => {
    for (const tint of ["#b08860", "#8a8a8a", "#6878a0"]) {
      expect(lighten(tint, 0)).toBe(tint);
      expect(lighten(tint, 1)).toBe("#ffffff");
      expect(clearsCaptionFloor(lighten(tint, 0.3))).toBe(true);
    }
  });
});

describe("sources", () => {
  it("never call Math.random", () => {
    for (const file of ["../src/textures.ts", "../src/border.ts"]) {
      const src = readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
      expect(src).not.toContain("Math.random");
    }
  });
});
