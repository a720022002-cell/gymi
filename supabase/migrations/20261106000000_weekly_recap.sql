-- Gymi: the weekly recap (a story shown on the first open of a new week).
-- One row per person and week: when it was shown, the AI part (kept so it's written once), and what you applied.
-- Safe to run more than once.

create table if not exists public.weekly_recaps (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  lang       text not null default 'en' check (lang in ('en', 'ar')),
  ai         jsonb,
  applied    jsonb,
  seen_at    timestamptz not null default now(),
  primary key (user_id, week_start),
  constraint weekly_recaps_size check (pg_column_size(ai) < 20000 and pg_column_size(applied) < 20000)
);
alter table public.weekly_recaps enable row level security;
drop policy if exists "own recaps" on public.weekly_recaps;
create policy "own recaps" on public.weekly_recaps for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
