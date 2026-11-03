import { describe, expect, it } from "vitest";
import { hexToHsl, hslToHex } from "../src/colour";
import { CAPTION_INK, CAPTION_MIN_CONTRAST, COORDS_INK, COORDS_MIN_CONTRAST, contrastRatio, withCaptionContrast } from "../src/contrast";
import { INTROS, assignIntro } from "../src/intros";
import {
  NEUTRAL_PALETTE,
  TIERS,
  TONES,
  VARIATION_RULES,
  type Palette,
  type Tone,
  type VariationInputs,
  deriveTexture,
  deriveTier,
  deriveTone,
  deriveToneStrength,
  deriveVariation,
  knownToneStrength,
  paletteFor,
  seasonStep,
  sunStep,
  variationSeed,
  whiteBalance,
  withOverrides,
  withWash,
} from "../src/variation";
import { MOTIONS, knownMotion } from "../src/motions";
import { captureInstant, sunElevation } from "../src/sun";

const at = (month: number, hour: number) => new Date(2026, month, 15, hour, 0, 0);
// Clears the caption contrast floor as written, so paletteFor only adds its wash.
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
  it("tones are white-balance shifts of the photo's colour, the photo's colour itself, or the neutral grey", () => {
    expect(Object.keys(TONES)).toEqual(["warm", "photo", "cool", "neutral"]);
    expect(TONES.warm).toMatchObject({ source: "shift", direction: 1 });
    expect(TONES.cool).toMatchObject({ source: "shift", direction: -1 });
    expect(TONES.photo.source).toBe("photo");
    expect(TONES.neutral.source).toBe("neutral");
    for (const tone of Object.values(TONES)) expect(JSON.stringify(tone)).not.toMatch(/#[0-9a-f]{3,6}/i);
  });
});

const SEOUL = { lat: 37.5563, lng: 126.9236 };
const SYDNEY = { lat: -33.8688, lng: 151.2093 };
const SINGAPORE = { lat: 1.3521, lng: 103.8198 };
const LONDON = { lat: 51.5074, lng: -0.1278 };
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
  it("takes the sun path for a UTC offset of zero, which is a zone and not a missing one", () => {
    // 19:00 in London in mid-March: the hour ranges say warm, but the sun is well below the cool line.
    const evening = new Date(2026, 2, 15, 19, 0);
    expect(sunElevation(captureInstant(evening, 0), LONDON.lat, LONDON.lng)).toBeLessThan(-4);
    expect(atPlace(evening, LONDON, null)).toBe("warm");
    expect(atPlace(evening, LONDON, 0)).toBe("cool");
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

describe("deriveToneStrength", () => {
  const strength = (d: Date, gps: { lat: number; lng: number }, offset: number | null) => deriveToneStrength({ takenAt: d, gps, utcOffsetMinutes: offset });
  // Seoul, March 15 (spring, no season step), June 21 (summer), January 15 (winter); +09:00.
  const spring = (lo: number, hi: number) => minuteWithSun(2026, 2, 15, 540, SEOUL, lo, hi, 15);
  const summer = (lo: number, hi: number) => minuteWithSun(2026, 5, 21, 540, SEOUL, lo, hi, 15);

  it("runs weak to strong through golden hour, with summer adding half the range", () => {
    expect(strength(spring(5.5, 6), SEOUL, 540)).toBe(6);
    expect(strength(spring(-4, -3.6), SEOUL, 540)).toBe(13);
    expect(strength(summer(5.5, 6), SEOUL, 540)).toBe(13);
    expect(strength(summer(-4, -3.6), SEOUL, 540)).toBe(20);
  });
  it("runs weak to strong into the night, with winter adding half the range", () => {
    expect(strength(spring(-4.4, -4.05), SEOUL, 540)).toBe(6);
    expect(strength(new Date(2026, 2, 15, 0, 30), SEOUL, 540)).toBe(13);
    expect(strength(new Date(2026, 0, 15, 0, 30), SEOUL, 540)).toBe(20);
  });
  it("is weak when the season alone makes a midday photo warm or cool", () => {
    expect(atPlace(new Date(2026, 5, 21, 12, 34), SEOUL, 540)).toBe("warm");
    expect(strength(new Date(2026, 5, 21, 12, 34), SEOUL, 540)).toBe(6);
    expect(atPlace(new Date(2026, 0, 15, 12, 0), SEOUL, 540)).toBe("cool");
    expect(strength(new Date(2026, 0, 15, 12, 0), SEOUL, 540)).toBe(6);
  });
  it("is the middle when the sun's position is unknown, for the photo's colour, and without a time", () => {
    expect(deriveToneStrength({ takenAt: at(2, 7), gps: null, utcOffsetMinutes: null })).toBe(13);
    expect(strength(at(0, 12), SEOUL, null)).toBe(13);
    expect(strength(new Date(2026, 2, 15, 12, 30), SEOUL, 540)).toBe(13);
    expect(deriveToneStrength({ takenAt: null, gps: SEOUL, utcOffsetMinutes: 540 })).toBe(13);
  });
  it("stays within weak and strong", () => {
    for (let m = 0; m < 24 * 60; m += 7) {
      for (const month of [0, 2, 5]) {
        const s = strength(new Date(2026, month, 15, Math.floor(m / 60), m % 60), SEOUL, 540);
        expect(s).toBeGreaterThanOrEqual(VARIATION_RULES.strength.weak);
        expect(s).toBeLessThanOrEqual(VARIATION_RULES.strength.strong);
      }
    }
  });
});

describe("knownToneStrength", () => {
  it("keeps a whole strength from 0 to the slider's top and reads anything else as the middle", () => {
    for (const s of [0, 6, 13, 20]) expect(knownToneStrength(s)).toBe(s);
    for (const s of [undefined, null, -1, 21, 6.5, "13", Number.NaN]) expect(knownToneStrength(s)).toBe(13);
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

const rgb = (hex: string) => [1, 3, 5].map((k) => Number.parseInt(hex.slice(k, k + 2), 16)) as [number, number, number];

describe("whiteBalance", () => {
  const blue: Palette = { tint: "#4466aa", foil: ["#c8d4ee", "#6a84c0"], wash: "#e3ebf2" };
  it("adds to red and takes from blue for warm, in the wash, the tint and both foil stops", () => {
    const w = whiteBalance(blue, 1, 10);
    for (const [before, after] of [[blue.tint, w.tint], [blue.foil[0], w.foil[0]], [blue.foil[1], w.foil[1]], [blue.wash!, w.wash!]] as const) {
      expect(rgb(after)[0]).toBe(rgb(before)[0] + 10);
      expect(rgb(after)[1]).toBe(rgb(before)[1]);
      expect(rgb(after)[2]).toBe(rgb(before)[2] - 10);
    }
  });
  it("does the reverse for cool, and clamps at 0 and 255", () => {
    const c = whiteBalance(blue, -1, 10);
    expect(rgb(c.tint)).toEqual([rgb(blue.tint)[0] - 10, rgb(blue.tint)[1], rgb(blue.tint)[2] + 10]);
    expect(rgb(whiteBalance({ tint: "#05a0fa", foil: ["#05a0fa", "#05a0fa"] }, -1, 20).tint)).toEqual([0, 160, 255]);
  });
  it("leaves a palette without a wash without one", () => {
    expect(whiteBalance({ tint: blue.tint, foil: blue.foil }, 1, 6).wash).toBeUndefined();
  });
  it("leaves a grey palette alone: a photo with no colour gets none from a tone", () => {
    expect(whiteBalance(NEUTRAL_PALETTE, 1, 20)).toBe(NEUTRAL_PALETTE);
    expect(whiteBalance(withWash(NEUTRAL_PALETTE), -1, 20)).toEqual(withWash(NEUTRAL_PALETTE));
  });
});

describe("withWash", () => {
  it("adds a light wash in the tint's hue with a capped saturation", () => {
    const p = withWash(photoPalette);
    const [h, s, l] = hexToHsl(p.wash!);
    // A wash this light has only a dozen 8-bit levels of colour, so hue and saturation round coarsely.
    expect(Math.abs(h - hexToHsl(photoPalette.tint)[0]) * 360).toBeLessThan(5);
    expect(s).toBeLessThanOrEqual(VARIATION_RULES.wash.saturationMax + 0.03);
    expect(Math.abs(l - VARIATION_RULES.wash.lightness)).toBeLessThan(0.01);
    expect(p.tint).toBe(photoPalette.tint);
    expect(p.foil).toEqual(photoPalette.foil);
  });
  it("gives the neutral palette a grey wash", () => {
    const [, s] = hexToHsl(withWash(NEUTRAL_PALETTE).wash!);
    expect(s).toBe(0);
  });
});

describe("paletteFor", () => {
  it("gives every tone a wash", () => {
    for (const tone of Object.keys(TONES) as Tone[]) {
      expect(paletteFor(tone, photoPalette, 13).wash, tone).toMatch(/^#[0-9a-f]{6}$/);
      expect(paletteFor(tone, null, 13).wash, tone).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
  it("returns the sampled palette with its wash for the photo tone", () => {
    expect(paletteFor("photo", photoPalette, 13)).toEqual(withWash(photoPalette));
  });
  it("shifts the sampled palette's white balance by the strength for warm and cool", () => {
    expect(paletteFor("warm", photoPalette, 13)).toEqual(withCaptionContrast(whiteBalance(withWash(photoPalette), 1, 13)));
    expect(paletteFor("cool", photoPalette, 6)).toEqual(withCaptionContrast(whiteBalance(withWash(photoPalette), -1, 6)));
    expect(paletteFor("warm", photoPalette, 20)).not.toEqual(paletteFor("warm", photoPalette, 6));
  });
  it("ignores the strength for the photo's colour and the neutral grey", () => {
    expect(paletteFor("photo", photoPalette, 20)).toEqual(paletteFor("photo", photoPalette, 0));
    expect(paletteFor("neutral", photoPalette, 20)).toEqual(paletteFor("neutral", photoPalette, 0));
  });
  it("is the neutral grey for neutral, and for any tone without a sample", () => {
    expect(paletteFor("neutral", photoPalette, 13).tint).toBe(NEUTRAL_PALETTE.tint);
    for (const tone of Object.keys(TONES) as Tone[]) expect(paletteFor(tone, null, 13).tint, tone).toBe(NEUTRAL_PALETTE.tint);
  });
  it("lightens a sampled palette's foil until the caption keeps its contrast floor", () => {
    const dark: Palette = { tint: "#223355", foil: ["#8899bb", "#223355"] };
    const p = paletteFor("photo", dark, 13);
    expect(p.tint).toBe(dark.tint);
    expect(p.foil[1]).not.toBe(dark.foil[1]);
    for (const c of [...p.foil, p.wash!]) {
      expect(contrastRatio(c, CAPTION_INK)).toBeGreaterThanOrEqual(CAPTION_MIN_CONTRAST);
      expect(contrastRatio(c, COORDS_INK)).toBeGreaterThanOrEqual(COORDS_MIN_CONTRAST);
    }
  });
  it("keeps the neutral grey as written", () => {
    expect(NEUTRAL_PALETTE).toEqual({ tint: "#8a8a8a", foil: ["#ececec", "#9c9c9c"] });
  });
});

describe("Warm and Cool are visible", () => {
  it("move a photo's wash apart and away from Photo even at the weak end, for every hue", () => {
    const { weak } = VARIATION_RULES.strength;
    const redOverBlue = (c: [number, number, number]) => c[0] - c[2];
    for (let hue = 0; hue < 360; hue += 15) {
      for (const s of [0.2, 0.45, 0.7]) {
        for (const l of [0.3, 0.5, 0.7]) {
          const h = hue / 360;
          const sample: Palette = { tint: hslToHex(h, s, l), foil: [hslToHex(h, s, 0.85), hslToHex(h, s, 0.45)] };
          const [w, p, c] = (["warm", "photo", "cool"] as const).map((t) => rgb(paletteFor(t, sample, weak).wash!));
          const label = `${hue}/${s}/${l}`;
          expect(redOverBlue(w!), label).toBeGreaterThan(redOverBlue(p!));
          expect(redOverBlue(c!), label).toBeLessThan(redOverBlue(p!));
          expect(Math.hypot(w![0] - c![0], w![1] - c![1], w![2] - c![2]), label).toBeGreaterThanOrEqual(12);
        }
      }
    }
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
      palette: paletteFor("warm", null, 13),
      tier: "animated",
      motion: "sheen",
      intro: assignIntro(0x1234abcd).id,
      seed: 0x1234abcd,
      toneStrength: 13,
    });
    expect(deriveVariation({ ...inputs, number: null }).motion).toBe("none");
  });
  it("shifts the photo's own palette by the card's strength rather than replacing it", () => {
    const v = deriveVariation({ ...inputs, photoPalette });
    expect(v.palette).toEqual(paletteFor("warm", photoPalette, v.toneStrength));
    expect(v.palette.wash).not.toBe(paletteFor("photo", photoPalette, v.toneStrength).wash);
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
  it("has retired Glow, Twinkle and Petals, and reads a retired or unknown stored motion as none", () => {
    for (const m of ["glow", "twinkle", "petals", "bogus", ""]) {
      expect(Object.hasOwn(MOTIONS, m)).toBe(false);
      expect(knownMotion(m)).toBe("none");
    }
    for (const m of Object.keys(MOTIONS)) expect(knownMotion(m)).toBe(m);
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
  it("re-resolves the palette from the sample only when the tone is overridden", () => {
    expect(withOverrides(base, { tone: "photo" }, photoPalette).palette).toEqual(paletteFor("photo", photoPalette, base.toneStrength));
    expect(withOverrides(base, { tone: "photo" }, null).palette).toEqual(paletteFor("photo", null, base.toneStrength));
    expect(withOverrides(base, { tone: "cool" }, photoPalette).palette).toEqual(paletteFor("cool", photoPalette, base.toneStrength));
  });
  it("re-resolves the palette when the strength is overridden, and keeps the tone's own strength otherwise", () => {
    const warm = withOverrides(base, { tone: "warm" }, photoPalette);
    expect(warm.toneStrength).toBe(base.toneStrength);
    const strong = withOverrides(base, { tone: "warm", toneStrength: 20 }, photoPalette);
    expect(strong.toneStrength).toBe(20);
    expect(strong.palette).toEqual(paletteFor("warm", photoPalette, 20));
    const stored: Palette = { tint: "#b08860", foil: ["#f3d9a4", "#b8864a"] };
    const saved = { ...base, tone: "warm" as const, palette: stored };
    expect(withOverrides(saved, { toneStrength: 18 }, photoPalette).palette).toEqual(paletteFor("warm", photoPalette, 18));
  });
  it("keeps a stored palette, wash or none, when the tone is not overridden", () => {
    const stored: Palette = { tint: "#b08860", foil: ["#f3d9a4", "#b8864a"] };
    const saved = { ...base, tone: "warm" as const, palette: stored };
    expect(withOverrides(saved, {}, null).palette).toBe(stored);
    expect(withOverrides(saved, { texture: "worn" }, photoPalette).palette).toBe(stored);
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
