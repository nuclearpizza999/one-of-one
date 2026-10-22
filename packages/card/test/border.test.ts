import { describe, expect, it } from "vitest";
import { BAND_UNITS, borderDataUrl, borderSvg, mulberry32, svgDataUrl } from "../src/border";
import { TEXTURES } from "../src/textures";
import { paletteFor, TIERS, TONES, type Tier, type Tone, type Variation } from "../src/variation";

const base: Variation = {
  texture: "grain",
  tone: "warm",
  palette: { tint: "#b08860", foil: ["#f3d9a4", "#b8864a"] },
  tier: "fine",
  motion: "none",
  intro: "rise",
  seed: 12345,
};
const H = 144.2; // 900 × 1200 photo

describe("mulberry32", () => {
  it("is deterministic and in [0, 1)", () => {
    const a = mulberry32(1);
    const b = mulberry32(1);
    for (let i = 0; i < 100; i += 1) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(mulberry32(2)()).not.toBe(mulberry32(1)());
  });
});

describe("borderSvg", () => {
  it("is an SVG in card units with the card's height", () => {
    const svg = borderSvg(base, H);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 144.2"')).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
  });
  it("draws only inside the two clip groups", () => {
    const svg = borderSvg(base, H);
    const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
    const withoutDefs = inner.replace(/<defs>.*<\/defs>/s, "");
    const groups = withoutDefs.match(/<g clip-path="url\(#(mat|band)\)">.*?<\/g>/gs) ?? [];
    expect(groups).toHaveLength(2);
    expect(groups[0]).toContain('url(#mat)');
    expect(groups[1]).toContain('url(#band)');
    expect(groups.reduce((rest, g) => rest.replace(g, ""), withoutDefs).trim()).toBe("");
  });
  it("keeps every texture, tone and tier inside two plain clip groups", () => {
    for (const texture of Object.keys(TEXTURES) as (keyof typeof TEXTURES)[]) {
      for (const tone of Object.keys(TONES) as Tone[]) {
        for (const tier of Object.keys(TIERS) as Tier[]) {
          const label = `${texture}/${tone}/${tier}`;
          const svg = borderSvg({ ...base, texture, tone, tier, palette: paletteFor(tone, null) }, H);
          const withoutDefs = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "").replace(/<defs>.*<\/defs>/s, "");
          const groups = withoutDefs.match(/<g clip-path="url\(#(mat|band)\)">.*?<\/g>/gs) ?? [];
          expect(groups, label).toHaveLength(2);
          expect(groups.reduce((rest, g) => rest.replace(g, ""), withoutDefs).trim(), label).toBe("");
          for (const g of groups) {
            const body = g.replace(/^<g clip-path="url\(#(mat|band)\)">/, "").replace(/<\/g>$/, "");
            for (const bad of ["<g", "clip-path", "<svg", "<image", "<use", "<style", "<script"]) {
              expect(body.includes(bad), `${label} body contains ${bad}`).toBe(false);
            }
          }
        }
      }
    }
  });
  it("cuts the photo box out of the mat clip and keeps the band to the outer 2 units", () => {
    const svg = borderSvg(base, H);
    expect(svg).toContain('<clipPath id="mat"><path clip-rule="evenodd" d="M0 0H100V144.2H0Z M5 5h90v120h-90Z"/></clipPath>');
    expect(svg).toContain(`<clipPath id="band"><path clip-rule="evenodd" d="M0 0H100V144.2H0Z M${BAND_UNITS} ${BAND_UNITS}H${100 - BAND_UNITS}V${H - BAND_UNITS}H${BAND_UNITS}Z"/></clipPath>`);
  });
  it("puts band-only effects in the band group", () => {
    const foil = borderSvg({ ...base, texture: "foil", tier: "foil" }, H);
    const [, bandGroup] = foil.split('<g clip-path="url(#band)">');
    expect(bandGroup).toContain('fill="url(#foil-12345)"');
    const [, matGroup] = foil.split('<g clip-path="url(#mat)">');
    expect(matGroup!.split('<g clip-path="url(#band)">')[0]).not.toContain("url(#foil-");
  });
  it("seeds the noise and is deterministic", () => {
    const svg = borderSvg(base, H);
    expect(svg).toContain('seed="2345"');
    expect(svg).toBe(borderSvg({ ...base }, H));
    expect(borderSvg({ ...base, seed: 99 }, H)).not.toBe(svg);
    expect(borderSvg({ ...base, texture: "worn" }, H)).not.toBe(svg);
  });
  it("renders every registered texture", () => {
    for (const id of Object.keys(TEXTURES) as (keyof typeof TEXTURES)[]) {
      const svg = borderSvg({ ...base, texture: id }, H);
      expect(svg).toContain("<svg");
      expect(svg).toContain("feTurbulence");
    }
  });
});

describe("borderDataUrl", () => {
  it("is a data URL that decodes back to the document", () => {
    const url = borderDataUrl(base, H);
    expect(url.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(url.slice("data:image/svg+xml;charset=utf-8,".length))).toBe(borderSvg(base, H));
  });
});

describe("svgDataUrl", () => {
  it("encodes any SVG string as a data URL", () => {
    expect(svgDataUrl("<svg a=\"#1\"/>")).toBe("data:image/svg+xml;charset=utf-8,%3Csvg%20a%3D%22%231%22%2F%3E");
  });
});
