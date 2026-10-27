# Border colour: the photo's own colour on every card

Oct 26, 2026. Piece 1 of 4 in refining the border variation (SPEC.md, "Card variation"). The pieces, in build order: 1 colour (this document), 2 ground facts (land cover, climate, coast and elevation looked up on our server, plus more EXIF clues), 3 types and motifs (fourteen types told from those facts, each with a fine single-colour motif), 4 motions (keyboard-style light rules over the card's own drawing, replacing Glow, Twinkle and Petals). Taking the variation from the photo's facts alone, with chance as a later priority, and the tilt shine as the refinement after the type look, are already in SPEC.md.

## The problem

Most cards look alike. Every unnumbered card that is not from a Fuji body or one of the 28 landmarks gets the Paper texture, a speckle in the palette's tint at 10% and 7% strength, and the palette is one of three presets chosen by the capture hour. At phone size the mat reads as plain white whatever its colour. The photo's own colour, sampled from the pixels that touch the mat, exists as the Photo tone but is never assigned.

## Decisions taken

- **Every card takes the photo's own colour.** The palette is always the one sampled from the photo's outer ring (`paletteFromPixels`, unchanged). A grey photo (mean saturation under 0.08) and a photo that cannot be sampled get the neutral grey palette, as today.
- **A wash makes it visible at phone size.** The palette gains a third colour, `wash`: the tint's hue at a light lightness and a capped saturation. The border draws it as a flat fill over the whole mat, under every texture's mottle, grain and pattern, so the mat reads as the photo's colour at arm's length. The caption contrast floor covers the wash: it is lightened until both caption inks clear it, and a test sweeps hues to prove it.
- **No fixed colours in any design.** Warm and Cool stop being preset colours and become nudges: each of the photo's colours mixed part of the way toward a warm or a cool hue at its own saturation and lightness, the way a warming filter works. The only fixed colours left are the white mat, white light in the sheen, and the neutral grey a colourless photo gets. (Glow, Twinkle and Petals still carry fixed colours; piece 4 replaces them.)
- **The sun decides warm and cool.** With GPS and a capture time zone, the sun's height above the horizon at that place and moment picks the nudge: golden hour (sun between 4° below and 6° above the horizon) warm, blue hour and night (lower) cool, day (higher) the photo's colour as sampled. Without GPS or without a time zone, today's hour ranges stand in.
- **Seasons follow the hemisphere.** With GPS, summer nudges one step warmer and winter one step cooler, by the photo's hemisphere; within the tropics (latitude under 23.44°) there is no season nudge. Without GPS there is no season nudge, since the hemisphere is unknown. This fixes a July photo in Sydney counting as summer.
- **The card id leaves the seed.** `variationSeed` hashes the photo's facts only (file size, pixel size, capture time, camera), so the same photo always gets the same card, intro included.
- **Saved cards do not change.** A saved card renders from its stored variation. A stored palette has no `wash`, and a palette without one draws no wash, so every card saved before this change looks exactly as it did. No migration.

## The tone model (`packages/card/src/variation.ts`)

A tone is how the card's colours are made from the photo's:

```ts
export type ToneDef = { id: string; label: string } & (
  | { source: "photo" }                       // the sampled palette as it is
  | { source: "nudge"; direction: 1 | -1 }    // the sampled palette shifted warmer (1) or cooler (-1)
  | { source: "neutral" }                     // the grey palette, for a photo with no colour
);

export const TONES = {
  warm: { id: "warm", label: "Warm", source: "nudge", direction: 1 },
  photo: { id: "photo", label: "Photo", source: "photo" },
  cool: { id: "cool", label: "Cool", source: "nudge", direction: -1 },
  neutral: { id: "neutral", label: "Neutral", source: "neutral" },
} as const satisfies Record<string, ToneDef>;

export interface Palette {
  tint: string;
  foil: readonly [string, string];
  /** The flat colour under the whole mat. Absent on cards saved before Oct 26, 2026, which draw no wash. */
  wash?: string;
}
```

The tone ids are unchanged, so every stored `variation.tone` still names a registered tone. `NEUTRAL_PALETTE` keeps its grey tint and foil (`#8a8a8a`, `#ececec`, `#9c9c9c`), now written in the constant itself rather than in a preset tone; `paletteFor` gives it a light grey wash like any other palette.

`paletteFor(tone, photoPalette)` resolves in this order: the base is `photoPalette ?? NEUTRAL_PALETTE`; `neutral` gives `NEUTRAL_PALETTE`; `photo` gives the base; a nudge gives `nudgePalette(base, direction)`. The result then gets its wash (`withWash`) and passes through `withCaptionContrast`, which now lightens the wash as well as the foil stops.

`nudgePalette(p, direction)` mixes the tint and both foil stops, in RGB, by `VARIATION_RULES.nudge.amount` toward the colour of `warmHue` (direction 1) or `coolHue` (direction -1) at that colour's own saturation and lightness. Rotating the hue instead would turn a warmed blue purple. A grey palette (tint saturation under `GREY_SATURATION`) is returned unchanged: a photo with no colour gets no colour from a nudge.

`withWash(p)` adds `wash`: the tint's hue, saturation `min(tint saturation, wash.saturationMax)`, lightness `wash.lightness`.

`VariationInputs` gains `gps: { lat: number; lng: number } | null` and `utcOffsetMinutes: number | null`, both from EXIF, and `deriveVariation` passes them with `takenAt` to `deriveTone`.

### The rule (`deriveTone`)

`deriveTone({ takenAt, gps, utcOffsetMinutes })` returns `"warm"`, `"photo"` or `"cool"`; never `"neutral"`, which a grey photo reaches through its palette, not its tone. Steps along `cool → photo → warm`:

1. No capture time: `photo`.
2. Base step. With GPS and an offset: the sun's elevation at the capture instant (the wall-clock time minus the offset) and place; above `sun.dayAbove` (6°) is photo, from `sun.coolBelow` (-4°) up to 6° is warm, below -4° is cool. Otherwise the hour ranges: `warmHours` warm, `photoHours` photo, the rest cool (today's ranges, renamed from `neutralHours`).
3. Season. With GPS and an absolute latitude of at least `season.tropicLatitude` (23.44): the capture month, shifted six months in the southern hemisphere, one step cool in `coolMonths` and one step warm in `warmMonths` (today's months). No GPS, or within the tropics: no step.
4. Clamp to the ends.

### Rules table additions (`VARIATION_RULES`)

```ts
tone: {
  warmHours, photoHours, coolMonths, warmMonths,      // as today; neutralHours renamed photoHours
  sun: { dayAbove: 6, coolBelow: -4 },
  tropicLatitude: 23.44,
},
nudge: { warmHue: 35, coolHue: 215, amount: 0.2 },    // hues in degrees; amount 0 to 1
wash: { lightness: 0.92, saturationMax: 0.35 },
```

The starting values are drafts, tuned on real photos in `/dev/variation` like the rest of the table. `wash.lightness` is the one that sets "visible at phone size"; the implementation checks it on the fixtures at 390 px wide before handing over, and Alex judges it on the phone.

## The sun (`packages/card/src/sun.ts`)

`sunElevation(utcMs: number, lat: number, lng: number): number` in degrees, from the NOAA solar position equations (declination and equation of time from the Julian century, true solar time, hour angle, zenith; no refraction correction). Pure, no dependencies. `captureInstant(takenAt: Date, utcOffsetMinutes: number): number` turns the zone-free wall-clock (read with local getters, as `wallClockMs` does) into a UTC instant.

## EXIF (`apps/web/lib/exif.ts`)

`PhotoMetadata` gains `utcOffsetMinutes: number | null`, from `OffsetTimeOriginal` when the date came from `DateTimeOriginal`, `OffsetTimeDigitized` when it came from `CreateDate`, otherwise null. `parseUtcOffset("+09:00")` is 540, `"-05:30"` is -330, anything else null. The fixture files stay as they are; the test writes `OffsetTimeOriginal` (tag 0x9011) or `OffsetTimeDigitized` (0x9012) into an in-memory copy of a fixture, registering the tag with piexifjs if its table lacks it.

## The border (`packages/card/src/border.ts`)

When `v.palette.wash` is set, `borderSvg` draws one `<rect>` of the wash over the whole card as the first element of the mat clip group, before the texture's fragments. When it is absent, the document is byte-for-byte what it is today. The photo box stays unpainted. Both painters render the same document, so the screen and the print carry the same wash, and Plain prints still print the white mat alone.

## App wiring

- `describePhoto` (Make and the gallery) passes `gps` and `utcOffsetMinutes` into `deriveVariation`, and stops passing the card id to `variationSeed`; `SeedFacts.cardId` is removed. The card id is still made at pick time and saved as before.
- `withOverrides` re-resolves the palette only when the tone is overridden; otherwise it keeps the base palette as stored. Today it recomputes it on every call, which on a saved card without a fresh sample would turn a stored Warm or Cool card grey.
- The saved card (`CardScreen`) samples the photo's palette from the image it shows when the viewer is a founder, so the panel's Warm, Photo and Cool resolve against the real photo; until the sample arrives, and for anyone else, it uses today's rule (the stored palette for a card saved with Photo, otherwise none).
- The design panel, the gallery's tone strip and `/dev/card` read `TONES`, so the strip becomes Warm, Photo, Cool, Neutral with no panel change. `/dev/card` keeps a fixed variation for the equivalence diff by passing a fixed sampled palette (a test fixture, the old warm preset's colours) through `paletteFor("photo", …)`.

## Documentation

SPEC.md "Card variation": the inputs line reads sun position and season by hemisphere, and a bullet records that every card takes the photo's colour as a wash and that warm and cool are nudges of it. CLAUDE.md's variation convention names `TONES` as nudges of the photo's colour and the three fixed colours that remain.

## Tests

- **`sun.test.ts`:** elevation within 1° of NOAA calculator values at several places and times (an equinox noon at the equator, Seoul at a June noon and midnight, a southern-hemisphere afternoon, a polar summer midnight); `captureInstant` applies the offset with the right sign.
- **`variation.test.ts`:** each `deriveTone` row: the three sun bands, the hour fallback without GPS and without an offset, `photo` without a time, the season step by hemisphere, no step in the tropics or without GPS, the clamp, and never `neutral`. `nudgePalette` raises red and lowers blue for a warm nudge of a cool colour and the reverse for a cool nudge of a warm one, changes nothing at amount 0, and leaves grey alone. `withOverrides` keeps a stored palette (wash or none) when the tone is not overridden. `paletteFor` gives every tone a wash, gives `neutral` the grey palette, and falls back to neutral without a sample. The registry test checks the new tone shapes. `variationSeed` is stable and sensitive to each photo fact, and has no card id input.
- **`contrast.test.ts`:** for every tone and a sweep of sampled hues (every 15°, three saturations, three lightnesses), the wash and both foil stops clear the caption floor.
- **`border.test.ts`:** a palette with a wash draws it first in the mat group and never in the photo box; a palette without one gives exactly the document drawn before this change (a stored-card fixture).
- **`exif.test.ts`:** the offset from an in-memory copy of a fixture carrying `OffsetTimeOriginal`, the digitized offset when the date came from `CreateDate`, null for the fixtures as they are, and `parseUtcOffset` cases.
- **Browser:** the existing suites, including the equivalence suite with its Mac-only pixel-ratio cases, run on the Mac before merging; the founders' restyle test still passes with the reordered tone strip.

## Out of scope

Ground facts, types, motifs and motions (pieces 2 to 4); replacing Glow, Twinkle and Petals (piece 4); re-deriving the variation when a number is assigned (step 5); the tilt shine.
