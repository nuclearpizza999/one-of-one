# Step 4: Accounts and the Private Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sign in by email code, save a made card privately to your board with its photo in Supabase storage, see your cards as rows of whole photos, and open any card again.

**Architecture:** One Supabase project (Postgres with row-level security, private storage buckets, email OTP auth) reached from the Next.js app through `@supabase/ssr` cookie sessions; a `proxy.ts` walls every route behind sign-in. The phone does every pixel job: it re-encodes the rendition and the thumbnail, uploads, and inserts the card row as the signed-in user. The Board and the opened card are server components that sign storage URLs and render the existing `Card`.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`), React 19, `@supabase/supabase-js`, `@supabase/ssr`, Supabase CLI via the `supabase` npm package, Postgres + PostGIS, pgTAP (`supabase test db`), Vitest, Playwright, Mailpit (the local stack's mail catcher).

## Global Constraints

- Read `docs/superpowers/specs/2026-10-22-step-4-accounts-board-design.md` (the design) and SPEC.md before any judgment call; CLAUDE.md's rules never bend.
- Node 24, npm workspaces. Run everything from the repo root unless a step says otherwise.
- The local Supabase stack needs Docker. `npx supabase start` fails without it; on a machine without Docker, write the code and tests and let CI (which has Docker) run the database and e2e tasks. Say so in the task report rather than skipping the test steps silently.
- Secrets never enter the repo: only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` reach the app, and the hosted project's values live only in `apps/web/.env.local` (git-ignored) and Vercel.
- An EXIF date is wall-clock at capture with no zone. Persist it as a `YYYY-MM-DD HH:MM:SS` string from the local getters, never `toISOString()`.
- The card renderer (`packages/card`) gains no app imports. Chrome is icons first; the words allowed on the sign-in screen are Email, Code, Send code, Sign in.
- Development-only surfaces (`/dev/*`, `/api/dev/*`, the dev panel) stay absent from production; `npm run check:prod` is the proof and must pass at the end.
- Commit after every task with a message in the repo's style (a sentence of what and why, no prefixes), ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File structure

| File | Responsibility |
| --- | --- |
| `supabase/config.toml` | Local stack settings: ports, auth (OTP length, rate limits, email template) |
| `supabase/templates/magic_link.html` | The sign-in email: subject line plus the six-digit code |
| `supabase/migrations/20261022000000_accounts_and_cards.sql` | users, places, cards, RLS, the publication guard, `ensure_place`, buckets and storage policies |
| `supabase/tests/accounts_and_cards.test.sql` | pgTAP: owner-only cards, the guard, `ensure_place`, storage prefixes |
| `scripts/supabase-env.mjs` | Writes `apps/web/.env.local` from `supabase status` (local stack) |
| `apps/web/.env.example` | The two public variables, with the local stack's URL and a placeholder key |
| `apps/web/lib/supabase/env.ts` | Reads the two public variables, fails loudly if missing |
| `apps/web/lib/supabase/paths.ts` | `isPublicPath(pathname)`: which routes need no session |
| `apps/web/lib/supabase/browser.ts` | Browser client |
| `apps/web/lib/supabase/server.ts` | Server client bound to Next's cookies |
| `apps/web/proxy.ts` | Session refresh and the sign-in wall |
| `apps/web/app/signin/page.tsx`, `SignInScreen.tsx` | The sign-in screen |
| `apps/web/lib/renditions.ts` | `fitLongEdge`, `scaledJpeg` |
| `apps/web/lib/save.ts` | `cardPaths`, `cardRow`, `saveCard` |
| `apps/web/lib/print.ts` | `printCard`, lifted from MakeScreen, shared with the opened card |
| `apps/web/app/board/page.tsx`, `BoardGrid.tsx` | The Board: query, signed URLs, rows of whole photos |
| `apps/web/app/card/[id]/page.tsx`, `CardScreen.tsx` | The opened card |
| `e2e/auth.ts`, `e2e/auth.setup.ts` | Sign-in helper reading codes from Mailpit; the shared signed-in state |
| `e2e/signin.spec.ts`, `e2e/board.spec.ts`, `e2e/card.spec.ts` | Wall, sign-in, save, rows, open, print |

---

### Task 1: The Supabase project: local stack, schema, policies, database tests

**Files:**
- Create: `supabase/config.toml`, `supabase/templates/magic_link.html`, `supabase/migrations/20261022000000_accounts_and_cards.sql`, `supabase/tests/accounts_and_cards.test.sql`, `scripts/supabase-env.mjs`, `apps/web/.env.example`
- Modify: `package.json` (root), `.gitignore`, `CLAUDE.md`

**Interfaces:**
- Produces: tables `public.users`, `public.places`, `public.cards` as in the design; function `ensure_place(p_kind text, p_name text, p_region text, p_lat double precision, p_lng double precision, p_radius_m integer, p_provider_ref text) returns uuid`; buckets `originals`, `renditions`, `cards`; setting `app.allow_publish` that the guard trigger honours (step 5 sets it inside its numbering function); `npm run supabase:env` writing `apps/web/.env.local`.

- [ ] **Step 1: Install the CLI as a dev dependency and initialise the project**

```bash
npm install -D supabase@^2
npx supabase --version
npx supabase init --yes
```

Expected: a version number prints; `supabase/config.toml`, `supabase/seed.sql` and `supabase/.gitignore` appear. If `init` asks about VS Code or IntelliJ settings, answer no.

- [ ] **Step 2: Tune `supabase/config.toml` for sign-in by code and for tests**

Keep the generated file and change only these keys (search each section; add a key if it is missing):

```toml
project_id = "one-of-one"

[api]
port = 54321

[db]
port = 54322

[storage]
file_size_limit = "50MiB"

[auth]
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000"]
jwt_expiry = 3600
enable_signup = true

[auth.email]
enable_signup = true
enable_confirmations = false
otp_length = 6
otp_expiry = 3600
max_frequency = "1s"

[auth.email.template.magic_link]
subject = "Your One of One code"
content_path = "./supabase/templates/magic_link.html"

[auth.rate_limit]
email_sent = 1000
token_verifications = 1000

[inbucket]
port = 54324
```

If the generated file names the mail section `[mailpit]` rather than `[inbucket]`, keep its name and set its port to 54324.

- [ ] **Step 3: Write the email template**

`supabase/templates/magic_link.html`:

```html
<p>Your One of One code is <strong>{{ .Token }}</strong>. It works for an hour.</p>
```

- [ ] **Step 4: Write the migration**

`supabase/migrations/20261022000000_accounts_and_cards.sql`:

```sql
-- Step 4: accounts and the private board. See docs/superpowers/specs/2026-10-22-step-4-accounts-board-design.md.

create extension if not exists postgis;

-- users mirrors auth.users; a trigger fills it on sign-up. No screen uses handle yet.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.places (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('venue', 'landmark', 'neighborhood', 'city')),
  name text not null,
  region text not null default '',
  lat double precision not null,
  lng double precision not null,
  radius_m integer,
  parent_id uuid references public.places (id),
  card_count integer not null default 0,
  provider_ref text not null unique,
  created_at timestamptz not null default now()
);

create table public.cards (
  id uuid primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  place_id uuid references public.places (id),
  original_path text not null,
  rendition_path text not null,
  thumb_path text not null,
  photo_w integer not null check (photo_w > 0),
  photo_h integer not null check (photo_h > 0),
  taken_at timestamp,
  date_source text not null,
  caption_place text not null default '',
  caption_date text not null default '',
  caption_coords text not null default '',
  exif_lat double precision,
  exif_lng double precision,
  camera jsonb,
  precision text not null default 'neighborhood' check (precision in ('city', 'neighborhood')),
  number integer,
  variation jsonb not null,
  intro text not null,
  variation_seed bigint not null,
  share_token text unique,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index cards_user_created on public.cards (user_id, created_at desc);

-- Nothing a client sends can number or publish a card. Step 5 sets app.allow_publish inside its numbering function.
create or replace function public.guard_card_publication() returns trigger
language plpgsql as $$
begin
  if current_setting('app.allow_publish', true) is distinct from 'on' then
    new.number := null;
    new.is_public := false;
    new.published_at := null;
    new.share_token := null;
  end if;
  return new;
end $$;

create trigger cards_guard
  before insert or update on public.cards
  for each row execute function public.guard_card_publication();

-- Places are written only through this function, keyed on the resolver's stable key.
create or replace function public.ensure_place(
  p_kind text, p_name text, p_region text, p_lat double precision, p_lng double precision, p_radius_m integer, p_provider_ref text
) returns uuid
language sql security definer set search_path = public as $$
  insert into public.places (kind, name, region, lat, lng, radius_m, provider_ref)
  values (p_kind, p_name, p_region, p_lat, p_lng, p_radius_m, p_provider_ref)
  on conflict (provider_ref) do update set name = excluded.name, region = excluded.region
  returning id;
$$;
revoke all on function public.ensure_place(text, text, text, double precision, double precision, integer, text) from public;
grant execute on function public.ensure_place(text, text, text, double precision, double precision, integer, text) to authenticated;

-- Row-level security: owners only.
alter table public.users enable row level security;
create policy "own user row" on public.users for select to authenticated using (id = auth.uid());

alter table public.places enable row level security;
create policy "places are readable" on public.places for select to authenticated using (true);

alter table public.cards enable row level security;
create policy "own cards" on public.cards for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Storage: three private buckets; every object path starts with the owner's id.
insert into storage.buckets (id, name, public, file_size_limit)
values ('originals', 'originals', false, 52428800),
       ('renditions', 'renditions', false, 5242880),
       ('cards', 'cards', false, 20971520);

create policy "own objects select" on storage.objects for select to authenticated
  using (bucket_id in ('originals', 'renditions', 'cards') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own objects insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('originals', 'renditions', 'cards') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own objects update" on storage.objects for update to authenticated
  using (bucket_id in ('originals', 'renditions', 'cards') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own objects delete" on storage.objects for delete to authenticated
  using (bucket_id in ('originals', 'renditions', 'cards') and (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 5: Write the failing database tests**

`supabase/tests/accounts_and_cards.test.sql` (pgTAP; `supabase test db` runs every file in `supabase/tests/`):

```sql
begin;
select plan(10);

-- Two signed-up users. Inserting into auth.users fires the trigger that fills public.users.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test', '', now(), now(), now(), '{}', '{}'),
       ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test', '', now(), now(), now(), '{}', '{}');

select is((select count(*) from public.users), 2::bigint, 'sign-up fills public.users');

-- Act as user A.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok($$
  insert into public.cards (id, user_id, original_path, rendition_path, thumb_path, photo_w, photo_h, date_source, variation, intro, variation_seed, number, is_public)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 'a/1.jpg', 'a/1/2048.jpg', 'a/1/512.jpg', 900, 1200, 'exif', '{"texture":"paper"}', 'rise', 42, 7, true)
$$, 'the owner can insert a card');

select is((select number from public.cards where id = '11111111-1111-1111-1111-111111111111'), null, 'the guard clears a client-supplied number');
select is((select is_public from public.cards where id = '11111111-1111-1111-1111-111111111111'), false, 'the guard clears a client-supplied is_public');

select throws_ok($$
  insert into public.cards (id, user_id, original_path, rendition_path, thumb_path, photo_w, photo_h, date_source, variation, intro, variation_seed)
  values ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-00000000000b', 'b/2.jpg', 'b/2/2048.jpg', 'b/2/512.jpg', 900, 1200, 'exif', '{}', 'rise', 1)
$$, '42501', 'new row violates row-level security policy for table "cards"', 'a user cannot insert a card for someone else');

select is((select public.ensure_place('city', 'Seoul', 'South Korea', 37.56, 126.99, null, 'city:Seoul, South Korea@37.56,126.99')),
          (select public.ensure_place('city', 'Seoul', 'South Korea', 37.56, 126.99, null, 'city:Seoul, South Korea@37.56,126.99')),
          'ensure_place returns the same id for the same key');

select throws_ok($$ insert into public.places (kind, name, lat, lng, provider_ref) values ('city', 'X', 0, 0, 'x') $$, '42501', null, 'places cannot be inserted directly');

select lives_ok($$ insert into storage.objects (bucket_id, name) values ('originals', '00000000-0000-0000-0000-00000000000a/x.jpg') $$, 'a user can upload under their own prefix');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('originals', '00000000-0000-0000-0000-00000000000b/x.jpg') $$, '42501', null, 'a user cannot upload under another prefix');

-- Act as user B: sees nothing of A's.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is((select count(*) from public.cards), 0::bigint, 'another user sees no cards');

select * from finish();
rollback;
```

Ten assertions, hence `plan(10)`. Count again after any edit: pgTAP fails on a wrong plan.

- [ ] **Step 6: Start the stack and run the tests to verify they fail, then pass**

```bash
npx supabase start -x studio,imgproxy,logflare,vector,realtime,edge-runtime
npx supabase test db
```

Expected on the first run, before the migration is applied: the tests fail with `relation "public.cards" does not exist` (the stack applies migrations on `start`; if it already applied them because the file existed, run `npx supabase db reset` and confirm the tests pass). Expected on the final run: `All tests successful.` with 10 tests. If `throws_ok` reports a different error message for the RLS insert, copy the real message into the test; the state code `42501` is the assertion that matters.

If Docker is absent on this machine, `supabase start` fails with a message about the Docker daemon. Then: finish the task's files, commit, and say in the report that the database tests were not run locally and must be read from CI (Task 9 wires them in).

- [ ] **Step 7: The environment script and example**

`scripts/supabase-env.mjs`:

```js
// Writes apps/web/.env.local from the running local Supabase stack, so the dev server and the e2e tests talk to it.
// Run: node scripts/supabase-env.mjs   (after `npx supabase start`)
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = execFileSync("npx", ["supabase", "status", "-o", "env"], { encoding: "utf8" });
const get = (name) => {
  const m = new RegExp(`^${name}="?([^"\\n]+)"?$`, "m").exec(out);
  if (!m) throw new Error(`${name} not in supabase status output`);
  return m[1];
};
const url = get("API_URL");
const key = (() => { try { return get("PUBLISHABLE_KEY"); } catch { return get("ANON_KEY"); } })();
const file = fileURLToPath(new URL("../apps/web/.env.local", import.meta.url));
writeFileSync(file, `NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${key}\n`);
console.log(`wrote ${file} for ${url}`);
```

`apps/web/.env.example`:

```
# Copy to .env.local. For the local stack, `npm run supabase:env` writes it for you.
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-with-the-publishable-key-from-supabase-status
```

Root `package.json` scripts, add:

```json
"supabase:start": "supabase start -x studio,imgproxy,logflare,vector,realtime,edge-runtime",
"supabase:reset": "supabase db reset",
"supabase:env": "node scripts/supabase-env.mjs",
"supabase:test": "supabase test db"
```

`.gitignore`, add under the env section:

```
supabase/.temp/
supabase/.branches/
e2e/.auth/
```

Run `npm run supabase:env` (with the stack up) and confirm `apps/web/.env.local` has both lines and is not in `git status`.

- [ ] **Step 8: CLAUDE.md commands**

In CLAUDE.md's Commands block add, after the `npm run check:prod` line:

```
npm run supabase:start                   local Supabase stack (needs Docker): API :54321, Postgres :54322, Mailpit :54324
npm run supabase:env                     write apps/web/.env.local from the running local stack
npm run supabase:reset                   reapply supabase/migrations to the local stack
npm run supabase:test                    pgTAP tests in supabase/tests against the local stack
```

And in "Where things are" add: "`supabase/` holds the schema (`migrations/`), the local stack's settings and the sign-in email template; `supabase test db` runs the pgTAP files in `supabase/tests/`."

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Add the Supabase project: local stack settings, the accounts and cards schema with owner-only policies and the publication guard, and pgTAP tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Supabase clients in the app and the sign-in wall

**Files:**
- Create: `apps/web/lib/supabase/env.ts`, `apps/web/lib/supabase/paths.ts`, `apps/web/lib/supabase/paths.test.ts`, `apps/web/lib/supabase/browser.ts`, `apps/web/lib/supabase/server.ts`, `apps/web/proxy.ts`
- Modify: `apps/web/package.json` (dependencies), `scripts/check-prod.mjs`, `e2e/board.spec.ts`

**Interfaces:**
- Produces: `supabaseEnv(): { url: string; key: string }`; `isPublicPath(pathname: string): boolean`; `createBrowserSupabase(): SupabaseClient`; `createServerSupabase(): Promise<SupabaseClient>`. Signed-out page requests redirect to `/signin`; signed-out `/api/*` requests get `401 { error: "sign in first" }`.

- [ ] **Step 1: Install the packages**

```bash
npm install @supabase/supabase-js@^2 @supabase/ssr@^0.7 -w apps/web
```

- [ ] **Step 2: Write the failing test for the public-path rule**

`apps/web/lib/supabase/paths.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isPublicPath } from "./paths";

describe("isPublicPath", () => {
  it("leaves the sign-in screen and the development surfaces open", () => {
    for (const p of ["/signin", "/dev", "/dev/card", "/dev/variation", "/api/dev", "/api/dev/photos", "/api/dev/photos/seoul.jpg"]) {
      expect(isPublicPath(p), p).toBe(true);
    }
  });
  it("walls everything else", () => {
    for (const p of ["/", "/board", "/make", "/card/abc", "/api/place", "/signin/extra", "/development"]) {
      expect(isPublicPath(p), p).toBe(false);
    }
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -w apps/web -- paths`
Expected: FAIL, `Cannot find module './paths'`.

- [ ] **Step 4: Write the environment, paths and clients**

`apps/web/lib/supabase/env.ts`:

```ts
/** The two public Supabase values. Public by design: row-level security, not the key, protects the data. */
export function supabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set; see apps/web/.env.example");
  }
  return { url, key };
}
```

`apps/web/lib/supabase/paths.ts`:

```ts
/** Routes that need no session: the sign-in screen and the development-only surfaces (absent in production anyway). */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/signin") return true;
  for (const prefix of ["/dev", "/api/dev"]) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
  }
  return false;
}
```

`apps/web/lib/supabase/browser.ts`:

```ts
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

/** The browser client. Sessions live in cookies, so server components see the same sign-in. */
export function createBrowserSupabase() {
  const { url, key } = supabaseEnv();
  return createBrowserClient(url, key);
}
```

`apps/web/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

/** A client for server components and route handlers, bound to the request's cookies. */
export async function createServerSupabase() {
  const { url, key } = supabaseEnv();
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // A server component cannot set cookies; proxy.ts refreshes the session instead.
        }
      },
    },
  });
}
```

`apps/web/proxy.ts` (Next 16's request interceptor; the file was called middleware.ts before 16):

```ts
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";
import { isPublicPath } from "@/lib/supabase/paths";

/** Refreshes the session cookie and walls every route but the public ones behind sign-in. */
export async function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (data.user) return response;

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "sign in first" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const signin = request.nextUrl.clone();
  signin.pathname = "/signin";
  signin.search = "";
  return NextResponse.redirect(signin);
}

export const config = {
  // Everything but Next's own files and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$).*)"],
};
```

- [ ] **Step 5: Run the unit test and typecheck**

Run: `npm test -w apps/web -- paths && npm run typecheck`
Expected: the two tests pass; typecheck prints no errors.

- [ ] **Step 6: Make the production check honest about the wall**

In `scripts/check-prod.mjs`:

Replace the `server = spawn(...)` line with:

```js
  server = spawn("npm", ["run", "start", "-w", "apps/web", "--", "--port", String(port)], {
    stdio: "ignore",
    detached: true,
    env: {
      ...process.env,
      // The production server must boot to be probed; it never talks to Supabase during this check.
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-for-the-production-check",
    },
  });
```

Replace the block from `const make = await fetch(...)` through the `for (const src of scripts)` loop with:

```js
  const make = await fetch(`${base}/make`);
  check(make.redirected && new URL(make.url).pathname === "/signin", `/make should redirect to /signin when signed out, got ${make.status} at ${make.url}`);
  const place = await fetch(`${base}/api/place`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  check(place.status === 401, `/api/place should be 401 when signed out, got ${place.status}`);
  const signin = await fetch(`${base}/signin`);
  check(signin.status === 200, `/signin should be 200, got ${signin.status}`);
  const html = await signin.text();
  check(!html.includes("data-dev-panel"), "/signin HTML contains the dev panel");
  const scripts = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
  check(scripts.length > 0, "no scripts found on /signin");
  for (const src of scripts) {
    const js = await (await fetch(src.startsWith("http") ? src : `${base}${src}`)).text();
    for (const m of MARKERS) check(!js.includes(m), `${src} contains dev marker ${JSON.stringify(m)}`);
  }
```

Also change `waitForServer()` to accept the redirect: `if ((await fetch(`${base}/board`)).ok) return;` (a followed redirect to `/signin` is `ok`; `/signin` does not exist until Task 3, so until then expect this check to report `/signin should be 200, got 404` and nothing else).

- [ ] **Step 7: Write the failing e2e for the wall**

Append to `e2e/board.spec.ts` (the existing two tests will be adjusted in Task 3 once sign-in exists; leave them for now):

```ts
test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the Board and Make redirect to sign-in, the dev card does not, and the place route refuses", async ({ page, request }) => {
    await page.goto("/board");
    await expect(page).toHaveURL(/\/signin$/);
    await page.goto("/make");
    await expect(page).toHaveURL(/\/signin$/);
    const dev = await request.get("/dev/card?fixture=portrait");
    expect(dev.status()).toBe(200);
    const place = await request.post("/api/place", { data: { lat: 37.8199, lng: -122.4783 } });
    expect(place.status()).toBe(401);
    expect(await place.json()).toEqual({ error: "sign in first" });
  });
});
```

- [ ] **Step 8: Run it**

Run: `npx playwright test -g "signed out"` (the dev server reads `apps/web/.env.local` from Task 1; the local stack must be up, `npm run supabase:start`).
Expected: PASS for the redirects and the 401 (the `/signin` page is a 404 at this point, but the URL assertion only checks the path). If the stack is not running, the proxy's `getUser()` fails closed and the test still passes; note that in the report.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Wall every route behind sign-in with Supabase cookie sessions, and keep the production check honest about the redirect

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The sign-in screen, the Mailpit helper and the shared signed-in state

**Files:**
- Create: `apps/web/app/signin/page.tsx`, `apps/web/app/signin/SignInScreen.tsx`, `e2e/auth.ts`, `e2e/auth.setup.ts`, `e2e/signin.spec.ts`
- Modify: `apps/web/app/globals.css`, `playwright.config.ts`, `e2e/board.spec.ts`

**Interfaces:**
- Consumes: `createBrowserSupabase()` (Task 2).
- Produces: route `/signin`; `freshEmail(): string`, `latestCode(email: string, after: number): Promise<string>`, `signIn(page: Page, email: string): Promise<void>` in `e2e/auth.ts`; every spec in the `chromium` project runs signed in as one shared user unless it opts out with `test.use({ storageState: { cookies: [], origins: [] } })`.

- [ ] **Step 1: Write the failing e2e**

`e2e/auth.ts`:

```ts
import { expect, type Page } from "@playwright/test";

/** The local stack's mail catcher. Every sign-in email lands here. */
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export function freshEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

interface MailpitSummary { ID: string; Created: string }
interface MailpitMessage { Text: string; HTML: string }

/** The six-digit code in the newest message to `email` created at or after `after` (ms since epoch). Polls for up to ten seconds. */
export async function latestCode(email: string, after: number): Promise<string> {
  for (let i = 0; i < 40; i += 1) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const list = (await res.json()) as { messages?: MailpitSummary[] };
    const msg = (list.messages ?? []).find((m) => new Date(m.Created).getTime() >= after - 1000);
    if (msg) {
      const full = (await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json()) as MailpitMessage;
      const m = /\b(\d{6})\b/.exec(full.Text || full.HTML);
      if (m) return m[1]!;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no sign-in code arrived for ${email} (is the local stack running?)`);
}

/** Signs in through the screen, as a person would, and lands on the Board. */
export async function signIn(page: Page, email: string): Promise<void> {
  const requestedAt = Date.now();
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("status")).toContainText(`We sent a six-digit code to ${email}.`);
  const code = await latestCode(email, requestedAt);
  await page.getByLabel("Code").fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/board$/);
}
```

`e2e/auth.setup.ts`:

```ts
import { test as setup } from "@playwright/test";
import { freshEmail, signIn } from "./auth";

setup("sign in the shared e2e user", async ({ page }) => {
  await signIn(page, freshEmail());
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
```

`e2e/signin.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { freshEmail, latestCode, signIn } from "./auth";

test.use({ storageState: { cookies: [], origins: [] } });

test("signs in with a six-digit code and lands on the Board", async ({ page }) => {
  const email = freshEmail();
  await signIn(page, email);
  await expect(page.getByText("No cards yet.")).toBeVisible();
  await page.goto("/signin");
  // Already signed in: the screen still renders, and the Board is a tab away.
  await page.goto("/board");
  await expect(page).toHaveURL(/\/board$/);
});

test("says so when the code is wrong, then accepts the right one", async ({ page }) => {
  const email = freshEmail();
  const requestedAt = Date.now();
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("status")).toContainText("We sent a six-digit code");
  await page.getByLabel("Code").fill("000000");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("status")).toHaveText("That code didn't match. Try again.");
  await page.getByLabel("Code").fill(await latestCode(email, requestedAt));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/board$/);
});

test("says so when the address is not an email", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("not-an-address");
  await page.getByRole("button", { name: "Send code" }).click();
  // The browser's own validation blocks the submit; nothing was sent.
  await expect(page.getByRole("status")).toHaveText("");
  await expect(page.getByLabel("Code")).toHaveCount(0);
});
```

Note: the wrong-code test relies on a code that is six digits but wrong; if the local stack happens to issue `000000`, the test is flaky once in a million runs, which is acceptable.

- [ ] **Step 2: Wire the setup project and the shared state in `playwright.config.ts`**

Replace the `projects` array with:

```ts
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1200, height: 1700 },
        deviceScaleFactor: 1,
        storageState: "e2e/.auth/user.json",
      },
    },
  ],
```

- [ ] **Step 3: Run the sign-in spec to verify it fails**

Run: `npx playwright test e2e/signin.spec.ts`
Expected: FAIL in setup, `getByLabel('Email')` not found (the page is a 404).

- [ ] **Step 4: Write the screen**

`apps/web/app/signin/page.tsx`:

```tsx
import { SignInScreen } from "./SignInScreen";

export default function SignInPage() {
  return <SignInScreen />;
}
```

`apps/web/app/signin/SignInScreen.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { StatusLine } from "@/components/StatusLine";
import { TopBar } from "@/components/TopBar";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/** The eighth screen: an email, then the six-digit code from the email. No passwords, no tab bar. */
export function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    const address = email.trim();
    setBusy(true);
    const { error } = await createBrowserSupabase().auth.signInWithOtp({ email: address });
    setBusy(false);
    if (error) {
      setStatus(error.status === 429 ? "Wait a minute before asking for another code." : "Couldn't send a code to that address.");
      return;
    }
    setSent(true);
    setStatus(`We sent a six-digit code to ${address}.`);
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await createBrowserSupabase().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) {
      setStatus("That code didn't match. Try again.");
      return;
    }
    router.replace("/board");
    router.refresh();
  }

  return (
    <div className="app">
      <TopBar />
      <main className="app-main signin">
        <form className="form" onSubmit={sent ? verify : sendCode}>
          <label className="field">
            <span className="field-label">Email</span>
            <input type="email" name="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {sent ? (
            <label className="field">
              <span className="field-label">Code</span>
              <input
                name="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
          ) : null}
          <button type="submit" className="button-primary" disabled={busy}>
            {sent ? "Sign in" : "Send code"}
          </button>
        </form>
        <StatusLine>{status}</StatusLine>
      </main>
    </div>
  );
}
```

Append to `apps/web/app/globals.css`:

```css
/* Sign-in: a field (48px, 1px rule, chrome type) and the primary button. Two design-system tokens, used only here so far. */
.signin {
  padding: 36px 20px 0;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 18px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-label {
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.field input {
  box-sizing: border-box;
  height: 48px;
  padding: 0 14px;
  font: inherit;
  font-size: 16px; /* under 16px, iOS zooms the page on focus */
  color: var(--ink);
  background: var(--ground);
  border: 1px solid var(--ink);
  border-radius: 0;
}
.field input:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 2px;
}
.button-primary {
  height: 52px;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ground);
  background: var(--ink);
}
.button-primary:disabled {
  opacity: 0.5;
}
.button-primary:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 2px;
}
```

- [ ] **Step 5: Adjust the Board shell tests for the signed-in state**

In `e2e/board.spec.ts` the two original tests now run signed in through the shared state and need no change, except that a fresh shared user has no cards, which still shows "No cards yet." and "0 cards". Keep them. Leave the "signed out" block from Task 2.

- [ ] **Step 6: Run the sign-in spec and the whole suite**

Run: `npx playwright test e2e/signin.spec.ts` then `npx playwright test`
Expected: all pass. The whole suite proves the shared state carries every older spec (Make, equivalence, place, dev variation) through the wall. Then `npm run lint && npm run typecheck`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add the sign-in screen with an emailed six-digit code, and sign the e2e suite in through the local stack's mail catcher

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The card id, made at pick time, seeds the variation

**Files:**
- Modify: `packages/card/src/variation.ts` (SeedFacts, variationSeed), `packages/card/test/variation.test.ts`, `apps/web/lib/photo.ts` (describePhoto, DescribedPhoto), `apps/web/app/make/MakeScreen.tsx` (onFile)
- Create: `apps/web/lib/ids.ts`, `apps/web/lib/ids.test.ts`

**Interfaces:**
- Produces: `SeedFacts.cardId?: string`; `newCardId(): string`; `describePhoto(file: File, lookup?: PlaceLookup, cardId?: string | null)`; `DescribedPhoto.id: string | null`.

- [ ] **Step 1: Write the failing unit test**

Append inside `describe("variationSeed", ...)` in `packages/card/test/variation.test.ts`:

```ts
  it("folds the card id in when there is one, and is unchanged without it", () => {
    const without = variationSeed(facts);
    expect(variationSeed({ ...facts, cardId: undefined })).toBe(without);
    const a = variationSeed({ ...facts, cardId: "7c1d9a6e-0d3f-4f7e-9c3a-0b6f8a9e1b2c" });
    const b = variationSeed({ ...facts, cardId: "c1b2a3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d" });
    expect(a).not.toBe(without);
    expect(a).not.toBe(b);
    expect(a).toBe(variationSeed({ ...facts, cardId: "7c1d9a6e-0d3f-4f7e-9c3a-0b6f8a9e1b2c" }));
  });
```

`apps/web/lib/ids.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { newCardId } from "./ids";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newCardId", () => {
  it("is a version 4 UUID and never repeats", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newCardId()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(V4);
  });
  it("works without crypto.randomUUID, as on a phone over plain http", () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      expect(newCardId()).toMatch(V4);
    } finally {
      Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true });
    }
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -w packages/card -- variation && npm test -w apps/web -- ids`
Expected: the seed test FAILS with `expected 1234… to not be 1234…` (the id is ignored today); the ids test fails with `Cannot find module './ids'`.

- [ ] **Step 3: Implement**

In `packages/card/src/variation.ts` change `SeedFacts` and `variationSeed`:

```ts
export interface SeedFacts {
  sizeBytes: number;
  width: number;
  height: number;
  takenAtMs: number | null;
  camera: { make: string; model: string } | null;
  /** The card's id, made when the photo is picked, so two cards of one photo differ. Absent in the gallery and the dev card. */
  cardId?: string;
}

/**
 * FNV-1a over the photo's facts and, once it exists, the card id (SPEC.md: the
 * variation is a function of the card id plus the inputs). Without an id the
 * same photo always gets the same variation on the same device.
 */
export function variationSeed(f: SeedFacts): number {
  const input = `${f.sizeBytes}:${f.width}:${f.height}:${f.takenAtMs ?? 0}:${f.camera?.make ?? ""}|${f.camera?.model ?? ""}${f.cardId ? `:${f.cardId}` : ""}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
```

`apps/web/lib/ids.ts`:

```ts
/**
 * A version 4 UUID for a new card. crypto.randomUUID exists only in secure
 * contexts, and a phone on the LAN loads the dev server over plain http, so
 * fall back to building one from getRandomValues, which is available everywhere.
 */
export function newCardId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
```

In `apps/web/lib/photo.ts`: add `id: string | null;` to `DescribedPhoto` (after `file`), change the signature to `describePhoto(file: File, lookup: PlaceLookup = lookupPlace, cardId: string | null = null)`, pass `cardId: cardId ?? undefined` into `variationSeed({...})`, and include `id: cardId` in the returned object.

In `apps/web/app/make/MakeScreen.tsx`, in `onFile`, replace `const described = await describePhoto(file);` with:

```ts
    // The card's id exists from the first moment, so the border and intro shown now are what the save writes.
    const described = await describePhoto(file, lookupPlace, newCardId());
```

and add `lookupPlace` to the import from `@/lib/photo` and `import { newCardId } from "@/lib/ids";`.

- [ ] **Step 4: Run the tests**

Run: `npm test && npm run typecheck`
Expected: all green, including the two ids tests (the gallery and the dev card pass no id and are unchanged).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Make the card id when the photo is picked and fold it into the variation seed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Renditions, the wall-clock string and the card row

**Files:**
- Create: `apps/web/lib/renditions.ts`, `apps/web/lib/renditions.test.ts`, `apps/web/lib/save.ts`, `apps/web/lib/save.test.ts`
- Modify: `apps/web/lib/exif.ts`, `apps/web/lib/exif.test.ts`

**Interfaces:**
- Consumes: `DescribedPhoto` (with `id`), `Caption` from `lib/photo.ts`; `PlaceMatch` from `@one-of-one/places`.
- Produces:
  - `fitLongEdge(w: number, h: number, max: number): { width: number; height: number }`
  - `scaledJpeg(img: HTMLImageElement, longEdge: number, quality: number): Promise<Blob>`
  - `wallClockString(d: Date): string`
  - `cardPaths(userId: string, cardId: string, file: File): { original: string; rendition: string; thumb: string }`
  - `cardRow(input: CardRowInput): CardRow`
  - `saveCard(supabase: SupabaseClient, userId: string, photo: DescribedPhoto, caption: Caption): Promise<void>` (throws on failure)

- [ ] **Step 1: Write the failing unit tests**

`apps/web/lib/renditions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fitLongEdge } from "./renditions";

describe("fitLongEdge", () => {
  it("scales the long edge down to the cap and keeps the aspect", () => {
    expect(fitLongEdge(3024, 4032, 2048)).toEqual({ width: 1536, height: 2048 });
    expect(fitLongEdge(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitLongEdge(6000, 4000, 512)).toEqual({ width: 512, height: 341 });
  });
  it("never upscales", () => {
    expect(fitLongEdge(900, 1200, 2048)).toEqual({ width: 900, height: 1200 });
    expect(fitLongEdge(512, 512, 512)).toEqual({ width: 512, height: 512 });
  });
});
```

Append to `apps/web/lib/exif.test.ts`:

```ts
describe("wallClockString", () => {
  it("prints the local getters, zero-padded, with no zone", () => {
    expect(wallClockString(new Date(2026, 6, 1, 14, 30, 5))).toBe("2026-07-01 14:30:05");
    expect(wallClockString(new Date(2026, 0, 9, 0, 0, 0))).toBe("2026-01-09 00:00:00");
  });
  it("keeps the recorded day whatever the zone would do to UTC", () => {
    const lateEvening = new Date(2026, 6, 1, 23, 30, 0);
    expect(wallClockString(lateEvening).slice(0, 10)).toBe("2026-07-01");
  });
});
```

and add `wallClockString` to that file's import from `./exif`.

`apps/web/lib/save.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cardPaths, cardRow } from "./save";

const file = (name: string, type: string) => new File([new Uint8Array([1, 2, 3])], name, { type });

const photo = {
  id: "11111111-1111-4111-8111-111111111111",
  width: 900,
  height: 1200,
  meta: {
    takenAt: new Date(2026, 6, 1, 14, 30, 0),
    dateSource: "exif" as const,
    gps: { lat: 37.5563, lng: 126.9236 },
    camera: { make: "Apple", model: "iPhone 15 Pro" },
  },
  variation: {
    texture: "paper" as const,
    tone: "warm" as const,
    palette: { tint: "#b08860", foil: ["#f3d9a4", "#b8864a"] as const },
    tier: "standard" as const,
    motion: "none" as const,
    intro: "rise" as const,
    seed: 2263211217,
  },
};
const caption = { place: "Seoul, South Korea", date: "July 1st, 2026", coords: "37.5563° N, 126.9236° E" };
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("cardPaths", () => {
  it("puts every object under the owner's id and keeps the original's type", () => {
    expect(cardPaths(userId, photo.id, file("IMG_1.JPG", "image/jpeg"))).toEqual({
      original: `${userId}/${photo.id}.jpg`,
      rendition: `${userId}/${photo.id}/2048.jpg`,
      thumb: `${userId}/${photo.id}/512.jpg`,
    });
    expect(cardPaths(userId, photo.id, file("x.png", "image/png")).original).toBe(`${userId}/${photo.id}.png`);
    expect(cardPaths(userId, photo.id, file("x.heic", "image/heic")).original).toBe(`${userId}/${photo.id}.heic`);
    expect(cardPaths(userId, photo.id, file("x", "")).original).toBe(`${userId}/${photo.id}.bin`);
  });
});

describe("cardRow", () => {
  const paths = cardPaths(userId, photo.id, file("a.jpg", "image/jpeg"));
  it("carries the caption as shown, the zone-less date, the facts and the assigned variation", () => {
    const row = cardRow({ photo, caption, userId, placeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", paths });
    expect(row).toEqual({
      id: photo.id,
      user_id: userId,
      place_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      original_path: paths.original,
      rendition_path: paths.rendition,
      thumb_path: paths.thumb,
      photo_w: 900,
      photo_h: 1200,
      taken_at: "2026-07-01 14:30:00",
      date_source: "exif",
      caption_place: "Seoul, South Korea",
      caption_date: "July 1st, 2026",
      caption_coords: "37.5563° N, 126.9236° E",
      exif_lat: 37.5563,
      exif_lng: 126.9236,
      camera: { make: "Apple", model: "iPhone 15 Pro" },
      variation: { texture: "paper", tone: "warm", palette: { tint: "#b08860", foil: ["#f3d9a4", "#b8864a"] }, tier: "standard", motion: "none" },
      intro: "rise",
      variation_seed: 2263211217,
    });
  });
  it("never carries a number or a public flag, and copes with no date, GPS, camera or place", () => {
    const bare = { ...photo, meta: { takenAt: null, dateSource: "none" as const, gps: null, camera: null } };
    const row = cardRow({ photo: bare, caption: { place: "", date: "", coords: "" }, userId, placeId: null, paths });
    expect(row.taken_at).toBeNull();
    expect(row.exif_lat).toBeNull();
    expect(row.camera).toBeNull();
    expect(row.place_id).toBeNull();
    expect("number" in row).toBe(false);
    expect("is_public" in row).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -w apps/web`
Expected: FAIL, modules `./renditions` and `./save` not found, `wallClockString` not exported.

- [ ] **Step 3: Implement**

Append to `apps/web/lib/exif.ts`:

```ts
/** The capture time for storage: `YYYY-MM-DD HH:MM:SS` from the local getters, no zone, so the day never shifts. */
export function wallClockString(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
```

`apps/web/lib/renditions.ts`:

```ts
/** The size to draw at so the long edge is at most `max`, never upscaling. */
export function fitLongEdge(w: number, h: number, max: number): { width: number; height: number } {
  const long = Math.max(w, h);
  if (long <= max) return { width: w, height: h };
  const s = max / long;
  return { width: Math.round(w * s), height: Math.round(h * s) };
}

/**
 * A JPEG of the decoded photo with its long edge capped. Drawing through a canvas
 * keeps the browser's orientation fix and carries no EXIF, so the rendition and the
 * thumbnail never leak the original's metadata.
 */
export async function scaledJpeg(img: HTMLImageElement, longEdge: number, quality: number): Promise<Blob> {
  const { width, height } = fitLongEdge(img.naturalWidth, img.naturalHeight, longEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d canvas");
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("JPEG encoding failed"))), "image/jpeg", quality);
  });
}
```

`apps/web/lib/save.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Variation } from "@one-of-one/card";
import type { PlaceMatch } from "@one-of-one/places";
import { type PhotoMetadata, wallClockString } from "./exif";
import type { Caption, DescribedPhoto } from "./photo";
import { scaledJpeg } from "./renditions";

export const RENDITION_LONG_EDGE = 2048;
export const THUMB_LONG_EDGE = 512;

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/heif": "heif", "image/webp": "webp" };

/** Object paths, every one under the owner's id (the storage policies key on it). */
export function cardPaths(userId: string, cardId: string, file: File): { original: string; rendition: string; thumb: string } {
  const ext = EXT[file.type] ?? "bin";
  return {
    original: `${userId}/${cardId}.${ext}`,
    rendition: `${userId}/${cardId}/${RENDITION_LONG_EDGE}.jpg`,
    thumb: `${userId}/${cardId}/${THUMB_LONG_EDGE}.jpg`,
  };
}

export interface CardRowInput {
  photo: { id: string | null; width: number; height: number; meta: PhotoMetadata; variation: Variation };
  caption: Caption;
  userId: string;
  placeId: string | null;
  paths: { original: string; rendition: string; thumb: string };
}

/** The insert payload. Never carries a number or a public flag: the database guard would clear them anyway. */
export interface CardRow {
  id: string;
  user_id: string;
  place_id: string | null;
  original_path: string;
  rendition_path: string;
  thumb_path: string;
  photo_w: number;
  photo_h: number;
  taken_at: string | null;
  date_source: PhotoMetadata["dateSource"];
  caption_place: string;
  caption_date: string;
  caption_coords: string;
  exif_lat: number | null;
  exif_lng: number | null;
  camera: { make: string; model: string } | null;
  variation: Pick<Variation, "texture" | "tone" | "palette" | "tier" | "motion">;
  intro: Variation["intro"];
  variation_seed: number;
}

export function cardRow({ photo, caption, userId, placeId, paths }: CardRowInput): CardRow {
  if (!photo.id) throw new Error("a card needs an id before it is saved");
  const { texture, tone, palette, tier, motion, intro, seed } = photo.variation;
  return {
    id: photo.id,
    user_id: userId,
    place_id: placeId,
    original_path: paths.original,
    rendition_path: paths.rendition,
    thumb_path: paths.thumb,
    photo_w: photo.width,
    photo_h: photo.height,
    taken_at: photo.meta.takenAt ? wallClockString(photo.meta.takenAt) : null,
    date_source: photo.meta.dateSource,
    caption_place: caption.place,
    caption_date: caption.date,
    caption_coords: caption.coords,
    exif_lat: photo.meta.gps?.lat ?? null,
    exif_lng: photo.meta.gps?.lng ?? null,
    camera: photo.meta.camera,
    variation: { texture, tone, palette, tier, motion },
    intro,
    variation_seed: seed,
  };
}

async function ensurePlace(supabase: SupabaseClient, match: PlaceMatch): Promise<string> {
  const { data, error } = await supabase.rpc("ensure_place", {
    p_kind: match.kind,
    p_name: match.name,
    p_region: match.region,
    p_lat: match.lat,
    p_lng: match.lng,
    p_radius_m: null,
    p_provider_ref: match.key,
  });
  if (error) throw error;
  return data as string;
}

/**
 * Save a made card: renditions on the phone, three uploads, the place, the row.
 * Uploads are idempotent per path, so a failed save can simply be retried. Throws on any failure.
 */
export async function saveCard(supabase: SupabaseClient, userId: string, photo: DescribedPhoto, caption: Caption): Promise<void> {
  if (!photo.id) throw new Error("a card needs an id before it is saved");
  const paths = cardPaths(userId, photo.id, photo.file);
  const [rendition, thumb] = await Promise.all([
    scaledJpeg(photo.element, RENDITION_LONG_EDGE, 0.9),
    scaledJpeg(photo.element, THUMB_LONG_EDGE, 0.85),
  ]);
  const up = async (bucket: string, path: string, body: Blob, contentType: string) => {
    const { error } = await supabase.storage.from(bucket).upload(path, body, { upsert: true, contentType });
    if (error) throw error;
  };
  await Promise.all([
    up("originals", paths.original, photo.file, photo.file.type || "application/octet-stream"),
    up("renditions", paths.rendition, rendition, "image/jpeg"),
    up("renditions", paths.thumb, thumb, "image/jpeg"),
  ]);
  const placeId = photo.match ? await ensurePlace(supabase, photo.match) : null;
  const { error } = await supabase.from("cards").insert(cardRow({ photo, caption, userId, placeId, paths }));
  if (error) throw error;
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -w apps/web && npm run typecheck`
Expected: PASS (7 new tests) and no type errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Build the rendition, the thumbnail, the zone-less capture time and the card row on the phone

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Add to board saves the card

**Files:**
- Modify: `apps/web/app/make/MakeScreen.tsx`
- Create: `e2e/card-save.spec.ts`

**Interfaces:**
- Consumes: `saveCard` (Task 5), `createBrowserSupabase` (Task 2), `signIn`/`freshEmail` (Task 3).
- Produces: pressing Add to board on Make with a photo saves and navigates to `/board`.

- [ ] **Step 1: Write the failing e2e**

`e2e/card-save.spec.ts`:

```ts
import path from "node:path";
import { expect, test } from "@playwright/test";
import exifr from "exifr";
import { freshEmail, signIn } from "./auth";

test.use({ storageState: { cookies: [], origins: [] } });

const seoul = path.resolve("apps/web/public/dev/seoul.jpg");

test("Add to board saves the card privately and the Board shows it", async ({ page, request }) => {
  await signIn(page, freshEmail());
  await page.goto("/make");
  await expect(page.getByRole("button", { name: "Add to board" })).toBeDisabled();
  await page.getByTestId("photo-input").setInputFiles(seoul);
  await expect(page.locator(".oo-line-place")).toHaveText("Seoul, South Korea");
  const texture = await page.locator("figure.oo-card").getAttribute("data-texture");

  await page.getByRole("button", { name: "Add to board" }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expect(page.getByLabel("1 card")).toHaveText("1");
  const tile = page.getByRole("link", { name: "Seoul, South Korea" });
  await expect(tile).toBeVisible();

  // The thumbnail the Board shows carries no EXIF: no GPS, no capture date.
  const src = await tile.locator("img").getAttribute("src");
  const bytes = await (await request.get(src!)).body();
  expect(await exifr.gps(bytes)).toBeUndefined();
  expect(await exifr.parse(bytes, { pick: ["DateTimeOriginal"] })).toBeUndefined();

  // The saved variation is the one Make showed.
  await tile.click();
  await expect(page).toHaveURL(/\/card\//);
  await expect(page.locator("figure.oo-card")).toHaveAttribute("data-texture", texture!);
});

test("a failed save says so and can be retried", async ({ page }) => {
  await signIn(page, freshEmail());
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(seoul);
  await expect(page.locator(".oo-line-place")).toHaveText("Seoul, South Korea");
  await page.route("**/storage/v1/object/**", (route) => route.abort());
  await page.getByRole("button", { name: "Add to board" }).click();
  await expect(page.getByRole("status")).toHaveText("Couldn't save the card. Try again.");
  await expect(page.getByRole("button", { name: "Add to board" })).toBeEnabled();
  await page.unroute("**/storage/v1/object/**");
  await page.getByRole("button", { name: "Add to board" }).click();
  await expect(page).toHaveURL(/\/board$/);
});
```

(The opened-card half of the first test passes only after Task 8; until then expect that one assertion to fail and say so in the report.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test e2e/card-save.spec.ts`
Expected: FAIL at the Add to board click (the cell is disabled).

- [ ] **Step 3: Wire the save into `MakeScreen`**

In `apps/web/app/make/MakeScreen.tsx`:

Add imports:

```ts
import { saveCard } from "@/lib/save";
import { createBrowserSupabase } from "@/lib/supabase/browser";
```

Add this function after `onPrint`:

```ts
  async function onAddToBoard() {
    if (!photo || busy) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.classList.contains("oo-line")) active.blur();
    setBusy(true);
    setStatus("Saving…");
    try {
      const supabase = createBrowserSupabase();
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw error ?? new Error("not signed in");
      await saveCard(supabase, data.user.id, photo, captionRef.current);
      router.replace("/board");
    } catch {
      setStatus("Couldn't save the card. Try again.");
      setBusy(false);
    }
  }
```

(`setBusy(false)` is not in a `finally` on purpose: after a successful save the screen is leaving, and re-enabling the cell for a moment would allow a double save.)

Change the strip's middle cell to:

```ts
            { label: "Add to board", icon: "grid-plus", selected: true, disabled: !photo || busy, onClick: onAddToBoard },
```

- [ ] **Step 4: Run the spec**

Run: `npx playwright test e2e/card-save.spec.ts`
Expected: the retry test passes; the first test passes up to the tile click and fails on `/card/` (Task 8). Run `npm run lint && npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Save the card to the board, private and unnumbered, when Add to board is pressed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: The Board as rows of whole photos

**Files:**
- Modify: `apps/web/app/board/page.tsx`, `apps/web/app/globals.css`, `e2e/board.spec.ts`
- Create: `apps/web/app/board/BoardGrid.tsx`

**Interfaces:**
- Consumes: `createServerSupabase` (Task 2).
- Produces: `BoardGrid({ cards: BoardCard[] })` with `BoardCard = { id: string; thumbUrl: string; width: number; height: number; label: string }`; tiles are links named by the place line (the date line when the place is blank).

- [ ] **Step 1: Write the failing e2e for the rows**

Append to `e2e/board.spec.ts`:

```ts
import path from "node:path";
import { freshEmail, signIn } from "./auth";

test.describe("rows of whole photos", () => {
  test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 390, height: 844 } });

  test("tiles share a height within a row, full rows run margin to margin, and nothing is cropped", async ({ page }) => {
    await signIn(page, freshEmail());
    for (const f of ["portrait.png", "landscape.png", "square.png", "seoul.jpg", "rotated.jpg"]) {
      await page.goto("/make");
      await page.getByTestId("photo-input").setInputFiles(path.resolve("apps/web/public/dev", f));
      await expect(page.locator("img.oo-photo")).toBeVisible();
      await page.getByRole("button", { name: "Add to board" }).click();
      await expect(page).toHaveURL(/\/board$/);
    }
    await expect(page.getByLabel("5 cards")).toHaveText("5");

    const boxes = await page.locator(".board .tile").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        const img = el.querySelector("img")!;
        return { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), height: r.height, width: r.width, w: img.naturalWidth || Number(img.getAttribute("width")), h: img.naturalHeight || Number(img.getAttribute("height")) };
      }),
    );
    const board = await page.locator(".board").boundingBox();
    expect(boxes.length).toBe(5);
    const rows = new Map<number, typeof boxes>();
    for (const b of boxes) rows.set(b.top, [...(rows.get(b.top) ?? []), b]);
    expect(rows.size).toBeGreaterThan(1);
    const tops = [...rows.keys()].sort((a, b) => a - b);
    for (const [i, top] of tops.entries()) {
      const row = rows.get(top)!;
      const heights = row.map((b) => b.height);
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1.5);
      // Each tile keeps its photo's aspect: no crop.
      for (const b of row) expect(Math.abs(b.width / b.height - b.w / b.h)).toBeLessThan(0.02);
      const isLast = i === tops.length - 1;
      const rightEdge = Math.max(...row.map((b) => b.right));
      if (!isLast) expect(Math.abs(rightEdge - (board!.x + board!.width - 2))).toBeLessThan(2);
    }
  });
});
```

Also change the first existing test's `getByLabel("0 cards")` expectation to remain as is (a fresh shared user has none).

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test -g "rows of whole photos"`
Expected: FAIL, `.board .tile` has 0 elements (the Board still shows the empty shell).

- [ ] **Step 3: Implement the Board**

`apps/web/app/board/BoardGrid.tsx`:

```tsx
import Link from "next/link";
import type { CSSProperties } from "react";

export interface BoardCard {
  id: string;
  thumbUrl: string;
  width: number;
  height: number;
  label: string;
}

/**
 * Rows of whole photos. Each tile's flex-basis is its aspect times the base row
 * height and its flex-grow is proportional to its aspect, so the tiles that wrap
 * into a row grow to one shared height and the row runs margin to margin. The
 * inner padding keeps each tile at its photo's aspect: nothing is cropped. A
 * filler keeps the last, partial row left-aligned at the base height.
 */
export function BoardGrid({ cards }: { cards: BoardCard[] }) {
  return (
    <div className="board-wrap">
      <div className="board">
        {cards.map((c) => (
          <Link
            key={c.id}
            href={`/card/${c.id}`}
            className="tile"
            aria-label={c.label}
            style={{ "--w": c.width, "--h": c.height } as CSSProperties}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived URL; Next's image loader would not help */}
            <img src={c.thumbUrl} alt="" width={c.width} height={c.height} loading="lazy" decoding="async" />
          </Link>
        ))}
        <span className="board-fill" aria-hidden="true" />
      </div>
    </div>
  );
}
```

`apps/web/app/board/page.tsx`:

```tsx
import { AppFrame } from "@/components/AppFrame";
import { TopBar } from "@/components/TopBar";
import { createServerSupabase } from "@/lib/supabase/server";
import { type BoardCard, BoardGrid } from "./BoardGrid";

export const dynamic = "force-dynamic";

const PAGE = 500;

interface BoardRow {
  id: string;
  thumb_path: string;
  photo_w: number;
  photo_h: number;
  caption_place: string;
  caption_date: string;
}

export default async function BoardPage() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("cards")
    .select("id, thumb_path, photo_w, photo_h, caption_place, caption_date")
    .order("created_at", { ascending: false })
    .limit(PAGE);
  if (error) throw error;
  // No generated database types yet; the select above lists exactly these columns.
  const rows = (data ?? []) as BoardRow[];

  let cards: BoardCard[] = [];
  if (rows.length > 0) {
    const { data: signed, error: signError } = await supabase.storage
      .from("renditions")
      .createSignedUrls(rows.map((r) => r.thumb_path), 60 * 60);
    if (signError) throw signError;
    const urlFor = new Map(signed.map((s) => [s.path, s.signedUrl] as const));
    cards = rows.map((r) => ({
      id: r.id,
      thumbUrl: urlFor.get(r.thumb_path) ?? "",
      width: r.photo_w,
      height: r.photo_h,
      label: r.caption_place || r.caption_date || "Untitled card",
    }));
  }

  const n = cards.length;
  return (
    <AppFrame top={<TopBar right={<span className="topbar-count" aria-label={`${n} ${n === 1 ? "card" : "cards"}`}>{n}</span>} />}>
      {n === 0 ? (
        <div className="empty-board">
          <p className="status">No cards yet.</p>
        </div>
      ) : (
        <BoardGrid cards={cards} />
      )}
    </AppFrame>
  );
}
```

Append to `apps/web/app/globals.css`:

```css
/* Board: rows of whole photos. See BoardGrid.tsx for how the flex numbers make rows. */
.board-wrap {
  container-type: inline-size;
}
.board {
  --oo-row: 36cqw; /* base row height: three portraits or two landscapes fill a phone-width row before growing */
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 2px;
  background: var(--ground);
}
.tile {
  position: relative;
  flex-grow: calc(var(--w) / var(--h) * 100);
  flex-basis: calc(var(--w) / var(--h) * var(--oo-row));
  min-width: 0;
}
.tile::before {
  content: "";
  display: block;
  padding-bottom: calc(var(--h) / var(--w) * 100%);
}
.tile img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.tile:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: -2px;
}
.board-fill {
  flex-grow: 100000;
  flex-basis: 0;
}
```

The design doc wrote the base height as `clamp(120px, 36vw, 240px)`; the app is a phone-width column even on a laptop, so 36% of the Board's own width is the same thing with no cap needed. Record that in the task report.

- [ ] **Step 4: Run the Board specs**

Run: `npx playwright test e2e/board.spec.ts e2e/card-save.spec.ts`
Expected: the rows test and the two shell tests pass; the save spec passes except its opened-card tail (Task 8). Then `npm run lint && npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Show the Board as rows of whole photos, packed to fit and rescaled to the margins

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: The opened card, and one print path for Make and the card

**Files:**
- Create: `apps/web/lib/print.ts`, `apps/web/app/card/[id]/page.tsx`, `apps/web/app/card/[id]/CardScreen.tsx`, `e2e/card.spec.ts`
- Modify: `apps/web/app/make/MakeScreen.tsx` (onPrint uses printCard)

**Interfaces:**
- Consumes: `createServerSupabase`, `Card` from `@one-of-one/card`, `renderPng`, `borderSvg`, `cardHeightUnits`, `loadImage` from `lib/photo.ts`.
- Produces: `printCard(input: PrintInput): Promise<string>` returning the status line to show; route `/card/[id]`.

- [ ] **Step 1: Write the failing e2e**

`e2e/card.spec.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";
import { freshEmail, signIn } from "./auth";

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "canShare", { value: undefined, configurable: true });
    Object.defineProperty(Navigator.prototype, "share", { value: undefined, configurable: true });
  });
});

test("opens a saved card with its caption, border and intro, goes back, and prints it", async ({ page }) => {
  await signIn(page, freshEmail());
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(path.resolve("apps/web/public/dev/seoul.jpg"));
  await expect(page.locator(".oo-line-place")).toHaveText("Seoul, South Korea");
  const card = page.locator("figure.oo-card");
  const shown = {
    texture: await card.getAttribute("data-texture"),
    tone: await card.getAttribute("data-tone"),
    tier: await card.getAttribute("data-tier"),
    intro: (await page.locator(".oo-frame").getAttribute("class"))!.match(/oo-intro-\w+/)![0],
  };
  await page.getByRole("button", { name: "Add to board" }).click();
  await expect(page).toHaveURL(/\/board$/);
  await page.getByRole("link", { name: "Seoul, South Korea" }).click();
  await expect(page).toHaveURL(/\/card\/[0-9a-f-]{36}$/);

  await expect(page.locator(".oo-line-place")).toHaveText("Seoul, South Korea");
  await expect(page.locator(".oo-line-date")).toHaveText("July 1st, 2026");
  await expect(page.locator(".oo-line-coords")).toHaveText("37.5563° N, 126.9236° E");
  await expect(page.locator(".oo-num")).toHaveText("");
  await expect(card).toHaveAttribute("data-texture", shown.texture!);
  await expect(card).toHaveAttribute("data-tone", shown.tone!);
  await expect(card).toHaveAttribute("data-tier", shown.tier!);
  await expect(card).toHaveAttribute("data-editable", "false");
  await expect(page.locator(".oo-frame")).toHaveClass(new RegExp(shown.intro));
  await expect(page.getByRole("button", { name: "Add to board" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Replay intro" })).toBeEnabled();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Print" }).click();
  const dl = await download;
  expect(dl.suggestedFilename()).toBe("one-of-one-seoul-south-korea.png");
  const png = PNG.sync.read(readFileSync((await dl.path())!));
  expect(png.width).toBe(1000); // seoul.jpg is 900 px wide: the print is the original's size, not the rendition's
  await expect(page.getByRole("status")).toContainText("Print saved.");

  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/board$/);
});

test("someone else's card is not found", async ({ page, browser }) => {
  await signIn(page, freshEmail());
  await page.goto("/make");
  await page.getByTestId("photo-input").setInputFiles(path.resolve("apps/web/public/dev/portrait.png"));
  await expect(page.locator("img.oo-photo")).toBeVisible();
  await page.getByRole("button", { name: "Add to board" }).click();
  await expect(page).toHaveURL(/\/board$/);
  const href = await page.getByRole("link", { name: /./ }).and(page.locator(".tile")).first().getAttribute("href");

  const other = await browser.newContext();
  const page2 = await other.newPage();
  await signIn(page2, freshEmail());
  const r = await page2.goto(href!);
  expect(r?.status()).toBe(404);
  await other.close();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test e2e/card.spec.ts`
Expected: FAIL, `/card/<id>` is a 404 for the owner too.

- [ ] **Step 3: Lift the print path out of MakeScreen**

`apps/web/lib/print.ts`:

```ts
import { type Variation, borderSvg, cardHeightUnits, renderPng } from "@one-of-one/card";

export interface PrintInput {
  image: HTMLImageElement;
  naturalWidth: number;
  naturalHeight: number;
  place: string;
  date: string;
  coords: string;
  variation: Variation | null;
  borderOnPrint: boolean;
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "card";
}

/**
 * Draw the print and hand it over: the share sheet where there is one, a download
 * otherwise. Returns the status line to show. Throws when the render itself fails.
 */
export async function printCard(input: PrintInput): Promise<string> {
  const border =
    input.borderOnPrint && input.variation
      ? borderSvg(input.variation, cardHeightUnits(input.naturalWidth, input.naturalHeight))
      : undefined;
  const r = await renderPng({
    image: input.image,
    naturalWidth: input.naturalWidth,
    naturalHeight: input.naturalHeight,
    place: input.place,
    date: input.date,
    coords: input.coords,
    number: null,
    border,
  });
  const name = `one-of-one-${slug(input.place)}.png`;
  const file = new File([r.blob], name, { type: "image/png" });
  const notes = [
    r.fontsLoaded ? "" : "Printed with a fallback font.",
    r.reduced ? "Saved at a smaller size than full print resolution." : "",
    border && !r.borderDrawn ? "Printed without the border." : "",
  ].filter(Boolean);

  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return ["Print shared.", ...notes].join(" ");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return ["Share cancelled.", ...notes].join(" ");
      // Any other failure falls through to the download.
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(r.blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return ["Print saved.", ...notes].join(" ");
}
```

In `apps/web/app/make/MakeScreen.tsx`: delete the local `slug` function and the imports of `borderSvg`, `cardHeightUnits`, `renderPng` (keep `Card`, `LineKind`, `VariationOverrides`, `withOverrides`); import `printCard` from `@/lib/print`; replace the body of `onPrint` from `setBusy(true);` to the end of its `finally` with:

```ts
    setBusy(true);
    setStatus("Rendering the print…");
    try {
      setStatus(
        await printCard({
          image: photo.element,
          naturalWidth: photo.width,
          naturalHeight: photo.height,
          place: placeText,
          date: dateText,
          coords: coordsText,
          variation,
          borderOnPrint,
        }),
      );
    } catch {
      setStatus("Couldn't render the print. Try another photo.");
    } finally {
      setBusy(false);
    }
```

Run `npx playwright test e2e/make.spec.ts` here: Make's print tests must still pass before the card screen uses the same path.

- [ ] **Step 4: The opened card**

`apps/web/app/card/[id]/page.tsx`:

```tsx
import type { Variation } from "@one-of-one/card";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { CardScreen } from "./CardScreen";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CardReadRow {
  id: string;
  original_path: string;
  rendition_path: string;
  photo_w: number;
  photo_h: number;
  caption_place: string;
  caption_date: string;
  caption_coords: string;
  variation: Pick<Variation, "texture" | "tone" | "palette" | "tier" | "motion">;
  intro: Variation["intro"];
  variation_seed: number | string;
}

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createServerSupabase();
  // Row-level security hides every card but the owner's, so a stranger's id reads as missing.
  const { data, error } = await supabase
    .from("cards")
    .select("id, original_path, rendition_path, photo_w, photo_h, caption_place, caption_date, caption_coords, variation, intro, variation_seed")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const row = data as CardReadRow | null;
  if (!row) notFound();

  const [rendition, original] = await Promise.all([
    supabase.storage.from("renditions").createSignedUrl(row.rendition_path, 60 * 60),
    supabase.storage.from("originals").createSignedUrl(row.original_path, 60 * 60),
  ]);
  if (rendition.error || original.error) throw rendition.error ?? original.error;

  return (
    <CardScreen
      photo={{ src: rendition.data.signedUrl, width: row.photo_w, height: row.photo_h }}
      originalUrl={original.data.signedUrl}
      caption={{ place: row.caption_place, date: row.caption_date, coords: row.caption_coords }}
      variation={{ ...row.variation, intro: row.intro, seed: Number(row.variation_seed) }}
    />
  );
}
```

`apps/web/app/card/[id]/CardScreen.tsx`:

```tsx
"use client";

import { Card, type Variation } from "@one-of-one/card";
import Link from "next/link";
import { useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { Icon } from "@/components/Icon";
import { StatusLine } from "@/components/StatusLine";
import { Strip } from "@/components/Strip";
import { TopBar } from "@/components/TopBar";
import { useWall } from "@/components/useWall";
import { loadImage } from "@/lib/photo";
import { printCard } from "@/lib/print";

export interface CardScreenProps {
  photo: { src: string; width: number; height: number };
  originalUrl: string;
  caption: { place: string; date: string; coords: string };
  variation: Variation;
}

/** A saved card, read-only: the same card and strip as Make, with Back in place of Cancel. */
export function CardScreen({ photo, originalUrl, caption, variation }: CardScreenProps) {
  const wall = useWall();
  const [replayKey, setReplayKey] = useState(0);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function onPrint() {
    if (busy) return;
    setBusy(true);
    setStatus("Rendering the print…");
    try {
      // The print is drawn from the original at its native size, never from the rendition.
      const image = await loadImage(originalUrl);
      setStatus(
        await printCard({
          image,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          place: caption.place,
          date: caption.date,
          coords: caption.coords,
          variation,
          borderOnPrint: true,
        }),
      );
    } catch {
      setStatus("Couldn't render the print. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppFrame
      top={
        <TopBar
          right={
            <Link href="/board" className="icon-target" aria-label="Back">
              <Icon name="back" size={20} />
            </Link>
          }
        />
      }
    >
      <div className="card-area">
        <Card
          photo={photo}
          place={caption.place}
          date={caption.date}
          coords={caption.coords}
          number={null}
          editable={false}
          intro={variation.intro}
          variation={variation}
          replayKey={replayKey}
          wall={wall}
        />
      </div>
      <StatusLine>{status}</StatusLine>
      <div className="actions">
        <Strip
          cells={[
            { label: "Replay intro", icon: "replay", onClick: () => setReplayKey((k) => k + 1) },
            { label: "Add to board", icon: "grid-plus", selected: true, disabled: true },
            { label: "Print", icon: "printer", disabled: busy, onClick: onPrint },
          ]}
        />
      </div>
    </AppFrame>
  );
}
```

Check `Card`'s props in `packages/card/src/Card.tsx` before building: `photo`, `place`, `date`, `coords`, `number`, `editable`, `intro`, `variation`, `replayKey`, `wall` are the names Make uses today; `onCaptionChange` and `onPick` are omitted here. The original is fetched cross-origin from Supabase; `loadImage` must set `img.crossOrigin = "anonymous"` before `src` or the canvas is tainted and `renderPng` fails. Add that line to `loadImage` in `lib/photo.ts` (object URLs are unaffected by it).

- [ ] **Step 5: Run the card, save and Make specs**

Run: `npx playwright test e2e/card.spec.ts e2e/card-save.spec.ts e2e/make.spec.ts`
Expected: all pass, including the opened-card tail of the save spec. If the print is tainted (`SecurityError` in the console), confirm the `crossOrigin` line and that Supabase's storage answers with `Access-Control-Allow-Origin: *` (it does for signed URLs).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Open a saved card from the Board with its caption, border and intro, and print it from the original through the path Make uses

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: CI runs the stack, the whole suite passes, and the step is documented

**Files:**
- Modify: `.github/workflows/ci.yml`, `CLAUDE.md`, `README.md`

- [ ] **Step 1: CI starts the local stack before the tests**

In `.github/workflows/ci.yml` insert after `- run: npm ci`:

```yaml
      - run: npx supabase start -x studio,imgproxy,logflare,vector,realtime,edge-runtime
      - run: node scripts/supabase-env.mjs
      - run: npx supabase test db
```

The `supabase` npm package ships the CLI; GitHub's Ubuntu runners have Docker. Leave the remaining steps as they are; `check:prod` runs last with the placeholders from Task 2.

- [ ] **Step 2: Documentation**

CLAUDE.md:
- In "Where things are", add: "`apps/web/proxy.ts` is the sign-in wall; `apps/web/lib/supabase/` holds the browser and server clients and the public-path rule; `lib/save.ts` is the one place a card is written; `lib/print.ts` is the one print path (Make and the opened card)."
- In "Commands", under `npm run test:e2e`, add: "(needs the local Supabase stack: `npm run supabase:start` once, then `npm run supabase:env`)".
- Update the build-order line to: "steps 1 (renderer and shell), 3 (metadata), 2 (variation) and 4 (accounts and the board) are done. Next is step 5 (Add to board sheet and numbering)."

README.md: under setup, add the two lines a new developer needs: install Docker, then `npm run supabase:start && npm run supabase:env` before `npm run dev`.

- [ ] **Step 3: Run everything**

```bash
npm run lint && npm run typecheck && npm test && npx playwright test && npm run check:prod
```

Expected: all green. Record the counts in the task report (unit tests per workspace, e2e cases, and that check:prod prints "production build serves no development surface").

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Run the local Supabase stack in CI and document the step 4 setup

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Deployment checklist (by hand, after merge)

Nothing in this task is code; it is the list Alex works through so friends can sign in from their phones.

- [ ] Create the hosted Supabase project (free tier). In its dashboard, Authentication → Email Templates → Magic Link: set the subject to "Your One of One code" and the body to the content of `supabase/templates/magic_link.html`.
- [ ] `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`. Confirm in the dashboard that the three buckets exist and are private.
- [ ] Authentication → Rate Limits: leave the defaults until a custom SMTP sender is connected; then Authentication → SMTP Settings: Resend's SMTP host, port 465, user `resend`, the API key as the password, a sender address on a domain Alex owns and has verified in Resend.
- [ ] Vercel: import the repository, framework Next.js, root directory `apps/web` with "Include source files outside of the Root Directory" on; environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the project's API settings. Deploy.
- [ ] Supabase Authentication → URL Configuration: Site URL = the Vercel address.
- [ ] From a phone: sign in, make a card, save it, open it, print it. Then run the first of the deferred checks: time the print of a foil card on the phone and note it in `.superpowers/sdd/progress.md`.
