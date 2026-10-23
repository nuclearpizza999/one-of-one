# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# One of One

A photo becomes a numbered Polaroid-style card: place, date and coordinates read from EXIF, a number counting the public cards made at that place. Private board, storyboards shared by link, prints. No feed, no likes, no editing of the card.

Read `SPEC.md` before any design or architecture decision. It is the source of truth; this file carries only the rules that must hold in every session and what the spec does not say about the files in this repo.

## Commands

npm workspaces on Node 24. Install once with `npm install` and `npx playwright install chromium`.

```
npm run dev                              Next dev server at http://localhost:3000 (apps/web)
                                         on a phone on the same Wi-Fi: http://<this Mac's LAN IP>:3000 (next.config allows private-range origins in dev)
npm test                                 Vitest unit tests in every workspace
npm test -w packages/card -- layout      one unit test file (substring filter on the file name)
npm test -w packages/places -- resolve   one places test file
npm run test:e2e                         Playwright; starts the dev server itself
                                         (needs the local Supabase stack: `npm run supabase:start` once, then `npm run supabase:env`)
                                         (reusing a running dev server? start it with DEV_PHOTOS_DIR=apps/web/public/dev, or stop it first)
npx playwright test -g "landscape"       one e2e case by title
npm run lint                             ESLint (Next config) in apps/web
npm run typecheck                        tsc for e2e, packages/card, packages/places and apps/web
npm run fixtures                         regenerate apps/web/public/dev/* (PNG fixtures, then EXIF JPEG fixtures)
npm run check:prod                       production build, then prove /dev/*, /api/dev/* and the Make dev panel are absent
npm run supabase:start                   local Supabase stack (needs Docker): API :54321, Postgres :54322, Mailpit :54324
npm run supabase:env                     write apps/web/.env.local from the running local stack
npm run supabase:reset                   reapply supabase/migrations to the local stack
npm run supabase:test                    pgTAP tests in supabase/tests against the local stack
```

`e2e/equivalence.spec.ts` is the enforcement of the screen-equals-print rule: it diffs the DOM card against the PNG on `/dev/card` and fails on a one-unit drift. `CARD.baselineFromBottom` in `packages/card/src/layout.ts` was measured by it and is frozen; change it only by re-measuring. Its pixel-ratio cases run on macOS only and are skipped on CI (Linux renders text edges differently); run `npm run test:e2e` on the Mac before merging any change to the card.

## Where things are

- `packages/card` is the renderer, with no app imports. `layout.ts` is the single source of card geometry; `Card.tsx` paints it in DOM and `renderPng.ts` paints it on canvas. Fonts ship in `fonts/` and are declared in `src/card.css`.
- `packages/places` is place resolution, no app imports: `data/` holds the prototype's 28 landmarks and 10,379 cities as JSON (regenerate with `npm run extract -w packages/places`); `resolvePlace()` runs SPEC.md's tiers; venue and neighborhood go through the `PlaceProvider` interface, stubbed until a places API is wired. The app calls it only through `POST /api/place`, with the coordinates in a JSON body, so they never enter a URL, an access log, or any server but ours.
- `apps/web` is the Next.js App Router app: chrome components in `components/`, screens under `app/`, `/dev/card` a dev-only route for the equivalence test.
- `supabase/` holds the schema (`migrations/`), the local stack's settings and the sign-in email template; `supabase test db` runs the pgTAP files in `supabase/tests/`.
- `apps/web/proxy.ts` is the sign-in wall; `apps/web/lib/supabase/` holds the browser and server clients and the public-path rule; `lib/save.ts` is the one place a card is written; `lib/print.ts` is the one print path (Make and the opened card).
- Development-only surfaces, absent from production builds: the variation panel under the card on Make (switch intro, texture, tone, tier, motion, border on print), `/dev/variation` (every photo in the git-ignored `dev-photos/` folder, or a picked one, under every texture), `/api/dev/photos`, and `/dev/card` for the equivalence test. `npm run check:prod` proves they do not ship.
- Build order from SPEC.md: steps 1 (renderer and shell), 3 (metadata), 2 (variation) and 4 (accounts and the board) are done. Next is step 5 (Add to board sheet and numbering). Decisions and plans so far are under `docs/superpowers/`.

## Reference material

- `SPEC.md`: product, card geometry, variation, metadata pipeline, numbering, screens, chrome design system, data model, privacy, build order, open decisions, and what was decided on Oct 21, 2026.
- `prototype/one-of-one.html`: working Make screen. Port the card CSS, `renderPrint()`, `placeFor()`, `fmtDate()`, `fmtCoords()` and the `INTROS` registry with its three CSS classes. Do not port its page chrome, its intro picker, `nextNumber()` (localStorage counting) or the `claude.use("downloads")` save path.
- `screens/`: fourteen HTML mockups (seven screens, light and dark). Open them in a browser for layout, spacing and icons. They match SPEC.md as of Oct 21, 2026.

### Reading the prototype

- It is 410 lines but 416 KB: line 171 is `const CITIES`, a single 397 KB line. Never cat or Read the whole file. Use `sed -n` ranges or `awk 'length($0) < 400'`, and grep inside `CITIES` if you need it.
- Where things are: card and intro CSS at lines 35 to 118; `LANDMARKS` and `INTROS` at 173 to 210; `placeFor()` at 220; `fmtDate()` and `fmtCoords()` at 236 to 239; `renderPrint()` at 361 to 387.
- Screen and print share one geometry. On screen the card is a CSS block inside `.frame { container-type: inline-size }` and every dimension is in `cqw`. In `renderPrint()` the same numbers are px per 1% of width: `W = photoW / 0.90`, `u = W / 100`, mat `5u`, strip `19.2u`, type `3.4u`, inset `3u`, bottom `3.6u`. The last caption line's baseline is `H - 3.6u - fs * 0.28`. The place line is clipped with `text-overflow` on screen and with `fillText`'s `maxWidth = 0.72 * photoW` on canvas. When porting, derive both from one table.
- The print has no hairline and no shadow. On screen they come from `--edge` and `--shadow`, and the dark theme sets `--edge` to black so the hairline disappears.
- The prototype's chrome colors (grey wall, warm off-white ink) predate the spec's chrome tokens. Take chrome colors from SPEC.md and the mockups, never from the prototype.

### Reading the mockups

- Each file is a self-contained 390 × 844 phone frame with inline styles; there is no shared stylesheet. Light and dark twins differ only in ground, ink, muted and rule colors.
- Navigation as linked: Make → Add to board (a sheet over Make) → Board. Make → Print. Storyboard → Shared card, which is what a link opens and has no tab bar, → Guide (phase two). Storyboard's back arrow returns to Board, but the Board mockup has no link into a storyboard; SPEC.md says storyboards are reached from the Board. Decided Oct 22, 2026, after the mockups: Add to board on Make saves privately and returns to the Board; the sheet opens from the opened card; the Board is rows of whole photos, not the mockup's square grid.
- The mockup cards size the photo in fixed px with `object-fit: cover` so the frames line up, and the Board mockup is a square grid. Both are mockup shortcuts. Nothing in the product crops a photo; take card geometry from the table in SPEC.md, the Board rows from SPEC.md's Screens table, and only the chrome from the mockups.
- The `aria-label` text on the mockups' icon-only controls is the vocabulary to reuse: Make, Board, Cancel, Back, Replay intro, Add to board, Print, Add cards, Copy share link, Order print, Location shown as, Directions to <venue>.

## Rules that never bend

- The card's layout and type are immutable. No filters, fonts, stickers, layouts or user-chosen borders. Only the derived border variation and intro differ between cards, and users never pick them.
- Card dimensions are percentages of card width (see the table in SPEC.md). One shared layout function feeds the screen painter and the print painter. Pixel-equivalent means a screenshot diff of the two passes within a small tolerance for text anti-aliasing; a one-unit layout drift fails it.
- The photo is never cropped. The Board and Storyboard rows show it whole at a shared row height; the card shows it whole everywhere else.
- The card number is assigned server-side in one transaction when a card goes public: one per card, next in sequence for that place, never reissued, never computed on the client.
- Chrome is icons first; words only where an icon would be ambiguous (place and venue names, numbers, size, paper, Plain / Border, Area / City, storyboard titles). Every icon-only control has an aria-label.
- The tab bar has three slots: Board, empty, Make. The middle slot is reserved for Guide in phase two. There is no map.

## Stack (web first, decided Oct 21, 2026; the rest as suggested in SPEC.md)

Next.js app, Postgres with PostGIS, object storage for photos, `exifr` for EXIF in the browser, a places and geocoding API for venue and neighborhood lookup.

## Conventions

- Keep the card renderer as a standalone package with no app imports, so the Make screen, the PNG export and any future server painter share one code path.
- Fonts: EB Garamond 600 for the card caption only (400 for the coordinates line); Archivo 500 for app chrome.
- Light and dark themes change the wall and chrome only; the card is identical in both.
- An EXIF date is wall-clock at capture with no zone. exifr builds the `Date` from its components in the device's zone and `fmtDate` reads local getters, so the card shows the date the camera recorded. Never convert to UTC. When a capture date is persisted (step 4), store the wall-clock as a zone-less string or the caption text, never `toISOString()`, which would shift the day across UTC.
- Precision is stored as `city` or `neighborhood` (data model) and shown as City or Area (chrome). Keep each vocabulary on its own side.
- Prefer a short status line in plain words over modal errors when metadata is missing.
- Variation is assigned by `deriveVariation` from the photo's facts; users never pick it. Everything that varies is a registry entry in `packages/card` (`TEXTURES`, `TONES`, `TIERS`, `MOTIONS`, `INTROS`): add there, never in the panel, the gallery or the tests, which read the registries. The rule table `VARIATION_RULES` is a first draft until textures have been judged on about 50 real photos.
- Development-only controls render only when `process.env.NODE_ENV !== "production"` and must never ship; `npm run check:prod` is the proof.
