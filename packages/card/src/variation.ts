import { GREY_SATURATION, hexToHsl, hslToHex } from "./colour";
import { withCaptionContrast } from "./contrast";
import { type IntroId, assignIntro } from "./intros";
import { captureInstant, sunElevation } from "./sun";
import type { Texture } from "./textures";

/*
 * Everything that varies is a registry entry. Adding one is data (plus, for a
 * texture, its draw function; for a motion, its CSS class). The types below are
 * derived from the registry keys, so a new entry needs no type edit.
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
 * A tone is how the card's colours are made from the photo's: as sampled, nudged
 * warmer or cooler, or the neutral grey a photo with no colour gets. No tone
 * carries a colour of its own.
 */
export type ToneDef = { id: string; label: string } & (
  | { source: "photo" }
  | { source: "nudge"; direction: 1 | -1 }
  | { source: "neutral" }
);

export const TONES = {
  warm: { id: "warm", label: "Warm", source: "nudge", direction: 1 },
  photo: { id: "photo", label: "Photo", source: "photo" },
  cool: { id: "cool", label: "Cool", source: "nudge", direction: -1 },
  neutral: { id: "neutral", label: "Neutral", source: "neutral" },
} as const satisfies Record<string, ToneDef>;
export type Tone = keyof typeof TONES;

/** The grey for a photo with no colour, or none sampled: one of the three fixed colours the card may draw. */
export const NEUTRAL_PALETTE: Palette = { tint: "#8a8a8a", foil: ["#ececec", "#9c9c9c"] };

/** `hex` mixed by `amount` toward the colour of `hue` (degrees) at hex's own saturation and lightness. */
function mixTowardHue(hex: string, hue: number, amount: number): string {
  const [, s, l] = hexToHsl(hex);
  const target = hslToHex(hue / 360, s, l);
  const a = Number.parseInt(hex.slice(1), 16);
  const b = Number.parseInt(target.slice(1), 16);
  const ch = (shift: number) => {
    const x = (a >> shift) & 255;
    const y = (b >> shift) & 255;
    return Math.round(x + (y - x) * amount).toString(16).padStart(2, "0");
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

/**
 * The palette nudged warmer (1) or cooler (-1): each colour mixed part of the way
 * toward the warm or cool hue at its own saturation and lightness, like a warming
 * filter. A grey palette is returned as it is: no colour comes from a nudge.
 */
export function nudgePalette(p: Palette, direction: 1 | -1): Palette {
  if (hexToHsl(p.tint)[1] < GREY_SATURATION) return p;
  const { nudge } = VARIATION_RULES;
  const hue = direction === 1 ? nudge.warmHue : nudge.coolHue;
  const move = (hex: string) => mixTowardHue(hex, hue, nudge.amount);
  return { tint: move(p.tint), foil: [move(p.foil[0]), move(p.foil[1])] };
}

/** The palette with its wash: the tint's hue, light, at a capped saturation. */
export function withWash(p: Palette): Palette {
  const [h, s] = hexToHsl(p.tint);
  const { wash } = VARIATION_RULES;
  return { tint: p.tint, foil: p.foil, wash: hslToHex(h, Math.min(s, wash.saturationMax), wash.lightness) };
}

/**
 * The colours a tone resolves to, from the photo's own sampled palette (neutral
 * without one), with a wash, every colour clearing the caption contrast floor.
 */
export function paletteFor(tone: Tone, photoPalette: Palette | null): Palette {
  const def: ToneDef = TONES[tone];
  const base = photoPalette ?? NEUTRAL_PALETTE;
  const raw = def.source === "neutral" ? NEUTRAL_PALETTE : def.source === "nudge" ? nudgePalette(base, def.direction) : base;
  return withCaptionContrast(withWash(raw));
}

export interface MotionDef {
  id: string;
  label: string;
  /** Class on .oo-frame that card.css animates; null for no motion. Screen only. */
  className: string | null;
}

export const MOTIONS = {
  none: { id: "none", label: "None", className: null },
  sheen: { id: "sheen", label: "Sheen", className: "oo-motion-sheen" },
} as const satisfies Record<string, MotionDef>;
export type Motion = keyof typeof MOTIONS;

/**
 * A stored motion as one the registry still has. Founders' saved cards may hold a retired
 * motion (Glow, Twinkle and Petals, retired Oct 27, 2026); those read as none. Saved rows
 * are never rewritten, so every read of a stored variation goes through this.
 */
export function knownMotion(id: string): Motion {
  return Object.hasOwn(MOTIONS, id) ? (id as Motion) : "none";
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
  /** Warm and cool are mixes toward these hues (degrees) by `amount` (0 to 1). */
  nudge: { warmHue: 35, coolHue: 215, amount: 0.2 },
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
  nudge: { warmHue: number; coolHue: number; amount: number };
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
 * The sun's real height when the photo knows where and when it was taken (GPS and
 * a UTC offset), otherwise the hour ranges; then the season, only with GPS, since
 * without it the hemisphere is unknown.
 */
export function deriveTone(f: ToneFacts): Tone {
  if (!f.takenAt) return "photo";
  const { tone } = VARIATION_RULES;
  let index: number;
  if (f.gps && f.utcOffsetMinutes !== null) {
    index = sunStep(sunElevation(captureInstant(f.takenAt, f.utcOffsetMinutes), f.gps.lat, f.gps.lng));
  } else {
    const hour = f.takenAt.getHours();
    index = inRanges(hour, tone.warmHours) ? 2 : inRanges(hour, tone.photoHours) ? 1 : 0;
  }
  if (f.gps) index += seasonStep(f.takenAt.getMonth(), f.gps.lat);
  return TONE_ORDER[Math.max(0, Math.min(TONE_ORDER.length - 1, index))]!;
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
  const tier = deriveTier(inputs.number);
  const texture = deriveTexture(tier, inputs.camera, inputs.placeKind);
  return {
    texture,
    tone,
    palette: paletteFor(tone, inputs.photoPalette),
    tier,
    motion: TIERS[tier].motion,
    intro: assignIntro(seed).id,
    seed,
  };
}

/** What the design panel may change (founders on the live site, everyone in development builds). Anyone else's overrides stay {}. */
export type VariationOverrides = Partial<Pick<Variation, "texture" | "tone" | "tier" | "motion" | "intro">>;

/** The texture an overridden tier implies: a foil tier always carries foil; leaving one drops back to the plain fallback. */
function textureForTier(tier: Tier, current: Texture): Texture {
  const t = VARIATION_RULES.texture;
  if (TIERS[tier].foil) return t.foil;
  return current === t.foil ? t.fallback : current;
}

/** Apply overrides and re-resolve what depends on them: the palette only from an overridden tone (a stored palette is kept otherwise), the motion and the texture from an overridden tier. */
export function withOverrides(base: Variation, overrides: VariationOverrides, photoPalette: Palette | null): Variation {
  const tone = overrides.tone ?? base.tone;
  const tier = overrides.tier ?? base.tier;
  const motion = overrides.motion ?? (overrides.tier !== undefined ? TIERS[tier].motion : base.motion);
  const texture = overrides.texture ?? (overrides.tier !== undefined ? textureForTier(tier, base.texture) : base.texture);
  return {
    ...base,
    texture,
    tone,
    palette: overrides.tone !== undefined ? paletteFor(tone, photoPalette) : base.palette,
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
