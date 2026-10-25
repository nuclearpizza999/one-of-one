import { describe, expect, it } from "vitest";
import { CAPTION_INK, CAPTION_MIN_CONTRAST, COORDS_INK, COORDS_MIN_CONTRAST, contrastRatio } from "../src/contrast";
import { INTROS, assignIntro } from "../src/intros";
import {
  MOTIONS,
  NEUTRAL_PALETTE,
  TIERS,
  TONES,
  VARIATION_RULES,
  type Palette,
  type VariationInputs,
  deriveTexture,
  deriveTier,
  deriveTone,
  deriveVariation,
  paletteFor,
  variationSeed,
  withOverrides,
} from "../src/variation";

const at = (month: number, hour: number) => new Date(2026, month, 15, hour, 0, 0);
// Clears the caption contrast floor as written, so paletteFor returns it unchanged.
const photoPalette: Palette = { tint: "#4466aa", foil: ["#c8d4ee", "#6a84c0"] };

describe("registries", () => {
  it("have ids equal to their keys and non-empty labels", () => {
    for (const reg of [TONES, TIERS, MOTIONS] as const) {
      for (const [key, def] of Object.entries(reg)) {
        expect(def.id).toBe(key);
        expect(def.label.length).toBeGreaterThan(0);
      }
    }
  });
  it("tiers point at registered motions", () => {
    for (const t of Object.values(TIERS)) expect(MOTIONS[t.motion]).toBeDefined();
  });
  it("preset tones carry colours and the photo tone does not", () => {
    for (const tone of Object.values(TONES)) {
      if (tone.source === "preset") {
        expect(tone.tint).toMatch(/^#[0-9a-f]{6}$/);
        expect(tone.foil).toHaveLength(2);
      } else {
        expect(tone.id).toBe("photo");
      }
    }
  });
});

describe("deriveTone", () => {
  it("is warm at golden hours in a neutral month", () => {
    expect(deriveTone(at(2, 7))).toBe("warm");
    expect(deriveTone(at(2, 18))).toBe("warm");
  });
  it("is neutral in the middle of the day", () => {
    expect(deriveTone(at(2, 12))).toBe("neutral");
  });
  it("is cool at night", () => {
    expect(deriveTone(at(4, 2))).toBe("cool");
    expect(deriveTone(at(4, 23))).toBe("cool");
  });
  it("shifts one step cool in winter and one step warm in summer, clamped", () => {
    expect(deriveTone(at(11, 7))).toBe("neutral");
    expect(deriveTone(at(0, 12))).toBe("cool");
    expect(deriveTone(at(0, 2))).toBe("cool");
    expect(deriveTone(at(6, 12))).toBe("warm");
    expect(deriveTone(at(6, 7))).toBe("warm");
  });
  it("is neutral without a capture time", () => {
    expect(deriveTone(null)).toBe("neutral");
  });
  it("never assigns the photo tone by itself", () => {
    for (let m = 0; m < 12; m += 1) for (let h = 0; h < 24; h += 1) expect(deriveTone(at(m, h))).not.toBe("photo");
  });
});

describe("deriveTier", () => {
  it.each([
    [1, "animated"], [10, "animated"], [11, "foil"], [100, "foil"],
    [101, "fine"], [1000, "fine"], [1001, "standard"], [0, "standard"],
  ] as const)("number %i → %s", (n, tier) => {
    expect(deriveTier(n)).toBe(tier);
  });
  it("is standard without a number", () => {
    expect(deriveTier(null)).toBe("standard");
  });
});

describe("deriveTexture", () => {
  const fuji = { make: "FUJIFILM", model: "X100VI" };
  const apple = { make: "Apple", model: "iPhone 15 Pro" };
  it("is foil for foil tiers whatever the camera or place", () => {
    expect(deriveTexture("foil", fuji, "landmark")).toBe("foil");
    expect(deriveTexture("animated", null, null)).toBe("foil");
  });
  it("is worn for a Fujifilm body, case-insensitively", () => {
    expect(deriveTexture("standard", fuji, "city")).toBe("worn");
    expect(deriveTexture("standard", { make: "Fujifilm", model: "X-T5" }, null)).toBe("worn");
  });
  it("is grain at a landmark or for the fine tier", () => {
    expect(deriveTexture("standard", apple, "landmark")).toBe("grain");
    expect(deriveTexture("fine", apple, "city")).toBe("grain");
  });
  it("is paper otherwise", () => {
    expect(deriveTexture("standard", apple, "city")).toBe("paper");
    expect(deriveTexture("standard", null, null)).toBe("paper");
  });
});

describe("paletteFor", () => {
  it("returns a preset's colours", () => {
    expect(paletteFor("warm", photoPalette)).toEqual({ tint: TONES.warm.tint, foil: TONES.warm.foil });
  });
  it("returns the sampled palette for the photo tone", () => {
    expect(paletteFor("photo", photoPalette)).toEqual(photoPalette);
  });
  it("falls back to neutral when the photo tone has no sample", () => {
    expect(paletteFor("photo", null)).toEqual(NEUTRAL_PALETTE);
  });
  it("lightens a sampled palette's foil until the caption keeps its contrast floor", () => {
    const dark: Palette = { tint: "#223355", foil: ["#8899bb", "#223355"] };
    const p = paletteFor("photo", dark);
    expect(p.tint).toBe(dark.tint);
    expect(p.foil[1]).not.toBe(dark.foil[1]);
    for (const stop of p.foil) {
      expect(contrastRatio(stop, CAPTION_INK)).toBeGreaterThanOrEqual(CAPTION_MIN_CONTRAST);
      expect(contrastRatio(stop, COORDS_INK)).toBeGreaterThanOrEqual(COORDS_MIN_CONTRAST);
    }
    expect(NEUTRAL_PALETTE).toEqual({ tint: TONES.neutral.tint, foil: TONES.neutral.foil });
  });
});

describe("deriveVariation", () => {
  const inputs: VariationInputs = {
    seed: 0x1234abcd,
    takenAt: at(6, 7),
    camera: { make: "Apple", model: "iPhone 15 Pro" },
    number: 7,
    placeKind: "city",
    photoPalette: null,
  };
  it("is deterministic", () => {
    expect(deriveVariation(inputs)).toEqual(deriveVariation({ ...inputs }));
  });
  it("combines the rules and takes motion from the tier, intro from the seed, palette from the tone", () => {
    expect(deriveVariation(inputs)).toEqual({
      texture: "foil",
      tone: "warm",
      palette: { tint: TONES.warm.tint, foil: TONES.warm.foil },
      tier: "animated",
      motion: "sheen",
      intro: assignIntro(0x1234abcd).id,
      seed: 0x1234abcd,
    });
    expect(deriveVariation({ ...inputs, number: null }).motion).toBe("none");
  });
  it("ignores the photo palette while the rule assigns a preset tone", () => {
    expect(deriveVariation({ ...inputs, photoPalette }).palette).toEqual({ tint: TONES.warm.tint, foil: TONES.warm.foil });
  });
  it("coerces the seed to unsigned 32-bit", () => {
    expect(deriveVariation({ ...inputs, seed: -1 }).seed).toBe(0xffffffff);
  });
  it("uses every assignable intro for some seed and no other", () => {
    const ids = new Set(INTROS.filter((i) => i.assignable).map((i) => i.id));
    const seen = new Set<string>();
    for (let s = 0; s < 30; s += 1) seen.add(deriveVariation({ ...inputs, seed: s }).intro);
    expect(seen).toEqual(ids);
  });
  it("never assigns the founders-only motions", () => {
    const assigned = new Set<string>(Object.values(TIERS).map((t) => t.motion));
    for (const m of ["glow", "twinkle", "petals"] as const) {
      expect(MOTIONS[m]).toBeDefined();
      expect(assigned.has(m)).toBe(false);
    }
  });
});

describe("withOverrides", () => {
  const base = deriveVariation({
    seed: 42, takenAt: at(2, 12), camera: null, number: null, placeKind: null, photoPalette: null,
  });
  it("returns an equal variation for no overrides", () => {
    expect(withOverrides(base, {}, photoPalette)).toEqual(base);
  });
  it("resolves the photo tone from the sampled palette, or neutral without one", () => {
    expect(withOverrides(base, { tone: "photo" }, photoPalette).palette).toEqual(photoPalette);
    expect(withOverrides(base, { tone: "photo" }, null).palette).toEqual(NEUTRAL_PALETTE);
    expect(withOverrides(base, { tone: "cool" }, photoPalette).palette).toEqual({ tint: TONES.cool.tint, foil: TONES.cool.foil });
  });
  it("lets motion follow an overridden tier unless motion is overridden too", () => {
    expect(withOverrides(base, { tier: "animated" }, null).motion).toBe("sheen");
    expect(withOverrides(base, { tier: "animated", motion: "none" }, null).motion).toBe("none");
    expect(withOverrides(base, { motion: "sheen" }, null).tier).toBe("standard");
  });
  it("carries the foil texture with an overridden foil tier, and drops it when the tier goes back", () => {
    expect(withOverrides(base, { tier: "foil" }, null).texture).toBe(VARIATION_RULES.texture.foil);
    expect(withOverrides(base, { tier: "animated" }, null).texture).toBe(VARIATION_RULES.texture.foil);
    expect(withOverrides(base, { tier: "fine" }, null).texture).toBe(base.texture);
    const foilBase = deriveVariation({ seed: 42, takenAt: at(2, 12), camera: null, number: 50, placeKind: null, photoPalette: null });
    expect(foilBase.texture).toBe(VARIATION_RULES.texture.foil);
    expect(withOverrides(foilBase, { tier: "standard" }, null).texture).toBe(VARIATION_RULES.texture.fallback);
    expect(withOverrides(base, { tier: "foil", texture: "worn" }, null).texture).toBe("worn");
  });
  it("overrides texture and intro directly", () => {
    const v = withOverrides(base, { texture: "worn", intro: "flip" }, null);
    expect(v.texture).toBe("worn");
    expect(v.intro).toBe("flip");
    expect(v.seed).toBe(base.seed);
  });
});

describe("variationSeed", () => {
  const facts = { sizeBytes: 123456, width: 3024, height: 4032, takenAtMs: 1782000000000, camera: { make: "Apple", model: "iPhone 15 Pro" } };
  it("is stable and unsigned 32-bit", () => {
    const s = variationSeed(facts);
    expect(s).toBe(variationSeed({ ...facts }));
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThan(2 ** 32);
  });
  it("changes when any fact changes", () => {
    const base = variationSeed(facts);
    expect(variationSeed({ ...facts, sizeBytes: 123457 })).not.toBe(base);
    expect(variationSeed({ ...facts, height: 4033 })).not.toBe(base);
    expect(variationSeed({ ...facts, takenAtMs: null })).not.toBe(base);
    expect(variationSeed({ ...facts, camera: null })).not.toBe(base);
    expect(variationSeed({ ...facts, camera: { make: "Apple", model: "iPhone 16" } })).not.toBe(base);
  });
  it("folds the card id in when there is one, and is unchanged without it", () => {
    const without = variationSeed(facts);
    expect(variationSeed({ ...facts, cardId: undefined })).toBe(without);
    const a = variationSeed({ ...facts, cardId: "7c1d9a6e-0d3f-4f7e-9c3a-0b6f8a9e1b2c" });
    const b = variationSeed({ ...facts, cardId: "c1b2a3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d" });
    expect(a).not.toBe(without);
    expect(a).not.toBe(b);
    expect(a).toBe(variationSeed({ ...facts, cardId: "7c1d9a6e-0d3f-4f7e-9c3a-0b6f8a9e1b2c" }));
  });
});
