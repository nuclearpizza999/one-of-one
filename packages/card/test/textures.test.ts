import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../src/border";
import { type BorderDraw, TEXTURES, foilBand, grainFilter, wearStrokes } from "../src/textures";
import { TIERS } from "../src/variation";

function draw(seed = 12345): BorderDraw {
  return {
    seed,
    rng: mulberry32(seed),
    palette: { tint: "#b08860", foil: ["#f3d9a4", "#b8864a"] },
    tier: TIERS.fine,
    width: 100,
    height: 144.2,
    band: 2,
    photo: { x: 5, y: 5, w: 90, h: 120 },
  };
}

describe("TEXTURES registry", () => {
  it("has ids equal to keys, labels, and a draw function", () => {
    for (const [key, t] of Object.entries(TEXTURES)) {
      expect(t.id).toBe(key);
      expect(t.label.length).toBeGreaterThan(0);
      expect(typeof t.draw).toBe("function");
    }
  });
  it("draws a mat fragment for every texture and a band fragment for all but paper", () => {
    for (const t of Object.values(TEXTURES)) {
      const f = t.draw(draw());
      expect(f.mat.length).toBeGreaterThan(0);
      expect(f.defs.length).toBeGreaterThan(0);
      if (t.id === "paper") expect(f.band).toBe("");
      else expect(f.band.length).toBeGreaterThan(0);
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
    // #b08860 is rgb(176, 136, 96): 0.690, 0.533, 0.376 as fractions.
    expect(g.def).toContain('values="0 0 0 0 0.690 0 0 0 0 0.533 0 0 0 0 0.376 0 0 0 0.09 0"');
    expect(g.use).toContain('filter="url(#g)"');
    expect(g.use).toContain('width="100" height="144.2"');
  });
});

describe("wearStrokes", () => {
  it("keeps every stroke inside the outer band", () => {
    const d = draw(99);
    const svg = wearStrokes(d);
    const lines = [...svg.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)];
    expect(lines.length).toBe(40);
    for (const m of lines) {
      for (const [x, y] of [[Number(m[1]), Number(m[2])], [Number(m[3]), Number(m[4])]]) {
        const inBand = x! <= d.band || x! >= d.width - d.band || y! <= d.band || y! >= d.height - d.band;
        expect(inBand, `point ${x},${y}`).toBe(true);
      }
    }
  });
  it("uses the palette tint and low opacity", () => {
    const svg = wearStrokes(draw(5), 3);
    expect(svg.match(/stroke="#b08860"/g)).toHaveLength(3);
    for (const m of svg.matchAll(/stroke-opacity="([\d.]+)"/g)) expect(Number(m[1])).toBeLessThan(0.25);
  });
});

describe("foilBand", () => {
  it("builds a gradient between the two foil stops at a seeded angle", () => {
    const f = foilBand("foil", draw(321));
    expect(f.def).toContain('stop-color="#f3d9a4"');
    expect(f.def).toContain('stop-color="#b8864a"');
    expect(f.def).toMatch(/rotate\(\d+ 0\.5 0\.5\)/);
    expect(f.use).toContain('fill="url(#foil)"');
    expect(foilBand("foil", draw(321))).toEqual(f);
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
