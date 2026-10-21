# Step 1 scaffold: card renderer package and app shell

Oct 21, 2026. Design for turning the handoff folder into a working project. SPEC.md stays the source of truth for the product; this document only fixes how build step 1 (and the app shell around it) is laid out.

## Decisions taken

- **Web first.** Next.js app plus a standalone renderer package. A native wrapper can reuse the renderer later.
- **Scope.** Build step 1 from SPEC.md plus an app shell: the renderer package with tests and fonts, and a Next.js app that runs with the tab bar, a Make screen driving the renderer, and an empty Board. No EXIF, place lookup, variation textures, accounts, storage or numbering; those are steps 2 to 5.
- **Rendering.** The screen card is live DOM. The PNG is drawn by a canvas painter on the owner's phone at the moments the card's content changes (made, number assigned, precision changed, print ordered). Every other use of the card (link previews, the shared card page, desktop) is a resize of that stored file. Board and Storyboard thumbnails are square crops of the photo rendition, never of the card. Both painters take their measurements from one layout function, and a test proves they match. No server rendering: the border is a layer on the mat that never moves the type, and every content change is owner-initiated from the phone, so a server redraw is not needed. If a public version ever needs one, the canvas painter is written so it can run under a Node canvas.

## Repo shape

npm workspaces at the repo root, TypeScript throughout, Node 24 and npm 11 (already installed).

```
package.json                  workspaces: packages/*, apps/*; root scripts
tsconfig.base.json
packages/card/                @one-of-one/card, the renderer; no app imports
apps/web/                     the Next.js app
e2e/                          Playwright tests that need a browser
docs/superpowers/specs/       design documents
SPEC.md, prototype/, screens/ unchanged, reference only
```

## The card package

`packages/card` exports five modules. React is a peer dependency. Nothing in the package imports from the app. The package ships TypeScript source with no build step: Vitest runs it directly and the app consumes it through Next.js `transpilePackages`.

### layout

A pure function. In: photo width and height in pixels, the three caption strings (place, date, coords; empty string means omitted), and the number or null. Out: every box, font size and baseline in units of card width, where the card is 100 units wide. The numbers are the SPEC table:

| Item | Value in units |
| --- | --- |
| mat | 5 on top, left and right |
| photo | x 5, y 5, w 90, h 90 × photoH ÷ photoW |
| caption strip | y = 5 + photo h, h 19.2 |
| caption type | size 3.4, line height 3.4 × 1.32 |
| text inset | 3 from the photo's edges, so text spans x 8 to x 92 |
| caption bottom | last line present sits 3.6 above the card's bottom edge |
| place line max width | 72% of the photo width, 64.8 |
| card height | 5 + photo h + 19.2 |

The output lists the lines present, bottom-aligned: each with its text, weight (600, or 400 for coords), color (#111, or #333 for coords) and baseline y. The number, when not null, sits on the last line's baseline, right-aligned to x 92, tabular figures. One constant in layout, the baseline offset below the line box's bottom (the prototype's 0.28 × font size), is tuned once by the equivalence test and then frozen.

Unit tests pin every number for a portrait, a landscape and a square photo, with and without the coords line and the number.

### format

Ports `fmtDate` ("July 1st, 2026"), `fmtCoords` ("37.5563° N, 126.9236° E") and `ordinal` from the prototype. Unit tests cover ordinals (1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 22nd, 23rd, 101st), hemispheres and four-decimal rounding.

### Card

The DOM painter: a React component that draws the layout with CSS container-query units inside a frame with `container-type: inline-size`, so the card is one CSS block at any width.

Props:

- `photo`: object URL or src, with naturalWidth and naturalHeight; absent for the empty state ("Tap to add a photo", 3:4 blank mat).
- `place`, `date`, `coords`, `number` as in layout.
- `editable` plus `onCaptionChange(field, text)`: caption lines are `contenteditable` with the prototype's hints ("Where was this?", "When?", "Coordinates"); Enter blurs.
- `intro`: an intro id from the registry, or none. The intro's CSS class is applied to the frame; a `replayKey` prop restarts it.
- `wall`: `light` shows the 1px #e6e6e6 hairline and the soft shadow; `dark` shows neither. The card itself is identical on both.
- A `border` slot (render prop or children) reserved for the step 2 variation layer. Empty in this step.

Reduced motion: the intro classes are neutralised under `prefers-reduced-motion`, exactly as the prototype does. The number slot is empty when `number` is null.

### renderPng

The canvas painter. In: an image source (an `HTMLImageElement` or `ImageBitmap`), the same caption fields and number, and a canvas factory. Out: a PNG blob. It calls layout, multiplies units by `W / 100` where `W = min(photoW, 4800) / 0.90`, fills the mat white, draws the photo, draws each line at its baseline with `fillText` and the place line's `maxWidth`, and draws the number right-aligned. No hairline, no shadow.

The canvas factory defaults to `document.createElement("canvas")` in the browser. It is a parameter so a Node canvas can be passed later without changing the painter.

Fonts are awaited before drawing (see Fonts).

### intros

The registry from the prototype, unchanged: Rise, Develop, Flip with their `numberAt` and `total` timings, plus the three CSS classes. Intro assignment in this step is a placeholder: an index from a small hash of the photo file's size and dimensions, so the same photo always gets the same intro. Step 2 replaces the hash with the variation seed.

### Fonts

EB Garamond Regular (400) and SemiBold (600) ship inside the package under `fonts/` as woff2, with the OFL licence file. The package's stylesheet declares the two `@font-face` rules pointing at those files; the app imports that stylesheet, and Next.js emits the files as static assets. Both painters use the same faces: the DOM through the stylesheet, the canvas by awaiting `document.fonts.load` for both weights before drawing. No runtime request to Google Fonts for the card. TTF copies are added only when a Node painter exists.

## The app shell

`apps/web` is a Next.js app using the App Router.

- **Routes.** `/make` (Make screen), `/board` (Board, empty state), `/` redirects to `/board`. A dev-only route `/dev/card` renders fixture cards for the equivalence test and returns 404 in production.
- **Chrome.** The tokens from SPEC.md as CSS variables (ground, ink, muted, rules), light and dark by `prefers-color-scheme`. Archivo 500 through `next/font` for chrome. Icons are the inline SVGs from the mockups, drawn at 22px, 1.5px stroke, round caps, in a single `Icon` component; every icon-only control has an aria-label using the mockups' vocabulary.
- **Components.** `TopBar` (48px, 1/1 mark left, one 44px icon target right), `TabBar` (84px, three 48 × 44 slots: grid, empty, plus), `Strip` (equal cells inside a 1px rule, 52px for action strips and 44px for option strips, selected cell fills with ink), `StatusLine`.
- **Make screen in this step.** Tap the empty mat to pick a photo. The card fills with it at its native aspect ratio and the assigned intro plays. Caption lines are typed by hand (no EXIF yet). The number slot stays blank. The three-cell strip: replay intro (replays the same intro), add to board (filled, inert until step 5), print (draws the PNG and hands it to the Web Share API when files are shareable, otherwise downloads it). × in the top bar is Cancel: it discards the card and returns to the Board.
- **Board in this step.** The empty state with the card count 0 in the top bar.

## Error handling

A status line under the card, in plain words, never a modal.

- Image cannot be decoded: "This photo format can't be shown here. Try a JPEG or PNG."
- Fonts fail to load before a PNG draw: draw with the fallback serif and say "Printed with a fallback font."
- Canvas allocation fails at the cap (phone memory): retry at half the width and say "Saved at a smaller size than full print resolution."

## Testing

- **Unit (Vitest)** in `packages/card`: layout numbers, format strings, the 4800 px cap and the scale it produces.
- **Equivalence (Playwright)** in `e2e/`: against the dev server's `/dev/card`, for portrait, landscape and square fixture photos, with and without the coords line and the number. Each case renders the Card component at a width equal to the PNG's pixel width (small fixtures, so the cap is not hit, with device scale factor 1), screenshots the card element, and screenshots the `<img>` the dev page fills with the PNG from renderPng, then diffs the two with pixelmatch. The tolerance is tuned on the first run to the DOM-versus-canvas text anti-aliasing difference and then frozen; a layout drift of one unit must fail it. This test is the enforcement of the "pixel-equivalent" rule.
- **Lint and types**: ESLint (Next's config) and `tsc --noEmit` across workspaces.

Fixtures are three small images (solid colour with a diagonal line, in portrait, landscape and square) made by a script in `e2e/fixtures` and committed; EXIF is not needed in this step.

## Root scripts

```
npm run dev        next dev in apps/web
npm test           vitest across workspaces
npm run test:e2e   playwright (starts the dev server itself)
npm run lint       eslint across workspaces
npm run typecheck  tsc --noEmit across workspaces
```

A single unit test: `npm test -w packages/card -- layout`. A single e2e case: `npx playwright test -g "landscape"`.

After the scaffold lands, CLAUDE.md's "State of the repo" section is replaced with these commands.

## Out of scope for this step

Variation textures and the border layer's content, EXIF reading, place resolution, numbering, accounts, storage, storyboards, prints, any server rendering, and the Add to board sheet. Each arrives at its step in SPEC.md's build order, one commit per step.
