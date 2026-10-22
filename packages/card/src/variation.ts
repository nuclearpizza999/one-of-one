import { withCaptionContrast } from "./contrast";
import { type IntroId, assignIntro } from "./intros";
import type { Texture } from "./textures";

/*
 * Everything that varies is a registry entry. Adding one is data (plus, for a
 * texture, its draw function; for a motion, its CSS class). The types below are
 * derived from the registry keys, so a new entry needs no type edit.
 */

/** Resolved colours the border draws with, as hex. */
export interface Palette {
  /** Grain tint over the white mat. */
  tint: string;
  /** Foil gradient stops, light then dark. */
  foil: readonly [string, string];
}

/** A tone is a source of colours: a preset, or the photo itself (sampled by the app). */
export type ToneDef = { id: string; label: string } & (
  | { source: "preset"; tint: string; foil: readonly [string, string] }
  | { source: "photo" }
);

export const TONES = {
  warm: { id: "warm", label: "Warm", source: "preset", tint: "#b08860", foil: ["#f3d9a4", "#b8864a"] },
  neutral: { id: "neutral", label: "Neutral", source: "preset", tint: "#8a8a8a", foil: ["#ececec", "#9c9c9c"] },
  cool: { id: "cool", label: "Cool", source: "preset", tint: "#6878a0", foil: ["#d9e2f6", "#7086ba"] },
  photo: { id: "photo", label: "Photo", source: "photo" },
} as const satisfies Record<string, ToneDef>;
export type Tone = keyof typeof TONES;

export const NEUTRAL_PALETTE: Palette = { tint: TONES.neutral.tint, foil: TONES.neutral.foil };

/**
 * The colours a tone resolves to, each clearing the caption contrast floor. The
 * photo tone needs the sampled palette; without one it is neutral. Presets clear
 * the floor as written; a sampled palette is lightened until it does.
 */
export function paletteFor(tone: Tone, photoPalette: Palette | null): Palette {
  const def = TONES[tone];
  const raw = def.source === "preset" ? { tint: def.tint, foil: def.foil } : (photoPalette ?? NEUTRAL_PALETTE);
  return withCaptionContrast(raw);
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
}

/**
 * First-draft mapping (SPEC.md: settle after textures have been seen on about
 * 50 real photos). Edit the table, not the functions.
 */
export const VARIATION_RULES = {
  tone: {
    warmHours: [[5, 9], [17, 20]],
    neutralHours: [[10, 16]],
    coolMonths: [10, 11, 0, 1],
    warmMonths: [5, 6, 7],
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
} as const satisfies {
  tone: {
    warmHours: readonly (readonly [number, number])[];
    neutralHours: readonly (readonly [number, number])[];
    coolMonths: readonly number[];
    warmMonths: readonly number[];
  };
  tier: readonly { upTo: number; tier: Tier }[];
  texture: { fujiMakePrefix: string; fuji: Texture; landmark: Texture; fine: Texture; fallback: Texture; foil: Texture };
};

/** Preset tones in cool-to-warm order; the rule steps along it. The photo tone is never assigned by the rule. */
const TONE_ORDER = ["cool", "neutral", "warm"] as const satisfies readonly Tone[];

function inRanges(value: number, ranges: readonly (readonly [number, number])[]): boolean {
  return ranges.some(([lo, hi]) => value >= lo && value <= hi);
}

export function deriveTone(takenAt: Date | null): Tone {
  if (!takenAt) return "neutral";
  const { tone } = VARIATION_RULES;
  const hour = takenAt.getHours();
  const month = takenAt.getMonth();
  let index = inRanges(hour, tone.warmHours) ? 2 : inRanges(hour, tone.neutralHours) ? 1 : 0;
  const coolMonths: readonly number[] = tone.coolMonths;
  const warmMonths: readonly number[] = tone.warmMonths;
  if (coolMonths.includes(month)) index -= 1;
  else if (warmMonths.includes(month)) index += 1;
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
  const tone = deriveTone(inputs.takenAt);
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

/** What the development panel may change. Production never calls withOverrides with anything but {}. */
export type VariationOverrides = Partial<Pick<Variation, "texture" | "tone" | "tier" | "motion" | "intro">>;

/** The texture an overridden tier implies: a foil tier always carries foil; leaving one drops back to the plain fallback. */
function textureForTier(tier: Tier, current: Texture): Texture {
  const t = VARIATION_RULES.texture;
  if (TIERS[tier].foil) return t.foil;
  return current === t.foil ? t.fallback : current;
}

/** Apply overrides and re-resolve what depends on them: the palette from the tone, the motion and the texture from an overridden tier. */
export function withOverrides(base: Variation, overrides: VariationOverrides, photoPalette: Palette | null): Variation {
  const tone = overrides.tone ?? base.tone;
  const tier = overrides.tier ?? base.tier;
  const motion = overrides.motion ?? (overrides.tier !== undefined ? TIERS[tier].motion : base.motion);
  const texture = overrides.texture ?? (overrides.tier !== undefined ? textureForTier(tier, base.texture) : base.texture);
  return {
    ...base,
    texture,
    tone,
    palette: paletteFor(tone, photoPalette),
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
 * The seed until cards have ids (step 4): FNV-1a over the photo's facts, so the
 * same photo always gets the same variation on the same device.
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
