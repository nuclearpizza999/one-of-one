-- Founder flag hardening (Oct 24, 2026). No policy lets a user write public.users, so
-- this is defense in depth: should one ever be added, a signed-in or anonymous caller
-- still cannot set or change is_founder. Only an operator with SQL (as postgres) can.
create or replace function public.guard_founder_flag() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon')
     and ((tg_op = 'INSERT' and new.is_founder)
          or (tg_op = 'UPDATE' and new.is_founder is distinct from old.is_founder)) then
    raise exception 'only an operator can change the founder flag' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger users_founder_guard
  before insert or update on public.users
  for each row execute function public.guard_founder_flag();

-- Note on cards_design_guard (20261024000000_founders.sql): it covers updates only.
-- A user may delete their own card and insert it again with any variation and intro.
-- That is by design: the phone builds the row on insert, and the guard exists to stop
-- a saved card's design being changed in place, not to police new cards.
