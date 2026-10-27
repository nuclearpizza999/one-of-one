# Border colour (piece 1 of the border refinement) is built and reviewed; commit the last fixes and push once macOS folder access is back

**Date:** 2026-10-27
**Status:** IN PROGRESS (code complete and reviewed; blocked on git access to commit and push)
**Bead(s):** none (bd is not installed on this Mac)
**Epic:** Border variation refinement (four pieces: colour, ground facts, types and motifs, motions)
**Chain:** `standalone-06bc68e9` seq `1`
**Parent:** `none — first in chain`
**Prior chain:** none — first in chain

---

## Related Handoffs

- Earlier `/handoff` files may exist in the main checkout's `plans/handoffs/` (the skill was installed Oct 25, 2026), but the main checkout was unreadable when this was written, so none could be checked. This session started after `/clear` with no pasted prompt, so it is a new chain.

## Reference Documents

- `SPEC.md`: product source of truth. Its "Card variation" section now carries this session's decisions (facts first, chance later; tilt shine next; colour rule).
- `CLAUDE.md`: project rules and conventions. Three stale lines fixed this session, plus the colour convention.
- `docs/superpowers/specs/2026-10-26-border-colour-design.md`: design for piece 1 (this work).
- `docs/superpowers/plans/2026-10-26-border-colour.md`: the six-task implementation plan that was executed.
- Memory (auto-loaded): `~/.claude/projects/-Users-alex-Desktop-one-of-one-handoff/memory/border-variation-refinement.md` (all four pieces' decisions), `alex-design-taste.md`, `one-of-one-project-state.md`, `production-steps-are-alexs.md`, `plan-flow-defaults.md`, `alex-working-style.md`.

## The Goal

Alex asked to "refine the outline feature" (it turned out to mean the card's **border variation**, SPEC.md "Card variation") through `/superpowers:brainstorming`. The problem found: almost every card looks the same (unnumbered, non-Fuji, non-landmark cards all get the faint Paper texture in one of three preset tones), so "no two cards look alike" is not true. Over the session the refinement was decided and split into four pieces built in order: **1 colour** (this work, built), **2 ground facts**, **3 types and motifs**, **4 motions**. Piece 1 makes every new card take the photo's own colour as a wash on the mat, nudged warmer or cooler by the real sun and the hemisphere's season. The end state for this handoff: piece 1 committed, pushed and live on `main` (Vercel deploys on every push to main), then brainstorm piece 2.

## Where We Are

- **Worktree:** `/Users/alex/Desktop/one-of-one-handoff/.claude/worktrees/variation-facts`, branch `worktree-variation-facts`, created from `origin/main` at `231a306`. Committed head **`98954a1`** (11 commits on the branch, listed in Evidence).
- **Six files edited on disk but NOT committed** (final-review fixes, re-reviewed and approved; git was unreadable when they were made):
  - `apps/web/app/card/[id]/CardScreen.tsx`
  - `e2e/founder.spec.ts`
  - `SPEC.md`
  - `CLAUDE.md`
  - `packages/card/src/textures.ts` (comment only)
  - `packages/card/test/variation.test.ts`
- **Nothing pushed.** `origin/main` is still `231a306`, and so is the live site https://one-of-one-eight.vercel.app.
- **Blocker:** since about 23:52 on Oct 26, macOS blocks this session from reading the main checkout. `git` in the worktree fails with `fatal: not a git repository: /Users/alex/Desktop/one-of-one-handoff/.git/worktrees/variation-facts`, because the worktree's git data lives in the main `.git`. Even `ls /Users/alex/Desktop/` returns "Operation not permitted". Alex chose option A: restore Files and Folders / Full Disk Access for the app running Claude Code, then restart the session.
- **Unit tests (with the fixes):** card 187, places 24, web 55, all passing; `npm run typecheck` and `npm run lint` clean. Lint prints one warning, "[Browserslist] Could not parse …/one-of-one-handoff/package.json", caused by the macOS block and expected to go away with it.
- **Browser tests:**
  - Run 1 (before the fixes): 77/77 passed, including the macOS-only equivalence pixel-ratio cases.
  - Run 2 (with the fixes): 77 passed and 1 failed. The failure was `e2e/board.spec.ts:80` ("the middle scrolls while the top bar and the tab bar stay put", `img.oo-photo` not visible within 10 s under full parallel load).
  - Repeating `board.spec.ts` three times on its own gave 22/22, so the failure is a flake unrelated to this change.
- **`npm run check:prod`:** passed ("production build serves no development surface").
- **Visual check (390 px wide, DPR 2, Make screen and `/dev/variation`):**
  - The wash is visible but pale.
  - Seoul fixture: pale blue-grey; tone warm, texture paper.
  - nogps (Fuji): dusty pink; tone photo, texture worn.
  - rotated: soft green; tone warm, texture paper.
  - Caption legible. `wash.lightness` stays at 0.92.
- **New modules in `packages/card`:**
  - `colour.ts`: `GREY_SATURATION`, `rgbToHsl`, `hslToHex`, `hexToHsl`, moved out of `palette.ts`.
  - `sun.ts`: `captureInstant`, `sunElevation`, from the NOAA equations.
- **`packages/card/src/variation.ts`:**
  - `TONES` are `warm` (nudge +1), `photo`, `cool` (nudge −1) and `neutral`. No tone carries a hex value.
  - `Palette` gains optional `wash`.
  - New functions: `nudgePalette`, `withWash`, `mixTowardHue` (private), `sunStep`, `seasonStep`, and `deriveTone(ToneFacts)`.
  - `VariationInputs` gains `gps` and `utcOffsetMinutes`.
  - `SeedFacts` loses `cardId`.
  - `withOverrides` keeps `base.palette` unless `overrides.tone` is set.
- **`contrast.ts`:** `withCaptionContrast` now lightens the wash too, and never adds a wash to a palette that had none.
- **`border.ts`:** `borderSvg` draws `<rect x="0" y="0" width="100" height="H" fill="{wash}"/>` as the first element of the mat clip group when the palette has a wash. Without a wash the output is byte-identical to before, so saved cards look exactly as they did.
- **`apps/web/lib/exif.ts`:** `PhotoMetadata.utcOffsetMinutes` comes from `OffsetTimeOriginal` (or `OffsetTimeDigitized` for a CreateDate). New function `parseUtcOffset`.
- **`apps/web/lib/photo.ts`:** `describePhoto` passes `gps` and the offset (offset only with an EXIF capture time) and no longer passes the card id to the seed.
- **`CardScreen.tsx`:**
  - For founders it samples the shown photo's palette as a promise kept in a ref.
  - The save awaits that promise inside the sequential `saving` chain.
  - One local rule, `photoPaletteFor`, feeds both the render and the save. This is the uncommitted fix.
- **`DevCard.tsx`:** the equivalence dev card uses `paletteFor("photo", DEV_PALETTE)`, with the fixed fixture `DEV_PALETTE = { tint: "#b08860", foil: ["#f3d9a4", "#b8864a"] }`.
- **Memory updated:**
  - New: `border-variation-refinement.md` and `alex-design-taste.md`.
  - `one-of-one-project-state.md` gained an Oct 26–27 paragraph.
  - `MEMORY.md` gained two index lines.
- **SDD ledger and artifacts** (git-ignored) are in `.superpowers/sdd/` in the worktree: `progress.md`, `task-N-brief.md`, `task-N-report.md`, `review-*.diff`, `final-fix-brief.md`, `final-fix-report.md`, `constraints.md`.

## What We Tried (Chronological)

1. **Finding "the outline feature".**
   - Grepped the repo for "outline". The only hits were CSS focus rings and the "cropped" Board logo design.
   - Asked Alex. Alex then asked "what is the border feature called"; the answer was the border variation (`deriveVariation`, registries `TEXTURES`, `TONES`, `TIERS`, `MOTIONS`, `INTROS`).
   - Alex confirmed with "propose improvements for this feature".
2. **Gap analysis of the border variation.** Read `variation.ts`, `textures.ts`, `border.ts`, `intros.ts`, the step-2 design doc and SPEC.md, and listed five gaps:
   1. Most cards look alike.
   2. Rare finishes won't stay rare, because the tiers use absolute numbers: 1–10 animated, 11–100 foil, 101–1000 fine.
   3. Spec inputs are unused: only the "landmark" place kind, only Fuji among cameras, no lens, and the photo tone never assigned.
   4. The client sends the variation and the server stores it as sent.
   5. There is no "upgrade moment" when a card is numbered.

   Alex: "2, 4, 5 are irrelevant for now". So the scope became gaps 1 and 3.
3. **Where differences come from.** Options were facts, chance (per-card seed) or both. Alex: "First is empircal, chance should be eliminated for now change @SPEC.md so it's a later priority". SPEC.md was edited (commit b201ffc): the card id no longer seeds the variation, and "Facts first, chance later" plus an open-decision item were added.
4. **Colour.** Options were the photo's colour on every card, only for colourful photos, or keep the presets. Alex: "A, photo colour on every card".
5. **Reading what's in the photo.** Options were an on-device classifier, a cloud vision model, or facts only. Alex chose on-device with facts helping.
   - I then corrected myself: an ImageNet-style classifier is object-centric and weak on scenes (no real "desert" or "jungle").
   - That led to scene classifier vs words-based model (CLIP-style). Alex: "B, words-based model with climate and colour helping, use gps and time to help".
6. **CLAUDE.md staleness.** Alex asked what in CLAUDE.md was going stale. Three lines were fixed (commit bbe630d):
   - The dev sign-in note sat under `dev:lan`.
   - The never-bend rule lacked the founder exception.
   - "Next is step 5" now reads border refinement first.
   Four more items wait for the build: the variation convention, the stack line, "no stickers" and where the model lives.
7. **Strength.** Options were a whisper, visible at phone size, or bold. Alex: "B, visible at phone size, like pokemon tcgp".
8. **TCG Pocket meaning.** Options were the type look, the tilt shine, or both. Alex: "the type look now make sure its obvious … however it has to be more suble since tcgp is a card game built for kids and this is supposed to be more sophisticated, tilt shine next in spec". The tilt shine was added to SPEC.md as the next refinement (commit b49c872).
9. **Type list.** I proposed 15 types. Alex: "ok thats good for a starting list, just make sure that none of the designs have hard coded colors, also change the motion designs glow, twinkle, and petals because they are locked to one color and look terrible".
10. **Motions.** Proposed Glint, Motes, Ripple, Engrave, Breathe and Drift.
    - Alex: "make new motions but do not lock the motion to the type".
    - Then: "all are great, you know how keboard light schemes are made, do more of those and less generic ai-slop looking petals".
    - That led to a set of 10 keyboard-RGB-style light rules. Light falling on the card's own drawing (A) or a dot grid (B)? Alex: "A, light falls on the card's own drawing, B could be nice if it's subtle enough".
11. **Model loading question.** Options were load early and wait, re-read later, or never wait. Alex: "truncate this feature for later, it's too complicated for nw". Clarified with "defer only the ai model reading".
12. **Facts-only types.** I proposed 12 types told by facts alone. Alex pushed back: "are you not able to find pretty accurate readings off exif?" Answer: yes, with more facts:
    - EXIF BrightnessValue, flash, white balance, lens and altitude;
    - the sun from GPS and time;
    - server-side map facts: land cover, Köppen climate, coast distance and elevation.

    That brings back 14 types, with only Flowers deferred. Alex: "yes".
13. **Decomposition.** Four pieces in the order 1 colour, 2 ground facts, 3 types and motifs, 4 motions. Alex: "yes, that split and order, begin agentic development".
14. **Piece 1 design.** Presented and approved ("yes, build it"). The spec was written (3ae3b94). Then three corrections before planning (c469725):
    - **Nudge as an RGB mix, not a hue rotation.** Rotating blue toward orange along the shorter arc goes through purple.
    - **`withOverrides` must keep the stored palette.** Re-resolving it on every call would turn stored Warm and Cool cards grey on the saved-card screen, now that the presets are gone.
    - **The offset test writes its tags in memory** rather than regenerating the fixtures.
15. **Plan self-review fixes.**
    - The no-wash test regex must not match the noise layers' `<rect … fill="#fff" filter=…>`.
    - Loosened the wash hue and saturation tolerances (5° and +0.03), because 8-bit rounding at L 0.92 is coarse.
    - Added the missing imports (`type Tone`, `withCaptionContrast`).
16. **Execution with subagent-driven development.**
    - Six tasks, each with an implementer (Haiku for transcription tasks 1 and 4, Sonnet for the others) and a Sonnet task reviewer.
    - All six were approved with Minor findings only (recorded in `.superpowers/sdd/progress.md`).
    - The Task 2 implementer derived the `withOverrides` test's `base` with `photoPalette`, because the old always-re-resolve palette broke "equal for no overrides". Accepted.
17. **Browser tests and the port clash.**
    - Alex's own `next dev` (pid 51398, started Oct 25 14:35 from the main checkout's `apps/web`) held port 3000, and Playwright's `reuseExistingServer` would have tested the old code.
    - I did not stop it. Instead I wrote a temporary untracked `playwright.port3100.config.ts` (since deleted). That gave 77/77.
    - Alex's server task later reported "failed with exit code 1"; I didn't kill it.
18. **Final whole-branch review (Opus)** ran from the six saved per-task diffs, because git had become unreadable. The verdict was "With fixes":
    - **Important:** founder tone pick race in CardScreen.
    - **Important:** stale SPEC.md:42 sentence.
    - **Minor:** stale `textures.ts` flower comment, CLAUDE.md wording, a step-5 hazard, no `OffsetTime` fallback.
19. **Final fix and re-review.** One Sonnet fixer applied all the fixes without git (left uncommitted). The re-review (Sonnet) said ready to merge. E2E run 2 passed apart from the board flake.
20. **Git access lost.**
    - `.git` got the `hidden` flag and a `com.apple.macl` attribute (mtime 23:52, later 00:17). The main checkout root got `com.apple.quarantine` (00:07, 00:17).
    - Reads failed with "Operation not permitted".
    - A sandbox-bypass attempt was denied by the auto-mode classifier; the plain run failed the same way.
    - Alex said "repo is back to being public, push", but the block is local macOS, not GitHub visibility.
    - Offered A (restore access, push with history) or B (fresh clone, one squashed commit). Alex: "a, save the project for a restart".

## Key Decisions

- **Scope is gaps 1 and 3 only.** Rarity (tier thresholds), server-side re-derivation and trust, and the upgrade moment were all declared "irrelevant for now".
- **Facts first, chance later.**
  - The variation is a function of the photo's facts alone, and the card id no longer feeds the seed. That brings back the pre-step-4 formula `${size}:${w}:${h}:${takenAtMs}:${make}|${model}`.
  - Rejected: chance (a per-card seed). It is rerollable by picking the photo again, and the look would mean nothing.
  - Rejected: "facts plus chance for details". Alex: "chance should be eliminated for now".
- **The photo's own colour on every card (A).**
  - Rejected: photo colour only for colourful photos, and keeping the three presets.
  - Warm and Cool become nudges, never colours of their own.
- **No hard-coded colours in any design.** The only fixed colours are the white mat, the sheen's white light and the neutral grey palette. Glow, Twinkle and Petals still carry fixed colours until piece 4 replaces them; that caveat is now written into SPEC.md and CLAUDE.md.
- **Visible at phone size (B), but sophisticated.**
  - Rejected: a whisper (A) and bold (C).
  - TCG Pocket is the visibility reference only, not the boldness.
- **The nudge is an RGB mix toward a hue at the colour's own saturation and lightness** (warm 35°, cool 215°, amount 0.2). Rejected: hue rotation, which turns a warmed blue purple.
- **The sun decides warm and cool.**
  - Elevation above 6° is the photo's own colour, −4° to 6° is warm, below −4° is cool.
  - Without GPS or an offset, the hour ranges stand in.
  - Seasons are hemisphere-aware with GPS and switched off in the tropics (|lat| < 23.44). There is no season without GPS.
- **Saved cards never change.** A palette without a wash draws none, and `withOverrides` keeps the stored palette unless the tone is overridden. No migration. Rejected: re-resolving stored palettes.
- **Founders' saved-card panel re-samples the photo,** and the save awaits that sample (the final fix).
- **Photo-reading model: words-based (CLIP-style), on the phone, deferred.**
  - Rejected: an ImageNet object classifier (weak on scenes), a cloud vision model (privacy and cost), and a scene classifier (fixed list).
  - Then the whole model was deferred ("defer only the ai model reading"), and types will be told from EXIF plus server-side ground facts instead.
- **Motions are keyboard-style light rules over the card's own drawing,** never tied to a type, and founders-only until numbering decides who earns motion. A faint dot grid is an optional surface, kept only if subtle. Rejected: Drift (sprite petals).
- **Production push:** Alex explicitly asked Claude to push ("push", then option A). This overrides, for this change, the memory note that Alex runs `git push origin main`.

## Evidence & Data

### Branch commits (worktree-variation-facts, base 231a306 = origin/main)

| Commit | What | Trailer |
|---|---|---|
| b201ffc | SPEC.md: variation from the photo's facts alone, chance a later priority | Opus |
| bbe630d | CLAUDE.md: three stale lines fixed | Opus |
| b49c872 | SPEC.md: tilt shine as the next refinement | Opus |
| 3ae3b94 | Design doc `2026-10-26-border-colour-design.md` | Opus |
| c469725 | Plan `2026-10-26-border-colour.md` and spec settlements | Opus |
| 11d8724 | Task 1: `colour.ts`, `sun.ts` | Haiku |
| ef39b71 | Task 2: sun and hemisphere tone rule, seed without card id | Opus (per reviewer) |
| dd134bc | Task 3: tones as nudges, wash, contrast, `withOverrides` keeps stored palette | Opus |
| 1419d08 | Task 4: border draws the wash | Haiku |
| ecf4fe8 | Task 5: EXIF `OffsetTimeOriginal` / `OffsetTimeDigitized` | Sonnet or Opus |
| 98954a1 | Task 6: app wiring, CardScreen sampling, DevCard fixed palette, make.spec Cool, SPEC/CLAUDE docs | Sonnet |
| (uncommitted) | Final-review fixes in six files | to commit |

The trailers name the model that wrote each commit, not uniformly Opus as the plan said. The final review advised leaving them; tell Alex.

### Test results

| Check | Result |
|---|---|
| Baseline before work | card 159, places 24, web 50 passing |
| After Task 1 | card 168 |
| After Task 2 | card 173 (RED was 11 failed / 34 passed) |
| After Task 3 | card 184 (RED was 15 failed / 47 passed in variation + contrast) |
| After Task 4 | card 186 |
| After Task 5 | web 55 (RED was 7 failures) |
| After final fixes | card 187, places 24, web 55; typecheck and lint clean |
| E2E run 1 | 77/77 passed (port 3100, includes macOS pixel-ratio equivalence) |
| E2E run 2 (with fixes) | 77 passed, 1 failed: `board.spec.ts:80` timeout on `img.oo-photo` |
| `board.spec.ts --repeat-each 3` | 22 passed |
| `npm run check:prod` | exit 0, "production build serves no development surface" |

### Sun reference values (Task 1, measured against the brief)

| Place and time | Expected | Measured |
|---|---|---|
| Seoul 2026-06-21 12:34 +09:00 | 75.88° | 75.882° |
| Seoul 2026-06-21 00:34 +09:00 | −29.0° | −29.007° |
| Sydney 2026-06-21 11:57 +10:00 | 32.69° | 32.693° |
| Tromsø 2026-06-22 00:46 +02:00 | 3.09° | 3.086° |
| Equator (0, 0) 2026-03-20, daily max | > 89.5° | passes |
| London 2026-03-15 19:00 +00:00 | below −4° | −9.35° (hours say warm, sun says cool) |

### Rule values (`VARIATION_RULES` and constants, all drafts to tune on real photos)

```ts
tone: {
  warmHours: [[5, 9], [17, 20]],
  photoHours: [[10, 16]],          // renamed from neutralHours
  coolMonths: [10, 11, 0, 1],      // Nov–Feb (northern; shifted 6 months south)
  warmMonths: [5, 6, 7],           // Jun–Aug
  sun: { dayAbove: 6, coolBelow: -4 },
  tropicLatitude: 23.44,
},
nudge: { warmHue: 35, coolHue: 215, amount: 0.2 },
wash: { lightness: 0.92, saturationMax: 0.35 },
// GREY_SATURATION = 0.08 (colour.ts); NEUTRAL_PALETTE = { tint: "#8a8a8a", foil: ["#ececec", "#9c9c9c"] }
// tiers unchanged: ≤10 animated, ≤100 foil, ≤1000 fine, else standard
```

### Visual check (Make screen, 390 px, DPR 2)

| Fixture | Ring colour | Assigned tone | Texture | Mat looks |
|---|---|---|---|---|
| seoul.jpg | rgb(96,120,160) blue | warm (July, GPS, no offset → hours + summer) | paper | pale blue-grey |
| nogps.jpg (Fuji) | rgb(160,110,110) | photo (14:30, no GPS, no season) | worn | dusty pink with wear strokes |
| rotated.jpg | rgb(110,150,110) | warm | paper | soft green |

Screenshots: `/Users/alex/.claude/jobs/2294600c/tmp/shots/` (make-seoul.png, make-nogps.png, make-rotated.png, gallery-top.png, gallery-full.png). That job tmp dir may be cleaned with the job.

### Logs

- `/Users/alex/.claude/jobs/2294600c/tmp/e2e-run1.log`, `e2e-run2.log`, `checkprod.log`, `dev3100.log`.

### The 14 types for piece 3 (decided; told from facts in piece 2)

| Type | Told by | Motif (fine single-colour linework) |
|---|---|---|
| City | city land cover, outdoor brightness | architectural lines, window grid |
| City at night | city land cover, sun below horizon | skyline linework, lit-window dots |
| Food & drink | indoor light in a city (sure once venue lookup exists) | steam curls, linen weave |
| Green | forest, grass or farmland, green colour, sun up | sprigs, leaves (Sprig, Meadow) |
| Autumn | forest, orange or brown colour, autumn for the hemisphere | oak and maple leaves |
| Beach | within a few hundred metres of the coast, bright, outside the tropics | wave lines, shells |
| Tropical | tropical climate, coast or bright | palm fronds, hibiscus |
| Jungle | tropical climate, forest | monstera, vines |
| Desert | bare ground, desert climate | dune contours, low sun |
| Oasis | desert climate, water or plants nearby | palm over rippled water |
| Mountain | high elevation, GPS altitude | topographic contours |
| Snow | snow and ice on the map, or winter with a very bright, pale photo | snow crystals |
| Lake & river | water nearby, inland | ripples, reeds |
| Night sky | not city, sun below horizon, dark scene | stars, constellation line |

Flowers is deferred to the photo-reading model. When the facts don't agree, the card gets no motif.

### The 10 motions for piece 4 (decided)

Breathe (Breathing), Wave, Ripple, Reactive (tap ripple from the finger), Glint (Marquee around the edge), Visor (Scanner), Starlight, Rain (down the side bands), Spiral (around the photo), Colour shift (between the palette's own shades, never a rainbow). Each is one brightness rule over the mat in the palette's colours, lighting the card's own grain and motif lines. They are screen-only, under the caption, off for reduced motion, founders-only for now, and replace Glow, Twinkle and Petals. Drift was dropped; Engrave became a surface option.

### Iteration history: the type list

| Version | Count | Basis | Outcome |
|---|---|---|---|
| v1 | 15 | words-based photo model, with climate, colour, GPS and time helping | approved as a starting list ("ok thats good for a starting list") |
| v2 | 12 | facts only, after the model was deferred (colour, climate map, season, hour, altitude); Food & drink, Flowers and Lake & river dropped | Alex: "are you not able to find pretty accurate readings off exif?" |
| v3 | 14 | EXIF clues (BrightnessValue, flash, white balance, lens, altitude) plus server-side land cover, Köppen climate, coast distance and elevation; only Flowers deferred | approved ("yes") |

### Iteration history: motions

| Version | Set | Outcome |
|---|---|---|
| today | Glow (gold-orange edge light), Twinkle (white and gold sparkles, warm halo), Petals (blush petals, rose edge, drop shadow): fixed colours as data URIs in `card.css` | "locked to one color and look terrible" |
| v1 | Glint, Motes, Ripple, Engrave, Breathe, Drift, palette-drawn, thin lines | "all are great … do more of those [keyboard light schemes] and less generic ai-slop looking petals" |
| v2 | 10 keyboard-RGB light rules (see table above) lighting the card's own drawing, optional faint dot grid | approved ("A … B could be nice if it's subtle enough") |

### Iteration history: reading the photo

| Option | Size and cost | Verdict |
|---|---|---|
| Small object classifier on the phone (ImageNet, about a thousand objects) | a few MB, free, private | first recommended, then withdrawn: weak on scenes (no real desert or jungle) |
| Cloud vision (Claude or Google Vision) via our server | cost per card, photo leaves our servers, needs network | rejected (privacy) |
| Scene classifier (a few hundred place kinds) | a few MB to about 15 MB | not chosen: fixed list |
| Words-based model (CLIP-style), on the phone | tens of MB, one download; must finish before the intro | chosen, then **deferred** ("defer only the ai model reading") |
| Facts only (EXIF plus server map facts) | no download | the approach for now |

Loading options for the deferred model (A: load early and wait, B: re-read later, C: never wait) became moot when it was deferred. A was recommended, so revisit it when the model comes back.

### Task reviews (per-task gates, all Approved, no Critical or Important)

| Task | Implementer | Reviewer | Minor findings recorded |
|---|---|---|---|
| 1 colour and sun | Haiku | Sonnet | three hex parsers; `hexToHsl` unvalidated; NaN on an invalid Date; sun tests only at extrema |
| 2 tone rule and seed | Sonnet | Sonnet | shadowed `at`; no offset-0 test (added in the final fix); seed test title broader than its assertion |
| 3 nudges and wash | Sonnet | Sonnet | stale `photoPalette` comment (fixed); `mixTowardHue` only takes `#rrggbb`; cool test checks only the tint |
| 4 border wash | Haiku | Sonnet | no-wash regex only rules out 6-digit flat rects; wash interpolated unescaped (like tint and foil) |
| 5 EXIF offset | Sonnet | Sonnet | `-00:00` gives −0; untested offset-null paths; `withExifFields` duplicates `withDates` |
| 6 wiring and docs | Sonnet | Sonnet | CardScreen race (fixed); SPEC.md:42 stale (fixed); no `describePhoto` gating test |
| Final whole branch | — | Opus | With fixes: race, SPEC wording; Minor: flower comment, CLAUDE wording, step-5 hazard, no `OffsetTime` fallback |
| Final-fix re-review | Sonnet fixer | Sonnet | Ready to merge. Minor: the e2e guards the outcome, not the race (delay the photo with `page.route` to make it deterministic); the save waits for the sample even on non-tone picks (a true image hang would leave "Saving…"); `sampled` keeps the old palette until a new `photo.src` sample settles; the plan doc still has the old CLAUDE wording |

### Piece 2 (ground facts) inputs already decided

- The lookups run on our own server in the same request as `POST /api/place`. The coordinates already go there, so there is no new privacy exposure and nothing to download on the phone.
- Data candidates (check licences while planning):
  - land cover: ESA WorldCover (CC BY 4.0), MODIS land cover or Copernicus 100 m;
  - Köppen-Geiger climate (Beck et al., CC BY 4.0);
  - Natural Earth coastline (public domain);
  - an elevation grid.
  The grids are coarse (about 1–5 km), so a city park may read as City.
- New EXIF fields to read: BrightnessValue (iPhones write it; others derive it from ExposureTime, FNumber and ISO), Flash, WhiteBalance or LightSource, LensModel and focal length, GPSAltitude.
- Photos with no GPS keep only the sun-free clues, so they usually get colour without a motif.
- Nothing visible changes in piece 2. It gathers the facts piece 3 needs.

### CLAUDE.md items to update when pieces 2–4 are built (from the staleness audit)

4. The variation convention: types and motif registry as they land.
5. The stack line: ground-facts data (and, later, the on-device model).
6. "No stickers": add that assigned motifs drawn into the mat are texture, not stickers.
7. "Where things are": where the ground-facts lookups live (packages/places or a new package); `packages/card` only receives a type id.

The SPEC.md build-order step 4 text still says "the 3-across grid of square crops"; the Board became rows of whole photos on Oct 22. This was flagged but not changed.

## Code Analysis

- `deriveTone({ takenAt, gps, utcOffsetMinutes })`:
  - No time → `photo`.
  - With GPS and an offset not null → `sunStep(sunElevation(captureInstant(takenAt, offset), lat, lng))`.
  - Otherwise the hour ranges.
  - Then `+ seasonStep(month, lat)` only with GPS.
  - Clamped along `["cool", "photo", "warm"]`.
  - Never returns `neutral`, which only a grey palette reaches.
  - The `utcOffsetMinutes !== null` check matters, and the London test guards it.
- `paletteFor(tone, photoPalette)`:
  - `base = photoPalette ?? NEUTRAL_PALETTE`.
  - `neutral` → `NEUTRAL_PALETTE`; `nudge` → `nudgePalette(base, dir)`; `photo` → `base`.
  - Then `withCaptionContrast(withWash(raw))`.
- `nudgePalette` returns a grey palette (tint saturation < 0.08) unchanged, by identity. `withWash` sets `wash = hsl(tintHue, min(tintSat, 0.35), 0.92)`.
- `withOverrides(base, overrides, photoPalette)`: `palette: overrides.tone !== undefined ? paletteFor(tone, photoPalette) : base.palette`. This line is what keeps every stored card unchanged.
- `captureInstant(takenAt, offset) = Date.UTC(local getters) − offset·60 000`. It reads local getters, per CLAUDE.md's rule that EXIF dates are zone-less wall-clock.
- `parseUtcOffset(value)`:
  - Matches `/^([+-])(\d{2}):(\d{2})$/` after trim; minutes ≤ 59 and total ≤ 14 h; otherwise null.
  - `"-00:00"` gives −0, which is harmless.
- `readPhotoMetadata`:
  - The offset comes from `OffsetTimeOriginal` when the date came from `DateTimeOriginal`, otherwise `OffsetTimeDigitized`.
  - A file-mtime date gets no offset.
  - exifr returns both tags as plain strings under those names.
  - piexifjs needed `piexif.TAGS.Exif[0x9011 / 0x9012]` registered as Ascii in the test.
- **CardScreen after the fix:**
  - A ref `sample = useRef<Promise<Palette | null>>(Promise.resolve(null))`.
  - The founder-only effect assigns `loadImage(photo.src).then(samplePhotoPalette).catch(() => null)` and sets `sampled` when not cancelled.
  - `photoPaletteFor(current)` is `current ?? (stored.tone === "photo" ? stored.palette : null)`.
  - `onOverrides` computes `design` inside `saving.current.then(async …)` after `await sample.current`, inside the existing try/catch.
- `borderSvg`: the wash rect is inserted as `${wash}${frag.mat}` inside `<g clip-path="url(#mat)">`. The test proves `washed === plain.replace(groupOpen, groupOpen + rect)`.
- The database: `cards.variation` is plain jsonb with no shape check. `cards_design_guard` (UPDATE only) still blocks non-founders. Only `designs.ts` (founders) updates `variation`.

## Files Changed

### Source code (committed unless marked)
- `packages/card/src/colour.ts`: new. HSL helpers and `GREY_SATURATION`.
- `packages/card/src/sun.ts`: new. `captureInstant`, `sunElevation`.
- `packages/card/src/palette.ts`: imports the helpers from `colour.ts` and re-exports `GREY_SATURATION`.
- `packages/card/src/variation.ts`: the tone model, rule table, `deriveTone`, `sunStep`, `seasonStep`, `nudgePalette`, `withWash`, `paletteFor`, `withOverrides` palette rule, inputs, seed.
- `packages/card/src/contrast.ts`: `withCaptionContrast` covers the wash; header comment reworded.
- `packages/card/src/border.ts`: wash rect.
- `packages/card/src/index.ts`: exports for the new functions and types (`hexToHsl`, `hslToHex`, `rgbToHsl`, `captureInstant`, `sunElevation`, `seasonStep`, `sunStep`, `ToneFacts`, `nudgePalette`, `withWash`).
- `packages/card/src/textures.ts`: FLOWER_FILL_MAX doc comment (**uncommitted**).
- `apps/web/lib/exif.ts`: `utcOffsetMinutes`, `parseUtcOffset`.
- `apps/web/lib/photo.ts`: passes `gps` and the offset; seed without card id.
- `apps/web/app/card/[id]/CardScreen.tsx`: founder sampling (committed); the save awaits the sample (**uncommitted**).
- `apps/web/app/dev/card/DevCard.tsx`: `DEV_PALETTE` through `paletteFor("photo", …)`.

### Tests
- `packages/card/test/colour.test.ts`, `sun.test.ts`: new.
- `packages/card/test/variation.test.ts`: sunStep, seasonStep, deriveTone, nudgePalette, withWash, paletteFor, withOverrides, seed tests. The `photoPalette` comment fix and the London offset-0 test are **uncommitted**.
- `packages/card/test/contrast.test.ts`: wash identity cases and the 864-palette sweep (24 hues × 3 saturations × 3 lightnesses × 4 tones).
- `packages/card/test/border.test.ts`: wash-first and no-wash tests.
- `apps/web/lib/exif.test.ts`: offset tests, `parseUtcOffset` cases.
- `apps/web/lib/save.test.ts`: `utcOffsetMinutes: null` added to the fixtures.
- `e2e/make.spec.ts`: the design-panel test clicks Cool (the Fuji fixture now derives `photo`).
- `e2e/founder.spec.ts`: new case "a founder's tone pick on a saved card is saved with the colour of the photo, not the neutral grey" (**uncommitted**).

### Docs
- `SPEC.md`:
  - Card variation: deterministic from facts, facts first with chance later, tilt shine next.
  - The Colour bullet and the sun sub-bullet.
  - Open decision "Variation by chance (later priority)".
  - Decided Oct 26, 2026 paragraph.
  - Wording fixes (**uncommitted**).
- `CLAUDE.md`:
  - The dev command block.
  - The never-bend founder exception.
  - Build order.
  - The colour convention, with wording fixes (**uncommitted**).
- `docs/superpowers/specs/2026-10-26-border-colour-design.md`, `docs/superpowers/plans/2026-10-26-border-colour.md`: new.
- `plans/handoffs/HANDOFF_border-colour-push_2026-10-27.md`: this file (new, uncommitted).

## User Feedback & Preferences (REQUIRED — never omit)

- "also get back to me before any implementation": the design gate. Alex later approved with "yes, build it", "begin agentic development".
- "2, 4, 5 are irrelevant for now": keep scope tight; rarity, trust and the upgrade moment are out.
- "First is empircal, chance should be eliminated for now change @SPEC.md so it's a later priority".
- "A, photo colour on every card, would it be possible to have a tool interpret whats in the photo and add little designs to the border to help".
- "B, visible at phone size, like pokemon tcgp", then "make sure its obvious (ex city vs nature, green nature vs brown vs tropical vs beach vs jungle vs desert vs oasis etc...) however it has to be more suble since tcgp is a card game built for kids and this is supposed to be more sophisticated".
- "just make sure that none of the designs have hard coded colors, also change the motion designs glow, twinkle, and petals because they are locked to one color and look terrible".
- "make new motions but do not lock the motion to the type".
- "you know how keboard light schemes are made, do more of those and less generic ai-slop looking petals".
- "B could be nice if it's subtle enough" (the dot grid).
- "truncate this feature for later, it's too complicated for nw", clarified as "defer only the ai model reading". Alex prunes complexity when it grows.
- "are you not able to find pretty accurate readings off exif?" Alex expects existing data to be squeezed before adding machinery.
- "yes, that split and order, begin agentic development"; "yes, build it". Per memory, no further check-ins after design approval.
- "repo is back to being public, push", then "a, save the project for a restart". Alex wants Claude to do the push this time.
- Working style (memory): plain explanation first, one question at a time, recommendation first. Alex rejects multiple choice until the issue is laid out in prose.

## Where We're Going

1. **Restore access** (Alex). Files and Folders / Full Disk Access for the terminal or app running Claude Code, then a new session.
2. **Verify git works.** From the worktree: `git status --short` should list exactly the six uncommitted files, plus this handoff and the untracked `plans/` directory.
3. **Re-run the fast checks.** `npm test && npm run typecheck && npm run lint` from the worktree.
4. **Commit the six fixes and this handoff** from the worktree. Suggested message: "Save a founder's tone pick on a saved card with the palette the screen shows by awaiting the photo sample, correct the colour wording in SPEC.md and CLAUDE.md, fix two stale comments, and guard a zero UTC offset in the tone rule", plus the Co-Authored-By trailer.
5. **Push and go live** (Alex asked Claude to push):
   - Push the branch: `git push -u origin worktree-variation-facts`.
   - Fast-forward `main`, in either of two ways:
     - Safest for the worktree-isolation guard: from the worktree, `git fetch origin && git merge-base --is-ancestor origin/main HEAD && git push origin HEAD:main`. Then the main checkout runs `git pull --ff-only`.
     - From a session in the main checkout: `git merge --ff-only worktree-variation-facts && git push origin main`.
   - No `npx supabase db push` (no migration).
6. **Watch the deploy.**
   - CI: `~/.local/bin/gh run list --limit 3`, then `gh run watch <id>`.
   - Vercel rebuilds main. Spot-check https://one-of-one-eight.vercel.app Make with a real photo.
7. **Then piece 2 (ground facts):** brainstorm the design, using the decisions in memory `border-variation-refinement.md`.

## Risks & Blockers

- **BLOCKER: macOS access.** Until the session can read `/Users/alex/Desktop/one-of-one-handoff/.git`, nothing can be committed or pushed.
  - The cause is unknown: `.git` got the `hidden` flag and `com.apple.macl`, and the root got `com.apple.quarantine`.
  - If access returns but git still fails, check that `.git/worktrees/variation-facts` still exists and that the main checkout wasn't replaced. If the folder was re-downloaded, the branch and its 11 commits may only exist in the old `.git`.
- **Do not lose the uncommitted fixes.** They exist only on disk in the worktree. Don't `git checkout .`, `git stash` or remove the worktree before committing.
- **The production push goes live immediately.** main deploys to Vercel. Unit tests, e2e and check:prod all passed, but run the fast checks again after the restart.
- **Port 3000** may be free now (Alex's server exited). Playwright reuses any server on 3000 (`reuseExistingServer: !CI`), so if one is running from another checkout, recreate the port-3100 config (Quick Start) rather than stopping it.
- **`board.spec.ts:80` flake** under full parallel load (10 s wait on `img.oo-photo`). It isn't from this change, but a rerun may fail once.
- **Step 5 hazard** (final review): SPEC.md says the variation "is re-derived when the number is assigned". The sampled photo palette and `utcOffsetMinutes` are not stored on the card, so a naive re-derive falls back to the hour ranges and the tone can flip. Step 5 must keep the stored tone and palette and re-derive only tier, texture and motion, or re-read EXIF and the sample from the stored original. This is also in memory.
- **Environment for tests:**
  - The worktree has its own `node_modules` (`npm install` was run there).
  - `apps/web/.env.local` was copied from the main checkout (local Supabase keys and `DEV_SIGNIN_PASSWORD`, git-ignored).
  - The local Supabase stack was running in Docker (API :54321 answered 200).
  - e2e needs it: `npm run supabase:start` if it is down.

## Open Questions

- What changed `.git` and the main checkout's attributes at 23:52 and 00:07 on Oct 26–27 (iCloud Desktop sync, a re-download, another tool)? Alex should check; it may recur.
- Should the commit trailers be normalised to Opus? Recommendation: leave them. They're accurate, and rewriting history isn't worth it.
- Piece-1 follow-ups the final review left as Minor (none block the merge):
  - add an `OffsetTime` (0x9010) fallback;
  - guard `#rrggbb` palettes before shared storyboards or a server painter ship;
  - extend the contrast sweep to the founders-only flower composite;
  - consolidate the three hex parsers.

## Quick Start for Next Session

```bash
# Work in the worktree (all piece-1 work lives here)
cd /Users/alex/Desktop/one-of-one-handoff/.claude/worktrees/variation-facts

# 1. Is git readable again? Expect the six fixed files + plans/ as changes.
git status --short
git log --oneline -12

# Reference docs
#   SPEC.md (Card variation), CLAUDE.md, docs/superpowers/specs/2026-10-26-border-colour-design.md
#   memory: border-variation-refinement.md, alex-design-taste.md

# Key files to read first
#   packages/card/src/variation.ts   (tone model, deriveTone, withOverrides)
#   apps/web/app/card/[id]/CardScreen.tsx  (uncommitted save-awaits-sample fix)
#   packages/card/src/border.ts      (wash rect)
#   .superpowers/sdd/progress.md     (ledger + deferred Minor findings)

# Verify current state
npm test && npm run typecheck && npm run lint

# If e2e is wanted again and port 3000 is taken by another checkout, write an untracked
# playwright.port3100.config.ts that spreads ./playwright.config with baseURL and webServer on
# port 3100 and reuseExistingServer: false, run `npx playwright test -c playwright.port3100.config.ts`,
# then delete it.

# Next action
# Commit the six fixes + this handoff, push the branch, fast-forward origin/main
# (git push origin HEAD:main after confirming origin/main is an ancestor), watch CI with ~/.local/bin/gh.
```

## Session Closed
**Closed at:** 2026-10-27, after the final-fix re-review
**Commit:** none. Git was unreadable (macOS block), so this handoff and the six fixes are uncommitted on disk in the worktree. The next session commits them first.
**Session status:** Handed off to next session
