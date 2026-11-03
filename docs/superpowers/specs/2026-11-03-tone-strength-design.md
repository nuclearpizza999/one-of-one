# Tone strength: Warm and Cool you can see

Nov 3, 2026. This corrects piece 1 of the border refinement (colour, `2026-10-26-border-colour-design.md`), which went live on Oct 27.

## The problem

Warm, Photo and Cool look the same on the card. A nudge mixes the photo's colours 20% toward a hue at their own saturation and lightness. The wash under the mat then keeps only the tint's hue, at 92% lightness. Across nine typical photo colours (sky blue, teal, green, orange, brick, sand, navy, lavender, the grey-blue fixture), the three washes land 0 to 5 steps apart out of 255, which is invisible on a phone. Cool on a blue photo, and Warm on an orange one, change nothing, because the nudge pulls toward a hue the photo already has. The tests checked that the tone changed, never that the colour visibly did.

## Decisions taken

- **A white-balance shift.** Warm adds red and takes away blue, and Cool does the reverse, like a camera's white-balance dial. The shift applies to the photo's own colours after the wash is made: the wash, the tint, and both foil stops. The card stays the photo's colour, only warmer or cooler.
- **A strength for each card.** The shift is `strength` steps out of 255 on red and on blue. Each card is assigned a strength from 6 (weak) to 20 (strong) from the same facts that choose its tone, so the same photo always gets the same strength.
- **Unchanged:** Photo, Neutral, and grey photos. Photo is the sampled colour. Neutral is the grey. A grey photo (tint saturation under `GREY_SATURATION`) gets no shift, as before, because no colour comes from a tone.
- **Founders choose.** The design panel gains a Strength slider from 0 to 20 under the Tone strip, with Assigned to return to the card's own value.
- **Saved cards keep their look.** A card stores its strength with its design. A card saved before this has none, and its stored palette is drawn as it is. Nothing in the database is rewritten, and there is no migration.

## The strength rule (`deriveToneStrength` in `packages/card/src/variation.ts`)

`deriveTone` keeps returning the tone; `deriveToneStrength` gives its strength from the same sun and season steps. The tone rule does not change: the sun's step plus the season's step, clamped along cool, photo, warm. The strength is `round(weak + (strong − weak) × t)`, where t runs from 0 to 1:

- **Warm with the sun known.** This is warm when the unclamped steps reach 2 or more. `t = (overshoot + depth) / 2`, clamped to [0, 1].
  - `overshoot` is 1 when the season adds to the sun (golden hour in summer), and 0 otherwise.
  - `depth` is how far the sun is through the golden band, from 0 at 6° above the horizon to 1 at 4° below: `(6 − elevation) / 10`. It is 0 when the warmth comes from the season alone, as for a midday photo in summer.
- **Cool with the sun known.** This is cool when the unclamped steps reach 0 or less.
  - `overshoot` is 1 when winter takes the steps below 0 (night in winter), and 0 otherwise.
  - `depth` is how far the sun is below the golden band, from 0 at 4° below to 1 at 18° below (full night): `(−4 − elevation) / 14`, clamped. It is 0 when the coolness comes from the season alone, as for a winter midday.
- **Hour only.** When the sun's position is unknown (no GPS, or no time zone), and the tone is Warm or Cool from the hour, t is 0.5. That gives 13.
- **Photo and Neutral** store 13, the middle. A founder who switches such a card to Warm or Cool starts in the middle of the range.

Examples:

| Photo | Strength |
|---|---|
| Spring, sun 6° up | 6 |
| Spring, sun 4° below the horizon | 13 |
| Summer, sun 6° up | 13 |
| Summer, sun 4° below | 20 |
| Summer midday | 6 (Warm) |
| Spring, just past golden hour (sun 4.1° below) | 6 (Cool) |
| Winter midday | 6 (Cool) |
| Spring, full night | 13 |
| Winter, full night | 20 |

`VARIATION_RULES` loses `nudge` and gains `strength: { weak: 6, strong: 20, nightBelow: -18, max: 20 }`. `nightBelow` is where cool depth reaches 1. `max` is the slider's top. Hour-only and Photo use the middle of weak and strong.

## Palettes (`variation.ts`)

- `paletteFor(tone, photoPalette, strength)` makes the wash first, then shifts it.
  - **Photo:** `withCaptionContrast(withWash(base))`.
  - **Neutral:** the same, with the grey.
  - **Warm and Cool:** `withCaptionContrast(whiteBalance(withWash(base), direction, strength))`.
- `whiteBalance(palette, direction, steps)`, new and exported. It adds `direction × steps` to red and subtracts it from blue, clamped to 0 to 255, on the wash, the tint and both foil stops. A grey palette is returned unchanged.
- `nudgePalette` and `mixTowardHue` are removed.
- `Variation` gains `toneStrength: number`. `VariationOverrides` gains `toneStrength`.
- `withOverrides` re-resolves the palette when the tone or the strength is overridden, and keeps the stored palette otherwise. That rule is unchanged, with strength added.
- `knownToneStrength(value: unknown): number`, new, in the spirit of `knownMotion`. It returns an integer from 0 to `max` as it is, and anything else (missing on an old card, out of range, not a number) as the middle, 13. Every read of a stored variation goes through it.

## The app

- **Card (`packages/card/src/Card.tsx`):** the figure gains `data-tone-strength`.
- **Design panel (`apps/web/components/DesignPanel.tsx`):**
  - Under Tone, a "Strength" field holds a range input from 0 to `max` (step 1) labelled "Tone strength", the current value as a number, and an Assigned button in the panel's strip style. Moving the slider sets the override, and Assigned clears it.
  - The field is disabled when the card's current tone, overridden or derived, is Photo or Neutral.
  - The Assigned status line shows the strength beside the tone, for example `warm 13`.
- **Saving:** `lib/save.ts` (`cardRow`) and `lib/designs.ts` (`updateCardDesign`) write `toneStrength` into the stored `variation`.
- **Reading:** `app/card/[id]/page.tsx` reads it through `knownToneStrength`.
- **Make and the saved card** need nothing else: they already pass overrides through `withOverrides`. The saved card resolves a strength pick against the photo sample, as it does a tone pick.
- **Dev pages:**
  - `/dev/card` passes a strength to `paletteFor` and keeps the Photo tone, so the equivalence diff is unchanged.
  - `/dev/variation` passes the photo's derived strength with its tone override.

## Documentation

- **SPEC.md, Colour bullet.** "Warm and Cool are nudges of that colour" becomes: Warm and Cool shift the photo's colours like a camera's white balance, red up and blue down for Warm, the reverse for Cool, by a strength from 6 to 20 assigned from how deep into golden hour or night the photo was taken, plus the season.
- **CLAUDE.md, variation convention.** "nudges of it (Warm, Cool)" becomes "white-balance shifts of it (Warm, Cool) by the card's strength". The re-resolve rule names the strength beside the tone.
- **Memory.** The step 5 hazard gains: keep `toneStrength` with the tone and palette.

## Tests

- **`variation.test.ts`**
  - Each row of the examples table, as `deriveTone` cases.
  - Hour-only gives 13; Photo and Neutral store 13; no time gives Photo with 13.
  - `whiteBalance` raises red and lowers blue for Warm (the reverse for Cool), clamps at 0 and 255, and leaves grey alone.
  - `paletteFor` gives Photo the same palette as before this change.
  - `withOverrides`: a strength override re-resolves the palette; no override keeps the stored palette, with or without a wash.
  - `knownToneStrength` cases.
  - The nudge tests are removed.
- **`contrast.test.ts`.** The existing hue sweep (every 15°, three saturations, three lightnesses) runs Warm and Cool at strengths 0, 6, 13 and 20. Every wash and foil stop must clear the caption floor.
- **Visible difference (new, in `variation.test.ts`).** For the same sweep, minus grey, at the weak end (6):
  - Warm's wash has a larger red-minus-blue than Photo's, and Cool's a smaller one.
  - Warm and Cool washes are at least 12 steps apart (RGB distance).

  This is the test that would have caught the bug.
- **`Card.test.tsx`.** The figure carries `data-tone-strength`.
- **Browser**
  - **Make (`e2e/make.spec.ts`):** pick Warm, move the slider to 20, and the border image changes and `data-tone-strength` reads 20. Assigned returns the derived value. Photo disables the slider.
  - **Saved card (`e2e/founder.spec.ts`):** a founder sets a strength, sees "Saved.", reloads, and it holds.
  - **Old card (`e2e/founder.spec.ts`):** a saved card with no `toneStrength`, written with psql, opens with 13 and its stored palette.
- **Before merging:** the full browser suite on the Mac, including the equivalence cases, and `npm run check:prod`.

## Out of scope

Chance, ground facts, types and motifs, re-deriving at numbering (step 5), and per-texture strengths.
