# Founder Design Panel and New Designs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The two founders can restyle their own cards on the live site (intro, texture, tone, finish, motion, border on print), on Make and on saved cards, with the picks saved; and the design registries gain flower-pattern textures, new intros and new motions.

## Design (decided with Alex on Oct 24, 2026)

- **The product rule stays:** for everyone else, the variation is assigned and never chosen. Only founders get the panel. Alex: "allow me and my co-founder to just edit however we want"; the customer-facing customization question is for the final product.
- **Founder is a database flag** on `public.users` (`is_founder boolean not null default false`), set only by an operator with SQL; no policy lets a user change it. Alex's account (heyalex918@gmail.com) is set after the hosted migration; the co-founder's address comes later.
- **The panel ships to production** but renders only for a founder (and in development builds, as now, for everyone). Its strips: Intro, Texture, Tone, Tier, Motion, Border on print, built from the registries as now, with an Assigned cell per strip. It shows the assigned variation's line as now.
- **On Make**, a founder's picks are what Add to board saves (variation and intro) and what Print draws.
- **On a saved card**, a founder sees the same panel under the card's strip; each pick is written to the card row at once and the status line says "Saved." (or "Couldn't save the design. Try again."). "Assigned" there means the design the card was saved with when the screen opened.
- **The database enforces it:** an update to a card's `variation` or `intro` by anyone but a founder is refused (a trigger, alongside the existing publication guard). Inserts are unchanged (the phone builds the row).
- **New designs:** four flower-pattern textures (Daisy, Meadow, Bloom, Sprig), three new intros (Fade, Slide, Drop) and three new motions (Glow, Twinkle, Petals). None of them enters assignment: textures and motions are only reached through `VARIATION_RULES` and `TIERS`, which do not change; intros gain an `assignable` flag and `assignIntro` picks only among assignable ones (the existing three), so every existing seed keeps its intro.
- **Everything keeps the card's rules:** nothing draws on the photo (textures stay in the mat clip; motions draw in the `.oo-border` layer, which sits under the photo and the caption); the caption contrast floor holds (flower colours come from the palette tint at low opacity); motions are screen-only and stop under reduced motion; textures render identically on screen and in print through the shared border SVG.

## Global Constraints

- Read SPEC.md's "Card variation" section and CLAUDE.md's rules; this plan keeps them for everyone but founders.
- `packages/card` gains no app imports; everything that varies is a registry entry there.
- Work from `/Users/alex/Desktop/one-of-one-handoff/.claude/worktrees/founder-design` (branch `worktree-founder-design`). Once per worktree: `npm install --no-audit --no-fund` and `npm run supabase:env`. The local Supabase stack is running; `npx supabase db reset` reapplies migrations locally (never against the hosted project). Port 3000 must be free before Playwright runs; stop the main checkout's dev server with `kill $(lsof -t -iTCP:3000 -sTCP:LISTEN)` if it holds the port, and leave the port free afterwards.
- The local database container is `supabase_db_one-of-one`; tests that need a founder set the flag through it (see Task 1).
- Commit messages are a sentence of what and why, no prefixes, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: The founder flag and the design guard (database)

**Files:**
- Create: `supabase/migrations/20261024000000_founders.sql`
- Modify: `supabase/tests/accounts_and_cards.test.sql` (or add `supabase/tests/founders.test.sql`)
- Create: `e2e/founder.ts` (test helper)

**Interfaces produced:** column `public.users.is_founder`; function `public.is_founder() returns boolean` (security definer, stable, granted to authenticated, revoked from anon and public); trigger `cards_design_guard` refusing a change to `variation` or `intro` on update unless `is_founder()` (SQLSTATE `42501`, message `only founders can change a card's design`); e2e helper `makeFounder(email: string): void`.

- [ ] **Step 1: Failing pgTAP tests.** New file `supabase/tests/founders.test.sql` with `plan(N)`: seed two users (founder F, regular R) and one card each as postgres (same insert shape as the existing test file); set F's flag as postgres; then as R: `is_founder()` is false; updating R's own card's `caption_place` lives; updating its `variation` throws `42501`; updating its `intro` throws `42501`; then as F: `is_founder()` is true; updating F's card's `variation` and `intro` lives and reads back; F still cannot update R's card (RLS: zero rows affected, check the value is unchanged as postgres afterwards); a user cannot set their own `is_founder` (no update policy on users: `update public.users set is_founder = true where id = auth.uid()` affects zero rows, verified as postgres); `has_function_privilege('anon', 'public.is_founder()', 'execute')` is false. Run `npx supabase test db`: fails (column missing).

- [ ] **Step 2: The migration.**

```sql
-- Founders may restyle their own cards (Oct 24, 2026). The flag is set only by an operator with SQL.
alter table public.users add column is_founder boolean not null default false;

create or replace function public.is_founder() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_founder from public.users where id = auth.uid()), false);
$$;
revoke all on function public.is_founder() from public;
revoke execute on function public.is_founder() from anon;
grant execute on function public.is_founder() to authenticated;

-- A card's design (variation and intro) is assigned; only founders may change it after saving.
create or replace function public.guard_card_design() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.variation is distinct from old.variation or new.intro is distinct from old.intro)
     and not public.is_founder() then
    raise exception 'only founders can change a card''s design' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger cards_design_guard
  before update on public.cards
  for each row execute function public.guard_card_design();
```

Run `npx supabase db reset && npx supabase test db`: all files pass.

- [ ] **Step 3: The e2e helper.** `e2e/founder.ts`:

```ts
import { execFileSync } from "node:child_process";

/** Marks a signed-up user as a founder in the local stack's database (tests only). */
export function makeFounder(email: string): void {
  const sql = `update public.users set is_founder = true where id = (select id from auth.users where email = '${email.replace(/'/g, "''")}');`;
  execFileSync("docker", ["exec", "-i", "supabase_db_one-of-one", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql], { stdio: "pipe" });
}
```

(CI's Ubuntu runner has Docker and the same container name.)

- [ ] **Step 4: Commit.** "Add the founder flag and refuse design changes to saved cards from anyone else".

---

### Task 2: The founder panel in production, on Make

**Files:**
- Rename: `apps/web/components/DevVariationPanel.tsx` to `apps/web/components/DesignPanel.tsx` (component `DesignPanel`), and `apps/web/components/dev.css` to `apps/web/components/design-panel.css`; markers `data-dev-panel` becomes `data-design-panel`, aria-label "Variation testing (development only)" becomes "Card design".
- Create: `apps/web/lib/founder.ts`, `apps/web/lib/founder.test.ts` is not needed (it calls Supabase); test end to end instead.
- Modify: `apps/web/app/make/MakeScreen.tsx`, `apps/web/lib/save.ts` (if needed), `scripts/check-prod.mjs`, `e2e/make.spec.ts` (selectors), `e2e/founder.spec.ts` (new), CLAUDE.md's dev-surfaces line, SPEC.md's Card variation section (one sentence: founders may restyle their own cards; everyone else's are assigned).

**Interfaces:** `useIsFounder(): boolean | null` in `apps/web/lib/founder.ts` (client hook: reads the signed-in user's own `users` row through the browser client once; null while loading, false on any error). `DesignPanel` props unchanged (`derived`, `overrides`, `onChange`, `borderOnPrint`, `onBorderOnPrint`).

- [ ] **Step 1: Failing e2e** `e2e/founder.spec.ts` (opt out of the shared sign-in): a fresh user who is not a founder signs in, picks `seoul.jpg` on Make, and sees no element `[data-design-panel]` in a production-like check — note that in the dev server the panel shows for everyone, so instead assert through a query flag: this test runs against `next dev`, where `process.env.NODE_ENV !== "production"`. Therefore gate the panel on `showDesignPanel = isFounder === true || process.env.NODE_ENV !== "production"` and test the founder path's real effect: a founder (made with `makeFounder` after `signIn`, then a reload) picks texture Foil on Make, presses Add to board, opens the saved card and finds `data-texture="foil"`; a non-founder's saved card in the same flow carries the assigned texture even if they clicked Foil in the dev panel (in development the panel shows, but a non-founder's picks are not saved: Add to board saves the assigned variation unless `isFounder === true`). Write both cases.
- [ ] **Step 2: Implement.** In MakeScreen: import `DesignPanel` statically (no longer dynamic/dev-only); compute `isFounder` with `useIsFounder()`; render the panel when `photo && (isFounder === true || process.env.NODE_ENV !== "production")`; in `onAddToBoard`, save `{ ...photo, variation: isFounder === true ? variation : photo.variation }` (variation here is the `withOverrides` result). Print already draws `variation`; for non-founders in production there are no overrides, so it is the assigned one.
- [ ] **Step 3: The production check.** `scripts/check-prod.mjs`: remove `data-dev-panel`, `Variation testing (development only)` and `.dev-panel` from `MARKERS` (the panel now ships by design); keep the gallery and dev-card markers and the `/dev/*` 404 checks. Add one check: the `/signin` HTML has no `data-design-panel` (a signed-out page never renders it).
- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run typecheck`, `npx playwright test`, `npm run check:prod`. Commit: "Ship the design panel to founders on the live site and save their picks with the card".

---

### Task 3: Founders restyle saved cards

**Files:** `apps/web/app/card/[id]/page.tsx`, `apps/web/app/card/[id]/CardScreen.tsx`, `apps/web/lib/designs.ts` (new: `updateCardDesign`), `e2e/founder.spec.ts`.

**Interfaces:** `updateCardDesign(supabase, cardId: string, v: Variation): Promise<void>` writes `{ variation: { texture, tone, palette, tier, motion }, intro }` and throws on error. The card page passes `isFounder` (read server-side from the signed-in user's `users` row) and the photo palette is not available there, so the "Photo" tone on a saved card resolves to the stored palette when the stored tone is already "photo", else to neutral (document this in a comment).

- [ ] **Step 1: Failing e2e:** a founder saves a card, opens it, picks texture Grain in the panel, sees the status "Saved.", reloads, and finds `data-texture="grain"`; picks intro Flip and the frame carries `oo-intro-flip` after reload. A non-founder's opened card has no panel (in development the panel is shown only to founders on this screen: gate it on `isFounder` alone, no development exception, since saving is the point here).
- [ ] **Step 2: Implement.** CardScreen gets `isFounder: boolean`; keeps `overrides` state and computes the shown variation with `withOverrides(stored, overrides, storedPaletteIfPhoto)`; on change, updates the row through `updateCardDesign` and sets the status; Replay picks up a changed intro; Print uses the shown variation and the panel's Border on print toggle.
- [ ] **Step 3: Run** the founder, card and make specs plus lint and typecheck. Commit: "Let founders restyle a saved card from its page, saving each pick".

---

### Task 4: Flower textures

**Files:** `packages/card/src/textures.ts` (+ helpers), `packages/card/test/textures.test.ts`, `packages/card/test/border.test.ts` (it loops over the registry already).

Four entries, each drawing in the mat clip only, seeded by `d.rng`, coloured from `d.palette.tint` (and a lighter mix of it), opacities low enough that the darkest flower ink over the mat stays above the caption floor (assert it: the strongest `fill-opacity`/`stroke-opacity` used is at most 0.35 for petals and 0.5 for thin strokes, and petals never use the foil stops):
- **Daisy:** 20 to 30 small five-petal flowers (petals as ellipses rotated around a centre dot) scattered over the mat regions weighted by area, sizes 1.6 to 3.2 units, random rotation; mottle and grain underneath as the other textures do.
- **Meadow:** a dense scatter (80 to 120) of tiny four-petal florets and dots, 0.6 to 1.4 units.
- **Bloom:** three or four large line-drawn flowers (stroke only, 0.2 unit) placed in the mat's corners and the caption strip's right half, partly clipped by the card edge and the photo box, sizes 8 to 14 units.
- **Sprig:** 12 to 18 leaf sprigs (a curved stem path with three to five leaf ellipses), along the edges of the mat.

Tests: registry entries render (existing loops); each flower texture is deterministic per seed and differs across seeds; nothing in a flower texture lies inside the photo box (parse element centres where practical, as the wear-stroke test does) — the mat clip already guarantees it visually, the test guards the generator; the opacity ceilings above. The equivalence suite gains a case per texture automatically (Mac-only); run it on the Mac and record the ratios.

Commit: "Add four flower-pattern textures to the registry, drawn in the mat only".

---

### Task 5: New intros and motions

**Files:** `packages/card/src/intros.ts`, `packages/card/src/variation.ts` (MOTIONS), `packages/card/src/card.css`, tests in `packages/card/test/intros.test.ts`, `variation.test.ts`, `Card.test.tsx`.

- **Intros** (`assignable: false` on each; the existing three get `assignable: true`; `assignIntro` picks `seed % assignable.length` over the assignable ones, so every existing seed keeps its intro — test it against the old function's outputs for seeds 0 to 99): **Fade** (the card fades in from 0 and scales from 0.97, 0.9 s; caption fades in at 0.7 s), **Slide** (the frame slides in from the left by 40 px with ease-out, 0.8 s; the photo wipes left to right; caption at 0.9 s), **Drop** (the frame drops from 60 px above with a small overshoot, 0.9 s; caption at 0.8 s). `numberAt` and `total` set accordingly. Each one CSS class, honouring the intro rule (frame, photo reveal, caption opacity only) and the reduced-motion block.
- **Motions** (each a class on `.oo-frame` that animates pseudo-elements of `.oo-border`, which sits under the photo and the caption, so nothing ever moves over the photo; screen only; disabled under reduced motion): **Glow** (a soft radial light that breathes in brightness over 4 s), **Twinkle** (six to eight small star points, as radial gradients in one pseudo-element, fading in and out on staggered timings over 3 s), **Petals** (a few soft petal shapes as radial gradients drifting slowly downward across the mat over 12 s, looping). The panel's Motion strip shows them automatically.

Tests: registries have ids equal to keys and labels; `assignIntro` unchanged for the old seeds; every intro and motion class exists in card.css (a source test reading the CSS file); the reduced-motion block covers each new class; Card renders the new motion classes on the frame.

Commit: "Add three intros and three border motions, available to founders and never assigned".

---

### After the tasks (controller)

Merge to main (Mac suite green including equivalence), push (Vercel deploys), then push the new migration to the hosted project (`npx supabase db push`) and set Alex's flag on the hosted database:

```sql
update public.users set is_founder = true where id = (select id from auth.users where email = 'heyalex918@gmail.com');
```

run through the linked CLI (`npx supabase db query --linked`, or the SQL editor in the dashboard if the CLI lacks it). The co-founder's address is added the same way when Alex sends it.
