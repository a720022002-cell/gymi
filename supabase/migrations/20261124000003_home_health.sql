-- Home and health.
--
-- 1. Vitamins "taken today": one row per supplement and day you tapped Taken. Only you can see or change your rows.
-- 2. Weekly recap Undo: what applying the recap's suggestions changed (the plan parts before, the food targets before,
--    the calorie moves and meals it added), kept with that week's recap so Undo works until the next one.
-- Safe to run more than once.

create table if not exists public.supplement_logs (
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  supplement_id uuid not null references public.supplements (id) on delete cascade,
  day           date not null,
  taken_at      timestamptz not null default now(),
  primary key (user_id, supplement_id, day)
);
create index if not exists supplement_logs_user_day on public.supplement_logs (user_id, day);

alter table public.supplement_logs enable row level security;
drop policy if exists "Own rows only" on public.supplement_logs;
create policy "Own rows only" on public.supplement_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.supplement_logs from anon;
grant select, insert, update, delete on public.supplement_logs to authenticated;

-- A log can only point at one of your own supplements.
create or replace function public.supplement_logs_own()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.supplements s where s.id = new.supplement_id and s.user_id = new.user_id) then
    raise exception 'not your supplement';
  end if;
  return new;
end $$;
revoke all on function public.supplement_logs_own() from public, anon, authenticated;
drop trigger if exists supplement_logs_own on public.supplement_logs;
create trigger supplement_logs_own before insert or update on public.supplement_logs
  for each row execute function public.supplement_logs_own();

alter table public.weekly_recaps add column if not exists undo jsonb;
alter table public.weekly_recaps drop constraint if exists weekly_recaps_undo_size;
alter table public.weekly_recaps add constraint weekly_recaps_undo_size check (undo is null or pg_column_size(undo) < 60000);
