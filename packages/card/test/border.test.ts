import { describe, expect, it } from "vitest";
import { borderDataUrl, borderSvg, mulberry32, svgDataUrl } from "../src/border";
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

const MAT_GROUP = /<g clip-path="url\(#mat\)">.*?<\/g>/gs;
const stripSvg = (svg: string) =>
  svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "").replace(/<defs>.*<\/defs>/s, "");

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
  it("draws everything inside the one mat clip group", () => {
    const withoutDefs = stripSvg(borderSvg(base, H));
    const groups = withoutDefs.match(MAT_GROUP) ?? [];
    expect(groups).toHaveLength(1);
    expect(groups.reduce((rest, g) => rest.replace(g, ""), withoutDefs).trim()).toBe("");
    expect(borderSvg(base, H)).not.toContain("#band");
  });
  it("keeps every texture, tone and tier inside one plain clip group", () => {
    for (const texture of Object.keys(TEXTURES) as (keyof typeof TEXTURES)[]) {
      for (const tone of Object.keys(TONES) as Tone[]) {
        for (const tier of Object.keys(TIERS) as Tier[]) {
          const label = `${texture}/${tone}/${tier}`;
          const withoutDefs = stripSvg(borderSvg({ ...base, texture, tone, tier, palette: paletteFor(tone, null) }, H));
          const groups = withoutDefs.match(MAT_GROUP) ?? [];
          expect(groups, label).toHaveLength(1);
          expect(groups.reduce((rest, g) => rest.replace(g, ""), withoutDefs).trim(), label).toBe("");
          const body = groups[0]!.replace(/^<g clip-path="url\(#mat\)">/, "").replace(/<\/g>$/, "");
          for (const bad of ["<g", "clip-path", "<svg", "<image", "<use", "<style", "<script"]) {
            expect(body.includes(bad), `${label} body contains ${bad}`).toBe(false);
          }
        }
      }
    }
  });
  it("cuts the photo box out of the mat clip, which is the only clip", () => {
    const svg = borderSvg(base, H);
    expect(svg).toContain('<clipPath id="mat"><path clip-rule="evenodd" d="M0 0H100V144.2H0Z M5 5h90v120h-90Z"/></clipPath>');
    expect(svg.match(/<clipPath/g)).toHaveLength(1);
  });
  it("fills the whole mat with foil for the foil texture", () => {
    const foil = borderSvg({ ...base, texture: "foil", tier: "foil" }, H);
    const [, matGroup] = foil.split('<g clip-path="url(#mat)">');
    expect(matGroup).toContain('<rect x="0" y="0" width="100" height="144.2" fill="url(#foil-12345)"/>');
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
