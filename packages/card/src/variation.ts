import { GREY_SATURATION, hexToHsl, hslToHex } from "./colour";
import { withCaptionContrast } from "./contrast";
import { type IntroId, assignIntro } from "./intros";
import { captureInstant, sunElevation } from "./sun";
import type { Motion } from "./motions";
import type { Texture } from "./textures";

/*
 * Everything that varies is a registry entry. Adding one is data (plus, for a
 * texture, its draw function; for a motion, its CSS and the pieces its light
 * layer holds, in motions.ts). The types below are derived from the registry
 * keys, so a new entry needs no type edit.
 */

/** Resolved colours the border draws with, as hex. */
export interface Palette {
  /** Grain and pattern ink over the mat. */
  tint: string;
  /** Foil gradient stops, light then dark. */
  foil: readonly [string, string];
  /** The flat colour under the whole mat. Absent on cards saved before Oct 26, 2026, which draw no wash. */
  wash?: string;
}

/**
 * A tone is how the card's colours are made from the photo's: as sampled, shifted
 * warmer or cooler like a camera's white balance, or the neutral grey a photo with
 * no colour gets. No tone carries a colour of its own.
 */
export type ToneDef = { id: string; label: string } & (
  | { source: "photo" }
  | { source: "shift"; direction: 1 | -1 }
  | { source: "neutral" }
);

export const TONES = {
  warm: { id: "warm", label: "Warm", source: "shift", direction: 1 },
  photo: { id: "photo", label: "Photo", source: "photo" },
  cool: { id: "cool", label: "Cool", source: "shift", direction: -1 },
  neutral: { id: "neutral", label: "Neutral", source: "neutral" },
} as const satisfies Record<string, ToneDef>;
export type Tone = keyof typeof TONES;

/** The grey for a photo with no colour, or none sampled: one of the three fixed colours the card may draw. */
export const NEUTRAL_PALETTE: Palette = { tint: "#8a8a8a", foil: ["#ececec", "#9c9c9c"] };

/**
 * The palette shifted like a camera's white balance: `steps` (of 255) added to red and
 * taken from blue for warm (direction 1), the reverse for cool, on the wash, the tint and
 * both foil stops, each channel kept within 0 to 255. A grey palette is returned as it is:
 * no colour comes from a tone. Colours are `#rrggbb`.
 */
export function whiteBalance(p: Palette, direction: 1 | -1, steps: number): Palette {
  if (hexToHsl(p.tint)[1] < GREY_SATURATION) return p;
  const shift = (hex: string): string => {
    const n = Number.parseInt(hex.slice(1), 16);
    const channel = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0");
    return `#${channel(((n >> 16) & 255) + direction * steps)}${channel((n >> 8) & 255)}${channel((n & 255) - direction * steps)}`;
  };
  return {
    tint: shift(p.tint),
    foil: [shift(p.foil[0]), shift(p.foil[1])],
    ...(p.wash ? { wash: shift(p.wash) } : {}),
  };
}

/** The palette with its wash: the tint's hue, light, at a capped saturation. */
export function withWash(p: Palette): Palette {
  const [h, s] = hexToHsl(p.tint);
  const { wash } = VARIATION_RULES;
  return { tint: p.tint, foil: p.foil, wash: hslToHex(h, Math.min(s, wash.saturationMax), wash.lightness) };
}

/**
 * The colours a tone resolves to, from the photo's own sampled palette (neutral
 * without one): the palette and its wash, shifted by `strength` for warm and cool,
 * every colour clearing the caption contrast floor. The photo's colour and the
 * neutral grey ignore the strength.
 */
export function paletteFor(tone: Tone, photoPalette: Palette | null, strength: number): Palette {
  const def: ToneDef = TONES[tone];
  const washed = withWash(def.source === "neutral" ? NEUTRAL_PALETTE : (photoPalette ?? NEUTRAL_PALETTE));
  return withCaptionContrast(def.source === "shift" ? whiteBalance(washed, def.direction, strength) : washed);
}

export interface TierDef {
  id: string;
  label: string;
  /** Foil tiers always get the foil texture. */
  foil: boolean;
  motion: Motion;
}

export const TIERS = {
  standard: { id: "standard", label: "Standard", foil: false, motion: "none" },
  fine: { id: "fine", label: "Fine", foil: false, motion: "none" },
  foil: { id: "foil", label: "Foil", foil: true, motion: "none" },
  animated: { id: "animated", label: "Animated", foil: true, motion: "sheen" },
} as const satisfies Record<string, TierDef>;
export type Tier = keyof typeof TIERS;

export type PlaceKindLike = "venue" | "landmark" | "neighborhood" | "city";

export interface Variation {
  texture: Texture;
  tone: Tone;
  /** How far Warm or Cool shifts the palette, in steps of 255 on red and blue (VARIATION_RULES.strength). Stored with the card; the photo's colour and the grey ignore it. */
  toneStrength: number;
  palette: Palette;
  tier: Tier;
  motion: Motion;
  intro: IntroId;
  seed: number;
}

export interface VariationInputs {
  seed: number;
  takenAt: Date | null;
  camera: { make: string; model: string } | null;
  /** null until the card is public. */
  number: number | null;
  placeKind: PlaceKindLike | null;
  /** Sampled from the decoded photo by the app; null when unavailable. */
  photoPalette: Palette | null;
  /** From EXIF; null when the photo carries no position. */
  gps: { lat: number; lng: number } | null;
  /** From EXIF; null when the photo records no time zone. */
  utcOffsetMinutes: number | null;
}

/**
 * First-draft mapping (SPEC.md: settle after textures have been seen on about
 * 50 real photos). Edit the table, not the functions.
 */
export const VARIATION_RULES = {
  tone: {
    warmHours: [[5, 9], [17, 20]],
    photoHours: [[10, 16]],
    coolMonths: [10, 11, 0, 1],
    warmMonths: [5, 6, 7],
    /** Sun elevation in degrees: above dayAbove is day, from coolBelow up to dayAbove golden hour, below it blue hour and night. */
    sun: { dayAbove: 6, coolBelow: -4 },
    /** Within this absolute latitude there is no season step. */
    tropicLatitude: 23.44,
  },
  tier: [
    { upTo: 10, tier: "animated" },
    { upTo: 100, tier: "foil" },
    { upTo: 1000, tier: "fine" },
  ],
  texture: {
    fujiMakePrefix: "FUJIFILM",
    fuji: "worn",
    landmark: "grain",
    fine: "grain",
    fallback: "paper",
    foil: "foil",
  },
  /**
   * How strongly Warm and Cool shift a card, in steps of 255: from `weak` to `strong` by how deep
   * the sun is into golden hour or into the night (night is full at `nightBelow` degrees), with the
   * season adding half the range. `max` is the top of the founders' slider.
   */
  strength: { weak: 6, strong: 20, nightBelow: -18, max: 20 },
  /** The wash under the whole mat: HSL lightness, and the most saturation it keeps from the tint. Sets how visible the colour is at phone size. */
  wash: { lightness: 0.92, saturationMax: 0.35 },
} as const satisfies {
  tone: {
    warmHours: readonly (readonly [number, number])[];
    photoHours: readonly (readonly [number, number])[];
    coolMonths: readonly number[];
    warmMonths: readonly number[];
    sun: { dayAbove: number; coolBelow: number };
    tropicLatitude: number;
  };
  tier: readonly { upTo: number; tier: Tier }[];
  texture: { fujiMakePrefix: string; fuji: Texture; landmark: Texture; fine: Texture; fallback: Texture; foil: Texture };
  strength: { weak: number; strong: number; nightBelow: number; max: number };
  wash: { lightness: number; saturationMax: number };
};

/** The tones the rule steps along, cool to warm. Neutral is never assigned: a grey photo reaches it through its palette. */
const TONE_ORDER = ["cool", "photo", "warm"] as const satisfies readonly Tone[];

function inRanges(value: number, ranges: readonly (readonly [number, number])[]): boolean {
  return ranges.some(([lo, hi]) => value >= lo && value <= hi);
}

export interface ToneFacts {
  takenAt: Date | null;
  gps: { lat: number; lng: number } | null;
  /** The capture time's UTC offset from EXIF; null when the photo does not record one. */
  utcOffsetMinutes: number | null;
}

/** The step along TONE_ORDER the sun gives: 1 the photo's colour by day, 2 warm in the golden band, 0 cool in blue hour and at night. */
export function sunStep(elevation: number): number {
  const { sun } = VARIATION_RULES.tone;
  if (elevation > sun.dayAbove) return 1;
  if (elevation >= sun.coolBelow) return 2;
  return 0;
}

/** One step warm in summer, one cool in winter, by the photo's own hemisphere; nothing in the tropics. `month` is 0 to 11. */
export function seasonStep(month: number, lat: number): number {
  const { tone } = VARIATION_RULES;
  if (Math.abs(lat) < tone.tropicLatitude) return 0;
  const northern = lat < 0 ? (month + 6) % 12 : month;
  const coolMonths: readonly number[] = tone.coolMonths;
  const warmMonths: readonly number[] = tone.warmMonths;
  if (coolMonths.includes(northern)) return -1;
  if (warmMonths.includes(northern)) return 1;
  return 0;
}

/**
 * Where the sun and the season put a photo: the summed steps along TONE_ORDER, not yet
 * clamped, and the sun's elevation when the photo knows where and when it was taken
 * (GPS and a UTC offset). Without both, the hour ranges stand in and the sun is null.
 * The season counts only with GPS, since without it the hemisphere is unknown. Null
 * without a capture time.
 */
function toneSteps(f: ToneFacts): { steps: number; sun: number | null } | null {
  if (!f.takenAt) return null;
  const { tone } = VARIATION_RULES;
  let steps: number;
  let sun: number | null = null;
  if (f.gps && f.utcOffsetMinutes !== null) {
    sun = sunElevation(captureInstant(f.takenAt, f.utcOffsetMinutes), f.gps.lat, f.gps.lng);
    steps = sunStep(sun);
  } else {
    const hour = f.takenAt.getHours();
    steps = inRanges(hour, tone.warmHours) ? 2 : inRanges(hour, tone.photoHours) ? 1 : 0;
  }
  if (f.gps) steps += seasonStep(f.takenAt.getMonth(), f.gps.lat);
  return { steps, sun };
}

/** The sun's real height when the photo knows where and when it was taken, otherwise the hour ranges; then the season. */
export function deriveTone(f: ToneFacts): Tone {
  const sky = toneSteps(f);
  if (!sky) return "photo";
  return TONE_ORDER[Math.max(0, Math.min(TONE_ORDER.length - 1, sky.steps))]!;
}

/** The middle of the assigned range: for a photo whose sun is unknown, and for the photo's colour. */
function middleStrength(): number {
  const { strength } = VARIATION_RULES;
  return Math.round((strength.weak + strength.strong) / 2);
}

/**
 * How strongly Warm or Cool shifts the card, from weak to strong. Half the range is the
 * season pushing the same way as the sun (summer for warm, winter for cool); the other half
 * is how deep the sun is: from the top of the golden band (6° up) to its foot (4° below)
 * for warm, from there to full night for cool. Warmth or coolness from the season alone is
 * weak. The middle when the sun's position is unknown, and for the photo's colour, so a
 * founder's switch to Warm or Cool starts there.
 */
export function deriveToneStrength(f: ToneFacts): number {
  const sky = toneSteps(f);
  if (!sky || sky.sun === null) return middleStrength();
  const { strength, tone } = VARIATION_RULES;
  const warm = sky.steps >= 2;
  const cool = sky.steps <= 0;
  if (!warm && !cool) return middleStrength();
  const overshoot = warm ? sky.steps - 2 : -sky.steps;
  const band = sunStep(sky.sun);
  const depth = warm
    ? band === 2 ? (tone.sun.dayAbove - sky.sun) / (tone.sun.dayAbove - tone.sun.coolBelow) : 0
    : band === 0 ? (tone.sun.coolBelow - sky.sun) / (tone.sun.coolBelow - strength.nightBelow) : 0;
  const t = Math.max(0, Math.min(1, (overshoot + Math.max(0, Math.min(1, depth))) / 2));
  return Math.round(strength.weak + (strength.strong - strength.weak) * t);
}

/**
 * A stored strength as one the slider has: a whole number from 0 to the slider's top as
 * it is, anything else (a card saved before strengths, Nov 3, 2026) the middle. Saved rows
 * are never rewritten, so every read of a stored variation goes through this.
 */
export function knownToneStrength(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= VARIATION_RULES.strength.max
    ? value
    : middleStrength();
}

export function deriveTier(number: number | null): Tier {
  if (number === null || number < 1) return "standard";
  for (const rule of VARIATION_RULES.tier) if (number <= rule.upTo) return rule.tier;
  return "standard";
}

export function deriveTexture(
  tier: Tier,
  camera: { make: string; model: string } | null,
  placeKind: PlaceKindLike | null,
): Texture {
  const t = VARIATION_RULES.texture;
  if (TIERS[tier].foil) return t.foil;
  if (camera && camera.make.toUpperCase().startsWith(t.fujiMakePrefix)) return t.fuji;
  if (placeKind === "landmark") return t.landmark;
  if (tier === "fine") return t.fine;
  return t.fallback;
}

/** Pure and deterministic: the same inputs always give the same variation. Users never pick any of it. */
export function deriveVariation(inputs: VariationInputs): Variation {
  const seed = inputs.seed >>> 0;
  const tone = deriveTone({ takenAt: inputs.takenAt, gps: inputs.gps, utcOffsetMinutes: inputs.utcOffsetMinutes });
  const toneStrength = deriveToneStrength({ takenAt: inputs.takenAt, gps: inputs.gps, utcOffsetMinutes: inputs.utcOffsetMinutes });
  const tier = deriveTier(inputs.number);
  const texture = deriveTexture(tier, inputs.camera, inputs.placeKind);
  return {
    texture,
    tone,
    palette: paletteFor(tone, inputs.photoPalette, toneStrength),
    tier,
    motion: TIERS[tier].motion,
    intro: assignIntro(seed).id,
    seed,
    toneStrength,
  };
}

/** What the design panel may change (founders on the live site, everyone in development builds). Anyone else's overrides stay {}. */
export type VariationOverrides = Partial<Pick<Variation, "texture" | "tone" | "toneStrength" | "tier" | "motion" | "intro">>;

/** The texture an overridden tier implies: a foil tier always carries foil; leaving one drops back to the plain fallback. */
function textureForTier(tier: Tier, current: Texture): Texture {
  const t = VARIATION_RULES.texture;
  if (TIERS[tier].foil) return t.foil;
  return current === t.foil ? t.fallback : current;
}

/** Apply overrides and re-resolve what depends on them: the palette only from an overridden tone or strength (a stored palette is kept otherwise), the motion and the texture from an overridden tier. */
export function withOverrides(base: Variation, overrides: VariationOverrides, photoPalette: Palette | null): Variation {
  const tone = overrides.tone ?? base.tone;
  const toneStrength = overrides.toneStrength ?? base.toneStrength;
  const tier = overrides.tier ?? base.tier;
  const motion = overrides.motion ?? (overrides.tier !== undefined ? TIERS[tier].motion : base.motion);
  const texture = overrides.texture ?? (overrides.tier !== undefined ? textureForTier(tier, base.texture) : base.texture);
  return {
    ...base,
    texture,
    tone,
    palette: overrides.tone !== undefined || overrides.toneStrength !== undefined ? paletteFor(tone, photoPalette, toneStrength) : base.palette,
    toneStrength,
    tier,
    motion,
    intro: overrides.intro ?? base.intro,
  };
}

export interface SeedFacts {
  sizeBytes: number;
  width: number;
  height: number;
  takenAtMs: number | null;
  camera: { make: string; model: string } | null;
}

/**
 * FNV-1a over the photo's own facts. The card id is not part of it (SPEC.md,
 * decided Oct 26, 2026): the same photo always gets the same card.
 */
export function variationSeed(f: SeedFacts): number {
  const input = `${f.sizeBytes}:${f.width}:${f.height}:${f.takenAtMs ?? 0}:${f.camera?.make ?? ""}|${f.camera?.model ?? ""}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
