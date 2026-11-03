# Tone strength Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Warm and Cool visibly change the card. They become a white-balance shift of the photo's colours, by a strength from 6 to 20 assigned per card from the sun and the season. Founders can set the strength with a slider.

**Architecture:** All colour logic stays in `packages/card/src/variation.ts`:
- `deriveToneStrength` sits beside `deriveTone` and shares its sun and season steps.
- `whiteBalance` replaces `nudgePalette`.
- `paletteFor` takes the strength.
- `Variation` carries `toneStrength`.

The app stores the strength with each card's design, reads stored strengths through `knownToneStrength`, and gains a Strength slider in the founders' design panel.

**Tech Stack:** TypeScript, React 19, Next.js App Router, Vitest, Playwright, Supabase (jsonb `cards.variation`, no migration).

**Spec:** `docs/superpowers/specs/2026-11-03-tone-strength-design.md`

## Global Constraints

- **Where to work:** run every command from the worktree root `/Users/alex/Desktop/one-of-one-handoff/.claude/worktrees/variation-facts`, on branch `tone-strength`. Never use bare `git stash`.
- **Dependencies:** npm workspaces on Node 24. No new dependencies. `packages/card` has no app imports.
- **Strength values:** `VARIATION_RULES.strength = { weak: 6, strong: 20, nightBelow: -18, max: 20 }`. The middle strength is `Math.round((weak + strong) / 2)` = 13.
- **White balance:** Warm adds `strength` to red and subtracts it from blue, and Cool does the reverse. Each channel is clamped to 0–255. The shift applies to the wash, the tint and both foil stops, after `withWash` and before `withCaptionContrast`. A grey palette (tint saturation under `GREY_SATURATION`) is never shifted.
- **Unchanged tones:** Photo and Neutral resolve exactly as before: `withCaptionContrast(withWash(base))`.
- **Saved cards:** never re-resolve a stored palette unless the tone or the strength is overridden. A stored variation without `toneStrength` reads as 13 through `knownToneStrength`. No migration, no rewrite of saved rows.
- **Screen equals print:** do not touch `CARD` in `layout.ts`. `/dev/card` keeps the Photo tone.
- **Spelling:** prose and comments use British spelling ("colour").
- **Commit messages:** one plain descriptive sentence, then a blank line, then `Co-Authored-By: <the model you are> <noreply@anthropic.com>`.
- **Browser suite:** it cannot share a running dev server. Next 16 refuses a second `next dev` in the same app, and Playwright needs the sign-in bypass off. Before `npm run test:e2e`, `npx playwright test` or `npm run check:prod`, make sure nothing listens on port 3000 (`lsof -nP -iTCP:3000 -sTCP:LISTEN`). The controller stops its dev server before dispatching.

## File map

| File | Change |
| --- | --- |
| `packages/card/src/variation.ts` | `whiteBalance`, `paletteFor(tone, palette, strength)`, `deriveToneStrength`, `knownToneStrength`, `Variation.toneStrength`, the `strength` rules, overrides; `nudgePalette` and `mixTowardHue` go |
| `packages/card/src/index.ts` | Exports |
| `packages/card/src/Card.tsx` | `data-tone-strength` on the figure |
| `packages/card/test/variation.test.ts`, `contrast.test.ts`, `border.test.ts`, `Card.test.tsx` | Update |
| `apps/web/lib/save.ts`, `lib/designs.ts`, `lib/save.test.ts` | Store `toneStrength` |
| `apps/web/app/card/[id]/page.tsx` | Read it through `knownToneStrength` |
| `apps/web/app/dev/card/DevCard.tsx` | Pass a strength |
| `apps/web/components/DesignPanel.tsx`, `design-panel.css` | The Strength slider |
| `e2e/make.spec.ts`, `e2e/founder.spec.ts`, `e2e/founder.ts` | Browser tests, and one psql helper for all three helpers |
| `SPEC.md`, `CLAUDE.md` | The new rule |

---

### Task 1: The strength rule, the white-balance shift, and storing the strength

Everything in `packages/card`, plus the app changes needed to save and read the new field and keep the typecheck green. There is no visible UI yet, beyond Warm and Cool now visibly differing.

**Files:**
- Modify: `packages/card/src/variation.ts`, `packages/card/src/index.ts`, `packages/card/src/Card.tsx`
- Modify: `apps/web/lib/save.ts`, `apps/web/lib/designs.ts`, `apps/web/app/card/[id]/page.tsx`, `apps/web/app/dev/card/DevCard.tsx`
- Test: `packages/card/test/variation.test.ts`, `packages/card/test/contrast.test.ts`, `packages/card/test/border.test.ts`, `packages/card/test/Card.test.tsx`, `apps/web/lib/save.test.ts`

**Interfaces:**
- Produces:
  - `whiteBalance(p: Palette, direction: 1 | -1, steps: number): Palette`
  - `paletteFor(tone: Tone, photoPalette: Palette | null, strength: number): Palette`
  - `deriveToneStrength(f: ToneFacts): number`
  - `knownToneStrength(value: unknown): number`
  - `Variation.toneStrength: number`
  - `VariationOverrides` gains `toneStrength`
  - `VARIATION_RULES.strength = { weak: 6, strong: 20, nightBelow: -18, max: 20 }`
  - `TONES.warm` and `TONES.cool` are `{ source: "shift", direction: 1 | -1 }`
  - The card figure carries `data-tone-strength`
  - Stored `variation` jsonb holds `toneStrength`

- [ ] **Step 1: Write the failing unit tests in `packages/card/test/variation.test.ts`**

In the `../src/variation` import, remove `nudgePalette` and add `deriveToneStrength`, `knownToneStrength` and `whiteBalance`. Add `hslToHex` to the `../src/colour` import, which currently imports only `hexToHsl`.

In the `registries` describe, replace the test `"tones are nudges of the photo's colour, the photo's colour itself, or the neutral grey"` with:

```ts
  it("tones are white-balance shifts of the photo's colour, the photo's colour itself, or the neutral grey", () => {
    expect(Object.keys(TONES)).toEqual(["warm", "photo", "cool", "neutral"]);
    expect(TONES.warm).toMatchObject({ source: "shift", direction: 1 });
    expect(TONES.cool).toMatchObject({ source: "shift", direction: -1 });
    expect(TONES.photo.source).toBe("photo");
    expect(TONES.neutral.source).toBe("neutral");
    for (const tone of Object.values(TONES)) expect(JSON.stringify(tone)).not.toMatch(/#[0-9a-f]{3,6}/i);
  });
```

Add this describe after `describe("deriveTone", …)`:

```ts
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
```

Replace the whole `describe("nudgePalette", …)` block with:

```ts
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
```

In `describe("paletteFor", …)`, make these changes:
- Pass a strength wherever `paletteFor` is called: `13` in `"gives every tone a wash"`, `"returns the sampled palette with its wash for the photo tone"`, `"is the neutral grey for neutral…"` and `"lightens a sampled palette's foil…"`.
- Replace the test `"nudges the sampled palette for warm and cool"` with:

```ts
  it("shifts the sampled palette's white balance by the strength for warm and cool", () => {
    expect(paletteFor("warm", photoPalette, 13)).toEqual(withCaptionContrast(whiteBalance(withWash(photoPalette), 1, 13)));
    expect(paletteFor("cool", photoPalette, 6)).toEqual(withCaptionContrast(whiteBalance(withWash(photoPalette), -1, 6)));
    expect(paletteFor("warm", photoPalette, 20)).not.toEqual(paletteFor("warm", photoPalette, 6));
  });
  it("ignores the strength for the photo's colour and the neutral grey", () => {
    expect(paletteFor("photo", photoPalette, 20)).toEqual(paletteFor("photo", photoPalette, 0));
    expect(paletteFor("neutral", photoPalette, 20)).toEqual(paletteFor("neutral", photoPalette, 0));
  });
```

Add this describe after `describe("paletteFor", …)`. It is the test that would have caught the invisible tones:

```ts
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
```

In `describe("deriveVariation", …)`:
- In `"combines the rules…"`, the expected object becomes:

```ts
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
```

  (`inputs` has no GPS, so the strength is the middle.)
- Replace `"nudges the photo's own palette rather than replacing it"` with:

```ts
  it("shifts the photo's own palette by the card's strength rather than replacing it", () => {
    const v = deriveVariation({ ...inputs, photoPalette });
    expect(v.palette).toEqual(paletteFor("warm", photoPalette, v.toneStrength));
    expect(v.palette.wash).not.toBe(paletteFor("photo", photoPalette, v.toneStrength).wash);
  });
```

In `describe("withOverrides", …)`:
- In `"re-resolves the palette from the sample only when the tone is overridden"`, pass `base.toneStrength` to every `paletteFor` call.
- Add:

```ts
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
```

- [ ] **Step 2: Update the other card tests**

`packages/card/test/contrast.test.ts`, in `"holds for the wash and both foil stops across a sweep of sampled colours"`: replace

```ts
          for (const tone of Object.keys(TONES) as Tone[]) {
            const p = paletteFor(tone, sample);
            for (const c of [p.wash!, ...p.foil]) {
              const label = `${tone} ${hue}/${s}/${l} ${c}`;
              expect(contrastRatio(c, CAPTION_INK), label).toBeGreaterThanOrEqual(CAPTION_MIN_CONTRAST);
              expect(contrastRatio(c, COORDS_INK), label).toBeGreaterThanOrEqual(COORDS_MIN_CONTRAST);
            }
          }
```

with

```ts
          for (const tone of Object.keys(TONES) as Tone[]) {
            for (const strength of [0, 6, 13, 20]) {
              const p = paletteFor(tone, sample, strength);
              for (const c of [p.wash!, ...p.foil]) {
                const label = `${tone} ${strength} ${hue}/${s}/${l} ${c}`;
                expect(contrastRatio(c, CAPTION_INK), label).toBeGreaterThanOrEqual(CAPTION_MIN_CONTRAST);
                expect(contrastRatio(c, COORDS_INK), label).toBeGreaterThanOrEqual(COORDS_MIN_CONTRAST);
              }
            }
          }
```

`packages/card/test/border.test.ts`:
- Add `toneStrength: 13,` to `base` after `seed: 12345,`.
- At line 53, `paletteFor(tone, null)` becomes `paletteFor(tone, null, 13)`.

`packages/card/test/Card.test.tsx`:
- Add `toneStrength: 13,` to the `variation` const after `seed: 7,`.
- In `"draws the border image under the photo when a variation is given"`, add `expect(html).toContain('data-tone-strength="13"');`.

`apps/web/lib/save.test.ts`:
- Add `toneStrength: 13,` to the fixture's `variation` after `seed: 2263211217,`.
- The expected row's `variation` becomes `{ texture: "paper", tone: "warm", palette: { tint: "#b08860", foil: ["#f3d9a4", "#b8864a"] }, tier: "standard", motion: "none", toneStrength: 13 }`.

- [ ] **Step 3: Run the tests to see them fail**

Run: `npm test -w packages/card -- variation contrast border Card`
Expected: FAIL. Vitest reports `whiteBalance`, `deriveToneStrength` and `knownToneStrength` as not functions (or not exported), and `paletteFor`'s results do not match.

- [ ] **Step 4: Implement in `packages/card/src/variation.ts`**

Replace the ToneDef comment, `ToneDef` and `TONES` (lines 25-41) with:

```ts
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
```

Delete `mixTowardHue` and `nudgePalette` (lines 47-72, from the `mixTowardHue` comment through the end of `nudgePalette`). In their place, add:

```ts
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
```

Replace `paletteFor` with:

```ts
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
```

In `interface Variation`, add after `tone: Tone;`:

```ts
  /** How far Warm or Cool shifts the palette, in steps of 255 on red and blue (VARIATION_RULES.strength). Stored with the card; the photo's colour and the grey ignore it. */
  toneStrength: number;
```

In `VARIATION_RULES`, replace

```ts
  /** Warm and cool are mixes toward these hues (degrees) by `amount` (0 to 1). */
  nudge: { warmHue: 35, coolHue: 215, amount: 0.2 },
```

with

```ts
  /**
   * How strongly Warm and Cool shift a card, in steps of 255: from `weak` to `strong` by how deep
   * the sun is into golden hour or into the night (night is full at `nightBelow` degrees), with the
   * season adding half the range. `max` is the top of the founders' slider.
   */
  strength: { weak: 6, strong: 20, nightBelow: -18, max: 20 },
```

In the `satisfies` type, replace `nudge: { warmHue: number; coolHue: number; amount: number };` with `strength: { weak: number; strong: number; nightBelow: number; max: number };`.

Replace `deriveTone` (from its doc comment through its closing brace) with:

```ts
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
```

In `deriveVariation`:
- After the `const tone = …` line, add `const toneStrength = deriveToneStrength({ takenAt: inputs.takenAt, gps: inputs.gps, utcOffsetMinutes: inputs.utcOffsetMinutes });`.
- `palette: paletteFor(tone, inputs.photoPalette),` becomes `palette: paletteFor(tone, inputs.photoPalette, toneStrength),`.
- Add `toneStrength,` after `seed,` in the returned object.

Replace the `VariationOverrides` line with:

```ts
export type VariationOverrides = Partial<Pick<Variation, "texture" | "tone" | "toneStrength" | "tier" | "motion" | "intro">>;
```

In `withOverrides`:
- Change the doc comment to: `Apply overrides and re-resolve what depends on them: the palette only from an overridden tone or strength (a stored palette is kept otherwise), the motion and the texture from an overridden tier.`
- Add `const toneStrength = overrides.toneStrength ?? base.toneStrength;` after the `const tone` line.
- In the returned object, `palette: overrides.tone !== undefined ? paletteFor(tone, photoPalette) : base.palette,` becomes:

```ts
    palette: overrides.tone !== undefined || overrides.toneStrength !== undefined ? paletteFor(tone, photoPalette, toneStrength) : base.palette,
    toneStrength,
```

- [ ] **Step 5: Exports and the card attribute**

`packages/card/src/index.ts`, in the `./variation` value export:
- Remove `nudgePalette,`.
- Add `deriveToneStrength,` after `deriveTone,`, `knownToneStrength,` after `deriveVariation,`, and `whiteBalance,` after `variationSeed,`.

`packages/card/src/Card.tsx`: after `data-tone={variation?.tone}` add `data-tone-strength={variation?.toneStrength}`.

- [ ] **Step 6: Store and read the strength in the app**

`apps/web/lib/save.ts`:
- In `interface CardRow`, the `variation` field becomes `variation: Pick<Variation, "texture" | "tone" | "palette" | "tier" | "motion" | "toneStrength">;`.
- In `cardRow`, the destructure becomes `const { texture, tone, palette, tier, motion, toneStrength, intro, seed } = photo.variation;`, and the row's field becomes `variation: { texture, tone, palette, tier, motion, toneStrength },`.

`apps/web/lib/designs.ts`: the destructure becomes `const { texture, tone, palette, tier, motion, toneStrength, intro } = v;`, and the update becomes `.update({ variation: { texture, tone, palette, tier, motion, toneStrength }, intro })`.

`apps/web/app/card/[id]/page.tsx`:
- The import becomes `import { knownMotion, knownToneStrength, type Variation } from "@one-of-one/card";`.
- In `CardReadRow`, the `variation` type and its comment become:

```ts
  // The motion is a string: a card saved with a since-retired motion still holds its id. A card saved before Nov 3, 2026 has no tone strength.
  variation: Pick<Variation, "texture" | "tone" | "palette" | "tier"> & { motion: string; toneStrength?: unknown };
```

- The `variation` prop becomes:

```tsx
      variation={{
        ...row.variation,
        motion: knownMotion(row.variation.motion),
        toneStrength: knownToneStrength(row.variation.toneStrength),
        intro: row.intro,
        seed: Number(row.variation_seed),
      }}
```

`apps/web/app/dev/card/DevCard.tsx`, in the fixed variation: `paletteFor("photo", DEV_PALETTE)` becomes `paletteFor("photo", DEV_PALETTE, 13)`, and the object gains `toneStrength: 13` after `seed: 12345`. The Photo tone ignores the strength, so the equivalence diff is unchanged.

- [ ] **Step 7: Run everything that does not need a browser**

Run: `npm test && npm run typecheck && npm run lint`
Expected: every workspace passes, including the new `deriveToneStrength`, `whiteBalance`, `knownToneStrength` and "Warm and Cool are visible" tests. No type errors, and lint is clean. If tsc reports another place that builds a `Variation` by hand, add `toneStrength: 13` there and list it in your report.

- [ ] **Step 8: Commit**

```bash
git add packages/card apps/web/lib/save.ts apps/web/lib/designs.ts apps/web/lib/save.test.ts "apps/web/app/card/[id]/page.tsx" apps/web/app/dev/card/DevCard.tsx
git commit -F - <<'EOF'
Make Warm and Cool a white-balance shift of the photo's colours by a strength from 6 to 20, assigned from how deep the sun is into golden hour or night plus the season, stored with each card and read as the middle for cards saved before it

Co-Authored-By: <the model you are> <noreply@anthropic.com>
EOF
```

---

### Task 2: The founders' Strength slider, browser tests and the docs

**Files:**
- Modify: `apps/web/components/DesignPanel.tsx`, `apps/web/components/design-panel.css`, `e2e/founder.ts`, `SPEC.md` (line 43), `CLAUDE.md` (line 93)
- Test: `e2e/make.spec.ts`, `e2e/founder.spec.ts`

**Interfaces:**
- Consumes (from Task 1):
  - `Variation.toneStrength`
  - `VariationOverrides.toneStrength`
  - `VARIATION_RULES.strength.max` (20)
  - the figure's `data-tone-strength`
  - stored `variation.toneStrength`
  - an assigned strength of 13 for a photo whose sun is unknown (the e2e fixtures have no time zone)
- Produces:
  - A "Strength" design field holding:
    - a range input labelled "Tone strength", from 0 to 20, step 1;
    - an `<output>` showing the value;
    - an "Assigned" strip cell.
  - Both the input and the cell are disabled when the current tone is Photo or Neutral.

- [ ] **Step 1: Write the failing browser tests**

Add to `e2e/make.spec.ts`:

```ts
test("the strength slider shifts a warm or cool card, and Assigned returns the card's own strength", async ({ page }) => {
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(seoul);
  await expect(page.locator(".oo-line-place")).toHaveText("Seoul, South Korea");
  const card = page.locator("figure.oo-card");
  const border = page.locator("img.oo-border-img");
  const tone = page.locator(".design-field", { hasText: "Tone" });
  const field = page.locator(".design-field", { hasText: "Strength" });
  const slider = page.getByRole("slider", { name: "Tone strength" });

  // The fixture records no time zone, so its sun is unknown and its strength is the middle.
  await expect(card).toHaveAttribute("data-tone-strength", "13");
  await tone.getByRole("button", { name: "Photo", exact: true }).click();
  await expect(slider).toBeDisabled();
  await tone.getByRole("button", { name: "Warm", exact: true }).click();
  await expect(slider).toBeEnabled();
  const before = (await border.getAttribute("src"))!;
  await slider.fill("20");
  await expect(card).toHaveAttribute("data-tone-strength", "20");
  await expect(field.locator("output")).toHaveText("20");
  await expect(border).not.toHaveAttribute("src", before);
  await field.getByRole("button", { name: "Assigned" }).click();
  await expect(card).toHaveAttribute("data-tone-strength", "13");
  await expect(border).toHaveAttribute("src", before);
});
```

Rewrite `e2e/founder.ts` so all three helpers share one psql runner, and add the new helper:

```ts
import { execFileSync } from "node:child_process";

/** Runs SQL as postgres in the local stack's database (tests only), bypassing row-level security and the design guard. */
function psql(sql: string): string {
  return execFileSync(
    "docker",
    ["exec", "supabase_db_one-of-one", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { stdio: "pipe", encoding: "utf8" },
  );
}

const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** Marks a signed-up user as a founder in the local stack's database (tests only); throws unless exactly one user matched. */
export function makeFounder(email: string): void {
  const out = psql(`update public.users set is_founder = true where id = (select id from auth.users where email = ${quote(email)});`);
  if (!/^UPDATE 1$/m.test(out)) throw new Error(`makeFounder: no single user matched ${email} (psql said: ${out.trim()})`);
}

/** Writes a motion straight into a saved card's stored variation (tests only), as a card saved before that motion was retired would hold it. */
export function setStoredMotion(cardId: string, motion: string): void {
  const out = psql(`update public.cards set variation = jsonb_set(variation, '{motion}', to_jsonb(${quote(motion)}::text)) where id = ${quote(cardId)};`);
  if (!/^UPDATE 1$/m.test(out)) throw new Error(`setStoredMotion: no single card matched ${cardId} (psql said: ${out.trim()})`);
}

/** Removes the tone strength from a saved card's stored variation (tests only), as a card saved before strengths existed holds it. */
export function clearStoredToneStrength(cardId: string): void {
  const out = psql(`update public.cards set variation = variation - 'toneStrength' where id = ${quote(cardId)};`);
  if (!/^UPDATE 1$/m.test(out)) throw new Error(`clearStoredToneStrength: no single card matched ${cardId} (psql said: ${out.trim()})`);
}
```

In `e2e/founder.spec.ts`, change the import to `import { clearStoredToneStrength, makeFounder, setStoredMotion } from "./founder";` and add after the retired-motion test:

```ts
test("a founder's tone strength on a saved card survives a reload", async ({ page }) => {
  const email = freshEmail();
  await signIn(page, email);
  makeFounder(email);
  await page.reload();
  await saveWithFoil(page);

  const card = page.locator("figure.oo-card");
  const panel = page.locator("[data-design-panel]");
  await panel.locator(".design-field", { hasText: "Tone" }).getByRole("button", { name: "Warm", exact: true }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
  await panel.getByRole("slider", { name: "Tone strength" }).fill("19");
  await expect(card).toHaveAttribute("data-tone-strength", "19");
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(card).toHaveAttribute("data-tone", "warm");
  await expect(card).toHaveAttribute("data-tone-strength", "19");
});

test("a card saved before tone strengths opens at the middle strength with its colours unchanged", async ({ page }) => {
  const email = freshEmail();
  await signIn(page, email);
  makeFounder(email);
  await page.reload();
  await saveWithFoil(page);
  const cardId = new URL(page.url()).pathname.split("/").pop()!;
  const border = page.locator("img.oo-border-img");
  const before = (await border.getAttribute("src"))!;

  clearStoredToneStrength(cardId);
  await page.reload();
  await expect(page.locator("figure.oo-card")).toHaveAttribute("data-tone-strength", "13");
  await expect(border).toHaveAttribute("src", before);
});
```

- [ ] **Step 2: Run them to see them fail**

Make sure nothing listens on port 3000. Run: `npx playwright test e2e/make.spec.ts e2e/founder.spec.ts -g "strength"`
Expected: the two slider tests FAIL, unable to find a slider named "Tone strength". The old-card test passes already, because Task 1 built what it checks.

- [ ] **Step 3: Add the slider to `apps/web/components/DesignPanel.tsx`**

The import becomes:

```ts
import { INTROS, MOTIONS, TEXTURES, TIERS, TONES, VARIATION_RULES, type Variation, type VariationOverrides } from "@one-of-one/card";
```

`type Field = keyof VariationOverrides;` becomes:

```ts
type Field = Exclude<keyof VariationOverrides, "toneStrength">;
```

Inside `DesignPanel`, after the `set` function, add:

```ts
  const setStrength = (value: number | undefined) => {
    const next: VariationOverrides = { ...overrides };
    if (value === undefined) delete next.toneStrength;
    else next.toneStrength = value;
    onChange(next);
  };
  // The photo's colour and the grey have nothing to shift.
  const tone = overrides.tone ?? derived.tone;
  const strengthOff = tone === "photo" || tone === "neutral";
  const strength = overrides.toneStrength ?? derived.toneStrength;
```

Render the fields so the Strength field comes straight after Tone. Replace `{FIELDS.map((f) => (` … `))}` with:

```tsx
      {FIELDS.map((f) => (
        <Fragment key={f.key}>
          <div className="design-field">
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
          {f.key === "tone" ? (
            <div className="design-field">
              <span className="label">Strength</span>
              <div className="design-strength">
                <input
                  type="range"
                  min={0}
                  max={VARIATION_RULES.strength.max}
                  step={1}
                  value={strength}
                  disabled={strengthOff}
                  aria-label="Tone strength"
                  onChange={(e) => setStrength(Number(e.currentTarget.value))}
                />
                <output>{strength}</output>
                <Strip
                  size="option"
                  cells={[{ label: "Assigned", text: "Assigned", selected: overrides.toneStrength === undefined, disabled: strengthOff, onClick: () => setStrength(undefined) }]}
                />
              </div>
            </div>
          ) : null}
        </Fragment>
      ))}
```

Add `import { Fragment } from "react";` at the top, after `"use client";`.

The status line's `{derived.tone}` becomes `{derived.tone} {derived.toneStrength}`.

- [ ] **Step 4: Style it in `apps/web/components/design-panel.css`**

Append:

```css
/* The tone's strength: a slider, its value, and Assigned, on one line. */
.design-strength {
  display: flex;
  align-items: center;
  gap: 12px;
}
.design-strength input {
  flex: 1;
  min-width: 0;
  accent-color: var(--ink);
}
.design-strength output {
  min-width: 2ch;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.design-strength .strip {
  flex: none;
}
```

- [ ] **Step 5: Write the rule into the docs**

`SPEC.md` line 43, in the Colour bullet, replace `Warm and Cool are nudges of that colour, never colours of their own.` with:

`Warm and Cool shift that colour like a camera's white balance (red up and blue down for Warm, the reverse for Cool), never colours of their own, by a strength from 6 to 20 steps of 255: weak near the top of golden hour or just after it, strong deep into a sunset or the night, with summer adding to Warm and winter to Cool (decided Nov 3, 2026). The founders' panel sets it with a slider.`

`CLAUDE.md` line 93:
- Replace `nudges of it (Warm, Cool)` with `white-balance shifts of it (Warm, Cool) by the card's strength`.
- Replace `so never re-resolve a stored palette unless its tone is overridden.` with `so never re-resolve a stored palette unless its tone or strength is overridden; a stored variation without a strength reads as the middle through \`knownToneStrength\`.`

- [ ] **Step 6: Run the tests**

Make sure nothing listens on port 3000. Run: `npm run typecheck && npm run lint && npx playwright test e2e/make.spec.ts e2e/founder.spec.ts`
Expected: everything passes, including the three new tests and the existing design-panel and tone tests.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/DesignPanel.tsx apps/web/components/design-panel.css e2e/make.spec.ts e2e/founder.spec.ts e2e/founder.ts SPEC.md CLAUDE.md
git commit -F - <<'EOF'
Give founders a Strength slider under Tone, off for Photo and Neutral, with Assigned to return to the card's own strength, and write the white-balance rule into SPEC.md and CLAUDE.md

Co-Authored-By: <the model you are> <noreply@anthropic.com>
EOF
```

---

### Task 3: Verify and hand over

The controller runs this task.

- [ ] **Step 1:** With nothing on port 3000, run `npm test && npm run typecheck && npm run lint && npm run test:e2e && npm run check:prod`. Expected:
  - every unit suite passes;
  - the full browser suite passes, including the equivalence suite's Mac-only cases;
  - `check:prod` ends with `production build serves no development surface`.
- [ ] **Step 2:** Restart `npm run dev` in the background. Re-run the scratchpad's `tone-probe.cjs` on `seoul.jpg`. Warm, Photo and Cool must now give clearly different mat colours, and the Strength slider must move them.
- [ ] **Step 3:** Tell Alex what changed and where to try it (Make, Tone, then Strength), and ask whether to push.
