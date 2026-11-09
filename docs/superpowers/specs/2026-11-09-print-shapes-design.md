# Print shapes: Card, Gallery and Thin

Nov 9, 2026. Prints so far are the card exactly as it looks on screen: a white border 5% of the width on the top and sides, a caption strip 16% deep, and text 3% tall. On a wall that reads heavy. At 16 inches wide the photo is only 69% of the print and the caption is 35 pt. Alex compared his Jimbōchō photo in three shapes (artifact "Wall print") and liked Gallery and Thin.

## Decisions taken

- **Three print shapes.** The Print sheet offers Card, Gallery and Thin, with Gallery picked by default.
  - **Card** is the card as it is on screen.
  - **Gallery** and **Thin** have a thinner border, a shallower strip and smaller text, so the photo is bigger.
- **The screen never changes.** Make, the Board and opened cards stay the Card shape. Only the print, and its preview, take another shape.
- **One layout for every shape.** The layout function takes the shape, and the screen preview and the print painter both use it. A print still looks exactly like its preview, and the equivalence test runs for every shape.
- **A Print sheet.** Tapping Print on Make or on a saved card opens a sheet over the screen with:
  - a preview;
  - a Shape strip;
  - a Border strip (Plain, Border);
  - Save.

  The Border strip replaces the founders-only "Border on print" switch and is for everyone, as SPEC.md planned. Sizes, papers, prices and ordering come later, with the print vendor (build step 7).
- **Nothing is stored.** The shape is a choice made at print time. No database change.

## The shapes (`packages/card/src/layout.ts`)

All values are in units of the print's width (W = 100).

| Shape | Border (top, sides) | Photo width | Caption strip | Text | Text indent | Gap under photo |
|---|---|---|---|---|---|---|
| Card | 5 | 90 | 16 | 3 | 3 | 2.4 |
| Gallery | 3 | 94 | 9.5 | 1.8 | 1.8 | 1.44 |
| Thin | 2 | 96 | 7 | 1.3 | 1.3 | 1.04 |

How the table is built:
- Each shape is defined by its border, strip and text size. Photo width is `100 − 2 × border`. The indent equals the text size, and the gap is 0.8 × the text size. That is the Card shape's own ratio (3 and 2.4 for text 3), so the Card shape's numbers are exactly today's `CARD` and nothing about it moves.
- **Strip depths:** Alex chose Gallery at 9 and Thin at 6 on a photo with no coordinates line, so the page showed two lines. A photo with GPS has three: place, date, coordinates. The strips grow just enough to hold three lines with at least 0.8 × the text size of air below: 9.5 and 7.
- **Shared values:** the line height (1.2), the place line's width limit (0.72 of the photo width), the measured baseline ratio (0.27 of the text size), inks and weights are shared by every shape.

The code changes:
- **`SHAPES`, a new registry** (`card`, `gallery`, `thin`, with labels). `geometryOf(shape)` returns the full geometry above. `CARD` stays as it is and equals `geometryOf("card")`, so the screen code that reads it (Card's frame variables, the motions) is untouched.
- **`layoutCard(spec, shape = "card")`** and **`cardHeightUnits(w, h, shape = "card")`** take the shape.
- **`printDimensions(w, h, cap, shape = "card")`** in `renderPng.ts` sizes the print from the shape's photo width, border and strip. `drawCard` and `renderPng` take the shape and paint `layoutCard(spec, shape)`. The print cap (4800 px) and the photo at native resolution are unchanged.
- **`borderSvg(v, height, shape = "card")`** in `border.ts` takes the photo box from the shape. Each texture already draws to the box and size it is given, so a texture fits any shape.
- **`Card.tsx`** gains `shape?: Shape` (default `card`). It builds its frame variables (`--oo-mat`, `--oo-strip`, `--oo-inset`, `--oo-gap`, `--oo-fs`, `--oo-place-max`) from `geometryOf(shape)`, once per shape. `card.css` already reads every dimension from those variables.

## The Print sheet (`apps/web/components/PrintSheet.tsx`, new)

**Opening and closing**
- It opens from the Print cell on Make and on an opened card, and covers the screen.
- A top bar holds Cancel (×), which closes the sheet.

**Contents**
- **Preview:** the card in the chosen shape, with no intro, no motion and no light layer (prints have none). It shows the border only when Border is chosen.
- **Strips:**
  - "Shape": Card · Gallery · Thin, Gallery selected on open.
  - "Border": Plain · Border, Border selected on open.

  Both use the app's option strips, with the same words as SPEC.md's Plain / Border.
- **Save:** an icon-only cell with the printer icon, labelled "Save print". It does what Print does today: renders the PNG from the original at native size, then shares or downloads it. The status line under it reports the result.

**Behaviour**
- Choices are not remembered between openings. Each opening starts at Gallery and Border.
- The file name gains the shape when it isn't Card: `one-of-one-<place>-gallery.png`.

**Chrome:** it follows `screens/6-print-light.html` and its dark twin (the back control, the preview, the strips, the filled action). Without a vendor it has no size, paper or price yet.

## The app

- `lib/print.ts`: `PrintInput` replaces `borderOnPrint` with `border: boolean` and adds `shape: Shape`. The border is drawn with `borderSvg(variation, cardHeightUnits(w, h, shape), shape)`.
- `MakeScreen.tsx` and `CardScreen.tsx`:
  - The Print cell opens the sheet.
  - The sheet gets the photo, the caption and the variation. Make passes the live caption and the current variation with the founder's picks, as Print does today.
  - The `borderOnPrint` state goes.
- `DesignPanel.tsx`: the "Border on print" field and its props go.

## Documentation

- **SPEC.md**
  - **Card geometry:** "so the card scales identically from a phone screen to a 12-inch print" becomes "so the card scales identically at any size; on screen it is always the Card shape, and a print may also take the Gallery or Thin shape (Print service)".
  - **Screens table, Print row:** gains the Shape strip (Card, Gallery, Thin, Gallery by default) before the paper strip.
  - **Print service:** "so the print looks exactly like the screen" becomes "so the print looks exactly like its preview". It gains the three shapes' table and the decision (Nov 9, 2026).
- **CLAUDE.md**
  - The equivalence note says the suite diffs every shape.
  - The design panel line drops "border on print".
  - "Where things are" names `components/PrintSheet.tsx`.

## Tests

- **`layout.test.ts`**
  - `geometryOf("card")` equals `CARD`.
  - `layoutCard(spec)` and `layoutCard(spec, "card")` give exactly what `layoutCard` gave before this change. The existing assertions stand.
  - Gallery and Thin: photo widths 94 and 96, indents and gaps from the text size.
  - The third line's box ends at least 0.8 × the text size above the bottom edge, for every shape.
  - `cardHeightUnits` per shape.
- **`renderPng.test.ts`:** `printDimensions` per shape for a portrait and a landscape photo. The photo always stays at native width under the cap.
- **`border.test.ts`:** the photo box is cut out at the shape's border and photo width. The Card shape's document is byte-identical to before.
- **`Card.test.tsx`:** `shape="gallery"` sets `--oo-mat:3cqw` and `--oo-fs:1.8cqw`, and the default stays Card.
- **Equivalence (`e2e/equivalence.spec.ts`).**
  - `/dev/card` takes `shape=`, and the DOM card and the PNG use it.
  - The macOS-only pixel-ratio cases run every fixture with coordinates and a number for Gallery and Thin, beside the existing Card cases.
  - The tolerance stays `MAX_DIFF_RATIO`. Smaller text has fewer edge pixels, so if a case fails, the cause is a real drift, not the tolerance.
  - One drift case per new shape proves it still catches a one-unit shift.
- **Browser (`e2e/make.spec.ts`):**
  - **Print sheet:** it opens with Gallery and Border selected; the preview changes shape; Cancel closes it; Save writes a PNG whose aspect matches the shape (Thin is wider for its height than Card).
  - **The existing print tests:** they go through the sheet, and the border test uses the sheet's Border strip instead of the founders' switch.
  - **No border switch:** the founders' panel no longer shows "Border on print".
- **Before merging:** the full browser suite on the Mac, equivalence included, and `npm run check:prod`.

## Out of scope

Paper sizes, papers, prices and ordering (build step 7, with the vendor); remembering a person's last shape; shapes on screen or on the Board; a shape chosen per card and stored.
