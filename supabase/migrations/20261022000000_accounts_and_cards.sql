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

-- Clients (the authenticated and anon roles) can neither set nor change publication fields.
-- A security-definer function owned by postgres (step 5's numbering) runs as its owner and can.
create or replace function public.guard_card_publication() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.number := null;
      new.is_public := false;
      new.published_at := null;
      new.share_token := null;
    else
      new.number := old.number;
      new.is_public := old.is_public;
      new.published_at := old.published_at;
      new.share_token := old.share_token;
    end if;
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
  on conflict (provider_ref) do update set provider_ref = excluded.provider_ref
  returning id;
$$;
revoke all on function public.ensure_place(text, text, text, double precision, double precision, integer, text) from public;
grant execute on function public.ensure_place(text, text, text, double precision, double precision, integer, text) to authenticated;
revoke execute on function public.ensure_place(text, text, text, double precision, double precision, integer, text) from anon;

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
