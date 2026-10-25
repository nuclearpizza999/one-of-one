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
