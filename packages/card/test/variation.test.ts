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
  seasonStep,
  sunStep,
  variationSeed,
  withOverrides,
} from "../src/variation";
import { captureInstant, sunElevation } from "../src/sun";

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

const SEOUL = { lat: 37.5563, lng: 126.9236 };
const SYDNEY = { lat: -33.8688, lng: 151.2093 };
const SINGAPORE = { lat: 1.3521, lng: 103.8198 };
const noGps = (d: Date | null) => deriveTone({ takenAt: d, gps: null, utcOffsetMinutes: null });
const atPlace = (d: Date, gps: { lat: number; lng: number }, offset: number | null) => deriveTone({ takenAt: d, gps, utcOffsetMinutes: offset });
/** The first minute of a day, at a place and offset, whose sun elevation is inside [lo, hi]. */
function minuteWithSun(y: number, mo: number, d: number, offset: number, gps: { lat: number; lng: number }, lo: number, hi: number, fromHour: number): Date {
  for (let m = fromHour * 60; m < 24 * 60; m += 1) {
    const at = new Date(y, mo, d, Math.floor(m / 60), m % 60);
    const e = sunElevation(captureInstant(at, offset), gps.lat, gps.lng);
    if (e >= lo && e <= hi) return at;
  }
  throw new Error("no minute found");
}

describe("sunStep", () => {
  it("is the photo's colour in daylight, warm in the golden band and cool below it", () => {
    expect(sunStep(30)).toBe(1);
    expect(sunStep(6.01)).toBe(1);
    expect(sunStep(6)).toBe(2);
    expect(sunStep(0)).toBe(2);
    expect(sunStep(-4)).toBe(2);
    expect(sunStep(-4.01)).toBe(0);
    expect(sunStep(-40)).toBe(0);
  });
});

describe("seasonStep", () => {
  it("is warm in the northern summer and cool in the northern winter", () => {
    expect(seasonStep(6, SEOUL.lat)).toBe(1);
    expect(seasonStep(0, SEOUL.lat)).toBe(-1);
    expect(seasonStep(3, SEOUL.lat)).toBe(0);
  });
  it("flips in the southern hemisphere", () => {
    expect(seasonStep(6, SYDNEY.lat)).toBe(-1);
    expect(seasonStep(0, SYDNEY.lat)).toBe(1);
  });
  it("is nothing in the tropics", () => {
    for (let m = 0; m < 12; m += 1) expect(seasonStep(m, SINGAPORE.lat)).toBe(0);
    expect(seasonStep(6, 23.43)).toBe(0);
    expect(seasonStep(6, 23.44)).toBe(1);
  });
});

describe("deriveTone", () => {
  it("uses the hour ranges and no season without GPS", () => {
    expect(noGps(at(2, 7))).toBe("warm");
    expect(noGps(at(2, 18))).toBe("warm");
    expect(noGps(at(2, 12))).toBe("photo");
    expect(noGps(at(4, 2))).toBe("cool");
    expect(noGps(at(4, 23))).toBe("cool");
    expect(noGps(at(0, 12))).toBe("photo");
    expect(noGps(at(6, 12))).toBe("photo");
  });
  it("uses the hour ranges with the season when there is GPS but no time zone", () => {
    expect(atPlace(at(6, 12), SEOUL, null)).toBe("warm");
    expect(atPlace(at(0, 12), SEOUL, null)).toBe("cool");
    expect(atPlace(at(11, 7), SEOUL, null)).toBe("photo");
  });
  it("follows the sun with GPS and a time zone", () => {
    expect(atPlace(new Date(2026, 2, 15, 12, 30), SEOUL, 540)).toBe("photo");
    expect(atPlace(new Date(2026, 2, 15, 0, 30), SEOUL, 540)).toBe("cool");
    expect(atPlace(minuteWithSun(2026, 2, 15, 540, SEOUL, 0, 3, 15), SEOUL, 540)).toBe("warm");
    expect(atPlace(minuteWithSun(2026, 2, 15, 540, SEOUL, -6, -4.5, 15), SEOUL, 540)).toBe("cool");
  });
  it("adds the season by hemisphere and clamps", () => {
    expect(atPlace(new Date(2026, 5, 21, 12, 34), SEOUL, 540)).toBe("warm");
    expect(atPlace(new Date(2026, 6, 15, 12, 0), SYDNEY, 600)).toBe("cool");
    expect(atPlace(new Date(2026, 0, 15, 12, 0), SYDNEY, 600)).toBe("warm");
    expect(atPlace(minuteWithSun(2026, 5, 21, 540, SEOUL, 0, 3, 15), SEOUL, 540)).toBe("warm");
    expect(atPlace(new Date(2026, 0, 15, 0, 30), SEOUL, 540)).toBe("cool");
  });
  it("gives no season in the tropics", () => {
    expect(atPlace(new Date(2026, 0, 15, 13, 0), SINGAPORE, 480)).toBe("photo");
    expect(atPlace(new Date(2026, 6, 15, 13, 0), SINGAPORE, 480)).toBe("photo");
  });
  it("is the photo's colour without a capture time", () => {
    expect(noGps(null)).toBe("photo");
    expect(deriveTone({ takenAt: null, gps: SEOUL, utcOffsetMinutes: 540 })).toBe("photo");
  });
  it("never assigns neutral, which only a grey photo reaches through its palette", () => {
    for (let m = 0; m < 12; m += 1) {
      for (let h = 0; h < 24; h += 1) {
        expect(noGps(at(m, h))).not.toBe("neutral");
        expect(atPlace(at(m, h), SEOUL, 540)).not.toBe("neutral");
        expect(atPlace(at(m, h), SYDNEY, null)).not.toBe("neutral");
      }
    }
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
    gps: null,
    utcOffsetMinutes: null,
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
  // Noon derives the photo tone, so the base is built from the same sample the overrides are given.
  const base = deriveVariation({
    seed: 42, takenAt: at(2, 12), camera: null, number: null, placeKind: null, photoPalette, gps: null, utcOffsetMinutes: null,
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
    const foilBase = deriveVariation({ seed: 42, takenAt: at(2, 12), camera: null, number: 50, placeKind: null, photoPalette: null, gps: null, utcOffsetMinutes: null });
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
  it("hashes the photo's facts alone, so two cards of one photo share a seed", () => {
    const fnv1a = (s: string) => {
      let hash = 0x811c9dc5;
      for (let i = 0; i < s.length; i += 1) {
        hash ^= s.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
      }
      return hash >>> 0;
    };
    expect(variationSeed(facts)).toBe(fnv1a("123456:3024:4032:1782000000000:Apple|iPhone 15 Pro"));
    expect(variationSeed({ ...facts, camera: null, takenAtMs: null })).toBe(fnv1a("123456:3024:4032:0:|"));
  });
});
