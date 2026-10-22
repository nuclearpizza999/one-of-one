# Step 2: the variation system, with development-only controls

Oct 21, 2026. Design for build step 2 from SPEC.md ("Card variation"), taken after step 3 at Alex's request. SPEC.md's "Card variation" section is the product truth; this document fixes how it is built and adds testing controls that exist only in development builds.

## Decisions taken

- **One SVG border document, rendered by both painters.** The variation is a small SVG string generated from the seed: `feTurbulence` noise for grain (its algorithm is defined by the SVG specification and takes a `seed`, so every browser draws the same noise), gradients for foil, seeded strokes for edge wear, all in card units (viewBox 0 0 100 H) so it scales to any pixel size. The screen shows it as an image in the card's border slot; print draws the same image onto the canvas. Same document, same rasterizer, so the equivalence test covers it by construction.
- **Edge band strong, whole mat subtle.** Grain covers the entire mat at low opacity so the caption strip stays readable; foil, edge wear and the on-screen sheen are confined to the outer band, 2 units of card width wide. The photo box is never touched.
- **Dev controls in two places, development builds only.** A panel under the card on Make, and a `/dev/variation` gallery page fed by a git-ignored `dev-photos/` folder plus a picker. Both render only when the build is not production, so they are absent from production bundles.
- **Never the photo.** No variation touches the photo's pixels: the border recipe is clipped to the mat (everything inside the photo box is transparent), the painters apply no filter, tint or overlay to the photo, and the print never carries one. The only thing that ever changes the photo on screen is the Develop intro's 2.6-second reveal, which SPEC.md defines and which ends at the untouched photo. A unit test asserts the border SVG draws nothing inside the photo box, and an equivalence test compares the print's photo region with the source fixture pixel for pixel, at zero tolerance.
- **A tone is a source of colours, and one of them is the photo.** Three preset tones (warm, neutral, cool) carry fixed colours; a fourth, "photo", samples its colours from the photo's outer edge (the pixels that sit against the mat): a hue at mid lightness for the grain tint, a lighter and a darker pair for the foil. The variation carries the resolved palette as numbers, so screen and print draw the same colours and nothing touches the photo. The time-of-day rule stays the draft default; the dev panel and the gallery offer Photo so the two can be compared on real photos before the rule is settled. A grey photo (mean saturation under 0.08) falls back to the neutral palette.
- **The tier mapping is a first draft.** SPEC.md says to settle which inputs map to which tiers after textures have been seen on about 50 real photos. The mapping is one table in one file, and the dev controls exist so Alex can judge it.

## The variation model (`packages/card/src/variation.ts`)

```ts
// Each of these types is derived from its registry's keys (see "Adding more"), never written by hand.
export type Texture = keyof typeof TEXTURES;   // "paper" | "grain" | "worn" | "foil" today
export type Tone = keyof typeof TONES;         // "warm" | "neutral" | "cool" | "photo"
export type Tier = keyof typeof TIERS;         // "standard" | "fine" | "foil" | "animated"
export type Motion = keyof typeof MOTIONS;     // "none" | "sheen"

export interface Palette { tint: string; foil: readonly [string, string] }   // resolved colours, hex

export interface Variation {
  texture: Texture;
  tone: Tone;
  palette: Palette;                   // from the tone preset, or sampled from the photo for tone "photo"
  tier: Tier;
  motion: Motion;
  intro: IntroId;
  seed: number;
}

export interface VariationInputs {
  seed: number;                       // see Seed below
  takenAt: Date | null;               // tone from hour and month
  camera: { make: string; model: string } | null;   // from EXIF Make and Model
  number: number | null;              // null until the card is public (step 5)
  placeKind: PlaceKind | null;        // venue, landmark, neighborhood, city
  photoPalette: Palette | null;       // sampled by the app from the decoded photo; null when unavailable
}

export function deriveVariation(inputs: VariationInputs): Variation;
```

`deriveVariation` is pure and deterministic: the same inputs always give the same `Variation`. Users never pick any of it.

### First-draft rules (one table, `VARIATION_RULES` in the same file)

| Fact | Rule |
| --- | --- |
| tone | hour 5 to 9 or 17 to 20 → warm; 10 to 16 → neutral; otherwise cool. November to February shift one step toward cool; June to August one step toward warm. No capture time → neutral. |
| tier | number 1 to 10 → animated; 11 to 100 → foil; 101 to 1000 → fine; otherwise or null → standard. |
| texture | tier animated or foil → foil; else camera make starting with "FUJIFILM" → worn; else place kind landmark → grain; else paper. |
| motion | tier animated → sheen; else none. |
| intro | `assignIntro(seed)` (the registry from step 1, now fed by the real seed). |

### Seed

Until cards have ids (step 4), the seed is FNV-1a over the photo's byte size, pixel dimensions, capture time in milliseconds (or 0) and camera make and model (or empty), so the same photo always gets the same variation on the same device. When a card is saved, the seed is re-derived from the card id plus the same facts and stored, as SPEC.md requires, and when the number is assigned the tier is re-derived. `seedFromPhoto` from step 1 is replaced by `variationSeed(facts)`.

## The border document (`packages/card/src/border.ts`)

```ts
export function borderSvg(v: Variation, cardHeightUnits: number): string;   // an SVG document string
export function borderDataUrl(v: Variation, cardHeightUnits: number): string;
export const BAND_UNITS = 2;
```

- `viewBox="0 0 100 H"` where H is the card height in units from `layoutCard`, so the same document fits any photo aspect and any pixel size.
- **Grain** (textures grain, worn, foil, and a lighter version for paper): an `feTurbulence` with `seed` set from the variation seed and `baseFrequency` chosen in card units, composited at low opacity over the whole mat (0.05 for paper, 0.09 for grain and worn, 0.07 for foil), coloured with the variation's palette tint (warm #b08860, cool #6878a0, neutral grey, or the photo's own hue).
- **Edge wear** (worn): a seeded set of short, low-opacity strokes along the band, never inside it.
- **Foil** (foil, animated): a linear gradient across the band only, angle from the seed, between the palette's two foil stops.
- **Mask**: everything stronger than the grain is clipped to the band (`x` or `y` within 2 units of the card edge). The photo box and the caption text area carry only the grain.
- Determinism: no `Math.random`; every random-looking value comes from a seeded generator (`mulberry32` from the seed), and `feTurbulence` gets the seed as its `seed` attribute.

## Painters

- **`Card`** gains `variation?: Variation | null`. When present it fills `.oo-border` with `<img class="oo-border-img" src={borderDataUrl(...)} alt="">`, stacked under the photo and the caption (`.oo-photo-wrap` and `.oo-plate` become `position: relative; z-index: 1`). With `motion: "sheen"` the frame gets `oo-motion-sheen`, a CSS animation on a pseudo-element gradient that sweeps the band every 6 seconds, screen only, disabled under `prefers-reduced-motion`.
- **`renderPng`** gains `border?: string` (the SVG document). It loads it as an image (a data URL into an `Image`, awaited), draws it after the white fill and before the photo, scaled to the full canvas. If the border image fails to load, the PNG is drawn without it and the result carries `borderDrawn: false` so the status can say "Printed without the border."
- The Make screen's Print cell exports with the border, since that is what the screen shows. The Print screen's Plain / Border strip is step 7.

## Palette sampling

`paletteFromPixels(rgba, width, height)` in `packages/card/src/palette.ts` is pure: it reads the outer ring (one eighth of the smaller dimension on each side), averages hue as a saturation-weighted vector, and returns `{ tint, foil }` as hex, or null when the ring is transparent; mean saturation under 0.08 returns the neutral palette. The app's `samplePhotoPalette(img)` draws the decoded photo at 32 px on a canvas and calls it; any failure yields null, which `paletteFor` treats as neutral.

## EXIF

`readPhotoMetadata` gains `camera: { make: string; model: string } | null` from EXIF `Make` and `Model` (trimmed; null when either is missing).

## Make screen wiring

After a photo is read, the screen derives the variation from the seed, the capture time, the camera, the place match's kind and a null number, applies it to the card, and uses its intro. The dev panel (below) can override any field; "Assigned" returns a field to the derived value. Overrides apply to the live card and to the exported PNG.

## Development-only controls

Both controls render only when `process.env.NODE_ENV !== "production"`, which Next.js resolves at build time, so production bundles contain neither.

### The panel on Make (`apps/web/components/DevVariationPanel.tsx`)

Under the action strip: five option strips (44px cells, text labels) for Intro, Texture, Tone, Tier and Motion, each built from its registry's labels plus an "Assigned" cell (today: Rise, Develop, Flip; Paper, Grain, Worn, Foil; Warm, Neutral, Cool, Photo; Standard, Fine, Foil, Animated; None, Sheen), plus a two-cell strip Border on print (On, Off). The panel never lists entries by hand. A caption line shows the derived variation and the seed in hexadecimal. Changing Intro replays it.

### The gallery page (`/dev/variation`)

- Returns 404 in production, like `/dev/card`.
- Lists every `.jpg` and `.jpeg` in `dev-photos/` at the repo root through a dev-only route `GET /api/dev/photos` (names only) and `GET /api/dev/photos/[name]` (the file). The route refuses anything outside the folder (names are validated against `/^[\w.-]+\.(jpe?g)$/i` and resolved paths must stay inside the folder) and is absent in production. `dev-photos/` is git-ignored and may not exist; CLAUDE.md's commands section says what it is for and the page says "Drop JPEGs into dev-photos/" when it is empty. The folder path can be overridden with `DEV_PHOTOS_DIR` so a test can point it at a temporary folder.
- A picker adds one photo from the device for the session.
- Layout: one row per photo; in each row the card at 160 px wide under every registered texture (one column per `TEXTURES` entry) for the tier chosen in a strip at the top (one cell per `TIERS` entry), each card's caption filled from the photo's EXIF through the same code as Make, the derived variation's cell marked with a 1px rule beneath it. Tone follows each photo's own capture time, with a strip to force Warm, Neutral, Cool or Photo (the photo's sampled palette).

## Tests

- **Unit, `packages/card`:** `paletteFromPixels` finds the ring's hue (a blue ring around a red centre gives a blue tint), falls back to neutral for grey, returns null for a transparent ring, and is deterministic; `paletteFor` resolves presets and the photo tone with its fallback; the border SVG draws nothing inside the photo box (every drawn element is clipped to the mat or the band, checked by parsing the document); `deriveVariation` is deterministic; one test per rule row (tone by hour and month, tier by number, texture by tier, camera and place kind, motion by tier); `variationSeed` is stable and sensitive to each input. `borderSvg` returns a parseable SVG with the right viewBox, carries the seed in `feTurbulence`, confines foil and wear elements to the band, and contains no `Math.random` (a source test). `Card` renders the border image under the photo when a variation is given and omits it otherwise; the sheen class appears only for motion sheen. `renderPng` draws the border between the fill and the photo (recording fake), and reports `borderDrawn: false` when the image fails.
- **Unit, `apps/web`:** `readPhotoMetadata` returns the camera from a fixture that carries Make and Model (the fixture script gains them: seoul.jpg gets Make "Apple" Model "iPhone 15 Pro", nogps.jpg Make "FUJIFILM" Model "X100VI").
- **Equivalence:** one case per registered texture on `/dev/card` (`texture=<id>`, generated by looping over `TEXTURES`, with the foil case at tier foil), within the same tolerance; a drift case where the DOM border is shifted by one unit must fail. Adding a texture adds its case automatically. Textured cases use their own tolerance, `MAX_TEXTURE_DIFF_RATIO = 0.002`, set by the same rule as the caption tolerance (twice the largest observed, 0.00094); the dev card uses the warm palette so the band contrasts with the mat.
- **Browser:** the dev panel is present on Make in the dev server, switching Texture to Foil changes the card's `data-texture` and the exported PNG differs from the Paper export; `/dev/variation` lists a JPEG written to a temporary `DEV_PHOTOS_DIR` and refuses `../`; a production build returns 404 for `/dev/variation` and `/api/dev/photos`, and the production bundle contains no "Assigned" string.

## Adding more

Everything that varies is a registry entry, so growing the system is data plus at most one small function, never a change to the card, the painters, the panel or the tests.

| To add | Where | What it takes |
| --- | --- | --- |
| a texture | `TEXTURES` in `packages/card/src/textures.ts` | `{ id, label, draw(ctx: BorderDraw): string }` where `draw` returns SVG fragments for the mat and the band using the seeded generator and tone passed in. A hand-made texture is an entry whose `draw` places a bundled image (`<image href>`) in the band instead of drawing. |
| a tone | `TONES` in `variation.ts` | a preset `{ id, label, source: "preset", tint, foil: [string, string] }`, or a computed source like the existing `photo` entry whose palette is resolved by `paletteFor` |
| a tier | `TIERS` in `variation.ts` | `{ id, label, foil: boolean, motion: Motion }` |
| a motion | `MOTIONS` in `variation.ts` plus one CSS class `oo-motion-<id>` in `card.css` | `{ id, label, className }`; the class holds the animation and its reduced-motion override |
| an intro | `INTROS` in `intros.ts` plus one CSS class, as in step 1 | unchanged |
| a mapping | `VARIATION_RULES` in `variation.ts` | edit the table; the rule tests read the same table |

What follows automatically from one entry: the type union, the dev panel's strip cell, the gallery page's column or cell, the `/dev/card` query value, and the equivalence case that proves screen and print still match for it. A registry test asserts every entry has an id equal to its key, a non-empty label, and (for textures) produces a parseable SVG with no element outside the band stronger than the grain.

## Out of scope

Hand-made textures for the rare tiers (procedural only for now), the Print screen's Plain / Border strip (step 7), final tier rules (after the 50-photo exercise), storing the seed and variation on a card (step 4), re-deriving the tier when a number is assigned (step 5).
