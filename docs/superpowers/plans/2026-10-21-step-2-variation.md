# Step 2 Variation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every card gets a deterministic border variation (texture, tone, tier, motion, intro) derived from the photo's facts, drawn identically on screen and in the print PNG, with development-only controls to pick any value on the Make screen and a gallery page that shows real photos under every texture.

**Architecture:** Registries (`TONES`, `TIERS`, `MOTIONS`, `TEXTURES`, `INTROS`) are the single source of what can vary; the types are derived from their keys. `deriveVariation()` maps facts to a `Variation` through one rule table. `borderSvg()` turns a `Variation` into one SVG document in card units, clipped to the mat and to a 2-unit outer band so the photo box is never touched; the DOM shows it as an image in the border slot and `renderPng()` draws the same image before the photo. The dev panel and gallery read the registries, and the equivalence test loops over every texture.

**Tech Stack:** SVG `feTurbulence` (seeded) for grain, SVG gradients and strokes for foil and wear, a mulberry32 PRNG, React 19, Next.js 16 route handlers, Vitest 5, Playwright 1.64, piexifjs for fixtures.

Spec: `docs/superpowers/specs/2026-10-21-step-2-variation-design.md`. Product rules: `CLAUDE.md`, `SPEC.md` ("Card variation", "The card"). Never read `prototype/one-of-one.html`.

## Global Constraints

- The card's layout and type never change. Nothing touches the photo's pixels: the border document draws only inside two clip groups (the mat minus the photo box, and the outer band), the painters apply no filter to the photo, and the print never carries one.
- Variation is assigned, never chosen: `deriveVariation(inputs)` is pure and deterministic over `{ seed, takenAt, camera, number, placeKind }`. The dev panel exists only in development builds.
- Registries: `TONES` (warm, neutral, cool presets with fixed colours, plus `photo`, whose colours are sampled from the photo's outer edge), `TIERS` (standard, fine, foil, animated), `MOTIONS` (none, sheen), `TEXTURES` (paper, grain, worn, foil), `INTROS` (rise, develop, flip). Each entry's `id` equals its key and has a non-empty `label`. The `Texture`, `Tone`, `Tier`, `Motion` types are `keyof typeof <REGISTRY>`.
- A `Variation` carries its resolved `palette: { tint, foil: [a, b] }` (hex). `paletteFor(tone, photoPalette)` resolves a preset's colours or, for `photo`, the sampled palette, falling back to neutral when null. `paletteFromPixels` (pure) samples the outer ring, one eighth of the smaller dimension on each side, averaging hue as a saturation-weighted vector; mean saturation under 0.08 → neutral; transparent ring → null.
- First-draft rules: tone by hour (5 to 9 or 17 to 20 warm; 10 to 16 neutral; else cool), shifted one step cool in November to February and one step warm in June to August, neutral without a capture time; tier by number (1 to 10 animated, 11 to 100 foil, 101 to 1000 fine, else standard, null standard); texture: foil tiers → foil, else camera make starting with "FUJIFILM" (case-insensitive) → worn, else landmark → grain, else fine → grain, else paper; motion from the tier; intro `assignIntro(seed)`.
- Seed until cards have ids: FNV-1a over `${sizeBytes}:${width}:${height}:${takenAtMs ?? 0}:${make}|${model}`, unsigned 32-bit.
- Border geometry: `viewBox="0 0 100 H"` with `H = 5 + 90 × photoH ÷ photoW + 19.2`; band width `BAND_UNITS = 2`; grain opacity 0.05 for paper, 0.09 for grain and worn, 0.07 for foil; nothing random that is not seeded (`feTurbulence seed` and mulberry32 from the variation seed).
- Print: `renderPng` gets the SVG string as `border`, loads it as an image, draws it after the white fill and before the photo; if the image fails to load the PNG is drawn without it and `borderDrawn` is false ("Printed without the border." in the status).
- Dev-only surfaces (`/dev/card`, `/dev/variation`, `/api/dev/photos`, the Make dev panel) render only when `process.env.NODE_ENV !== "production"`; a production build must serve none of their markup or strings (checked by `npm run check:prod`).
- `dev-photos/` at the repo root is git-ignored; the photos route serves only `/^[\w.-]+\.(jpe?g)$/i` names resolved inside that folder (or `DEV_PHOTOS_DIR`).
- Equivalence: one case per registered texture within `MAX_DIFF_RATIO = 0.001`; a one-unit shift of the DOM border on the foil texture must exceed three times that.
- Commit after every task with the message shown. All commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Every test file is written first and run to fail before its implementation.

## File structure

```
packages/card/src/variation.ts          TONES, TIERS, MOTIONS, VARIATION_RULES, Palette, Variation, paletteFor, deriveVariation, withOverrides, variationSeed
packages/card/src/palette.ts            paletteFromPixels (pure sampler)
packages/card/src/textures.ts           TEXTURES registry: each entry draws SVG fragments for the mat and the band
packages/card/src/border.ts             BAND_UNITS, mulberry32, borderSvg, borderDataUrl
packages/card/src/layout.ts             + cardHeightUnits(photoW, photoH)
packages/card/src/intros.ts             seedFromPhoto removed
packages/card/src/Card.tsx              variation prop replaces the border slot; border image; motion class; data attributes
packages/card/src/card.css              border image, stacking, sheen motion, reduced motion
packages/card/src/renderPng.ts          border image drawn before the photo; borderDrawn
packages/card/test/variation.test.ts, palette.test.ts, textures.test.ts, border.test.ts, Card.test.tsx (modified), renderPng.test.ts (modified), intros.test.ts (modified)
apps/web/lib/exif.ts                    + camera { make, model }
apps/web/lib/photo.ts                   describePhoto: decode + EXIF + lookup + caption + derived variation (shared by Make and the gallery)
apps/web/lib/devPhotos.ts               folder, name validation, listing
apps/web/components/DevVariationPanel.tsx
apps/web/app/make/MakeScreen.tsx        uses describePhoto; overrides; border on print; dev panel
apps/web/app/api/dev/photos/route.ts, apps/web/app/api/dev/photos/[name]/route.ts
apps/web/app/dev/variation/page.tsx, VariationGallery.tsx
apps/web/app/dev/card/page.tsx, DevCard.tsx   texture, tier, driftBorder params
apps/web/app/globals.css                dev panel and gallery styles
e2e/fixtures/make-exif-fixtures.mjs     camera make and model on the fixtures (regenerated)
e2e/make.spec.ts, e2e/dev-variation.spec.ts, e2e/equivalence.spec.ts
scripts/check-prod.mjs                  production build serves no dev surface
.github/workflows/ci.yml, .gitignore, CLAUDE.md, README.md, playwright.config.ts
```

---

### Task 1: Registries, rules, the palette and the seed

**Files:**
- Create: `packages/card/src/variation.ts`, `packages/card/src/palette.ts`
- Modify: `packages/card/src/intros.ts` (remove `seedFromPhoto`), `packages/card/src/index.ts`, `packages/card/test/intros.test.ts`
- Test: `packages/card/test/variation.test.ts`, `packages/card/test/palette.test.ts`

**Interfaces:**
- Produces (from `@one-of-one/card`):
  ```ts
  export interface Palette { tint: string; foil: readonly [string, string] }
  export type ToneDef = { id: string; label: string } & ({ source: "preset"; tint: string; foil: readonly [string, string] } | { source: "photo" });
  export interface MotionDef { id: string; label: string; className: string | null }
  export interface TierDef { id: string; label: string; foil: boolean; motion: Motion }
  export const TONES, MOTIONS, TIERS;                       // registries, `as const satisfies Record<string, Def>`
  export type Tone = keyof typeof TONES; export type Motion = keyof typeof MOTIONS; export type Tier = keyof typeof TIERS;
  export type PlaceKindLike = "venue" | "landmark" | "neighborhood" | "city";
  export interface Variation { texture: Texture; tone: Tone; palette: Palette; tier: Tier; motion: Motion; intro: IntroId; seed: number }
  export interface VariationInputs { seed: number; takenAt: Date | null; camera: { make: string; model: string } | null; number: number | null; placeKind: PlaceKindLike | null; photoPalette: Palette | null }
  export const NEUTRAL_PALETTE: Palette;
  export function paletteFor(tone: Tone, photoPalette: Palette | null): Palette;
  export type VariationOverrides = Partial<Pick<Variation, "texture" | "tone" | "tier" | "motion" | "intro">>;
  export function withOverrides(base: Variation, overrides: VariationOverrides, photoPalette: Palette | null): Variation;   // re-resolves palette from the tone; motion follows an overridden tier unless motion is overridden too
  export function paletteFromPixels(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Palette | null;   // palette.ts
  export const VARIATION_RULES;                             // the data table
  export function deriveTone(takenAt: Date | null): Tone; deriveTier(number: number | null): Tier; deriveTexture(tier, camera, placeKind): Texture;
  export function deriveVariation(inputs: VariationInputs): Variation;
  export interface SeedFacts { sizeBytes: number; width: number; height: number; takenAtMs: number | null; camera: { make: string; model: string } | null }
  export function variationSeed(facts: SeedFacts): number;
  ```
  `Texture` is defined in Task 2's `textures.ts`; Task 1 imports it as a type. Until Task 2 lands, create `packages/card/src/textures.ts` with only the placeholder below so the type exists (Task 2 replaces the file).

- [ ] **Step 1: Placeholder textures module**

`packages/card/src/textures.ts` (temporary; Task 2 replaces it entirely):

```ts
/** Replaced in Task 2 by the texture registry. Only the type is needed before then. */
export type Texture = "paper" | "grain" | "worn" | "foil";
```

- [ ] **Step 2: Write the failing variation and palette tests**

`packages/card/test/variation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { INTROS, assignIntro } from "../src/intros";
import {
  MOTIONS,
  NEUTRAL_PALETTE,
  TIERS,
  TONES,
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
const photoPalette: Palette = { tint: "#4466aa", foil: ["#c8d4ee", "#5a74b0"] };

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
  it("uses every registered intro for some seed", () => {
    const ids = new Set(INTROS.map((i) => i.id));
    for (let s = 0; s < 30; s += 1) ids.delete(deriveVariation({ ...inputs, seed: s }).intro);
    expect(ids.size).toBe(0);
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
});
```

`packages/card/test/palette.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { paletteFromPixels } from "../src/palette";
import { NEUTRAL_PALETTE } from "../src/variation";

type Rgb = [number, number, number];

/** A width × height RGBA image: `ring` colour on the outer eighth, `centre` inside. */
function image(width: number, height: number, ring: Rgb, centre: Rgb, alpha = 255): Uint8ClampedArray {
  const r = Math.max(1, Math.round(Math.min(width, height) / 8));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inRing = x < r || x >= width - r || y < r || y >= height - r;
      const [cr, cg, cb] = inRing ? ring : centre;
      const i = (y * width + x) * 4;
      data[i] = cr; data[i + 1] = cg; data[i + 2] = cb; data[i + 3] = alpha;
    }
  }
  return data;
}

const channels = (hex: string): Rgb => [1, 3, 5].map((k) => Number.parseInt(hex.slice(k, k + 2), 16)) as Rgb;

describe("paletteFromPixels", () => {
  it("takes its hue from the outer ring, not the centre", () => {
    const p = paletteFromPixels(image(32, 32, [40, 80, 220], [220, 40, 40]), 32, 32);
    expect(p).not.toBeNull();
    const [r, g, b] = channels(p!.tint);
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
    const light = channels(p!.foil[0]).reduce((a, c) => a + c, 0);
    const dark = channels(p!.foil[1]).reduce((a, c) => a + c, 0);
    expect(light).toBeGreaterThan(dark);
  });
  it("ignores the centre entirely", () => {
    const a = paletteFromPixels(image(32, 32, [40, 80, 220], [220, 40, 40]), 32, 32);
    const b = paletteFromPixels(image(32, 32, [40, 80, 220], [10, 200, 10]), 32, 32);
    expect(a).toEqual(b);
  });
  it("returns the neutral palette for a grey photo", () => {
    expect(paletteFromPixels(image(32, 32, [128, 128, 128], [200, 200, 200]), 32, 32)).toEqual(NEUTRAL_PALETTE);
  });
  it("returns null when the ring is transparent", () => {
    expect(paletteFromPixels(image(32, 32, [40, 80, 220], [220, 40, 40], 0), 32, 32)).toBeNull();
  });
  it("returns null for an empty or short buffer", () => {
    expect(paletteFromPixels(new Uint8ClampedArray(0), 0, 0)).toBeNull();
    expect(paletteFromPixels(new Uint8ClampedArray(8), 32, 32)).toBeNull();
  });
  it("keeps the tint mat-friendly rather than fully saturated", () => {
    const p = paletteFromPixels(image(32, 32, [255, 0, 0], [255, 0, 0]), 32, 32)!;
    expect(p.tint).not.toBe("#ff0000");
    const [r, g, b] = channels(p.tint);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(160);
  });
  it("is deterministic", () => {
    const img = image(24, 40, [200, 160, 40], [0, 0, 0]);
    expect(paletteFromPixels(img, 24, 40)).toEqual(paletteFromPixels(img, 24, 40));
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npm test -w packages/card -- variation palette`
Expected: FAIL, both files cannot resolve their imports.

- [ ] **Step 4: Implement variation.ts**

`packages/card/src/variation.ts`:

```ts
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

/** The colours a tone resolves to. The photo tone needs the sampled palette; without one it is neutral. */
export function paletteFor(tone: Tone, photoPalette: Palette | null): Palette {
  const def = TONES[tone];
  if (def.source === "preset") return { tint: def.tint, foil: def.foil };
  return photoPalette ?? NEUTRAL_PALETTE;
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
 * 50 real photos). Edit the table, not the functions; the tests read it too.
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
  if (tone.coolMonths.includes(month)) index -= 1;
  else if (tone.warmMonths.includes(month)) index += 1;
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

/** Apply overrides and re-resolve what depends on them: the palette from the tone, the motion from an overridden tier. */
export function withOverrides(base: Variation, overrides: VariationOverrides, photoPalette: Palette | null): Variation {
  const tone = overrides.tone ?? base.tone;
  const tier = overrides.tier ?? base.tier;
  const motion = overrides.motion ?? (overrides.tier !== undefined ? TIERS[tier].motion : base.motion);
  return {
    ...base,
    texture: overrides.texture ?? base.texture,
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
```

- [ ] **Step 5: Implement palette.ts**

`packages/card/src/palette.ts`:

```ts
import { NEUTRAL_PALETTE, type Palette } from "./variation";

/** Below this mean saturation the photo counts as grey and gets the neutral palette. */
export const GREY_SATURATION = 0.08;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  return [h / 6, s, l];
}

function hue2rgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToHex(h: number, s: number, l: number): string {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const toHex = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
  return `#${toHex(hue2rgb(p, q, h + 1 / 3))}${toHex(hue2rgb(p, q, h))}${toHex(hue2rgb(p, q, h - 1 / 3))}`;
}

/**
 * The photo's edge colours as a border palette. Reads the outer ring (one eighth
 * of the smaller dimension on each side), averages hue as a saturation-weighted
 * vector, and returns a mat-friendly tint plus light and dark foil stops.
 * Null when the ring is transparent or the buffer is too small; neutral for grey.
 */
export function paletteFromPixels(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Palette | null {
  if (width <= 0 || height <= 0 || rgba.length < width * height * 4) return null;
  const ring = Math.max(1, Math.round(Math.min(width, height) / 8));
  let vx = 0;
  let vy = 0;
  let sumS = 0;
  let n = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= ring && x < width - ring && y >= ring && y < height - ring) continue;
      const i = (y * width + x) * 4;
      if (rgba[i + 3]! < 128) continue;
      const [h, s] = rgbToHsl(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!);
      vx += Math.cos(2 * Math.PI * h) * s;
      vy += Math.sin(2 * Math.PI * h) * s;
      sumS += s;
      n += 1;
    }
  }
  if (n === 0) return null;
  const meanS = sumS / n;
  if (meanS < GREY_SATURATION) return NEUTRAL_PALETTE;
  let hue = Math.atan2(vy, vx) / (2 * Math.PI);
  if (hue < 0) hue += 1;
  const sat = Math.min(0.45, Math.max(0.15, meanS * 0.7));
  return { tint: hslToHex(hue, sat, 0.5), foil: [hslToHex(hue, sat, 0.84), hslToHex(hue, sat, 0.58)] };
}
```

- [ ] **Step 6: Remove seedFromPhoto and update exports, tests and the Make screen**

In `packages/card/src/intros.ts`, delete the `seedFromPhoto` function and its doc comment (keep `INTROS`, `Intro`, `IntroId`, `assignIntro`).

In `packages/card/test/intros.test.ts`: delete the `describe("seedFromPhoto", ...)` block and the `seedFromPhoto` import; in the `assignIntro` block, replace the test that used `seedFromPhoto(99, 900, 1200)` with `const seed = 0x9e3779b9;` and keep its assertion. The file then has 6 tests.

Replace `packages/card/src/index.ts` with:

```ts
export { fmtCoords, fmtDate, ordinal } from "./format";
export { CARD, layoutCard } from "./layout";
export type { CaptionLine, CardLayout, CardSpec, LineKind } from "./layout";
export { CARD_FONT_FAMILY, cardFont, loadCardFonts } from "./fonts";
export { INTROS, assignIntro } from "./intros";
export type { Intro, IntroId } from "./intros";
export {
  MOTIONS,
  NEUTRAL_PALETTE,
  TIERS,
  TONES,
  VARIATION_RULES,
  deriveTexture,
  deriveTier,
  deriveTone,
  deriveVariation,
  paletteFor,
  variationSeed,
  withOverrides,
} from "./variation";
export type {
  Motion,
  MotionDef,
  Palette,
  PlaceKindLike,
  SeedFacts,
  Tier,
  TierDef,
  Tone,
  ToneDef,
  Variation,
  VariationInputs,
  VariationOverrides,
} from "./variation";
export { GREY_SATURATION, paletteFromPixels } from "./palette";
export type { Texture } from "./textures";
export { Card } from "./Card";
export type { CardPhoto, CardProps } from "./Card";
export { PRINT_CAP, drawCard, ellipsize, printDimensions, renderPng } from "./renderPng";
export type { CanvasTarget, Ctx2D, DrawSpec, PrintDims, RenderPngInput, RenderPngResult } from "./renderPng";
```

`apps/web/app/make/MakeScreen.tsx` imports `seedFromPhoto`; so the branch typechecks until Task 6 rewires it, replace `seedFromPhoto,` in its import list with `variationSeed,` and replace the `setIntro(...)` line with:

```ts
    setIntro(assignIntro(variationSeed({ sizeBytes: file.size, width: img.naturalWidth, height: img.naturalHeight, takenAtMs: meta.takenAt?.getTime() ?? null, camera: null })).id);
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test -w packages/card -- variation palette` → PASS, 36 variation tests and 7 palette tests. Run: `npm test -w packages/card` → all files pass (intros now 6). Run: `npm run typecheck && npm run lint` → exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/card/src/variation.ts packages/card/src/palette.ts packages/card/src/textures.ts packages/card/src/intros.ts packages/card/src/index.ts packages/card/test/variation.test.ts packages/card/test/palette.test.ts packages/card/test/intros.test.ts apps/web/app/make/MakeScreen.tsx
git commit -m "Add the variation registries, the first-draft rules, the photo palette and the seed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The texture registry and the border document

**Files:**
- Replace: `packages/card/src/textures.ts`
- Create: `packages/card/src/border.ts`
- Modify: `packages/card/src/index.ts`
- Test: `packages/card/test/textures.test.ts`, `packages/card/test/border.test.ts`

**Interfaces:**
- Consumes: `Palette`, `TierDef`, `TIERS`, `Variation` (Task 1); `CARD` (layout).
- Produces:
  ```ts
  export interface BorderDraw { seed: number; rng: () => number; palette: Palette; tier: TierDef; width: number; height: number; band: number; photo: { x: number; y: number; w: number; h: number } }
  export interface TextureFragments { defs: string; mat: string; band: string }
  export interface TextureDef { id: string; label: string; draw(d: BorderDraw): TextureFragments }
  export const TEXTURES;  export type Texture = keyof typeof TEXTURES;        // paper, grain, worn, foil
  export function grainFilter(id, d, alpha, baseFrequency?): { def: string; use: string };
  export function wearStrokes(d, count?): string;   export function foilBand(id, d): { def: string; use: string };
  export const BAND_UNITS = 2;  export function mulberry32(seed: number): () => number;
  export function borderSvg(v: Variation, cardHeightUnits: number): string;  export function borderDataUrl(v, cardHeightUnits): string;
  ```

- [ ] **Step 1: Write the failing texture tests**

`packages/card/test/textures.test.ts`:

```ts
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
```

- [ ] **Step 2: Write the failing border tests**

`packages/card/test/border.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BAND_UNITS, borderDataUrl, borderSvg, mulberry32 } from "../src/border";
import { TEXTURES } from "../src/textures";
import type { Variation } from "../src/variation";

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
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npm test -w packages/card -- textures border`
Expected: FAIL, "Failed to resolve import "../src/border"" (and textures.ts has no `TEXTURES`).

- [ ] **Step 4: Implement textures.ts**

Replace `packages/card/src/textures.ts` with:

```ts
import type { Palette, TierDef } from "./variation";

/** What a texture's draw function receives. Everything is in card units (the card is 100 wide). */
export interface BorderDraw {
  seed: number;
  /** Seeded generator in [0, 1): the only source of randomness. */
  rng: () => number;
  palette: Palette;
  tier: TierDef;
  width: number;
  height: number;
  /** Outer band width. */
  band: number;
  photo: { x: number; y: number; w: number; h: number };
}

/** SVG fragments: `defs` go in <defs>; `mat` is clipped to the mat minus the photo; `band` is clipped to the outer band. */
export interface TextureFragments {
  defs: string;
  mat: string;
  band: string;
}

export interface TextureDef {
  id: string;
  label: string;
  draw(d: BorderDraw): TextureFragments;
}

const f = (n: number): string => Number(n.toFixed(3)).toString();

function hexToRgb01(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Seeded fractal noise over the whole card, coloured with the palette tint and scaled to `alpha`. */
export function grainFilter(id: string, d: BorderDraw, alpha: number, baseFrequency = 2.5): { def: string; use: string } {
  const [r, g, b] = hexToRgb01(d.palette.tint);
  const seed = d.seed % 10000;
  const def =
    `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${baseFrequency}" numOctaves="3" seed="${seed}" stitchTiles="stitch" result="noise"/>` +
    `<feColorMatrix in="noise" type="matrix" values="0 0 0 0 ${r.toFixed(3)} 0 0 0 0 ${g.toFixed(3)} 0 0 0 0 ${b.toFixed(3)} 0 0 0 ${alpha} 0"/>` +
    `</filter>`;
  const use = `<rect x="0" y="0" width="${f(d.width)}" height="${f(d.height)}" fill="#fff" filter="url(#${id})"/>`;
  return { def, use };
}

/** Short, faint strokes along the edges, like a worn paper border. Every point stays inside the band. */
export function wearStrokes(d: BorderDraw, count = 40): string {
  const parts: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const side = Math.floor(d.rng() * 4);
    const along = d.rng();
    const depth = d.band * (0.15 + d.rng() * 0.7);
    const len = 0.8 + d.rng() * 2.2;
    const opacity = (0.08 + d.rng() * 0.14).toFixed(3);
    let x1: number;
    let y1: number;
    let x2: number;
    let y2: number;
    if (side === 0) {
      x1 = along * d.width; y1 = depth; x2 = Math.min(d.width, x1 + len); y2 = depth;
    } else if (side === 2) {
      x1 = along * d.width; y1 = d.height - depth; x2 = Math.min(d.width, x1 + len); y2 = y1;
    } else if (side === 3) {
      x1 = depth; y1 = along * d.height; x2 = depth; y2 = Math.min(d.height, y1 + len);
    } else {
      x1 = d.width - depth; y1 = along * d.height; x2 = x1; y2 = Math.min(d.height, y1 + len);
    }
    parts.push(
      `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${d.palette.tint}" stroke-opacity="${opacity}" stroke-width="0.22" stroke-linecap="round"/>`,
    );
  }
  return parts.join("");
}

/** A foil gradient between the palette's two stops, at a seeded angle. Fills the card; the caller clips it to the band. */
export function foilBand(id: string, d: BorderDraw): { def: string; use: string } {
  const angle = Math.round(d.rng() * 360);
  const [light, dark] = d.palette.foil;
  const def =
    `<linearGradient id="${id}" gradientTransform="rotate(${angle} 0.5 0.5)">` +
    `<stop offset="0" stop-color="${light}"/><stop offset="0.5" stop-color="${dark}"/><stop offset="1" stop-color="${light}"/>` +
    `</linearGradient>`;
  const use = `<rect x="0" y="0" width="${f(d.width)}" height="${f(d.height)}" fill="url(#${id})"/>`;
  return { def, use };
}

/**
 * The texture registry. Adding a texture is one entry: an id, a label and a draw
 * function that returns fragments for the mat and the band. The dev panel, the
 * gallery page and the equivalence test read this table.
 */
export const TEXTURES = {
  paper: {
    id: "paper",
    label: "Paper",
    draw: (d) => {
      const g = grainFilter(`grain-${d.seed}`, d, 0.05, 3);
      return { defs: g.def, mat: g.use, band: "" };
    },
  },
  grain: {
    id: "grain",
    label: "Grain",
    draw: (d) => {
      const g = grainFilter(`grain-${d.seed}`, d, 0.09);
      const e = grainFilter(`edge-${d.seed}`, d, 0.06, 1.2);
      return { defs: g.def + e.def, mat: g.use, band: e.use };
    },
  },
  worn: {
    id: "worn",
    label: "Worn",
    draw: (d) => {
      const g = grainFilter(`grain-${d.seed}`, d, 0.09);
      return { defs: g.def, mat: g.use, band: wearStrokes(d) };
    },
  },
  foil: {
    id: "foil",
    label: "Foil",
    draw: (d) => {
      const g = grainFilter(`grain-${d.seed}`, d, 0.07);
      const fo = foilBand(`foil-${d.seed}`, d);
      return { defs: g.def + fo.def, mat: g.use, band: fo.use };
    },
  },
} as const satisfies Record<string, TextureDef>;

export type Texture = keyof typeof TEXTURES;
```

- [ ] **Step 5: Implement border.ts**

`packages/card/src/border.ts`:

```ts
import { CARD } from "./layout";
import { type BorderDraw, TEXTURES } from "./textures";
import { TIERS, type Variation } from "./variation";

/** Width of the outer band, in card units, that carries foil, wear and the sheen. */
export const BAND_UNITS = 2;

/** Small, fast, deterministic PRNG in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number): string => Number(n.toFixed(3)).toString();

/**
 * The border as one SVG document in card units (viewBox 0 0 100 H). Everything
 * drawn sits in one of two clip groups: the mat minus the photo box, or the
 * outer band. The photo box is never painted. Both painters render this
 * same document, so screen and print match by construction.
 */
export function borderSvg(v: Variation, cardHeightUnits: number): string {
  const H = Number(cardHeightUnits.toFixed(3));
  const photo = {
    x: CARD.mat,
    y: CARD.mat,
    w: CARD.photoWidth,
    h: Number((H - CARD.mat - CARD.stripHeight).toFixed(3)),
  };
  const d: BorderDraw = {
    seed: v.seed >>> 0,
    rng: mulberry32(v.seed),
    palette: v.palette,
    tier: TIERS[v.tier],
    width: 100,
    height: H,
    band: BAND_UNITS,
    photo,
  };
  const frag = TEXTURES[v.texture].draw(d);
  const B = BAND_UNITS;
  const matClip = `<clipPath id="mat"><path clip-rule="evenodd" d="M0 0H100V${f(H)}H0Z M${f(photo.x)} ${f(photo.y)}h${f(photo.w)}v${f(photo.h)}h-${f(photo.w)}Z"/></clipPath>`;
  const bandClip = `<clipPath id="band"><path clip-rule="evenodd" d="M0 0H100V${f(H)}H0Z M${B} ${B}H${100 - B}V${f(H - B)}H${B}Z"/></clipPath>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ${f(H)}" width="100" height="${f(H)}">` +
    `<defs>${matClip}${bandClip}${frag.defs}</defs>` +
    `<g clip-path="url(#mat)">${frag.mat}</g>` +
    `<g clip-path="url(#band)">${frag.band}</g>` +
    `</svg>`
  );
}

/** The document as an image URL for an <img> or a canvas drawImage. */
export function borderDataUrl(v: Variation, cardHeightUnits: number): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(borderSvg(v, cardHeightUnits))}`;
}
```

Add to `packages/card/src/index.ts` (replace the `export type { Texture } from "./textures";` line with these):

```ts
export { TEXTURES, foilBand, grainFilter, wearStrokes } from "./textures";
export type { BorderDraw, Texture, TextureDef, TextureFragments } from "./textures";
export { BAND_UNITS, borderDataUrl, borderSvg, mulberry32 } from "./border";
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -w packages/card -- textures border` → PASS, 8 texture tests and 8 border tests. Run: `npm test -w packages/card` and `npm run typecheck && npm run lint` → all green.

- [ ] **Step 7: Commit**

```bash
git add packages/card/src/textures.ts packages/card/src/border.ts packages/card/src/index.ts packages/card/test/textures.test.ts packages/card/test/border.test.ts
git commit -m "Add the texture registry and the seeded SVG border document clipped to the mat and the band

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The card draws its border

**Files:**
- Modify: `packages/card/src/layout.ts` (add `cardHeightUnits`), `packages/card/src/Card.tsx`, `packages/card/src/card.css`, `packages/card/src/index.ts`
- Test: `packages/card/test/layout.test.ts` (one test added), `packages/card/test/Card.test.tsx`

**Interfaces:**
- Consumes: `borderDataUrl`, `BAND_UNITS` (Task 2); `MOTIONS`, `Variation` (Task 1).
- Produces: `cardHeightUnits(photoW: number, photoH: number): number` from `@one-of-one/card`. `Card` prop `variation?: Variation | null` replaces the `border` slot: with a photo and a variation, the card renders `<div class="oo-border"><img class="oo-border-img" src="data:image/svg+xml;..." alt="" draggable="false"></div>` before the photo, adds `oo-motion-<id>` on the frame when the motion has a class, and sets `data-texture`, `data-tone`, `data-tier`, `data-motion` on the figure. `--oo-band` joins the frame's custom properties.

- [ ] **Step 1: Write the failing tests**

Append to the geometry `describe` in `packages/card/test/layout.test.ts`:

```ts
  it("gives the card height in units for a photo's aspect", () => {
    expect(cardHeightUnits(900, 1200)).toBeCloseTo(144.2, 6);
    expect(cardHeightUnits(900, 1200)).toBeCloseTo(layoutCard({ photoW: 900, photoH: 1200, ...full }).height, 6);
    expect(cardHeightUnits(900, 600)).toBeCloseTo(84.2, 6);
  });
```

and add `cardHeightUnits` to that file's import from `../src/layout`.

In `packages/card/test/Card.test.tsx`: delete the test "renders the border slot inside the card", add the fixture after `const photo = ...`:

```tsx
const variation = {
  texture: "grain",
  tone: "warm",
  palette: { tint: "#b08860", foil: ["#f3d9a4", "#b8864a"] },
  tier: "fine",
  motion: "none",
  intro: "rise",
  seed: 7,
} as const;
```

and add these tests inside `describe("Card with a photo", ...)`:

```tsx
  it("draws the border image under the photo when a variation is given", () => {
    const html = renderToStaticMarkup(<Card photo={photo} {...caption} variation={variation} />);
    expect(html).toContain('<div class="oo-border"><img class="oo-border-img" src="data:image/svg+xml;charset=utf-8,');
    expect(html.indexOf('class="oo-border"')).toBeLessThan(html.indexOf('class="oo-photo-wrap"'));
    expect(html).toContain('data-texture="grain"');
    expect(html).toContain('data-tone="warm"');
    expect(html).toContain('data-tier="fine"');
    expect(html).toContain('data-motion="none"');
    expect(html).toContain("--oo-band:2cqw");
  });

  it("omits the border without a variation", () => {
    const html = renderToStaticMarkup(<Card photo={photo} {...caption} />);
    expect(html).not.toContain("oo-border");
    expect(html).not.toContain("data-texture");
  });

  it("adds the motion class on the frame for a sheen", () => {
    const sheen = { ...variation, motion: "sheen" } as const;
    expect(renderToStaticMarkup(<Card photo={photo} {...caption} variation={sheen} />)).toContain('class="oo-frame oo-motion-sheen"');
    expect(renderToStaticMarkup(<Card photo={photo} {...caption} variation={sheen} intro="flip" />)).toContain('class="oo-frame oo-intro-flip oo-motion-sheen"');
  });
```

and in `describe("Card empty state", ...)`:

```tsx
  it("draws no border on the empty mat even with a variation", () => {
    const html = renderToStaticMarkup(<Card photo={null} place="" date="" coords="" number={null} variation={variation} />);
    expect(html).not.toContain("oo-border");
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -w packages/card -- layout Card`
Expected: FAIL: `cardHeightUnits` is not exported; the Card tests fail on the missing border image and data attributes (and typecheck complains about the `variation` prop).

- [ ] **Step 3: Implement**

Append to `packages/card/src/layout.ts`:

```ts
/** Card height in units for a photo of this aspect ratio: mat + photo + caption strip. */
export function cardHeightUnits(photoW: number, photoH: number): number {
  return CARD.mat + (CARD.photoWidth * photoH) / photoW + CARD.stripHeight;
}
```

In `packages/card/src/index.ts`, change the layout export line to `export { CARD, cardHeightUnits, layoutCard } from "./layout";`.

In `packages/card/src/Card.tsx`:

1. Imports: change the react type import to `import type { CSSProperties, FocusEvent, KeyboardEvent, MouseEvent } from "react";` (ReactNode goes), and add:

```ts
import { BAND_UNITS, borderDataUrl } from "./border";
import { cardHeightUnits } from "./layout";
import { MOTIONS, type Variation } from "./variation";
```

2. In `CardProps`, replace the `border` prop and its comment with:

```ts
  /** The derived border variation; null or absent draws the plain white mat. Never user-chosen. */
  variation?: Variation | null;
```

3. In `FRAME_VARS`, add `"--oo-band": `${BAND_UNITS}cqw`,` after `"--oo-place-max"`.

4. In the component signature, replace `border,` with `variation = null,`. Replace the `frameClass` line with:

```ts
  const motionClass = variation ? MOTIONS[variation.motion].className : null;
  const frameClass = ["oo-frame", intro ? `oo-intro-${intro}` : null, motionClass].filter(Boolean).join(" ");
```

5. On the `<figure>`, after `data-editable={...}` add:

```tsx
        data-texture={variation?.texture}
        data-tone={variation?.tone}
        data-tier={variation?.tier}
        data-motion={variation?.motion}
```

6. Replace `{border ? <div className="oo-border">{border}</div> : null}` with:

```tsx
        {variation && photo ? (
          <div className="oo-border">
            <img
              className="oo-border-img"
              src={borderDataUrl(variation, cardHeightUnits(photo.width, photo.height))}
              alt=""
              draggable={false}
            />
          </div>
        ) : null}
```

In `packages/card/src/card.css`:

1. After the `.oo-border { ... }` rule add:

```css
.oo-border-img {
  display: block;
  width: 100%;
  height: 100%;
}
```

2. Add `z-index: 1;` to `.oo-photo-wrap` (it is already `position: relative`), and add `position: relative;` and `z-index: 1;` to `.oo-plate`, so both stack above the border layer.

3. Before the `@media (prefers-reduced-motion: reduce)` block add:

```css
/* Sheen: a slow light sweep over the outer band only. Screen only; the print never carries it. */
.oo-motion-sheen .oo-border::after {
  content: "";
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  padding: var(--oo-band);
  background: linear-gradient(115deg, transparent 38%, rgba(255, 255, 255, 0.55) 50%, transparent 62%) 0 0 / 300% 100% no-repeat;
  mix-blend-mode: screen;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
  animation: oo-sheen 6s linear infinite;
}
@keyframes oo-sheen {
  from { background-position: 100% 0; }
  to { background-position: 0 0; }
}
```

4. Inside the reduced-motion block add:

```css
  .oo-motion-sheen .oo-border::after {
    animation: none !important;
    display: none;
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w packages/card -- layout Card` → PASS (layout 9, Card 16). Run: `npm test -w packages/card` and `npm run typecheck && npm run lint` → green. `apps/web` still compiles because nothing there passed `border`.

- [ ] **Step 5: Commit**

```bash
git add packages/card/src/layout.ts packages/card/src/Card.tsx packages/card/src/card.css packages/card/src/index.ts packages/card/test/layout.test.ts packages/card/test/Card.test.tsx
git commit -m "Draw the border variation under the photo on the DOM card, with the sheen motion

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The print draws the same border

**Files:**
- Modify: `packages/card/src/border.ts` (add `svgDataUrl`), `packages/card/src/renderPng.ts`, `packages/card/src/index.ts`
- Test: `packages/card/test/renderPng.test.ts`, `packages/card/test/border.test.ts` (one test)

**Interfaces:**
- Produces: `svgDataUrl(svg: string): string` in border.ts (used by `borderDataUrl` and the painter). `drawCard(ctx, image, dims, spec, border: CanvasImageSource | null = null)` draws the border between the white fill and the photo. `RenderPngInput` gains `border?: string` (the SVG document) and `loadImage?: (dataUrl: string) => Promise<CanvasImageSource | null>` (defaults to an `Image` element; resolves null on error). `RenderPngResult` gains `borderDrawn: boolean`: true only when a border was requested and its image loaded.

- [ ] **Step 1: Write the failing tests**

Add to `packages/card/test/border.test.ts` (import `svgDataUrl` from `../src/border`):

```ts
describe("svgDataUrl", () => {
  it("encodes any SVG string as a data URL", () => {
    expect(svgDataUrl("<svg a=\"#1\"/>")).toBe("data:image/svg+xml;charset=utf-8,%3Csvg%20a%3D%22%231%22%2F%3E");
  });
});
```

In `packages/card/test/renderPng.test.ts`:

1. Change `fakeCanvasFactory` so the test can see the context it handed out:

```ts
  function fakeCanvasFactory(maxWidth: number) {
    const made: Array<{ w: number; h: number }> = [];
    const contexts: ReturnType<typeof fakeCtx>[] = [];
    const createCanvas = (w: number, h: number): CanvasTarget => {
      if (w > maxWidth) throw new Error("canvas too large");
      made.push({ w, h });
      const c = fakeCtx();
      contexts.push(c);
      return { width: w, height: h, getContext: () => c.ctx };
    };
    return { createCanvas, made, contexts };
  }
```

2. Add to `describe("drawCard", ...)`:

```ts
  it("draws the border over the fill and under the photo when given one", () => {
    const { ctx, calls } = fakeCtx();
    const border = { kind: "border" } as unknown as CanvasImageSource;
    drawCard(ctx, image, dims, spec, border);
    expect(calls[0]![0]).toBe("fillRect");
    expect(calls[1]).toEqual(["drawImage", border, 0, 0, 1000, 1442]);
    expect(calls[2]).toEqual(["drawImage", image, 50, 50, 900, 1200]);
  });

  it("draws no border by default", () => {
    const { ctx, calls } = fakeCtx();
    drawCard(ctx, image, dims, spec);
    expect(calls.filter((c) => c[0] === "drawImage")).toHaveLength(1);
  });
```

3. Add to `describe("renderPng", ...)`:

```ts
  it("loads the border SVG as a data URL and reports it drawn", async () => {
    const { createCanvas, contexts } = fakeCanvasFactory(10_000);
    const seen: string[] = [];
    const borderImage = { kind: "border" } as unknown as CanvasImageSource;
    const r = await renderPng({
      ...spec, image, naturalWidth: 900, naturalHeight: 1200, createCanvas, toBlob,
      border: "<svg/>",
      loadImage: async (url) => { seen.push(url); return borderImage; },
    });
    expect(r.borderDrawn).toBe(true);
    expect(seen).toEqual(["data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E"]);
    const draws = contexts[0]!.calls.filter((c) => c[0] === "drawImage");
    expect(draws).toHaveLength(2);
    expect(draws[0]![1]).toBe(borderImage);
  });

  it("prints without the border when its image fails to load", async () => {
    const { createCanvas, contexts } = fakeCanvasFactory(10_000);
    const r = await renderPng({
      ...spec, image, naturalWidth: 900, naturalHeight: 1200, createCanvas, toBlob,
      border: "<svg/>",
      loadImage: async () => null,
    });
    expect(r.borderDrawn).toBe(false);
    expect(contexts[0]!.calls.filter((c) => c[0] === "drawImage")).toHaveLength(1);
  });

  it("never loads an image when no border is requested", async () => {
    const { createCanvas } = fakeCanvasFactory(10_000);
    let loads = 0;
    const r = await renderPng({
      ...spec, image, naturalWidth: 900, naturalHeight: 1200, createCanvas, toBlob,
      loadImage: async () => { loads += 1; return null; },
    });
    expect(loads).toBe(0);
    expect(r.borderDrawn).toBe(false);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -w packages/card -- renderPng border`
Expected: FAIL: `svgDataUrl` missing; `drawCard` ignores the fifth argument; `borderDrawn` undefined.

- [ ] **Step 3: Implement**

In `packages/card/src/border.ts`, add before `borderDataUrl` and make `borderDataUrl` use it:

```ts
/** Any SVG document as an image URL for an <img> or a canvas drawImage. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** The border document as an image URL. */
export function borderDataUrl(v: Variation, cardHeightUnits: number): string {
  return svgDataUrl(borderSvg(v, cardHeightUnits));
}
```

(delete the previous `borderDataUrl` body). Export `svgDataUrl` from `index.ts` on the border line.

In `packages/card/src/renderPng.ts`:

1. Import: `import { svgDataUrl } from "./border";`

2. `drawCard` signature and body:

```ts
/** Draw the card onto a context whose canvas is dims.W by dims.H. Pure: no fonts loading, no blob. */
export function drawCard(
  ctx: Ctx2D,
  image: CanvasImageSource,
  dims: PrintDims,
  spec: DrawSpec,
  border: CanvasImageSource | null = null,
): void {
  const { photoW, photoH, W, H, u } = dims;
  const layout = layoutCard({ photoW, photoH, ...spec });
  const fs = layout.text.fontSize * u;
  const yFromBottom = (baselineY: number) => H - (layout.height - baselineY) * u;

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  // The border sits on the mat, under the photo and the caption, exactly as on screen.
  if (border) ctx.drawImage(border, 0, 0, W, H);
  ctx.drawImage(image, layout.photo.x * u, layout.photo.y * u, photoW, photoH);
  // ... the caption and number drawing stays exactly as it is
```

3. In `RenderPngInput` add:

```ts
  /** The border SVG document from borderSvg(); drawn under the photo. Omit for the plain white mat. */
  border?: string;
  /** Loads the border as an image. Defaults to an Image element fed the data URL; resolves null when it fails. */
  loadImage?: (dataUrl: string) => Promise<CanvasImageSource | null>;
```

4. In `RenderPngResult` add:

```ts
  /** true when a border was requested and its image loaded and was drawn. */
  borderDrawn: boolean;
```

5. Add the default loader next to `domToBlob`:

```ts
function domLoadImage(dataUrl: string): Promise<CanvasImageSource | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
```

6. In `renderPng`, after `const fontsLoaded = ...`:

```ts
  const loadImage = input.loadImage ?? domLoadImage;
  const borderImage = input.border ? await loadImage(svgDataUrl(input.border)) : null;
```

pass `borderImage` as the fifth argument to `drawCard`, and add `borderDrawn: borderImage !== null,` to the returned result.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w packages/card -- renderPng border` → PASS (renderPng 19, border 9). Run: `npm test -w packages/card` and `npm run typecheck && npm run lint` → green.

- [ ] **Step 5: Commit**

```bash
git add packages/card/src/border.ts packages/card/src/renderPng.ts packages/card/src/index.ts packages/card/test/renderPng.test.ts packages/card/test/border.test.ts
git commit -m "Draw the border SVG under the photo in the print PNG and report when it could not load

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Camera make and model from EXIF

**Files:**
- Modify: `apps/web/lib/exif.ts`, `apps/web/lib/exif.test.ts`, `e2e/fixtures/make-exif-fixtures.mjs`
- Regenerate: `apps/web/public/dev/seoul.jpg`, `nogps.jpg`, `rotated.jpg`

**Interfaces:**
- Produces: `PhotoMetadata.camera: { make: string; model: string } | null` (both trimmed; null when either is missing). Fixtures carry Make and Model: seoul and rotated are `Apple` / `iPhone 15 Pro`; nogps is `FUJIFILM` / `X100VI`.

- [ ] **Step 1: Add camera to the fixtures and regenerate**

In `e2e/fixtures/make-exif-fixtures.mjs`, change `withExif` to accept and write the camera:

```js
function withExif(jpegBuffer, { orientation, date, gps, camera }) {
  const exif = { "0th": {}, Exif: {} };
  if (orientation) exif["0th"][piexif.ImageIFD.Orientation] = orientation;
  if (camera) {
    exif["0th"][piexif.ImageIFD.Make] = camera.make;
    exif["0th"][piexif.ImageIFD.Model] = camera.model;
  }
  if (date) exif.Exif[piexif.ExifIFD.DateTimeOriginal] = date;
  if (gps) exif.GPS = gpsIfd(gps);
  const bytes = piexif.dump(exif);
  return Buffer.from(piexif.insert(bytes, jpegBuffer.toString("binary")), "binary");
}
```

and the fixtures list:

```js
const APPLE = { make: "Apple", model: "iPhone 15 Pro" };
const FUJI = { make: "FUJIFILM", model: "X100VI" };
const fixtures = [
  { name: "seoul", w: 900, h: 1200, rgb: [96, 120, 160], exif: { date: DATE, gps: SEOUL, camera: APPLE } },
  { name: "nogps", w: 900, h: 1200, rgb: [160, 110, 110], exif: { date: DATE, camera: FUJI } },
  // Stored landscape with Orientation 6 (rotate 90° clockwise to display): shows as 900 × 1200 portrait.
  { name: "rotated", w: 1200, h: 900, rgb: [110, 150, 110], exif: { date: DATE, gps: SEOUL, orientation: 6, camera: APPLE } },
];
```

Run: `npm run fixtures` → the three JPEGs are rewritten (the PNGs stay byte-identical).

- [ ] **Step 2: Write the failing tests**

In `apps/web/lib/exif.test.ts`: change both `toEqual({ takenAt: null, dateSource: "none", gps: null })` assertions to `toEqual({ takenAt: null, dateSource: "none", gps: null, camera: null })`, and add inside the `describe`:

```ts
  it("reads the camera make and model", async () => {
    expect((await readPhotoMetadata(fixture("seoul.jpg"))).camera).toEqual({ make: "Apple", model: "iPhone 15 Pro" });
    expect((await readPhotoMetadata(fixture("nogps.jpg"))).camera).toEqual({ make: "FUJIFILM", model: "X100VI" });
    expect((await readPhotoMetadata(fixture("rotated.jpg"))).camera).toEqual({ make: "Apple", model: "iPhone 15 Pro" });
  });

  it("has no camera when the photo carries none", async () => {
    expect((await readPhotoMetadata(fixture("portrait.png"))).camera).toBeNull();
  });
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npm test -w apps/web -- exif`
Expected: FAIL: `camera` is undefined on the result.

- [ ] **Step 4: Implement**

In `apps/web/lib/exif.ts`: add to `PhotoMetadata`:

```ts
  /** EXIF Make and Model, trimmed; null unless both are present. */
  camera: { make: string; model: string } | null;
```

In `readPhotoMetadata`: declare `let camera: PhotoMetadata["camera"] = null;`, change the `pick` list to `["DateTimeOriginal", "CreateDate", "Make", "Model"]`, and inside the same `try` after the date logic add:

```ts
    const make = typeof out?.Make === "string" ? out.Make.trim() : "";
    const model = typeof out?.Model === "string" ? out.Model.trim() : "";
    if (make && model) camera = { make, model };
```

Return `{ takenAt, dateSource, gps, camera }`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -w apps/web -- exif` → PASS, 13 tests. Run: `npm run typecheck && npm run lint` → exit 0. Run: `npx playwright test make` → still 11 passing (the fixtures' dates and GPS are unchanged).

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/exif.ts apps/web/lib/exif.test.ts e2e/fixtures/make-exif-fixtures.mjs apps/web/public/dev/seoul.jpg apps/web/public/dev/nogps.jpg apps/web/public/dev/rotated.jpg
git commit -m "Read the camera make and model from EXIF; fixtures carry an iPhone and a Fujifilm

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The Make screen derives the variation, with the development panel

**Files:**
- Create: `apps/web/lib/photo.ts`, `apps/web/components/DevVariationPanel.tsx`
- Modify: `apps/web/app/make/MakeScreen.tsx`, `apps/web/app/globals.css`
- Test: `e2e/make.spec.ts`

**Interfaces:**
- Consumes: `deriveVariation`, `withOverrides`, `variationSeed`, `paletteFromPixels`, `borderSvg`, `cardHeightUnits`, the registries (Tasks 1 to 4); `readPhotoMetadata` with `camera` (Task 5); `Strip`, `StatusLine`.
- Produces (`apps/web/lib/photo.ts`):
  ```ts
  export interface Caption { place: string; date: string; coords: string }
  export interface DescribedPhoto { file: File; src: string; width: number; height: number; element: HTMLImageElement; meta: PhotoMetadata; match: PlaceMatch | null; lookupFailed: boolean; caption: Caption; palette: Palette | null; variation: Variation }
  export type PlaceLookup = (lat: number, lng: number) => Promise<PlaceMatch | null>;
  export async function lookupPlace(lat, lng): Promise<PlaceMatch | null>;        // moved out of MakeScreen unchanged
  export function loadImage(src: string): Promise<HTMLImageElement>;              // moved out of MakeScreen unchanged
  export function samplePhotoPalette(img: HTMLImageElement, size?: number): Palette | null;
  export async function describePhoto(file: File, lookup?: PlaceLookup): Promise<DescribedPhoto | null>;   // null when undecodable (its URL revoked)
  ```
  `DevVariationPanel({ derived, overrides, onChange, borderOnPrint, onBorderOnPrint })` renders `<section class="dev-panel" data-dev-panel>` with one `.dev-field` per registry (title then an option strip of the registry labels plus "Assigned"), a Border on print strip (On, Off), and a `<p data-dev-assigned>` line. The Make screen renders it only when `process.env.NODE_ENV !== "production"`, through a conditional dynamic import so production bundles do not contain it.

- [ ] **Step 1: Write the failing Make tests**

Append to `e2e/make.spec.ts`:

```ts
test("the dev panel switches the live card's variation and returns to the assigned one", async ({ page }) => {
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(nogps); // FUJIFILM: the rule assigns "worn"
  const card = page.locator("figure.oo-card");
  await expect(card).toHaveAttribute("data-texture", "worn");
  await expect(page.locator("img.oo-border-img")).toHaveCount(1);
  await expect(page.locator("[data-dev-assigned]")).toContainText("Assigned: worn");

  const texture = page.locator(".dev-field", { hasText: "Texture" });
  await texture.getByRole("button", { name: "Foil" }).click();
  await expect(card).toHaveAttribute("data-texture", "foil");
  await texture.getByRole("button", { name: "Assigned" }).click();
  await expect(card).toHaveAttribute("data-texture", "worn");

  const tone = page.locator(".dev-field", { hasText: "Tone" });
  await tone.getByRole("button", { name: "Photo" }).click();
  await expect(card).toHaveAttribute("data-tone", "photo");

  const tier = page.locator(".dev-field", { hasText: "Tier" });
  await tier.getByRole("button", { name: "Animated" }).click();
  await expect(card).toHaveAttribute("data-motion", "sheen");
  await expect(page.locator(".oo-frame")).toHaveClass(/oo-motion-sheen/);

  const intro = page.locator(".dev-field", { hasText: "Intro" });
  await intro.getByRole("button", { name: "Flip" }).click();
  await expect(page.locator(".oo-frame")).toHaveClass(/oo-intro-flip/);
});

test("the printed PNG carries the border, differs between textures, and can leave it off", async ({ page }) => {
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(seoul);
  const texture = page.locator(".dev-field", { hasText: "Texture" });
  const borderOnPrint = page.locator(".dev-field", { hasText: "Border on print" });
  const print = async () => {
    const dl = page.waitForEvent("download");
    await page.getByRole("button", { name: "Print" }).click();
    return readFileSync((await (await dl).path())!);
  };

  await texture.getByRole("button", { name: "Foil" }).click();
  const foil = await print();
  await expect(page.getByRole("status")).toContainText("Print saved.");
  await expect(page.getByRole("status")).not.toContainText("without the border");
  expect(PNG.sync.read(foil).width).toBe(1000);

  await texture.getByRole("button", { name: "Paper" }).click();
  const paper = await print();
  expect(foil.equals(paper)).toBe(false);

  await borderOnPrint.getByRole("button", { name: "Off" }).click();
  const plain = await print();
  expect(plain.equals(paper)).toBe(false);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx playwright test make`
Expected: the two new tests FAIL (no `data-texture`, no dev panel); the existing eleven still pass.

- [ ] **Step 3: Write photo.ts**

`apps/web/lib/photo.ts`:

```ts
import {
  type Palette,
  type Variation,
  deriveVariation,
  fmtCoords,
  fmtDate,
  paletteFromPixels,
  variationSeed,
} from "@one-of-one/card";
import type { PlaceMatch } from "@one-of-one/places";
import { type PhotoMetadata, readPhotoMetadata } from "./exif";

export interface Caption {
  place: string;
  date: string;
  coords: string;
}

export interface DescribedPhoto {
  file: File;
  src: string;
  width: number;
  height: number;
  element: HTMLImageElement;
  meta: PhotoMetadata;
  match: PlaceMatch | null;
  lookupFailed: boolean;
  caption: Caption;
  /** The photo's edge colours for the "photo" tone; null when sampling was impossible. */
  palette: Palette | null;
  /** The assigned variation (number null until the card is public). */
  variation: Variation;
}

export type PlaceLookup = (lat: number, lng: number) => Promise<PlaceMatch | null>;

/** Asks our own route for the place. Throws on any failure so the caller can say so. */
export async function lookupPlace(lat: number, lng: number): Promise<PlaceMatch | null> {
  const res = await fetch("/api/place", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lat, lng }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`place lookup failed: ${res.status}`);
  const body = (await res.json()) as { match: PlaceMatch | null };
  return body.match;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The image could not be decoded"));
    img.src = src;
  });
}

/** The photo's edge colours, sampled at a small size. Null when a canvas is unavailable or the read fails. */
export function samplePhotoPalette(img: HTMLImageElement, size = 32): Palette | null {
  try {
    const landscape = img.naturalWidth >= img.naturalHeight;
    const w = landscape ? size : Math.max(8, Math.round((size * img.naturalWidth) / img.naturalHeight));
    const h = landscape ? Math.max(8, Math.round((size * img.naturalHeight) / img.naturalWidth)) : size;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return paletteFromPixels(ctx.getImageData(0, 0, w, h).data, w, h);
  } catch {
    return null;
  }
}

/**
 * Everything the Make screen and the gallery share: decode, read EXIF, look up
 * the place, build the caption, sample the palette, derive the variation.
 * Returns null when the image cannot be decoded (its object URL is revoked).
 */
export async function describePhoto(file: File, lookup: PlaceLookup = lookupPlace): Promise<DescribedPhoto | null> {
  const src = URL.createObjectURL(file);
  const [img, meta] = await Promise.all([
    loadImage(src).catch(() => null),
    readPhotoMetadata(file, file.lastModified),
  ]);
  if (!img || img.naturalWidth === 0 || img.naturalHeight === 0) {
    URL.revokeObjectURL(src);
    return null;
  }

  let match: PlaceMatch | null = null;
  let lookupFailed = false;
  if (meta.gps) {
    try {
      match = await lookup(meta.gps.lat, meta.gps.lng);
    } catch {
      lookupFailed = true;
    }
  }

  const caption: Caption = {
    place: match?.label ?? "",
    date: meta.takenAt ? fmtDate(meta.takenAt) : "",
    coords: meta.gps ? fmtCoords(meta.gps.lat, meta.gps.lng) : "",
  };
  // Only a real capture time feeds the seed and the tone; a file's modification time is not a fact about the photo.
  const exifTime = meta.dateSource === "exif" ? meta.takenAt : null;
  const palette = samplePhotoPalette(img);
  const seed = variationSeed({
    sizeBytes: file.size,
    width: img.naturalWidth,
    height: img.naturalHeight,
    takenAtMs: exifTime?.getTime() ?? null,
    camera: meta.camera,
  });
  const variation = deriveVariation({
    seed,
    takenAt: exifTime,
    camera: meta.camera,
    number: null,
    placeKind: match?.kind ?? null,
    photoPalette: palette,
  });

  return { file, src, width: img.naturalWidth, height: img.naturalHeight, element: img, meta, match, lookupFailed, caption, palette, variation };
}
```

- [ ] **Step 4: Write the dev panel**

`apps/web/components/DevVariationPanel.tsx`:

```tsx
"use client";

import { INTROS, MOTIONS, TEXTURES, TIERS, TONES, type Variation, type VariationOverrides } from "@one-of-one/card";
import { Strip } from "@/components/Strip";

export interface DevVariationPanelProps {
  derived: Variation;
  overrides: VariationOverrides;
  onChange: (next: VariationOverrides) => void;
  borderOnPrint: boolean;
  onBorderOnPrint: (on: boolean) => void;
}

type Field = keyof VariationOverrides;

/** Built from the registries, never listed by hand: a new entry appears here on its own. */
const FIELDS: ReadonlyArray<{ key: Field; title: string; entries: ReadonlyArray<{ id: string; label: string }> }> = [
  { key: "intro", title: "Intro", entries: INTROS },
  { key: "texture", title: "Texture", entries: Object.values(TEXTURES) },
  { key: "tone", title: "Tone", entries: Object.values(TONES) },
  { key: "tier", title: "Tier", entries: Object.values(TIERS) },
  { key: "motion", title: "Motion", entries: Object.values(MOTIONS) },
];

/** Development builds only: pick any variation value to see it on the live card and in the print. Production never renders this. */
export function DevVariationPanel({ derived, overrides, onChange, borderOnPrint, onBorderOnPrint }: DevVariationPanelProps) {
  const set = (key: Field, id: string | undefined) => {
    const next: Record<string, string> = { ...(overrides as Record<string, string>) };
    if (id === undefined) delete next[key];
    else next[key] = id;
    onChange(next as VariationOverrides);
  };

  return (
    <section className="dev-panel" data-dev-panel aria-label="Variation testing (development only)">
      {FIELDS.map((f) => (
        <div className="dev-field" key={f.key}>
          <span className="label">{f.title}</span>
          <Strip
            size="option"
            cells={[
              ...f.entries.map((e) => ({
                label: e.label,
                text: e.label,
                selected: overrides[f.key] === e.id,
                onClick: () => set(f.key, e.id),
              })),
              { label: "Assigned", text: "Assigned", selected: overrides[f.key] === undefined, onClick: () => set(f.key, undefined) },
            ]}
          />
        </div>
      ))}
      <div className="dev-field">
        <span className="label">Border on print</span>
        <Strip
          size="option"
          cells={[
            { label: "On", text: "On", selected: borderOnPrint, onClick: () => onBorderOnPrint(true) },
            { label: "Off", text: "Off", selected: !borderOnPrint, onClick: () => onBorderOnPrint(false) },
          ]}
        />
      </div>
      <p className="status" data-dev-assigned>
        Assigned: {derived.texture} · {derived.tone} · {derived.tier} · {derived.motion} · {derived.intro} · seed 0x
        {derived.seed.toString(16)} · tint {derived.palette.tint}
      </p>
    </section>
  );
}
```

Append to `apps/web/app/globals.css`:

```css
/* Development-only variation panel on Make. Never rendered in production builds. */
.dev-panel {
  margin: 24px 20px 0;
  padding-top: 14px;
  border-top: 1px dashed var(--muted);
}
.dev-field {
  margin-top: 10px;
}
.dev-field .label {
  display: block;
  margin-bottom: 6px;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}
.dev-panel .strip-cell {
  font-size: 9px;
  letter-spacing: 0.08em;
  padding: 0 2px;
}
```

- [ ] **Step 5: Rewire the Make screen**

Replace `apps/web/app/make/MakeScreen.tsx` with:

```tsx
"use client";

import {
  Card,
  type LineKind,
  type VariationOverrides,
  borderSvg,
  cardHeightUnits,
  renderPng,
  withOverrides,
} from "@one-of-one/card";
import type { PlaceMatch } from "@one-of-one/places";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { Icon } from "@/components/Icon";
import { StatusLine } from "@/components/StatusLine";
import { Strip } from "@/components/Strip";
import { TopBar } from "@/components/TopBar";
import { useWall } from "@/components/useWall";
import { type DescribedPhoto, describePhoto } from "@/lib/photo";
import { statusFor } from "@/lib/status";

/** Development builds only. The condition is resolved at build time, so production bundles contain no panel code. */
const DevVariationPanel =
  process.env.NODE_ENV === "production"
    ? null
    : dynamic(() => import("@/components/DevVariationPanel").then((m) => m.DevVariationPanel), { ssr: false });

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "card";
}

export function MakeScreen() {
  const router = useRouter();
  const wall = useWall();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<DescribedPhoto | null>(null);
  const [place, setPlace] = useState("");
  const [date, setDate] = useState("");
  const [coords, setCoords] = useState("");
  const [overrides, setOverrides] = useState<VariationOverrides>({});
  const [borderOnPrint, setBorderOnPrint] = useState(true);
  const [replayKey, setReplayKey] = useState(0);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  // Caption edits commit on blur; print reads the committed text from here, not from state.
  const captionRef = useRef({ place: "", date: "", coords: "" });
  // The resolved place for step 5's numbering; not shown on the card.
  const placeMatchRef = useRef<PlaceMatch | null>(null);
  const pickSeq = useRef(0);

  // The variation on the card: the assigned one, plus any development overrides.
  const variation = photo ? withOverrides(photo.variation, overrides, photo.palette) : null;

  // Release the previous photo's object URL when it is replaced or the screen unmounts.
  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.src);
    };
  }, [photo]);

  // The one place the caption is written: the ref (read by print) and the state (read by the card).
  function setCaption(next: { place: string; date: string; coords: string }) {
    captionRef.current = next;
    setPlace(next.place);
    setDate(next.date);
    setCoords(next.coords);
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const seq = ++pickSeq.current;
    setStatus("Reading the photo…");
    const described = await describePhoto(file);
    // A newer pick has superseded this one; drop its result so it cannot overwrite the newer photo.
    if (seq !== pickSeq.current) {
      if (described) URL.revokeObjectURL(described.src);
      return;
    }
    if (!described) {
      setStatus("This photo format can't be shown here. Try a JPEG or PNG.");
      return;
    }
    placeMatchRef.current = described.match;
    setPhoto(described);
    setCaption(described.caption);
    setOverrides({});
    setReplayKey((k) => k + 1);
    setStatus(
      statusFor({
        gps: described.meta.gps !== null,
        dateSource: described.meta.dateSource,
        match: described.match?.kind ?? null,
        lookupFailed: described.lookupFailed,
      }),
    );
  }

  function onCaptionChange(field: LineKind, text: string) {
    setCaption({ ...captionRef.current, [field]: text });
  }

  function onOverrides(next: VariationOverrides) {
    setOverrides(next);
    if (next.intro !== overrides.intro) setReplayKey((k) => k + 1);
  }

  async function onPrint() {
    if (!photo || !variation || busy) return;
    // Commit a line that is still being edited; its blur handler updates captionRef synchronously.
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.classList.contains("oo-line")) active.blur();
    const { place: placeText, date: dateText, coords: coordsText } = captionRef.current;
    setBusy(true);
    setStatus("Rendering the print…");
    try {
      const border = borderOnPrint ? borderSvg(variation, cardHeightUnits(photo.width, photo.height)) : undefined;
      const r = await renderPng({
        image: photo.element,
        naturalWidth: photo.width,
        naturalHeight: photo.height,
        place: placeText,
        date: dateText,
        coords: coordsText,
        number: null,
        border,
      });
      const name = `one-of-one-${slug(placeText)}.png`;
      const file = new File([r.blob], name, { type: "image/png" });
      const notes = [
        r.fontsLoaded ? "" : "Printed with a fallback font.",
        r.reduced ? "Saved at a smaller size than full print resolution." : "",
        border && !r.borderDrawn ? "Printed without the border." : "",
      ].filter(Boolean);

      const download = (blob: Blob, fileName: string) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        setStatus(["Print saved.", ...notes].join(" "));
      };

      let shared = false;
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          setStatus(["Print shared.", ...notes].join(" "));
          shared = true;
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            setStatus(["Share cancelled.", ...notes].join(" "));
            shared = true;
          }
          // Any other failure falls through to the download below.
        }
      }
      if (!shared) download(r.blob, name);
    } catch {
      setStatus("Couldn't render the print. Try another photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppFrame
      top={
        <TopBar
          right={
            <button type="button" className="icon-target" aria-label="Cancel" onClick={() => router.push("/board")}>
              <Icon name="close" size={20} />
            </button>
          }
        />
      }
    >
      <div className="card-area">
        <Card
          photo={photo ? { src: photo.src, width: photo.width, height: photo.height } : null}
          place={place}
          date={date}
          coords={coords}
          number={null}
          editable={photo !== null}
          onCaptionChange={onCaptionChange}
          intro={variation?.intro ?? null}
          variation={variation}
          replayKey={replayKey}
          wall={wall}
          onPick={() => fileInput.current?.click()}
        />
      </div>
      <StatusLine>{status}</StatusLine>
      <div className="actions">
        <Strip
          cells={[
            { label: "Replay intro", icon: "replay", disabled: !photo, onClick: () => setReplayKey((k) => k + 1) },
            { label: "Add to board", icon: "grid-plus", selected: true, disabled: true },
            { label: "Print", icon: "printer", disabled: !photo || busy, onClick: onPrint },
          ]}
        />
      </div>
      {DevVariationPanel && photo ? (
        <DevVariationPanel
          derived={photo.variation}
          overrides={overrides}
          onChange={onOverrides}
          borderOnPrint={borderOnPrint}
          onBorderOnPrint={setBorderOnPrint}
        />
      ) : null}
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onFile} data-testid="photo-input" />
    </AppFrame>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx playwright test make` → PASS, 13 tests. Run: `npm run lint && npm run typecheck` → exit 0. Run: `npm test` → all unit tests still pass.

Open http://localhost:3000/make, pick a real photo, and switch Texture and Tone in the panel; time the Print with Foil on a phone if one is at hand and note it in the report (the border is rasterized at print size).

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/photo.ts apps/web/components/DevVariationPanel.tsx apps/web/app/make/MakeScreen.tsx apps/web/app/globals.css e2e/make.spec.ts
git commit -m "Derive the variation on Make, print it, and add the development-only variation panel

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: The development photos route and the gallery page

**Files:**
- Create: `apps/web/lib/devPhotos.ts`, `apps/web/lib/devPhotos.test.ts`, `apps/web/app/api/dev/photos/route.ts`, `apps/web/app/api/dev/photos/[name]/route.ts`, `apps/web/app/dev/variation/page.tsx`, `apps/web/app/dev/variation/VariationGallery.tsx`
- Modify: `apps/web/app/globals.css`, `playwright.config.ts`, `.gitignore`
- Test: `apps/web/lib/devPhotos.test.ts`, `e2e/dev-variation.spec.ts`

**Interfaces:**
- Consumes: `describePhoto` (Task 6); `Card`, `TEXTURES`, `TIERS`, `TONES`, `withOverrides` (Tasks 1 to 3).
- Produces: `devPhotosDir()`, `listDevPhotos(dir?)`, `resolveDevPhoto(name, dir?)`, `PHOTO_NAME` in `lib/devPhotos.ts`; `GET /api/dev/photos` → `{ photos: string[] }`; `GET /api/dev/photos/<name>` → the JPEG; both 404 in production and `no-store`; `/dev/variation` (404 in production) rendering `[data-dev-gallery]` with one `.gallery-row` per photo and one `.gallery-cell[data-texture]` per registered texture, `data-derived="true"` on the assigned one.

- [ ] **Step 1: Write the failing unit tests for the folder helpers**

`apps/web/lib/devPhotos.test.ts`:

```ts
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PHOTO_NAME, devPhotosDir, listDevPhotos, resolveDevPhoto } from "./devPhotos";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "oo-dev-photos-"));
  for (const name of ["b.jpg", "A.JPEG", "c.png", "notes.txt"]) writeFileSync(path.join(dir, name), "x");
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("devPhotosDir", () => {
  it("honours DEV_PHOTOS_DIR", () => {
    const prev = process.env.DEV_PHOTOS_DIR;
    process.env.DEV_PHOTOS_DIR = "/tmp/elsewhere";
    expect(devPhotosDir()).toBe("/tmp/elsewhere");
    if (prev === undefined) delete process.env.DEV_PHOTOS_DIR;
    else process.env.DEV_PHOTOS_DIR = prev;
  });
  it("defaults to dev-photos two levels above the app", () => {
    const prev = process.env.DEV_PHOTOS_DIR;
    delete process.env.DEV_PHOTOS_DIR;
    expect(devPhotosDir()).toBe(path.resolve(process.cwd(), "..", "..", "dev-photos"));
    if (prev !== undefined) process.env.DEV_PHOTOS_DIR = prev;
  });
});

describe("listDevPhotos", () => {
  it("lists only JPEG names, sorted", async () => {
    expect(await listDevPhotos(dir)).toEqual(["A.JPEG", "b.jpg"]);
  });
  it("is empty for a missing folder", async () => {
    expect(await listDevPhotos(path.join(dir, "missing"))).toEqual([]);
  });
});

describe("resolveDevPhoto", () => {
  it("resolves a JPEG inside the folder", async () => {
    expect(await resolveDevPhoto("b.jpg", dir)).toBe(path.join(dir, "b.jpg"));
  });
  it("refuses other types, missing files and anything that is not a plain name", async () => {
    expect(await resolveDevPhoto("c.png", dir)).toBeNull();
    expect(await resolveDevPhoto("nope.jpg", dir)).toBeNull();
    expect(await resolveDevPhoto("../b.jpg", dir)).toBeNull();
    expect(await resolveDevPhoto("sub/b.jpg", dir)).toBeNull();
    expect(await resolveDevPhoto("", dir)).toBeNull();
  });
  it("accepts only plain JPEG names", () => {
    expect(PHOTO_NAME.test("IMG_0001.JPG")).toBe(true);
    expect(PHOTO_NAME.test("a photo.jpg")).toBe(false);
    expect(PHOTO_NAME.test("x.jpeg")).toBe(true);
  });
});
```

- [ ] **Step 2: Write the failing gallery browser tests**

Add to `playwright.config.ts`: `import path from "node:path";` at the top, and in `webServer` add

```ts
    env: { ...(process.env as Record<string, string>), DEV_PHOTOS_DIR: path.resolve("apps/web/public/dev") },
```

so the dev server lists the three fixture JPEGs as "dev photos".

`e2e/dev-variation.spec.ts`:

```ts
import path from "node:path";
import { expect, test } from "@playwright/test";
import { TEXTURES } from "../packages/card/src/textures";

const textureCount = Object.keys(TEXTURES).length;

test("lists the JPEGs in the dev photos folder", async ({ request }) => {
  const r = await request.get("/api/dev/photos");
  expect(r.status()).toBe(200);
  expect(r.headers()["cache-control"]).toBe("no-store");
  expect(await r.json()).toEqual({ photos: ["nogps.jpg", "rotated.jpg", "seoul.jpg"] });
});

test("serves one photo and refuses anything else", async ({ request }) => {
  const ok = await request.get("/api/dev/photos/seoul.jpg");
  expect(ok.status()).toBe(200);
  expect(ok.headers()["content-type"]).toBe("image/jpeg");
  expect(ok.headers()["cache-control"]).toBe("no-store");
  for (const bad of ["portrait.png", "nope.jpg", "..%2Fseoul.jpg", "%2E%2E%2Fseoul.jpg"]) {
    expect((await request.get(`/api/dev/photos/${bad}`)).status(), bad).toBe(404);
  }
});

test("the gallery shows every photo under every texture and marks the assigned one", async ({ page }) => {
  await page.goto("/dev/variation");
  await expect(page.locator("[data-dev-gallery] .gallery-row")).toHaveCount(3);
  await expect(page.locator(".gallery-row").first().locator("figure.oo-card")).toHaveCount(textureCount);
  const nogps = page.locator(".gallery-row", { hasText: "nogps.jpg" });
  await expect(nogps.locator('.gallery-cell[data-derived="true"]')).toHaveAttribute("data-texture", "worn");
  await expect(nogps.locator('.gallery-cell[data-texture="foil"] figure.oo-card')).toHaveAttribute("data-texture", "foil");
  const seoul = page.locator(".gallery-row", { hasText: "seoul.jpg" });
  await expect(seoul.locator(".status").first()).toContainText("Seoul, South Korea");
  await expect(seoul.locator("img.oo-border-img")).toHaveCount(textureCount);
});

test("the tier and tone strips change every card", async ({ page }) => {
  await page.goto("/dev/variation");
  await expect(page.locator(".gallery-row")).toHaveCount(3);
  await page.getByRole("button", { name: "Animated" }).click();
  for (const card of await page.locator("figure.oo-card").all()) await expect(card).toHaveAttribute("data-tier", "animated");
  await page.getByRole("button", { name: "Photo", exact: true }).click();
  for (const card of await page.locator("figure.oo-card").all()) await expect(card).toHaveAttribute("data-tone", "photo");
});

test("a picked photo joins the gallery", async ({ page }) => {
  await page.goto("/dev/variation");
  await expect(page.locator(".gallery-row")).toHaveCount(3);
  await page.getByTestId("gallery-input").setInputFiles(path.resolve("apps/web/public/dev/portrait.png"));
  await expect(page.locator(".gallery-row")).toHaveCount(4);
  await expect(page.locator(".gallery-row", { hasText: "portrait.png" }).locator("figure.oo-card")).toHaveCount(textureCount);
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npm test -w apps/web -- devPhotos` → FAIL (module missing). Run: `npx playwright test dev-variation` → FAIL (404s).

- [ ] **Step 4: Implement the folder helpers and the routes**

`apps/web/lib/devPhotos.ts`:

```ts
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

/** A plain JPEG file name: no slashes, no spaces. */
export const PHOTO_NAME = /^[\w.-]+\.(jpe?g)$/i;

/** The folder of local test photos: DEV_PHOTOS_DIR, else dev-photos/ at the repo root (two levels above apps/web). */
export function devPhotosDir(): string {
  return process.env.DEV_PHOTOS_DIR ?? path.resolve(process.cwd(), "..", "..", "dev-photos");
}

/** JPEG names in the folder, sorted; empty when the folder does not exist. */
export async function listDevPhotos(dir = devPhotosDir()): Promise<string[]> {
  try {
    const names = await readdir(dir);
    return names.filter((n) => PHOTO_NAME.test(n)).sort();
  } catch {
    return [];
  }
}

/** The absolute path of one photo, or null unless the name is a plain JPEG name that resolves to a file inside the folder. */
export async function resolveDevPhoto(name: string, dir = devPhotosDir()): Promise<string | null> {
  if (!PHOTO_NAME.test(name)) return null;
  const root = path.resolve(dir);
  const file = path.resolve(root, name);
  if (!file.startsWith(root + path.sep)) return null;
  try {
    return (await stat(file)).isFile() ? file : null;
  } catch {
    return null;
  }
}
```

`apps/web/app/api/dev/photos/route.ts`:

```ts
import { NextResponse } from "next/server";
import { listDevPhotos } from "@/lib/devPhotos";

export const dynamic = "force-dynamic";

/** Development only: the JPEG names in the local test-photo folder. */
export async function GET(): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  return NextResponse.json({ photos: await listDevPhotos() }, { headers: { "Cache-Control": "no-store" } });
}
```

`apps/web/app/api/dev/photos/[name]/route.ts`:

```ts
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { resolveDevPhoto } from "@/lib/devPhotos";

export const dynamic = "force-dynamic";

/** Development only: one JPEG from the local test-photo folder, by plain name. */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  const { name } = await params;
  const file = await resolveDevPhoto(name);
  if (!file) return new NextResponse(null, { status: 404 });
  const bytes = await readFile(file);
  return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" } });
}
```

Append `dev-photos/` to `.gitignore` under a `# local test photos (never committed)` comment.

- [ ] **Step 5: Implement the gallery page**

`apps/web/app/dev/variation/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { VariationGallery } from "./VariationGallery";

export const dynamic = "force-dynamic";

/** Development only: every local test photo under every texture. */
export default function DevVariationPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <VariationGallery />;
}
```

`apps/web/app/dev/variation/VariationGallery.tsx`:

```tsx
"use client";

import { Card, TEXTURES, TIERS, TONES, type Tier, type Tone, withOverrides } from "@one-of-one/card";
import { type ChangeEvent, useEffect, useState } from "react";
import { Strip } from "@/components/Strip";
import { type DescribedPhoto, describePhoto } from "@/lib/photo";

interface Entry {
  name: string;
  photo: DescribedPhoto;
}

export function VariationGallery() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tier, setTier] = useState<Tier>("standard");
  /** null: each photo's own tone. */
  const [tone, setTone] = useState<Tone | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/dev/photos");
      const { photos } = (await res.json()) as { photos: string[] };
      const found: Entry[] = [];
      for (const name of photos) {
        const blob = await (await fetch(`/api/dev/photos/${encodeURIComponent(name)}`)).blob();
        const described = await describePhoto(new File([blob], name, { type: "image/jpeg" }));
        if (described) found.push({ name, photo: described });
      }
      if (!cancelled) {
        setEntries(found);
        setLoaded(true);
      }
    })().catch(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const described = await describePhoto(file);
    if (described) setEntries((prev) => [...prev, { name: file.name, photo: described }]);
  }

  return (
    <main className="gallery" data-dev-gallery>
      <h1 className="place-name">Variation gallery (development only)</h1>
      <div className="gallery-controls">
        <Strip
          size="option"
          cells={Object.values(TIERS).map((t) => ({ label: t.label, text: t.label, selected: tier === t.id, onClick: () => setTier(t.id) }))}
        />
        <Strip
          size="option"
          cells={[
            { label: "Photo's own", text: "Own", selected: tone === null, onClick: () => setTone(null) },
            ...Object.values(TONES).map((t) => ({ label: t.label, text: t.label, selected: tone === t.id, onClick: () => setTone(t.id) })),
          ]}
        />
        <label className="gallery-pick">
          Pick a photo <input type="file" accept="image/*" onChange={onPick} data-testid="gallery-input" />
        </label>
      </div>
      {loaded && entries.length === 0 ? (
        <p className="status">Drop JPEGs into dev-photos/ at the repo root, or pick one.</p>
      ) : null}
      {entries.map(({ name, photo }) => (
        <section className="gallery-row" key={photo.src}>
          <p className="status">
            {name} · assigned {photo.variation.texture} · {photo.variation.tone} · {photo.variation.tier}
            {photo.caption.place ? ` · ${photo.caption.place}` : ""}
          </p>
          <div className="gallery-cards">
            {Object.values(TEXTURES).map((t) => {
              const v = withOverrides(photo.variation, { texture: t.id, tier, ...(tone ? { tone } : {}) }, photo.palette);
              return (
                <figure
                  className="gallery-cell"
                  key={t.id}
                  data-texture={t.id}
                  data-derived={t.id === photo.variation.texture ? "true" : "false"}
                >
                  <div style={{ width: 160 }}>
                    <Card
                      photo={{ src: photo.src, width: photo.width, height: photo.height }}
                      place={photo.caption.place}
                      date={photo.caption.date}
                      coords={photo.caption.coords}
                      number={null}
                      variation={v}
                      wall="light"
                    />
                  </div>
                  <figcaption className="label">{t.label}</figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
```

Append to `apps/web/app/globals.css`:

```css
/* Development-only variation gallery. */
.gallery {
  padding: 16px 20px 40px;
}
.gallery-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 12px 0 20px;
  max-width: 430px;
}
.gallery-pick {
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}
.gallery-row {
  margin-top: 18px;
}
.gallery-cards {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
}
.gallery-cell {
  margin: 0;
  flex: 0 0 auto;
  padding-bottom: 6px;
  border-bottom: 1px solid transparent;
}
.gallery-cell[data-derived="true"] {
  border-bottom-color: var(--ink);
}
.gallery-cell .label {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  text-align: center;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -w apps/web -- devPhotos` → PASS, 7 tests. Run: `npx playwright test dev-variation` → PASS, 5 tests. Run: `npm run lint && npm run typecheck` → exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/devPhotos.ts apps/web/lib/devPhotos.test.ts apps/web/app/api/dev apps/web/app/dev/variation apps/web/app/globals.css playwright.config.ts .gitignore e2e/dev-variation.spec.ts
git commit -m "Add the development gallery: local test photos under every texture, tier and tone

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Every texture passes the screen-versus-print test

**Files:**
- Modify: `apps/web/app/dev/card/page.tsx`, `apps/web/app/dev/card/DevCard.tsx`, `e2e/equivalence.spec.ts`

**Interfaces:**
- Consumes: `TEXTURES`, `TIERS`, `NEUTRAL_PALETTE`, `borderSvg`, `cardHeightUnits` (Tasks 1 to 4).
- Produces: `/dev/card` accepts `texture=<id>`, `tier=<id>` (default `fine`) and `driftBorder=1`; with a texture, the DOM card gets a variation (neutral palette, motion none, seed 12345) and the PNG gets the same border document. `driftBorder=1` shifts the DOM border image one unit to the right through a dev-page style.

- [ ] **Step 1: Write the failing tests**

In `e2e/equivalence.spec.ts`, add `import { TEXTURES } from "../packages/card/src/textures";` and, in `capture()`, decode the border image when present (after the photo decode line):

```ts
  const border = page.locator("#dom img.oo-border-img");
  if ((await border.count()) > 0) await border.evaluate((el) => (el as HTMLImageElement).decode());
```

Append:

```ts
// Every registered texture, so adding one adds its screen-versus-print case.
for (const id of Object.keys(TEXTURES)) {
  const tier = id === "foil" ? "foil" : "fine";
  const name = `portrait-texture-${id}`;
  test(`${name}: the DOM card and the PNG match`, async ({ page }) => {
    const { dom, png } = await capture(page, `fixture=portrait&coords=1&number=1&texture=${id}&tier=${tier}`);
    expect(diffRatio(dom, png, name)).toBeLessThan(MAX_DIFF_RATIO);
  });
}

test("a one-unit border drift on the foil texture is caught", async ({ page }) => {
  const { dom, png } = await capture(page, "fixture=portrait&coords=1&number=1&texture=foil&tier=foil&driftBorder=1");
  expect(diffRatio(dom, png, "border-drift")).toBeGreaterThan(MAX_DIFF_RATIO * 3);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx playwright test equivalence`
Expected: the four texture cases pass trivially today only if the page ignores the parameter, so the drift case FAILS (no border to drift). Confirm the drift case fails before continuing.

- [ ] **Step 3: Implement the dev page parameters**

In `apps/web/app/dev/card/page.tsx`: import `TEXTURES`, `TIERS` and the types from `@one-of-one/card`:

```ts
import { TEXTURES, TIERS, type Texture, type Tier } from "@one-of-one/card";
```

and pass the new props:

```tsx
  const texture = (Object.keys(TEXTURES) as Texture[]).find((t) => t === one(q.texture)) ?? null;
  const tier = (Object.keys(TIERS) as Tier[]).find((t) => t === one(q.tier)) ?? "fine";
  return (
    <DevCard
      fixture={fixture}
      coords={one(q.coords) !== "0"}
      number={number}
      longPlace={one(q.place) === "long"}
      drift={one(q.drift) === "1"}
      texture={texture}
      tier={tier}
      driftBorder={one(q.driftBorder) === "1"}
    />
  );
```

In `apps/web/app/dev/card/DevCard.tsx`:

1. Imports: `import { CARD, Card, NEUTRAL_PALETTE, type Texture, type Tier, type Variation, borderSvg, cardHeightUnits, renderPng } from "@one-of-one/card";`
2. Props: add `texture: Texture | null; tier: Tier; driftBorder: boolean;` to `DevCardProps` and destructure them.
3. Before the state hooks:

```ts
  // A fixed variation for the diff: neutral colours, no motion, one seed, so only the texture varies between cases.
  const variation: Variation | null = texture
    ? { texture, tone: "neutral", palette: NEUTRAL_PALETTE, tier, motion: "none", intro: "rise", seed: 12345 }
    : null;
```

4. In the `renderPng` call add `border: variation ? borderSvg(variation, cardHeightUnits(photo.width, photo.height)) : undefined,` and add `texture, tier` to that effect's dependency array.
5. In the JSX: the `<style>` becomes

```tsx
      <style>{`.drift .oo-plate { padding-bottom: ${CARD.bottom + 1}cqw; } .drift-border .oo-border-img { transform: translateX(1cqw); }`}</style>
```

the `#dom` div's className becomes `[drift ? "drift" : null, driftBorder ? "drift-border" : null].filter(Boolean).join(" ") || undefined`, and `<Card ... />` gets `variation={variation}`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx playwright test equivalence` → PASS, 21 tests (16 before plus 4 textures and the border drift). Record every ratio printed. If a texture case exceeds `MAX_DIFF_RATIO`, do not loosen it: open its `*-diff.png` under `test-results/`, describe where the difference is (whole mat, the band, the text), and report BLOCKED. If the border drift case is not above three times the tolerance, report its ratio and BLOCKED.

Run: `npm run lint && npm run typecheck` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/dev/card/page.tsx apps/web/app/dev/card/DevCard.tsx e2e/equivalence.spec.ts
git commit -m "Prove screen and print match for every registered texture, and catch a border drift

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: The production build serves no development surface; CI and docs

**Files:**
- Create: `scripts/check-prod.mjs`
- Modify: `package.json` (root scripts), `.github/workflows/ci.yml`, `CLAUDE.md`, `README.md`

**Interfaces:**
- Produces: `npm run build` (the app), `npm run check:prod` (build, start on port 3100, assert the dev surfaces are absent, stop). CI runs it after the e2e suite.

- [ ] **Step 1: Write the check script**

`scripts/check-prod.mjs`:

```js
// Proves a production build serves none of the development surfaces:
// /dev/* and /api/dev/* are 404, and the Make page and its scripts carry no dev-panel markup.
// Run after `npm run build`: node scripts/check-prod.mjs
import { spawn } from "node:child_process";

const port = 3100;
const base = `http://localhost:${port}`;
const server = spawn("npm", ["run", "start", "-w", "apps/web", "--", "--port", String(port)], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(`${base}/board`)).status === 200) return;
    } catch {
      // not up yet
    }
    await sleep(1000);
  }
  throw new Error("the production server did not start");
}

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

try {
  await waitForServer();
  for (const p of ["/dev/variation", "/dev/card", "/api/dev/photos", "/api/dev/photos/seoul.jpg"]) {
    const r = await fetch(`${base}${p}`);
    check(r.status === 404, `${p} should be 404 in production, got ${r.status}`);
  }
  const make = await fetch(`${base}/make`);
  check(make.status === 200, `/make should be 200, got ${make.status}`);
  const html = await make.text();
  check(!html.includes("data-dev-panel"), "/make HTML contains the dev panel");
  const scripts = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
  check(scripts.length > 0, "no scripts found on /make");
  for (const src of scripts) {
    const js = await (await fetch(src.startsWith("http") ? src : `${base}${src}`)).text();
    check(!js.includes("data-dev-panel") && !js.includes("Variation testing (development only)"), `${src} contains dev panel code`);
  }
} finally {
  server.kill();
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("production build serves no development surface");
```

- [ ] **Step 2: Wire the scripts and CI**

In the root `package.json` scripts add:

```json
    "build": "npm run build -w apps/web",
    "check:prod": "npm run build && node scripts/check-prod.mjs",
```

In `.github/workflows/ci.yml`, after the `npm run test:e2e` step (and its `env`), add:

```yaml
      - run: npm run check:prod
```

Run: `npm run check:prod`
Expected: the build succeeds and the last line is `production build serves no development surface`. If a script contains the dev panel string, the conditional dynamic import in `MakeScreen.tsx` was not folded away; report the chunk name and stop.

- [ ] **Step 3: Record it in CLAUDE.md and README.md**

In `CLAUDE.md`:

1. In the Commands block add after the `npm run fixtures` line:

```
npm run check:prod                       production build, then prove /dev/*, /api/dev/* and the Make dev panel are absent
```

2. Under `## Where things are`, add a bullet:

```
- Development-only surfaces, absent from production builds: the variation panel under the card on Make (switch intro, texture, tone, tier, motion, border on print), `/dev/variation` (every photo in the git-ignored `dev-photos/` folder, or a picked one, under every texture), `/api/dev/photos`, and `/dev/card` for the equivalence test. `npm run check:prod` proves they do not ship.
```

and change the build-order bullet to:

```
- Build order from SPEC.md: steps 1 (renderer and shell), 3 (metadata) and 2 (variation) are done. Next is step 4 (accounts and the board). Decisions and plans so far are under `docs/superpowers/`.
```

3. Under `## Conventions`, add:

```
- Variation is assigned by `deriveVariation` from the photo's facts; users never pick it. Everything that varies is a registry entry in `packages/card` (`TEXTURES`, `TONES`, `TIERS`, `MOTIONS`, `INTROS`): add there, never in the panel, the gallery or the tests, which read the registries. The rule table `VARIATION_RULES` is a first draft until textures have been judged on about 50 real photos.
- Development-only controls render only when `process.env.NODE_ENV !== "production"` and must never ship; `npm run check:prod` is the proof.
```

In `README.md`, add after the `e2e/` line in the tree:

```
dev-photos/               your own JPEGs for /dev/variation (git-ignored; create it when you want it)
```

- [ ] **Step 4: Run everything**

Run: `npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run check:prod`
Expected: all green. Record the unit counts per workspace and the e2e count (2 board + 13 make + 21 equivalence + 12 place + 5 dev-variation = 53).

- [ ] **Step 5: Commit**

```bash
git add scripts/check-prod.mjs package.json .github/workflows/ci.yml CLAUDE.md README.md
git commit -m "Prove production builds carry no development surface; record step 2 in the docs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Push and confirm the `ci` workflow passes on GitHub before starting step 4.
