# The caption hangs under the photo

Oct 22, 2026. A change to the card's caption, decided by Alex after comparing five renders of the same card at phone size (settings A to E; E chosen). SPEC.md's card table is the product truth; this document records the decision and how it is built.

## Decision

- **Smaller type, tighter lines.** Caption type goes from 3.4% of the card width to 3.0%, line height from 1.32 to 1.2.
- **Hung under the photo.** The caption no longer rests on the bottom edge. The first line's box starts 2.4% of the card width below the photo and the other lines stack beneath it, so a two-line caption sits exactly where a three-line one does. The number, when a card has one, stays on the last line's baseline at the right.
- **A shorter strip.** The caption strip under the photo goes from 19.2% of the card width to 16%.
- Unchanged: the photo, the mat (5%), the text inset (3%), the type faces and weights, the ink colours, the place line's 72% truncation, the border variation.

## Geometry

The one table both painters read, `CARD` in `packages/card/src/layout.ts`, changes as follows:

| Field | Was | Becomes |
| --- | --- | --- |
| `stripHeight` | 19.2 | 16 |
| `fontSize` | 3.4 | 3.0 |
| `lineHeight` | 1.32 | 1.2 |
| `bottom` (last line's distance above the bottom edge) | 3.6 | removed |
| `gap` (first line box's distance below the photo) | none | 2.4 |
| `baselineFromBottom` | 0.32, measured for line height 1.32 | re-measured for line height 1.2 by the equivalence test's probe and frozen again |

`layoutCard` computes each line's baseline from the top instead of the bottom: line `i` of the lines present has `baselineY = strip.y + gap + (i + 1) × lineHeight − fontSize × baselineFromBottom`, where `strip.y = mat + photoHeight` and `lineHeight = fontSize × 1.2` in card units. The number sits on the last present line's baseline, as before. The card's height stays `mat + photoHeight + stripHeight`.

## Painters

- **Screen** (`Card.tsx`, `card.css`): the plate keeps the strip's height and is padded `gap` at the top instead of `bottom` at the bottom; its content is aligned to the top. The lines and the number move into one row inside the plate, laid out as a flex row aligned at the bottom, so the number keeps sitting on the last line's baseline now that the caption is anchored at the top. The custom properties the frame exposes change accordingly (`--oo-gap` replaces `--oo-bottom`).
- **Print** (`renderPng.ts`): no change beyond reading the new table through `layoutCard`.
- **Border** (`border.ts`): no change; the photo box it cuts out already derives from `stripHeight`.

## What follows

- Every card re-renders with the new caption, saved ones included, since the layout is not stored. Prints drawn after this change use it too.
- The print of the 900 × 1200 fixture is 1000 × 1410 px (was 1442).
- SPEC.md's card table: Caption strip 16% of W; Caption type 3.0% of W, line height 1.2; Caption position "hung under the photo: the first line's box starts 2.4% of W below the photo, the others stack beneath it". The decisions paragraph gains a line. CLAUDE.md's prototype-reading notes keep the prototype's own numbers, since they describe that file.

## Tests

- `packages/card/test/layout.test.ts`: baselines from the top (one, two and three lines present), the number on the last baseline, the card height with the new strip, the new table values.
- `e2e/equivalence.spec.ts`: the baseline probe measures `baselineFromBottom` for the new line height; the constant is set from that measurement and the probe's tolerance (0.006) then holds; every equivalence case stays within its tolerance; the one-unit drift cases still fail by their margins.
- `e2e/make.spec.ts`: the print height assertion becomes 1410.
- Card and renderPng unit tests: adjusted where they pin the old numbers.

## Out of scope

Any other change to the card. The strip's proportion on prints is the same as on screen by construction.
