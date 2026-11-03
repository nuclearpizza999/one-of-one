import { describe, expect, it } from "vitest";
import { CARD, cardHeightUnits } from "../src/layout";
import {
  GLINT,
  MOTIONS,
  STARLIGHT,
  captionBlock,
  glintKeyframes,
  glintRim,
  knownMotion,
  lightGeometry,
  starlightPoints,
  type MotionDef,
} from "../src/motions";
import { TIERS, type VariationInputs, deriveVariation } from "../src/variation";

const SHAPES = {
  portrait: cardHeightUnits(900, 1200),
  square: cardHeightUnits(1000, 1000),
  landscape: cardHeightUnits(1200, 800),
};

describe("the motion registry", () => {
  it("gives None no light layer and Sheen an empty one, so taps have somewhere to bloom", () => {
    expect(MOTIONS.none.light).toBeNull();
    expect(MOTIONS.sheen.light({ height: SHAPES.portrait, seed: 7 })).toEqual([]);
  });
  it("keeps every registry id and reads anything else as none", () => {
    for (const m of Object.keys(MOTIONS)) expect(knownMotion(m)).toBe(m);
    for (const m of ["glow", "bogus", ""]) expect(knownMotion(m)).toBe("none");
  });
});

describe("lightGeometry", () => {
  it("carries the card's height and centres on the photo", () => {
    expect(lightGeometry(130)).toEqual({ "--oo-h": "130", "--oo-cx": "50", "--oo-cy": "59.5", "--oo-r": "92.431" });
    expect(lightGeometry(SHAPES.portrait)).toEqual({ "--oo-h": "141", "--oo-cx": "50", "--oo-cy": "65", "--oo-r": "96.973" });
  });
  it("reaches past every corner of the card by 6", () => {
    for (const height of Object.values(SHAPES)) {
      const g = lightGeometry(height);
      const cx = Number(g["--oo-cx"]);
      const cy = Number(g["--oo-cy"]);
      for (const [x, y] of [[0, 0], [100, 0], [0, height], [100, height]] as const) {
        expect(Number(g["--oo-r"])).toBeGreaterThanOrEqual(Math.hypot(x - cx, y - cy) + 6 - 0.001);
      }
    }
  });
});

describe("captionBlock", () => {
  it("covers all three caption lines and the number, inset to inset", () => {
    for (const height of Object.values(SHAPES)) {
      const top = height - CARD.stripHeight + CARD.gap;
      const b = captionBlock(height);
      expect(b.x0).toBeLessThanOrEqual(CARD.mat + CARD.inset);
      expect(b.x1).toBeGreaterThanOrEqual(CARD.width - CARD.mat - CARD.inset);
      expect(b.y0).toBeLessThanOrEqual(top);
      expect(b.y1).toBeGreaterThanOrEqual(top + 3 * CARD.fontSize * CARD.lineHeight);
    }
  });
});

describe("starlightPoints", () => {
  it("gives ten points, the same for one seed and different for another", () => {
    const a = starlightPoints({ height: SHAPES.portrait, seed: 7 });
    expect(a).toHaveLength(STARLIGHT.points);
    expect(starlightPoints({ height: SHAPES.portrait, seed: 7 })).toEqual(a);
    expect(starlightPoints({ height: SHAPES.portrait, seed: 8 })).not.toEqual(a);
  });
  it("keeps every point inside the mat, off the photo and clear of the caption, on every shape", () => {
    for (const height of Object.values(SHAPES)) {
      const photoBottom = height - CARD.stripHeight;
      const c = captionBlock(height);
      for (let seed = 0; seed < 50; seed += 1) {
        const points = starlightPoints({ height, seed });
        expect(points).toHaveLength(STARLIGHT.points);
        for (const p of points) {
          expect(p.x).toBeGreaterThanOrEqual(STARLIGHT.margin);
          expect(p.x).toBeLessThanOrEqual(CARD.width - STARLIGHT.margin);
          expect(p.y).toBeGreaterThanOrEqual(STARLIGHT.margin);
          expect(p.y).toBeLessThanOrEqual(height - STARLIGHT.margin);
          const offPhoto = p.x <= CARD.mat || p.x >= CARD.width - CARD.mat || p.y <= CARD.mat || p.y >= photoBottom;
          expect(offPhoto).toBe(true);
          const inCaption = p.x > c.x0 && p.x < c.x1 && p.y > c.y0 && p.y < c.y1;
          expect(inCaption).toBe(false);
        }
      }
    }
  });
  it("gives each point a beat of 4.5 to 7.5 s and starts it part-way through", () => {
    for (const p of starlightPoints({ height: SHAPES.square, seed: 3 })) {
      expect(p.duration).toBeGreaterThanOrEqual(STARLIGHT.minSeconds);
      expect(p.duration).toBeLessThan(STARLIGHT.minSeconds + STARLIGHT.spanSeconds);
      expect(p.delay).toBeLessThanOrEqual(0);
      expect(p.delay).toBeGreaterThan(-p.duration);
    }
  });
});

describe("glintKeyframes", () => {
  it("runs round a rectangle 2.5 in from the edge at an even pace, so the corners fall where the lap says", () => {
    expect(GLINT.inset).toBe(2.5);
    const k = glintKeyframes(130);
    expect(k.name).toBe("oo-glint-13000");
    expect(k.css).toBe(
      "@keyframes oo-glint-13000 { " +
        "0% { transform: translate(2.5cqw, 2.5cqw); } " +
        "21.591% { transform: translate(97.5cqw, 2.5cqw); } " +
        "50% { transform: translate(97.5cqw, 127.5cqw); } " +
        "71.591% { transform: translate(2.5cqw, 127.5cqw); } " +
        "100% { transform: translate(2.5cqw, 2.5cqw); } }",
    );
  });
  it("names each shape apart, since the corners move with the height", () => {
    const k = glintKeyframes(150);
    expect(k.name).toBe("oo-glint-15000");
    expect(k.css).toContain("19.792% { transform: translate(97.5cqw, 2.5cqw); }");
    expect(k.css).toContain("69.792% { transform: translate(2.5cqw, 147.5cqw); }");
  });
});

describe("glintRim", () => {
  it("is the card's outer 5 units, softened, as an image", () => {
    const url = glintRim(130);
    expect(url.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    const svg = decodeURIComponent(url.slice(url.indexOf(",") + 1));
    expect(svg).toContain('viewBox="0 0 100 130"');
    expect(svg).toContain('d="M0 0H100V130H0Z M5 5H95V125H5Z"');
    expect(svg).toContain('<feGaussianBlur stdDeviation="1.3"/>');
  });
});

describe("the Sheen family", () => {
  const shape = { height: SHAPES.portrait, seed: 7 };
  const classes = (id: keyof typeof MOTIONS) => ((MOTIONS[id] as MotionDef).light?.(shape) ?? []).map((p) => p.className);

  it("lists None, Sheen and the eight new motions in panel order", () => {
    expect(Object.values(MOTIONS).map((m) => m.label)).toEqual([
      "None", "Sheen", "Wave", "Visor", "Breathe", "Ripple", "Glint", "Starlight", "Cross", "Sway",
    ]);
  });
  it("gives every motion but None its frame class and a light layer", () => {
    for (const m of Object.values(MOTIONS) as MotionDef[]) {
      if (m.id === "none") continue;
      expect(m.className).toBe(`oo-motion-${m.id}`);
      expect(m.light).toBeTypeOf("function");
    }
  });
  it("draws each motion's pieces", () => {
    expect(classes("sheen")).toEqual([]);
    expect(classes("wave")).toEqual(["oo-light-wave"]);
    expect(classes("visor")).toEqual(["oo-light-bar"]);
    expect(classes("breathe")).toEqual(["oo-light-hold"]);
    expect(classes("ripple")).toEqual(["oo-light-ring", "oo-light-ring oo-light-ring-late"]);
    expect(classes("glint")).toEqual(["oo-light-rim"]);
    expect(classes("starlight")).toEqual(Array(STARLIGHT.points).fill("oo-light-point"));
    expect(classes("cross")).toEqual(["oo-light-band", "oo-light-band oo-light-band-mirror"]);
    expect(classes("sway")).toEqual(["oo-light-band"]);
  });
  it("places Starlight's pieces at its points, with their beats", () => {
    const pieces = MOTIONS.starlight.light(shape);
    const points = starlightPoints(shape);
    pieces.forEach((piece, i) => {
      const p = points[i]!;
      const u = (n: number) => Number(n.toFixed(3)).toString();
      expect(piece.style).toEqual({ left: `${u(p.x)}cqw`, top: `${u(p.y)}cqw`, "--oo-d": `${u(p.duration)}s`, "--oo-dl": `${u(p.delay)}s` });
    });
  });
  it("points Glint at its keyframes and its rim", () => {
    const [rim] = MOTIONS.glint.light(shape);
    expect(rim!.style).toEqual({ "--oo-rim": `url("${glintRim(shape.height)}")`, "--oo-glint": glintKeyframes(shape.height).name });
    expect(MOTIONS.glint.keyframes(shape)).toEqual(glintKeyframes(shape.height));
  });
  it("is never assigned: tiers name only None or Sheen, so only a founder's pick reaches a card", () => {
    for (const t of Object.values(TIERS)) expect(["none", "sheen"]).toContain(t.motion);
    const inputs: VariationInputs = {
      seed: 1, takenAt: null, camera: null, number: null, placeKind: null, photoPalette: null, gps: null, utcOffsetMinutes: null,
    };
    for (const number of [null, 0, 1, 5, 10, 11, 100, 101, 1000, 1001, 50000]) {
      expect(["none", "sheen"]).toContain(deriveVariation({ ...inputs, number }).motion);
    }
  });
});
