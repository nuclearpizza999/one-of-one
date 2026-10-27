# Border colour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every new card takes the photo's own colour as a wash over the whole mat, nudged warmer or cooler by the sun's real height and the hemisphere's season, with a seed that no longer includes the card id; saved cards render exactly as before.

**Architecture:** All colour logic stays in `packages/card` (pure, no app imports): a small colour-conversion module, a NOAA sun-position module, the tone rule and palette resolution in `variation.ts`, the caption floor in `contrast.ts`, and one wash rectangle in the shared border SVG that both painters render. The app reads one more EXIF field (the capture time zone) and passes GPS and the offset into `deriveVariation`.

**Tech Stack:** TypeScript, Vitest, React (Next.js App Router), exifr, piexifjs (tests), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-26-border-colour-design.md`

## Global Constraints

- npm workspaces on Node 24. No new dependencies.
- `packages/card` has no app imports.
- The only fixed colours any design may draw: the white mat, white light in the sheen, and the neutral grey palette (`#8a8a8a`, `#ececec`, `#9c9c9c`). Test fixtures may carry literal colours.
- The caption contrast floor: every colour a palette can paint under the caption (wash and both foil stops) keeps contrast ≥ 4.5 against `#111` and ≥ 3 against `#333`.
- Saved cards must render exactly as before: a palette without `wash` draws no wash, and nothing re-resolves a stored palette unless the tone is overridden.
- Screen equals print: the wash lives only in `borderSvg`, which both painters render. Do not touch `CARD` in `layout.ts`.
- EXIF dates are zone-less wall-clock read with local getters; never `toISOString()` or `getTime()` for a capture time.
- Prose and comments use British spelling ("colour"), matching the repo.
- Commit messages: one plain descriptive sentence, ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` after a blank line.
- Run every command from the worktree root `/Users/alex/Desktop/one-of-one-handoff/.claude/worktrees/variation-facts`.

## File map

| File | Change |
| --- | --- |
| `packages/card/src/colour.ts` | Create: `GREY_SATURATION`, `rgbToHsl`, `hslToHex`, `hexToHsl` (moved out of `palette.ts`) |
| `packages/card/src/palette.ts` | Import the helpers from `colour.ts`; re-export `GREY_SATURATION` |
| `packages/card/src/sun.ts` | Create: `captureInstant`, `sunElevation` |
| `packages/card/src/variation.ts` | Tone rule (`deriveTone`, `sunStep`, `seasonStep`), new inputs, seed without card id, new `TONES`, `wash`, `nudgePalette`, `withWash`, `paletteFor`, `withOverrides` palette rule |
| `packages/card/src/contrast.ts` | `withCaptionContrast` lightens the wash too |
| `packages/card/src/border.ts` | Draw the wash first in the mat group |
| `packages/card/src/index.ts` | Export the new functions and types |
| `packages/card/test/colour.test.ts`, `sun.test.ts` | Create |
| `packages/card/test/variation.test.ts`, `contrast.test.ts`, `border.test.ts` | Update |
| `apps/web/lib/exif.ts`, `exif.test.ts` | `utcOffsetMinutes`, `parseUtcOffset` |
| `apps/web/lib/photo.ts` | Pass GPS and the offset; seed without card id |
| `apps/web/app/card/[id]/CardScreen.tsx` | Founders sample the photo's palette |
| `apps/web/app/dev/card/DevCard.tsx` | Fixed fixture palette through `paletteFor("photo", …)` |
| `e2e/make.spec.ts` | The tone step of the design-panel test picks Cool |
| `SPEC.md`, `CLAUDE.md` | Document the colour rule |

---

### Task 1: Colour helpers and the sun

**Files:**
- Create: `packages/card/src/colour.ts`, `packages/card/src/sun.ts`, `packages/card/test/colour.test.ts`, `packages/card/test/sun.test.ts`
- Modify: `packages/card/src/palette.ts` (lines 1-42: the helpers move out), `packages/card/src/index.ts`

**Interfaces:**
- Produces: `GREY_SATURATION: number` (0.08); `rgbToHsl(r: number, g: number, b: number): [number, number, number]` (h, s, l each 0 to 1); `hslToHex(h: number, s: number, l: number): string` (`#rrggbb`); `hexToHsl(hex: string): [number, number, number]` for `#rrggbb`; `captureInstant(takenAt: Date, utcOffsetMinutes: number): number` (UTC ms); `sunElevation(utcMs: number, lat: number, lng: number): number` (degrees above the horizon, negative below).

- [ ] **Step 1: Write the failing tests**

`packages/card/test/colour.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { GREY_SATURATION, hexToHsl, hslToHex, rgbToHsl } from "../src/colour";

describe("colour helpers", () => {
  it("convert pure red, a grey and white", () => {
    expect(rgbToHsl(255, 0, 0)).toEqual([0, 1, 0.5]);
    const [h, s, l] = hexToHsl("#808080");
    expect(h).toBe(0);
    expect(s).toBe(0);
    expect(l).toBeCloseTo(0.502, 3);
    expect(hslToHex(0, 0, 1)).toBe("#ffffff");
  });
  it("round-trip hex through HSL", () => {
    for (const hex of ["#b08860", "#6878a0", "#4466aa", "#ececec", "#e77d98", "#102030"]) {
      expect(hslToHex(...hexToHsl(hex))).toBe(hex);
    }
  });
  it("keep the grey threshold", () => {
    expect(GREY_SATURATION).toBe(0.08);
  });
});
```

`packages/card/test/sun.test.ts` (reference values: at local solar noon the elevation is 90 − |lat − declination|, at local solar midnight lat + declination − 90 for the northern hemisphere; the June 2026 solstice declination is 23.44°):

```ts
import { describe, expect, it } from "vitest";
import { captureInstant, sunElevation } from "../src/sun";

const SEOUL = { lat: 37.5563, lng: 126.9236 };
const SYDNEY = { lat: -33.8688, lng: 151.2093 };
const TROMSO = { lat: 69.6492, lng: 18.9553 };
const elevation = (d: Date, offset: number, p: { lat: number; lng: number }) => sunElevation(captureInstant(d, offset), p.lat, p.lng);

describe("captureInstant", () => {
  it("subtracts the offset from the zone-free wall-clock", () => {
    expect(captureInstant(new Date(2026, 6, 1, 14, 30), 540)).toBe(Date.UTC(2026, 6, 1, 5, 30));
    expect(captureInstant(new Date(2026, 6, 1, 14, 30), -330)).toBe(Date.UTC(2026, 6, 1, 20, 0));
    expect(captureInstant(new Date(2026, 6, 1, 14, 30), 0)).toBe(Date.UTC(2026, 6, 1, 14, 30));
  });
});

describe("sunElevation", () => {
  it("is nearly overhead at an equinox noon on the equator", () => {
    let max = -90;
    for (let m = 0; m < 1440; m += 1) max = Math.max(max, sunElevation(Date.UTC(2026, 2, 20, 0, m), 0, 0));
    expect(max).toBeGreaterThan(89.5);
  });
  it("is 90 − lat + 23.44 at Seoul's June solstice noon and lat + 23.44 − 90 at its midnight", () => {
    expect(Math.abs(elevation(new Date(2026, 5, 21, 12, 34), 540, SEOUL) - 75.88)).toBeLessThan(0.5);
    expect(Math.abs(elevation(new Date(2026, 5, 21, 0, 34), 540, SEOUL) - -29.0)).toBeLessThan(0.5);
  });
  it("is low at a southern-hemisphere winter noon", () => {
    expect(Math.abs(elevation(new Date(2026, 5, 21, 11, 57), 600, SYDNEY) - 32.69)).toBeLessThan(0.5);
  });
  it("stays above the horizon at a polar summer midnight", () => {
    expect(Math.abs(elevation(new Date(2026, 5, 22, 0, 46), 120, TROMSO) - 3.09)).toBeLessThan(0.5);
  });
  it("is negative in the middle of the night and positive mid-afternoon", () => {
    expect(elevation(new Date(2026, 2, 15, 2, 0), 540, SEOUL)).toBeLessThan(-20);
    expect(elevation(new Date(2026, 2, 15, 15, 0), 540, SEOUL)).toBeGreaterThan(20);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w packages/card -- colour sun`
Expected: FAIL, cannot resolve `../src/colour` and `../src/sun`.

- [ ] **Step 3: Create `packages/card/src/colour.ts`**

Move `rgbToHsl`, `hue2rgb` and `hslToHex` out of `palette.ts` unchanged, export them, and add `hexToHsl`:

```ts
/** Below this mean saturation a photo counts as grey and gets the neutral palette. */
export const GREY_SATURATION = 0.08;

/** RGB channels 0 to 255 as [hue, saturation, lightness], each 0 to 1. */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
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

/** Hue, saturation and lightness, each 0 to 1, as `#rrggbb`. */
export function hslToHex(h: number, s: number, l: number): string {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const toHex = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
  return `#${toHex(hue2rgb(p, q, h + 1 / 3))}${toHex(hue2rgb(p, q, h))}${toHex(hue2rgb(p, q, h - 1 / 3))}`;
}

/** A `#rrggbb` colour as [hue, saturation, lightness], each 0 to 1. */
export function hexToHsl(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace(/^#/, ""), 16);
  return rgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
}
```

In `packages/card/src/palette.ts`, delete the local `GREY_SATURATION`, `rgbToHsl`, `hue2rgb` and `hslToHex` and replace the import lines at the top with:

```ts
import { GREY_SATURATION, hslToHex, rgbToHsl } from "./colour";
import { NEUTRAL_PALETTE, type Palette } from "./variation";

export { GREY_SATURATION } from "./colour";
```

`paletteFromPixels` stays as it is.

- [ ] **Step 4: Create `packages/card/src/sun.ts`**

```ts
/*
 * The sun's position from the NOAA solar calculator's equations (declination and
 * equation of time from the Julian century, true solar time, hour angle, zenith),
 * without the refraction correction. Accurate to a fraction of a degree, which is
 * far finer than the tone bands it feeds.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const DAY_MS = 86_400_000;

/**
 * The capture moment in UTC milliseconds: the zone-free wall-clock, read with the
 * local getters as exifr builds it, minus the photo's own UTC offset in minutes.
 */
export function captureInstant(takenAt: Date, utcOffsetMinutes: number): number {
  const wall = Date.UTC(
    takenAt.getFullYear(),
    takenAt.getMonth(),
    takenAt.getDate(),
    takenAt.getHours(),
    takenAt.getMinutes(),
    takenAt.getSeconds(),
  );
  return wall - utcOffsetMinutes * 60_000;
}

/** The sun's height above the horizon in degrees, negative below it, at a UTC moment and a place. */
export function sunElevation(utcMs: number, lat: number, lng: number): number {
  const jd = utcMs / DAY_MS + 2_440_587.5;
  const t = (jd - 2_451_545) / 36_525;
  const l0 = (((280.46646 + t * (36000.76983 + t * 0.0003032)) % 360) + 360) % 360;
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const centre =
    Math.sin(m * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m * RAD) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const lambda = l0 + centre - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));
  const y = Math.tan((eps / 2) * RAD) ** 2;
  const eqTime =
    4 *
    DEG *
    (y * Math.sin(2 * l0 * RAD) -
      2 * e * Math.sin(m * RAD) +
      4 * e * y * Math.sin(m * RAD) * Math.cos(2 * l0 * RAD) -
      0.5 * y * y * Math.sin(4 * l0 * RAD) -
      1.25 * e * e * Math.sin(2 * m * RAD));
  const minutes = (((utcMs % DAY_MS) + DAY_MS) % DAY_MS) / 60_000;
  const trueSolar = (((minutes + eqTime + 4 * lng) % 1440) + 1440) % 1440;
  const hourAngle = trueSolar / 4 - 180;
  const cosZenith =
    Math.sin(lat * RAD) * Math.sin(decl) + Math.cos(lat * RAD) * Math.cos(decl) * Math.cos(hourAngle * RAD);
  return 90 - Math.acos(Math.min(1, Math.max(-1, cosZenith))) * DEG;
}
```

In `packages/card/src/index.ts`, add after the `./palette` export line:

```ts
export { hexToHsl, hslToHex, rgbToHsl } from "./colour";
export { captureInstant, sunElevation } from "./sun";
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -w packages/card`
Expected: PASS, including the existing `palette.test.ts`.

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck -w packages/card`
Expected: no errors.

```bash
git add packages/card/src/colour.ts packages/card/src/sun.ts packages/card/src/palette.ts packages/card/src/index.ts packages/card/test/colour.test.ts packages/card/test/sun.test.ts
git commit -m "Move the colour conversions into their own module and add the sun's elevation from the NOAA equations, for the tone rule to read

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The tone rule follows the sun and the hemisphere, and the seed drops the card id

**Files:**
- Modify: `packages/card/src/variation.ts` (the `VARIATION_RULES.tone` block, `TONE_ORDER`, `deriveTone`, `VariationInputs`, `deriveVariation`, `SeedFacts`, `variationSeed`), `packages/card/src/index.ts`
- Test: `packages/card/test/variation.test.ts`

**Interfaces:**
- Consumes: `captureInstant`, `sunElevation` from `./sun` (Task 1).
- Produces: `interface ToneFacts { takenAt: Date | null; gps: { lat: number; lng: number } | null; utcOffsetMinutes: number | null }`; `deriveTone(f: ToneFacts): Tone` returning only `"warm" | "photo" | "cool"`; `sunStep(elevation: number): number` (0 cool, 1 photo, 2 warm); `seasonStep(month: number, lat: number): number` (−1, 0 or 1); `VariationInputs` gains `gps: { lat: number; lng: number } | null` and `utcOffsetMinutes: number | null`; `SeedFacts` loses `cardId`; `VARIATION_RULES.tone` is `{ warmHours, photoHours, coolMonths, warmMonths, sun: { dayAbove: 6, coolBelow: -4 }, tropicLatitude: 23.44 }`.

- [ ] **Step 1: Rewrite the `deriveTone` and `variationSeed` tests**

In `packages/card/test/variation.test.ts`, add `seasonStep, sunStep` to the import from `../src/variation`, add `import { captureInstant, sunElevation } from "../src/sun";`, and replace the whole `describe("deriveTone", …)` block with:

```ts
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
```

In the `deriveVariation` block, give `inputs` the two new fields (`gps: null, utcOffsetMinutes: null`); with `takenAt: at(6, 7)` and no GPS the tone stays `warm`, so the expectations there are unchanged. In the `withOverrides` block, add `gps: null, utcOffsetMinutes: null` to both `deriveVariation({ … })` calls (`base` and `foilBase`); their `at(2, 12)` now derives `photo` rather than `neutral`, which the assertions there do not depend on.

Replace the last test of `describe("variationSeed", …)` ("folds the card id in…") with:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w packages/card -- variation`
Expected: FAIL: `sunStep` and `seasonStep` are not exported, and `deriveTone` takes a Date.

- [ ] **Step 3: Implement the rule in `packages/card/src/variation.ts`**

Add `import { captureInstant, sunElevation } from "./sun";` to the imports.

Replace the `tone` entry of `VARIATION_RULES` and its part of the `satisfies` type:

```ts
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
```

```ts
  tone: {
    warmHours: readonly (readonly [number, number])[];
    photoHours: readonly (readonly [number, number])[];
    coolMonths: readonly number[];
    warmMonths: readonly number[];
    sun: { dayAbove: number; coolBelow: number };
    tropicLatitude: number;
  };
```

Replace `TONE_ORDER` and `deriveTone` with:

```ts
/** The tones the rule steps along, cool to warm. Neutral is never assigned: a grey photo reaches it through its palette. */
const TONE_ORDER = ["cool", "photo", "warm"] as const satisfies readonly Tone[];

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
```

Add the two fields to `VariationInputs`, after `photoPalette`:

```ts
  /** From EXIF; null when the photo carries no position. */
  gps: { lat: number; lng: number } | null;
  /** From EXIF; null when the photo records no time zone. */
  utcOffsetMinutes: number | null;
```

In `deriveVariation`, change the tone line to:

```ts
  const tone = deriveTone({ takenAt: inputs.takenAt, gps: inputs.gps, utcOffsetMinutes: inputs.utcOffsetMinutes });
```

Remove `cardId` from `SeedFacts` (the field and its comment) and replace the `variationSeed` doc comment and input line:

```ts
/**
 * FNV-1a over the photo's own facts. The card id is not part of it (SPEC.md,
 * decided Oct 26, 2026): the same photo always gets the same card.
 */
export function variationSeed(f: SeedFacts): number {
  const input = `${f.sizeBytes}:${f.width}:${f.height}:${f.takenAtMs ?? 0}:${f.camera?.make ?? ""}|${f.camera?.model ?? ""}`;
```

The loop below it stays.

In `packages/card/src/index.ts`, add `seasonStep` and `sunStep` to the value exports from `./variation`, and `ToneFacts` to the type exports.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w packages/card`
Expected: PASS.

- [ ] **Step 5: Typecheck the package and commit**

Run: `npm run typecheck -w packages/card`
Expected: no errors. (The app's typecheck fails until Task 6 passes the new inputs; do not fix it here.)

```bash
git add packages/card/src/variation.ts packages/card/src/index.ts packages/card/test/variation.test.ts
git commit -m "Pick warm and cool from the sun's real height where the photo knows its place and time zone, step the season by the photo's own hemisphere and not at all in the tropics, and hash the photo's facts alone into the seed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Tones become nudges of the photo's colour, with a wash under the caption floor

**Files:**
- Modify: `packages/card/src/variation.ts` (`Palette`, `ToneDef`, `TONES`, `NEUTRAL_PALETTE`, `paletteFor`, `VARIATION_RULES`, `withOverrides`; new `nudgePalette`, `withWash`), `packages/card/src/contrast.ts` (`withCaptionContrast`), `packages/card/src/index.ts`
- Test: `packages/card/test/variation.test.ts`, `packages/card/test/contrast.test.ts`

**Interfaces:**
- Consumes: `GREY_SATURATION`, `hexToHsl`, `hslToHex` from `./colour` (Task 1); `deriveTone` returning `warm | photo | cool` (Task 2).
- Produces: `Palette` gains optional `wash?: string`; `ToneDef` is `{ id; label } & ({ source: "photo" } | { source: "nudge"; direction: 1 | -1 } | { source: "neutral" })`; `TONES` keys in order `warm, photo, cool, neutral`; `nudgePalette(p: Palette, direction: 1 | -1): Palette`; `withWash(p: Palette): Palette`; `paletteFor(tone, photoPalette)` always returns a palette with `wash`; `VARIATION_RULES.nudge = { warmHue: 35, coolHue: 215, amount: 0.2 }` and `VARIATION_RULES.wash = { lightness: 0.92, saturationMax: 0.35 }`; `withOverrides` keeps `base.palette` unless `overrides.tone` is set.

- [ ] **Step 1: Write the failing tests**

In `packages/card/test/variation.test.ts`:

Add `nudgePalette, withWash` and `type Tone` to the import from `../src/variation`, `withCaptionContrast` to the import from `../src/contrast`, and `import { hexToHsl } from "../src/colour";`.

Replace the registry test "preset tones carry colours and the photo tone does not" with:

```ts
  it("tones are nudges of the photo's colour, the photo's colour itself, or the neutral grey", () => {
    expect(Object.keys(TONES)).toEqual(["warm", "photo", "cool", "neutral"]);
    expect(TONES.warm).toMatchObject({ source: "nudge", direction: 1 });
    expect(TONES.cool).toMatchObject({ source: "nudge", direction: -1 });
    expect(TONES.photo.source).toBe("photo");
    expect(TONES.neutral.source).toBe("neutral");
    for (const tone of Object.values(TONES)) expect(JSON.stringify(tone)).not.toMatch(/#[0-9a-f]{3,6}/i);
  });
```

Replace the whole `describe("paletteFor", …)` block with:

```ts
const rgb = (hex: string) => [1, 3, 5].map((k) => Number.parseInt(hex.slice(k, k + 2), 16)) as [number, number, number];

describe("nudgePalette", () => {
  const blue: Palette = { tint: "#4466aa", foil: ["#c8d4ee", "#6a84c0"] };
  const orange: Palette = { tint: "#c07a3a", foil: ["#f0d6bc", "#c88a50"] };
  it("warms a cool colour: more red, less blue, in the tint and both foil stops", () => {
    const w = nudgePalette(blue, 1);
    for (const [before, after] of [[blue.tint, w.tint], [blue.foil[0], w.foil[0]], [blue.foil[1], w.foil[1]]] as const) {
      expect(rgb(after)[0]).toBeGreaterThan(rgb(before)[0]);
      expect(rgb(after)[2]).toBeLessThan(rgb(before)[2]);
    }
  });
  it("cools a warm colour: more blue, less red", () => {
    const c = nudgePalette(orange, -1);
    expect(rgb(c.tint)[2]).toBeGreaterThan(rgb(orange.tint)[2]);
    expect(rgb(c.tint)[0]).toBeLessThan(rgb(orange.tint)[0]);
  });
  it("keeps the photo's colour recognisable: lightness within a few points", () => {
    const w = nudgePalette(blue, 1);
    expect(Math.abs(hexToHsl(w.tint)[2] - hexToHsl(blue.tint)[2])).toBeLessThan(0.05);
  });
  it("leaves a grey palette alone: a photo with no colour gets none from a nudge", () => {
    expect(nudgePalette(NEUTRAL_PALETTE, 1)).toBe(NEUTRAL_PALETTE);
    expect(nudgePalette(NEUTRAL_PALETTE, -1)).toBe(NEUTRAL_PALETTE);
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
      expect(paletteFor(tone, photoPalette).wash, tone).toMatch(/^#[0-9a-f]{6}$/);
      expect(paletteFor(tone, null).wash, tone).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
  it("returns the sampled palette with its wash for the photo tone", () => {
    expect(paletteFor("photo", photoPalette)).toEqual(withWash(photoPalette));
  });
  it("nudges the sampled palette for warm and cool", () => {
    expect(paletteFor("warm", photoPalette)).toEqual(withCaptionContrast(withWash(nudgePalette(photoPalette, 1))));
    expect(paletteFor("cool", photoPalette)).toEqual(withCaptionContrast(withWash(nudgePalette(photoPalette, -1))));
    expect(paletteFor("warm", photoPalette).tint).not.toBe(photoPalette.tint);
  });
  it("is the neutral grey for neutral, and for any tone without a sample", () => {
    expect(paletteFor("neutral", photoPalette).tint).toBe(NEUTRAL_PALETTE.tint);
    for (const tone of Object.keys(TONES) as Tone[]) expect(paletteFor(tone, null).tint, tone).toBe(NEUTRAL_PALETTE.tint);
  });
  it("lightens a sampled palette's foil until the caption keeps its contrast floor", () => {
    const dark: Palette = { tint: "#223355", foil: ["#8899bb", "#223355"] };
    const p = paletteFor("photo", dark);
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
```

In the `deriveVariation` block, change the expected palette in "combines the rules…" to `palette: paletteFor("warm", null),` and replace the test "ignores the photo palette while the rule assigns a preset tone" with:

```ts
  it("nudges the photo's own palette rather than replacing it", () => {
    expect(deriveVariation({ ...inputs, photoPalette }).palette).toEqual(paletteFor("warm", photoPalette));
    expect(deriveVariation({ ...inputs, photoPalette }).palette.tint).not.toBe(paletteFor("photo", photoPalette).tint);
  });
```

In the `withOverrides` block, replace "resolves the photo tone from the sampled palette, or neutral without one" with:

```ts
  it("re-resolves the palette from the sample only when the tone is overridden", () => {
    expect(withOverrides(base, { tone: "photo" }, photoPalette).palette).toEqual(paletteFor("photo", photoPalette));
    expect(withOverrides(base, { tone: "photo" }, null).palette).toEqual(paletteFor("photo", null));
    expect(withOverrides(base, { tone: "cool" }, photoPalette).palette).toEqual(paletteFor("cool", photoPalette));
  });
  it("keeps a stored palette, wash or none, when the tone is not overridden", () => {
    const stored: Palette = { tint: "#b08860", foil: ["#f3d9a4", "#b8864a"] };
    const saved = { ...base, tone: "warm" as const, palette: stored };
    expect(withOverrides(saved, {}, null).palette).toBe(stored);
    expect(withOverrides(saved, { texture: "worn" }, photoPalette).palette).toBe(stored);
  });
```

In `packages/card/test/contrast.test.ts`, change the import of `TONES` to `import { NEUTRAL_PALETTE, TONES, type Tone, paletteFor } from "../src/variation";` plus `import { hslToHex } from "../src/colour";`, and replace the first two tests of `describe("withCaptionContrast", …)` with:

```ts
  it("returns the same palette when both foil stops and the wash already clear the floor", () => {
    const light = { tint: "#b08860", foil: ["#f3d9a4", "#b8864a"] as const, wash: "#f1ebe4" };
    expect(withCaptionContrast(light)).toBe(light);
    const noWash = { tint: "#b08860", foil: ["#f3d9a4", "#b8864a"] as const };
    expect(withCaptionContrast(noWash)).toBe(noWash);
  });
  it("leaves the neutral grey as written", () => {
    expect(withCaptionContrast(NEUTRAL_PALETTE)).toBe(NEUTRAL_PALETTE);
  });
  it("lightens a dark wash and keeps a palette without one without one", () => {
    const p = withCaptionContrast({ tint: "#223355", foil: ["#c8d4ee", "#8899bb"], wash: "#223355" });
    expect(contrastRatio(p.wash!, CAPTION_INK)).toBeGreaterThanOrEqual(CAPTION_MIN_CONTRAST);
    expect(contrastRatio(p.wash!, COORDS_INK)).toBeGreaterThanOrEqual(COORDS_MIN_CONTRAST);
    expect("wash" in withCaptionContrast({ tint: "#223355", foil: ["#8899bb", "#223355"] })).toBe(false);
  });
```

and append, after that `describe`:

```ts
describe("the caption floor over every tone", () => {
  it("holds for the wash and both foil stops across a sweep of sampled colours", () => {
    for (let hue = 0; hue < 360; hue += 15) {
      for (const s of [0.15, 0.3, 0.45]) {
        for (const l of [0.3, 0.5, 0.7]) {
          const h = hue / 360;
          const sample = { tint: hslToHex(h, s, l), foil: [hslToHex(h, s, 0.84), hslToHex(h, s, l * 0.9)] as const };
          for (const tone of Object.keys(TONES) as Tone[]) {
            const p = paletteFor(tone, sample);
            for (const c of [p.wash!, ...p.foil]) {
              const label = `${tone} ${hue}/${s}/${l} ${c}`;
              expect(contrastRatio(c, CAPTION_INK), label).toBeGreaterThanOrEqual(CAPTION_MIN_CONTRAST);
              expect(contrastRatio(c, COORDS_INK), label).toBeGreaterThanOrEqual(COORDS_MIN_CONTRAST);
            }
          }
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w packages/card -- variation contrast`
Expected: FAIL: `nudgePalette` and `withWash` are not exported, and the tone shapes differ.

- [ ] **Step 3: Implement the tone model**

In `packages/card/src/variation.ts`, add `import { GREY_SATURATION, hexToHsl, hslToHex } from "./colour";` and replace `Palette`, `ToneDef`, `TONES`, `NEUTRAL_PALETTE` and `paletteFor` (the block from `/** Resolved colours the border draws with, as hex. */` to the end of `paletteFor`) with:

```ts
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
```

`VARIATION_RULES` is declared below this block; the functions read it only when called, so the order is fine. Add its two new entries after `texture` and their types to the `satisfies` clause:

```ts
  /** Warm and cool are mixes toward these hues (degrees) by `amount` (0 to 1). */
  nudge: { warmHue: 35, coolHue: 215, amount: 0.2 },
  /** The wash under the whole mat: HSL lightness, and the most saturation it keeps from the tint. Sets how visible the colour is at phone size. */
  wash: { lightness: 0.92, saturationMax: 0.35 },
```

```ts
  nudge: { warmHue: number; coolHue: number; amount: number };
  wash: { lightness: number; saturationMax: number };
```

In `withOverrides`, change the palette line so a stored palette survives:

```ts
    palette: overrides.tone !== undefined ? paletteFor(tone, photoPalette) : base.palette,
```

and update its doc comment to: `/** Apply overrides and re-resolve what depends on them: the palette only from an overridden tone (a stored palette is kept otherwise), the motion and the texture from an overridden tier. */`

In `packages/card/src/contrast.ts`, replace `withCaptionContrast` and its comment with:

```ts
/**
 * The palette with both foil stops and the wash clearing the floor: the same
 * object when they already do, lightened copies otherwise. A palette without a
 * wash stays without one. The tint only ever colours noise and pattern ink at
 * low opacity over the mat, so it is left as sampled.
 */
export function withCaptionContrast(p: Palette): Palette {
  const foil = [lightenToCaptionFloor(p.foil[0]), lightenToCaptionFloor(p.foil[1])] as const;
  const wash = p.wash === undefined ? undefined : lightenToCaptionFloor(p.wash);
  if (foil[0] === p.foil[0] && foil[1] === p.foil[1] && wash === p.wash) return p;
  return wash === undefined ? { tint: p.tint, foil } : { tint: p.tint, foil, wash };
}
```

In `packages/card/src/index.ts`, add `nudgePalette` and `withWash` to the value exports from `./variation`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w packages/card`
Expected: PASS. `palette.test.ts`'s grey case still equals `NEUTRAL_PALETTE`, and `border.test.ts`'s every-tone loop now sees washes, which are plain `<rect>`s it allows.

- [ ] **Step 5: Typecheck the package and commit**

Run: `npm run typecheck -w packages/card`
Expected: no errors.

```bash
git add packages/card/src/variation.ts packages/card/src/contrast.ts packages/card/src/index.ts packages/card/test/variation.test.ts packages/card/test/contrast.test.ts
git commit -m "Make warm and cool nudges of the photo's own colour rather than preset colours, give every palette a light wash in the tint's hue under the caption contrast floor, and keep a stored palette unless the tone is overridden

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The border draws the wash

**Files:**
- Modify: `packages/card/src/border.ts` (`borderSvg`)
- Test: `packages/card/test/border.test.ts`

**Interfaces:**
- Consumes: `Palette.wash?: string` (Task 3).
- Produces: `borderSvg` output where, with a wash, the mat group's first element is `<rect x="0" y="0" width="100" height="{H}" fill="{wash}"/>`; without one, the document is unchanged.

- [ ] **Step 1: Write the failing tests**

Append inside `describe("borderSvg", …)` in `packages/card/test/border.test.ts`:

```ts
  it("draws the wash first in the mat group, and only there", () => {
    const plain = borderSvg(base, H);
    const washed = borderSvg({ ...base, palette: { ...base.palette, wash: "#eef2f8" } }, H);
    expect(washed).toBe(
      plain.replace('<g clip-path="url(#mat)">', '<g clip-path="url(#mat)"><rect x="0" y="0" width="100" height="141" fill="#eef2f8"/>'),
    );
  });
  it("draws no wash for a palette saved without one, so saved cards look as they did", () => {
    // A wash is a flat full-card rect with a six-digit fill and nothing else; the noise layers' rects carry a filter.
    const WASH = /<rect x="0" y="0" width="100" height="141" fill="#[0-9a-f]{6}"\/>/;
    for (const id of Object.keys(TEXTURES) as (keyof typeof TEXTURES)[]) {
      expect(borderSvg({ ...base, texture: id }, H), id).not.toMatch(WASH);
    }
    expect(borderSvg({ ...base, palette: { ...base.palette, wash: "#eef2f8" } }, H)).toMatch(WASH);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w packages/card -- border`
Expected: FAIL on "draws the wash first".

- [ ] **Step 3: Implement**

In `packages/card/src/border.ts`, inside `borderSvg`, after `const frag = …`:

```ts
  // The wash is the photo's colour under everything else; a palette saved before it existed has none and draws none.
  const wash = v.palette.wash ? `<rect x="0" y="0" width="100" height="${f(H)}" fill="${v.palette.wash}"/>` : "";
```

and change the group line to:

```ts
    `<g clip-path="url(#mat)">${wash}${frag.mat}</g>` +
```

Update the function's doc comment to say the mat is filled with the palette's wash first, when it has one.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w packages/card`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/card/src/border.ts packages/card/test/border.test.ts
git commit -m "Fill the mat with the palette's wash under every texture in the one border document both painters draw, and draw none for a palette saved without one

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: EXIF reads the capture time zone

**Files:**
- Modify: `apps/web/lib/exif.ts`
- Test: `apps/web/lib/exif.test.ts`

**Interfaces:**
- Produces: `PhotoMetadata.utcOffsetMinutes: number | null`; `parseUtcOffset(value: unknown): number | null`.

- [ ] **Step 1: Write the failing tests**

In `apps/web/lib/exif.test.ts`, add `parseUtcOffset` to the import from `./exif`, and add after `withDates`:

```ts
// piexifjs predates the EXIF 2.31 offset tags; register them so dump() can write them.
const OFFSET_TIME_ORIGINAL = 0x9011;
const OFFSET_TIME_DIGITIZED = 0x9012;
const tags = (piexif as unknown as { TAGS: { Exif: Record<number, { name: string; type: string }> } }).TAGS.Exif;
tags[OFFSET_TIME_ORIGINAL] ??= { name: "OffsetTimeOriginal", type: "Ascii" };
tags[OFFSET_TIME_DIGITIZED] ??= { name: "OffsetTimeDigitized", type: "Ascii" };

function withExifFields(name: string, fields: Record<number, string>, drop: number[] = []): Uint8Array {
  const binary = fixture(name).toString("binary");
  const exif = piexif.load(binary);
  for (const tag of drop) delete exif.Exif[tag];
  for (const [tag, value] of Object.entries(fields)) exif.Exif[Number(tag)] = value;
  return Buffer.from(piexif.insert(piexif.dump(exif), piexif.remove(binary)), "binary");
}
```

Add these tests inside `describe("readPhotoMetadata", …)`:

```ts
  it("reads the capture time zone that goes with DateTimeOriginal", async () => {
    const m = await readPhotoMetadata(withExifFields("seoul.jpg", { [OFFSET_TIME_ORIGINAL]: "+09:00" }));
    expect(m.utcOffsetMinutes).toBe(540);
    expect(m.takenAt?.getHours()).toBe(14);
  });

  it("reads the digitized time zone when the date came from CreateDate", async () => {
    const m = await readPhotoMetadata(
      withExifFields(
        "nogps.jpg",
        { [piexif.ExifIFD.DateTimeDigitized]: "2026:07:01 14:30:00", [OFFSET_TIME_DIGITIZED]: "-05:00", [OFFSET_TIME_ORIGINAL]: "+09:00" },
        [piexif.ExifIFD.DateTimeOriginal],
      ),
    );
    expect(m.dateSource).toBe("exif");
    expect(m.utcOffsetMinutes).toBe(-300);
  });

  it("has no time zone when the photo records none", async () => {
    expect((await readPhotoMetadata(fixture("seoul.jpg"))).utcOffsetMinutes).toBeNull();
    expect((await readPhotoMetadata(fixture("nogps.jpg"))).utcOffsetMinutes).toBeNull();
  });
```

and a new block:

```ts
describe("parseUtcOffset", () => {
  it("reads ±HH:MM as minutes east of UTC", () => {
    expect(parseUtcOffset("+09:00")).toBe(540);
    expect(parseUtcOffset("-05:30")).toBe(-330);
    expect(parseUtcOffset("+00:00")).toBe(0);
    expect(parseUtcOffset(" +05:45 ")).toBe(345);
  });
  it("is null for anything else", () => {
    for (const bad of [undefined, null, 540, "", "09:00", "+9:00", "+09:60", "+15:00", "UTC", "+0900"]) {
      expect(parseUtcOffset(bad), String(bad)).toBeNull();
    }
  });
});
```

Add `utcOffsetMinutes: null` to the two `toEqual({ takenAt: null, dateSource: "none", gps: null, camera: null })` expectations ("returns nulls for a PNG with no EXIF" and "never throws on garbage").

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w apps/web -- exif`
Expected: FAIL, `parseUtcOffset` is not exported.

If `piexif.TAGS` is undefined or `dump()` throws on the registered tags, look for the tag table piexifjs actually exports (`node -e "const p=require('piexifjs');console.log(Object.keys(p))"` from `apps/web`) and register the two entries there; the test's intent is only to write the two ASCII tags.

- [ ] **Step 3: Implement**

In `apps/web/lib/exif.ts`, add to `PhotoMetadata` after `camera`:

```ts
  /** The capture time's UTC offset in minutes from EXIF OffsetTimeOriginal (or OffsetTimeDigitized for a CreateDate); null when absent. */
  utcOffsetMinutes: number | null;
```

Add, above `readPhotoMetadata`:

```ts
/** An EXIF offset string, "+09:00" or "-05:30", as minutes east of UTC; null for anything else. */
export function parseUtcOffset(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hours = Number(m[2]);
  const minutes = Number(m[3]);
  if (minutes > 59 || hours * 60 + minutes > 14 * 60) return null;
  const total = hours * 60 + minutes;
  return m[1] === "-" ? -total : total;
}
```

In `readPhotoMetadata`: declare `let utcOffsetMinutes: number | null = null;` with the others; add `"OffsetTimeOriginal", "OffsetTimeDigitized"` to the `pick` list; and replace the date lines with:

```ts
    const original = plausibleDate(out?.DateTimeOriginal);
    const d = original ?? plausibleDate(out?.CreateDate);
    if (d) {
      takenAt = d;
      dateSource = "exif";
      utcOffsetMinutes = parseUtcOffset(original ? out?.OffsetTimeOriginal : out?.OffsetTimeDigitized);
    }
```

Return `{ takenAt, dateSource, gps, camera, utcOffsetMinutes }`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w apps/web -- exif`
Expected: PASS. If exifr returns the offset under a different key or type, print `await parse(bytes, { exif: true })` once for the in-memory Seoul copy to see what it returns, and read that key. The tests define the behaviour.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/exif.ts apps/web/lib/exif.test.ts
git commit -m "Read the capture time zone from EXIF OffsetTimeOriginal, or OffsetTimeDigitized for a CreateDate, so the sun can be placed in the photo's real sky

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Wire the app, keep the dev card fixed, and document the rule

**Files:**
- Modify: `apps/web/lib/photo.ts` (`describePhoto`), `apps/web/app/card/[id]/CardScreen.tsx`, `apps/web/app/dev/card/DevCard.tsx`, `e2e/make.spec.ts:187-189`, `SPEC.md` (Card variation), `CLAUDE.md` (Conventions)

**Interfaces:**
- Consumes: `VariationInputs.gps`, `VariationInputs.utcOffsetMinutes`, `SeedFacts` without `cardId` (Task 2); `paletteFor`, `Palette` (Task 3); `PhotoMetadata.utcOffsetMinutes` (Task 5); `samplePhotoPalette(img: HTMLImageElement): Palette | null` and `loadImage(src: string): Promise<HTMLImageElement>` from `apps/web/lib/photo.ts` (existing).

- [ ] **Step 1: Pass the new facts in `describePhoto`**

In `apps/web/lib/photo.ts`, drop `cardId: cardId ?? undefined,` from the `variationSeed({ … })` call, and give `deriveVariation` the two new inputs:

```ts
  const variation = deriveVariation({
    seed,
    takenAt: exifTime,
    camera: meta.camera,
    number: null,
    placeKind: match?.kind ?? null,
    photoPalette: palette,
    gps: meta.gps,
    // An offset belongs to the EXIF capture time; a file's modification time has none.
    utcOffsetMinutes: exifTime ? meta.utcOffsetMinutes : null,
  });
```

The `cardId` parameter of `describePhoto` stays: it is still the card's id, saved with the card.

- [ ] **Step 2: Founders' saved-card panel samples the photo**

In `apps/web/app/card/[id]/CardScreen.tsx`: change the React import to `import { useEffect, useRef, useState } from "react";`, add `type Palette` to the `@one-of-one/card` import, change `import { loadImage } from "@/lib/photo";` to `import { loadImage, samplePhotoPalette } from "@/lib/photo";`, and replace the `photoPalette` comment and line with:

```ts
  // The photo's palette is not stored with the card. For a founder, sample it from the photo shown, so the
  // panel's Warm, Photo and Cool resolve against the real photo; until then, and for anyone else, a card saved
  // with the Photo tone uses its stored palette and any other card none. Without an overridden tone the stored
  // palette is kept whatever this is, so nobody's saved card changes.
  const [sampled, setSampled] = useState<Palette | null>(null);
  useEffect(() => {
    if (!isFounder) return;
    let cancelled = false;
    loadImage(photo.src)
      .then((img) => {
        if (!cancelled) setSampled(samplePhotoPalette(img));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isFounder, photo.src]);
  const photoPalette = sampled ?? (stored.tone === "photo" ? stored.palette : null);
```

- [ ] **Step 3: The dev card keeps one fixed palette**

In `apps/web/app/dev/card/DevCard.tsx`, add `type Palette` to the `@one-of-one/card` import, add above `export function DevCard`:

```ts
// A fixed sample (a test fixture, not a design colour) so only the texture varies between equivalence cases.
const DEV_PALETTE: Palette = { tint: "#b08860", foil: ["#f3d9a4", "#b8864a"] };
```

and change the variation and its comment to:

```ts
  // A fixed variation for the diff: one sampled palette with its wash, no motion, one seed, so only the texture varies between cases.
  …
        ? { texture, tone: "photo", palette: paletteFor("photo", DEV_PALETTE), tier, motion: "none", intro: "rise", seed: 12345 }
```

- [ ] **Step 4: The design-panel browser test picks a tone the rule did not**

The Fuji fixture (`nogps.jpg`, 14:30, no GPS) now derives `photo`, so clicking Photo would prove nothing. In `e2e/make.spec.ts`, replace:

```ts
  await tone.getByRole("button", { name: "Photo" }).click();
  await expect(card).toHaveAttribute("data-tone", "photo");
```

with:

```ts
  await tone.getByRole("button", { name: "Cool" }).click();
  await expect(card).toHaveAttribute("data-tone", "cool");
```

- [ ] **Step 5: Document the rule**

In `SPEC.md`, "Card variation", replace the line

```
  - time of day and season from the EXIF capture time (a golden-hour photo gets a warm texture)
```

with

```
  - the sun's height at the photo's place and moment, from EXIF GPS, capture time and time zone, and the season in the photo's own hemisphere (a golden-hour photo gets a warmer colour; without GPS, the hour alone and no season)
```

and add this bullet directly after the "What varies" bullet:

```
- Colour (decided Oct 26, 2026). Every card takes the photo's own colour, sampled from the pixels that touch the mat, as a light wash over the whole mat under the texture, strong enough to see at phone size and under the caption contrast floor. Warm and Cool are nudges of that colour, never colours of their own. The only fixed colours a design draws are the white mat, white light in the sheen, and the neutral grey a photo with no colour gets.
```

In `CLAUDE.md`, "Conventions", append to the bullet that begins "Variation is assigned by `deriveVariation`":

```
 Colour comes from the photo: `TONES` are the sampled palette, nudges of it (Warm, Cool) or the neutral grey, never colours of their own, and every palette carries a `wash` the border draws under the texture; the only fixed colours a design may draw are the white mat, the sheen's white light and that grey. A palette saved without a `wash` draws none, so never re-resolve a stored palette.
```

- [ ] **Step 6: Run everything that does not need a browser**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all PASS, no type or lint errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/photo.ts "apps/web/app/card/[id]/CardScreen.tsx" apps/web/app/dev/card/DevCard.tsx e2e/make.spec.ts SPEC.md CLAUDE.md
git commit -m "Give new cards the sun, the hemisphere and the photo's own colour, let founders restyle saved cards against a fresh sample of the photo, keep the dev card on one fixed palette, and write the colour rule into the spec and CLAUDE.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After the tasks (controller)

1. `npm run test:e2e` on this Mac against the local Supabase stack, with no other dev server on port 3000 (Playwright reuses one if it finds it), including the Mac-only equivalence cases.
2. `npm run check:prod`.
3. Look at the wash: screenshot `/dev/variation` (with `DEV_PHOTOS_DIR=apps/web/public/dev`) at 390 px wide and the Make screen with each JPEG fixture; if the mat still reads as white at phone size, lower `VARIATION_RULES.wash.lightness` in steps of 0.02 (the contrast sweep test bounds it), rerun the card tests, and commit the value.
4. Final review of the whole diff, then a local fast-forward of `main` and the push commands for Alex.
