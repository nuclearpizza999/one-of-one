# Step 4: accounts and the private board

Oct 22, 2026. Design for build step 4 from SPEC.md ("Accounts and the private board: upload, store, the board, open a card"). SPEC.md is the product truth; this document fixes how step 4 is built and records the decisions Alex took on Oct 22, 2026 while designing it. Steps 1, 3 and 2 are on main; the whole-mat border change (2fd8c76) is the base.

## Decisions taken

- **Supabase, hosted free tier to start.** Postgres with PostGIS, file storage with private buckets and signed links, and email sign-in, under one project and one set of keys. It is the open-source stack with the most stars that covers every storage need in SPEC.md (Apache-2.0, 113k stars on Oct 22, 2026), so the exit is self-hosting the same code. Tests never touch the real project: on this Mac and in CI they run against Supabase's local stack, which needs Docker.
- **Sign in first, by email and a six-digit code.** The app opens on a sign-in screen and nothing else shows until you are in. A magic link would open in whatever browser the mail app launches, so the screen asks for the code from the same email instead. No passwords, no Google or Apple buttons for now.
- **Add to board saves privately.** The middle cell on Make saves the card to your board, private and unnumbered, and returns you to the Board with it first. Going public with a number is a later action on the opened card (step 5), which is where the sheet with the precision strip and the number preview moves to. This settles SPEC.md's open decision on private saves.
- **The Board is rows of whole photos.** Each row packs as many photos as fit at a base height and is rescaled to run margin to margin, so heights vary by row and nothing is cropped. Gutters are 2px in the wall colour. Storyboards (step 6) use the same rows. The spec's 3-across grid of square crops is gone, and with it the one place a photo was cropped: nothing in the product crops a photo now.
- **The card id is made when the photo is picked**, and the variation seed includes it as SPEC.md asks, so the border and intro shown on Make are exactly what is saved. Picking the same photo twice gives two different borders.
- **Everything is rendered on the phone.** The rendition and the thumbnail are re-encoded through a canvas at save time, which drops EXIF by construction. No card PNG is stored in this step: a full-resolution PNG of a 4800 px print runs to tens of megabytes, over the free tier's 50 MB file limit, and nothing needs it until link previews (step 6) and prints (step 7). Print on the opened card draws from the original, as Make does.
- **Not in this step:** delete, sign-out, caption editing on the opened card, paging past the first 500 cards. During seeding, delete and sign-out can be done from the Supabase dashboard. A drifting-belt Board (rows that scroll sideways on their own) was considered and parked.

## Platform and environments

- One hosted Supabase project for production. Its URL and publishable key reach the app as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; no secret key is used in this step, since every write goes through row-level security as the signed-in user. `apps/web/.env.local` is git-ignored; `apps/web/.env.example` is committed with the local stack's values.
- `supabase/config.toml` and `supabase/migrations/*.sql` live at the repo root and are the schema's source of truth. `supabase start` runs the local stack (API on 54321, Postgres on 54322, Mailpit on 54324); `supabase db reset` reapplies the migrations; `supabase db push` applies them to the hosted project after `supabase link`. CLAUDE.md's commands section gains these.
- CI installs the Supabase CLI (`supabase/setup-cli`), starts the local stack without the services the tests do not need (Studio, image proxy, realtime, edge runtime, logs), exports its URL and key into the environment, and then runs the existing steps. `check:prod` passes placeholder values for the two public variables, since the production server must boot to be probed and the probed routes are exempt from sign-in.

## Sign-in

- **Screen** `/signin`, the eighth screen, in the chrome style: the 1/1 mark in the top bar, a field labelled Email (48px tall, 1px rule, chrome type, the label above it in strip text style), and a primary button reading Send code. After the code is sent the screen shows a Code field (six digits, numeric keyboard, `autocomplete="one-time-code"`) and a Sign in button, with the status line saying "We sent a six-digit code to <email>." Errors are plain words on the status line: "Couldn't send a code to that address.", "That code didn't match. Try again.", "Wait a minute before asking for another code." Words are allowed here because an icon would be ambiguous.
- **Flow** with `@supabase/supabase-js`: `signInWithOtp({ email })` creates the user if needed and sends the email; `verifyOtp({ email, token, type: "email" })` signs in. The email template includes the code (`{{ .Token }}`), set in `config.toml` for the local stack and in the dashboard for the hosted project. Sign-in lands on `/board`.
- **Sessions** are cookies managed by `@supabase/ssr`: a browser client for the screens, a server client for server components, and `apps/web/proxy.ts` (Next 16's request interceptor, called middleware before) refreshes the session and redirects a signed-out request to `/signin`. Exempt: `/signin`, `/dev/*` and `/api/dev/*` (development only, and absent in production anyway), and Next's static files. Everything else, including `/api/place`, requires a session.
- **Email delivery.** The local stack's Mailpit catches every email. The hosted project uses Supabase's own sender during Alex's testing and a free Resend account connected as custom SMTP before friends join, since the built-in sender allows only a few messages an hour; the sender address needs a domain Alex owns.
- **`public.users`** mirrors `auth.users`: `id uuid primary key references auth.users on delete cascade`, `handle text unique null`, `created_at timestamptz default now()`, filled by a trigger on `auth.users` insert. No screen uses the handle yet.

## Data

Migrations in `supabase/migrations/`, written by hand.

```sql
create extension if not exists postgis;

create table places (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('venue','landmark','neighborhood','city')),
  name text not null,
  region text not null default '',
  lat double precision not null,
  lng double precision not null,
  radius_m integer,
  parent_id uuid references places,
  card_count integer not null default 0,
  provider_ref text unique not null,   -- the offline resolver's place key until a places API arrives
  created_at timestamptz not null default now()
);

create table cards (
  id uuid primary key,                 -- made on the phone when the photo is picked
  user_id uuid not null references users on delete cascade,
  place_id uuid references places,
  original_path text not null,
  rendition_path text not null,
  thumb_path text not null,
  photo_w integer not null check (photo_w > 0),
  photo_h integer not null check (photo_h > 0),
  taken_at timestamp,                  -- wall-clock at capture, no zone (CLAUDE.md rule)
  date_source text not null,
  caption_place text not null default '',
  caption_date text not null default '',
  caption_coords text not null default '',
  exif_lat double precision,
  exif_lng double precision,
  camera jsonb,
  precision text not null default 'neighborhood' check (precision in ('city','neighborhood')),
  number integer,
  variation jsonb not null,            -- texture, tone, palette, tier, motion
  intro text not null,
  variation_seed bigint not null,
  share_token text unique,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index cards_user_created on cards (user_id, created_at desc);
```

- **Row-level security.** `cards`: the owner (`user_id = auth.uid()`) may select, insert, update and delete, nobody else. `places`: any signed-in user may select; inserts go only through `ensure_place`. `users`: the owner may select their row.
- **A guard trigger on `cards`** forces `number`, `is_public`, `published_at` and `share_token` to their empty values on every insert or update made as an authenticated user, so a client can never number or publish a card. Step 5 assigns numbers through a security-definer function.
- **`ensure_place(kind, name, region, lat, lng, radius_m, provider_ref) returns uuid`**, security definer, granted to authenticated users: upserts on `provider_ref` and returns the id. Step 5 will own the hierarchy and the counter.
- **Buckets** `originals`, `renditions` and `cards`, all private, created by migration. Object paths start with the owner's id: `originals/<user>/<card>.<ext>`, `renditions/<user>/<card>/2048.jpg`, `renditions/<user>/<card>/512.jpg`. Policies on `storage.objects` allow each operation only when the first path segment equals `auth.uid()`. File size limits: 50 MB on originals (the free tier's cap), 5 MB on renditions. The `cards` bucket is created now for step 6 and stays empty.
- **Reads** use signed URLs (one hour) made on the server for the Board and the opened card.

## Saving a card (Make)

When Add to board is pressed (enabled once a photo is shown and nothing is busy), `MakeScreen` runs `saveCard()` from `apps/web/lib/save.ts`, with the status line reporting progress:

1. Commit a caption line still being edited (blur, as Print does) and read the caption from `captionRef`.
2. Make the rendition (2048 px on the long edge, JPEG quality 0.9) and the thumbnail (512 px on the long edge, JPEG 0.85) from the decoded photo with `scaledJpeg(img, longEdge, quality)` in `apps/web/lib/renditions.ts`. The browser has already applied EXIF orientation to the decoded image, so both come out upright; the rotated fixture guards it.
3. Upload the original file as picked, the rendition and the thumbnail to their paths with `upsert: true`, in parallel.
4. If the place lookup matched, call `ensure_place` with the match and keep the id.
5. Insert the card row: the id from pick time, the paths, the photo's pixel size, `taken_at` as a zone-less `YYYY-MM-DD HH:MM:SS` string built from the local getters (`wallClockString` in `exif.ts`), the date source, the three caption strings, the EXIF coordinates, the camera, `precision` left at its default, the assigned variation (not the dev panel's overrides), its intro and seed.
6. `router.replace("/board")`.

Status: "Saving…" during, then the Board. On any failure: "Couldn't save the card. Try again." with the cell enabled again; uploads are idempotent per path, so a retry is safe. Cancel (×) discards as before.

## The seed and the card id

`SeedFacts` gains `cardId?: string`, hashed with the other facts when present. `MakeScreen` makes `crypto.randomUUID()` when a photo is picked and passes it through `describePhoto`, so the variation, intro and seed shown on Make are what the save writes. The gallery and the dev card pass no id and keep their fact-only seeds.

## Board

- A server component queries the signed-in user's cards (`id, thumb_path, photo_w, photo_h, caption_place, created_at`), newest first, up to 500, and signs the thumbnail paths in one `createSignedUrls` call.
- **Rows by CSS, no measuring.** The grid is a wrapping flex container with 2px gaps and 2px padding in the wall colour. Each tile sets `--w` and `--h` from the photo's pixel size; its `flex-basis` is `aspect × var(--oo-row)` and its `flex-grow` is proportional to the aspect, with an inner padding-bottom of `h / w` to hold the shape and the image absolutely positioned inside. Tiles in a row therefore grow to the same height and the row runs margin to margin; a filler element with a huge `flex-grow` keeps the last, partial row left-aligned at the base height. The base height `--oo-row` is `clamp(120px, 36vw, 240px)`: on a 390px phone three portrait photos make a row and two landscapes make a row; on a laptop four landscapes do.
- Each tile is a link to `/card/<id>` whose image carries `width`, `height` and `loading="lazy"`, with the place line as its accessible name (the date line when the place is blank).
- The top bar shows the 1/1 mark and the count with `aria-label="<n> cards"`. An empty board shows "No cards yet." in the status style, as now.

## Opened card

- Route `/card/[id]`, a server component: loads the row (RLS makes a stranger's id a 404), signs the rendition's URL, and renders the `Card` with the rendition as the photo at the stored pixel size, the stored caption, no number, not editable, and the stored variation and intro so the intro plays on open and Replay intro plays it again.
- Top bar: 1/1 left, Back (←) right to `/board`. Strip: Replay intro; Add to board shown filled and inert, since the card is already there (step 5 turns it into the public step); Print, which fetches the original through a signed URL, decodes it and draws the PNG with the stored variation's border through the same `printCard()` that Make uses, lifted out of `MakeScreen` into `apps/web/lib/print.ts`.

## Chrome additions

Two tokens join the design system: a field (48px, 1px rule, chrome type, label above in strip text style) and the existing primary button used as a form submit. Both are plain CSS in `globals.css` next to the strip styles, in both themes. The sign-in screen is the only user of them in this step.

## Tests

- **Unit, `packages/card`:** `variationSeed` changes with `cardId` and is unchanged when it is omitted.
- **Unit, `apps/web`:** `fitLongEdge(w, h, max)` (the size `scaledJpeg` draws at, never upscaling); `wallClockString` renders local getters and never shifts the day; `cardRow()` builds the insert payload from a described photo and caption (ids, paths, zone-less date, assigned variation, no number, not public).
- **End-to-end, against the local stack** (the developer or CI runs `supabase start` first; Playwright's web server stays `next dev`):
  - Signed-out `/board` and `/make` redirect to `/signin`; `/dev/card` does not.
  - `signIn(page, email)` in `e2e/auth.ts`: request a code on the screen, read the newest Mailpit message for that address through `http://127.0.0.1:54324/api/v1/messages`, type the six digits, land on `/board`. A global setup signs in one shared user and saves its storage state for every existing spec; the board and card specs sign in a fresh user each so counts are exact.
  - Save a card from Make with `seoul.jpg`: the status reads "Saving…", the Board shows one tile named "Seoul, South Korea" and the count reads 1; the uploaded rendition and thumbnail carry no EXIF (read back through a signed URL); the card row has no number and is not public even when the insert tries to set them (the guard).
  - Open the card: the three caption lines, `data-texture`, `data-tone`, `data-tier` and the intro class match what Make showed; Back returns to the Board; Print downloads a PNG at the original's print size.
  - Rows: after saving the three portrait and two landscape fixtures, every row's tiles share a height, every full row spans the container width, and the last row is left-aligned.
- **CI:** the Supabase CLI action and `supabase start` precede the test steps; `check:prod` runs with placeholder public variables.

## Deployment (end of the step, by hand)

A checklist task closes the step so friends can sign in from their phones: create the hosted project and apply the migrations (`supabase link`, `supabase db push`); set the magic-link email template to show the code; connect Resend as custom SMTP with a sender on Alex's domain; deploy `apps/web` on Vercel's free plan with the two public variables; set the project's site URL to the Vercel address. None of it is code.

## Changes to SPEC.md and CLAUDE.md

SPEC.md: the Board row and the chrome's Rows token describe the rows of whole photos; the "only cropped view" sentences go; the Screens intro mentions the sign-in screen and a paragraph describes it; Make's Add to board saves privately and the sheet moves to the opened card; the storage paragraph drops the stored card PNG until step 6 and says why; the open decision on private saves is ticked; the Oct 22 decisions paragraph grows. CLAUDE.md: the crop rule becomes "never cropped"; the mockup notes record the sheet's move and the Board's rows; the commands section gains `supabase start`, `supabase db reset` and the environment file when they exist.

## Out of scope

Delete and sign-out (no place in the screens yet; dashboard during seeding), caption editing on the opened card, paging past 500 cards, the stored card PNG (step 6), numbering and the public step (step 5), storyboards and share links (step 6), a places API (venue and neighborhood tiers), the drifting-belt Board.
