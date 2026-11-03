# Motions: the Sheen family

Oct 27, 2026. Piece 4 of 4 in refining the border variation (SPEC.md, "Card variation"), built ahead of pieces 2 (ground facts) and 3 (types and motifs) because the old motions looked wrong. Glow, Twinkle and Petals were retired the same day (922559b): a saved card that picked one opens with no motion, and the founders' panel offers None and Sheen. This piece adds the new motions.

## The problem

The old founder motions drew in fixed colours over the mat and read as stickers. Sheen, the Animated tier's sweep of white light across the foil, is the one motion that looks right ("hands down the best animation made so far"). The founders have nothing else to try, and there is no tap response on any card.

## Decisions taken

- **Every new motion is Sheen's own light.** White, screen-blended, 0.55 at the ridge, falling off in straight ramps either side, so the ridge reads crisp and the edges soft. Only the path changes. White light is already one of the fixed colours SPEC.md allows; nothing takes a colour of its own.
- **Eight new motions:** Wave, Visor, Breathe, Ripple, Glint and Starlight from the light-rule brief, and Cross and Sway from the proposals. Rain, Spiral, Colour shift and Afterglow are dropped.
- **Tap blooms the light.** On any card that has a motion, Sheen included, a tap sends a ring of the same light out from the finger. It is an extra on every rule, not a choice in the panel.
- **Sheen does not change.** Its rule in card.css stays as it is, byte for byte.
- **Founders only.** No tier assigns the new motions, so only a founder's pick reaches a card. Who earns motion (Sheen and these) is decided with numbering in step 5. Until then no one else's card has a motion: the Animated tier needs a number, and numbers are not assigned yet.
- **Same place as Sheen.** The light sits in the border layer, under the photo and the caption, which both sit above it. It never lands on the photo and only lightens behind the words.
- **Screen only.** Prints never carry it (the print path paints on canvas and has no motion). Reduced-motion users get no motion and no tap bloom.
- **No migration.** A motion is a string in the stored `variation`, and nothing in the database checks its value. `knownMotion` already reads an id the registry lacks as none.

## The motions

Lengths are card units (1 unit = 1% of card width, `cqw` on screen); H is the card's height in units. The light is `rgba(255, 255, 255, 0.55)` at the ridge everywhere.

| Motion | What you see | How it is drawn |
|---|---|---|
| Sheen | One band crosses the foil left to right every 6 s. | Unchanged: `.oo-border::after`, a 115° ramp moved by `background-position`. |
| Wave | Sheen's band as a train, one band following another at Sheen's angle. | A repeating 115° ramp with a period of 92 units along the gradient (101.5 units across the card), moved one period per loop by `translateX`, 3.05 s a period, linear. |
| Visor | Sheen's band laid flat, scanning down the card and back, slowing at each end. | A 56-unit horizontal ramp moved by `translateY` from −6 to H + 6, 5 s each way, alternate, ease-in-out. |
| Breathe | Sheen's band held still across the card; the foil brightens and fades in place. | A full-card 115° ramp from 0.16 white at the edges to the ridge, opacity 0 → 1 → 0 over 6 s, ease-in-out. |
| Ripple | Sheen's band bent into a ring, spreading out from the photo's centre. | Two radial ramps (clear to 62%, ridge at 81%, clear at 100%), centred on the photo, sized to reach the farthest corner plus 6, scaling 0.5 → 1.04 over 6 s, the second 3 s behind. |
| Glint | A short piece of Sheen runs round the card's outer edge. | A 34-unit 115° patch in a soft round window, moved by `translate` round a rectangle 2.5 units in from the card's edge at an even pace, 9 s a lap, inside a soft mask on the outer 5 units. |
| Starlight | Points of the foil each catch a small passing sheen and let it go, each on its own beat. | Ten soft round windows 12 units across, placed in the mat by the card's seed, each with a small band crossing it; fade in, cross, fade out, 4.5 to 7.5 s each, phases from the seed. |
| Cross | Two mirrored bands pass each other mid-card and brighten where they meet. | Two Sheen bands, one flipped, moved by `translateX` from −100 to 100, 7 s, linear. |
| Sway | Sheen crosses and comes back, easing at each end, like turning the card in your hand. | One Sheen band moved by `translateX` from −90 to 90, 4.5 s each way, alternate, ease-in-out. |
| Tap | A ring of light spreads from the finger and fades. | A radial ramp (clear to 30%, ridge at 72%, clear at 100%), radius 52, at the tap point, scaling 0.15 → 1 over 1.7 s and fading over its last 30%. |

The new motions move `transform` or `opacity` only, so the browser can run them without repainting. These numbers come from the prototype gallery Alex judged on Oct 27, a throwaway page outside the repo. It was checked in Chromium and WebKit on three real palettes, on foil and on each card's assigned texture.

## The registry (`packages/card/src/motions.ts`, new)

`MOTIONS`, `MotionDef`, `Motion` and `knownMotion` move out of `variation.ts` into `motions.ts`. `variation.ts` imports `Motion` from it, and `index.ts` exports everything as before. Adding a motion stays one registry entry plus its CSS.

- `MotionDef` gains `light(shape)`. It returns the pieces the light layer holds for that card, each a class name and optional inline custom properties. `shape` holds the card's height in units, the photo's height in units, and the seed. None returns no pieces and gets no layer. Sheen returns no pieces but gets the layer, so taps have somewhere to bloom.
- Order, as the panel shows it: None, Sheen, Wave, Visor, Breathe, Ripple, Glint, Starlight, Cross, Sway. Class names follow Sheen's: `oo-motion-<id>` on `.oo-frame`.
- `lightGeometry(shape)` gives the custom properties the CSS reads on the layer: `--oo-h` (card height), `--oo-cx` and `--oo-cy` (the photo's centre: 50 and mat + photo height / 2), and `--oo-r` (distance from that centre to the farthest card corner, plus 6).
- **Starlight** places its ten points with `mulberry32(seed ^ 0x3c6ef372)`, a stream apart from the texture's. Each point lies in the mat (the top, side or bottom band, picked by area), at least 2.5 units inside its band. It stays clear of the caption block, worked out from `CARD` for all three lines whatever the caption holds, so the points never move while a caption is typed on Make. Each point has a duration from 4.5 to 7.5 s and a negative delay within it, so the points start out of step.
- **Glint** needs keyframes for the card's shape: the corners fall at fractions of the lap that depend on the height. `glintKeyframes(height)` returns a name (`oo-glint-<height × 100, rounded>`) and the `@keyframes` text. Cards of one shape share one rule. Its rim mask is an SVG made like the border's (`svgDataUrl`): the card's rectangle minus an inner rectangle 5 units in, blurred 1.3 units.

## The card (`packages/card/src/Card.tsx`, `card.css`)

- **Light layer:** when the card has a photo and a variation, and its motion is not None, `.oo-card` holds `<div class="oo-light" aria-hidden="true">` right after `.oo-border`. It carries the geometry properties and the motion's pieces. Pieces are `<span class="oo-light-…">` elements. For Glint, the card also renders the keyframes as a React 19 `<style href={name} precedence="oo-motion">`, which React hoists and de-duplicates by name.
- **Tap:** a click anywhere on the card while its layer is shown adds one bloom at the click point (on the photo, the ring spreads out from under it into the mat), in card units (the click's offset in the card's box divided by width / 100). A click rather than a press, so a scroll that starts on the card does not bloom. Clicks that start in an editable caption line (`startsInCaption`) do not bloom. At most four blooms show at once. Each is removed when its animation ends. No bloom is added while `prefers-reduced-motion: reduce` matches, since a hidden bloom would never end.
- **card.css:** `.oo-light` is `position: absolute; inset: 0; overflow: hidden; pointer-events: none`, in the DOM after `.oo-border` and below the photo and the plate (`z-index: 1`). Every piece is `mix-blend-mode: screen` and reads the light from one custom property, `--oo-light: rgba(255, 255, 255, 0.55)`. Each motion has one block under `.oo-motion-<id> .oo-light`. Masks are written with and without `-webkit-` for Safari.
- **Off:** `@media (prefers-reduced-motion: reduce)` and `@media print` set `.oo-light { display: none }`. The existing reduced-motion rule for Sheen stays.

## App wiring

The design panel builds its Motion strip from `MOTIONS`, so it shows the ten choices plus Assigned. Its strips wrap onto more rows (`design-panel.css`), since eleven cells do not fit one row on a phone; the Texture strip already ran off the screen. A founder's pick saves through the existing paths (`lib/save.ts` on Make, `lib/designs.ts` on a saved card). The opened card reads it through `knownMotion`. `/dev/card` keeps motion None, so the equivalence diff is untouched.

## Documentation

- SPEC.md "Card variation" gains a Motion bullet: what the family is, the list, tap, founders only until numbering, screen only, none under reduced motion. The colour bullet's "white light in the sheen" becomes "white light in the motions".
- CLAUDE.md needs no change: `MOTIONS` is still the registry in `packages/card`.

## Tests

- **`motions.test.ts` (new):**
  - The registry's order and labels.
  - Every motion but None has class `oo-motion-<id>`.
  - No tier names a motion other than None or Sheen, and `deriveVariation` never returns one, across a sweep of numbers.
  - Starlight gives ten points, the same for one seed and different for another. Every point is inside a mat band, out of the photo box, and clear of the three-line caption block, for a portrait, a square and a landscape card.
  - `glintKeyframes` puts the corners at the right fractions of the lap for two heights and names the two differently.
  - `lightGeometry`'s radius reaches every corner.
  - `knownMotion` keeps every registry id.
- **`Card.test.tsx`:**
  - Each motion puts its class on the frame and the right number of pieces in `.oo-light`.
  - None renders no layer; Sheen renders an empty layer.
  - A card with no photo renders no layer.
  - Glint renders its keyframes.
- **`intros.test.ts`'s card.css check** is rewritten: Sheen keeps its `::after` rule and its reduced-motion entry; every other motion has a `.oo-motion-<id> .oo-light` block; reduced motion and print hide `.oo-light`; `--oo-light` equals Sheen's literal light.
- **Browser (`e2e/founder.spec.ts`):**
  - A founder picks each new motion on Make; the frame gets its class and the layer its pieces.
  - A Glint pick on a saved card survives a reload.
  - A click on the mat adds a bloom that is gone within 2.5 s.
  - Under emulated reduced motion, the layer is not displayed and a click adds no bloom.
  - The existing Sheen test in `make.spec.ts` still passes.
- **Before merging:** unit, typecheck and lint; the full browser suite on the Mac, equivalence included; `npm run check:prod`. Headless screenshots of every motion on Make at phone width, in Chromium and in WebKit, signed in as the local founder. Then Alex looks on the dev server, and checks on their iPhone once it is live.

## Out of scope

Who earns motion (step 5, with numbering); the tilt shine; colour in the light; the faint dot-grid surface from the original brief; Rain, Spiral, Colour shift and Afterglow; motion on the Board, on shared cards (not built yet) and on prints.
