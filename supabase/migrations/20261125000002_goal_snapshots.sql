-- Daily goal snapshots.
--
-- Each day keeps the calorie, protein and water goals it had, so changing your goals later doesn't re-judge earlier
-- days (rings, the Food day view, progress, streaks, the weekly recap and reports). The app writes today's row when
-- it opens and again whenever a goal changes; a day with no row uses the latest earlier row, else your current goals.
--
-- The numbers are the base goals: calories and protein as shown (your own targets, or your coach's, with pregnancy or
-- breastfeeding extra), and your plan's water. Calories moved between days, cardio and the watch's extra movement,
-- and a training day's extra water are added on top from that day's own logs, as before.
-- Only you can see or change your rows. Safe to run more than once.

create table if not exists public.daily_goals (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        date not null,
  kcal       integer not null check (kcal between 0 and 20000),
  protein    integer not null check (protein between 0 and 1000),
  water      integer not null check (water between 0 and 20000),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.daily_goals enable row level security;
drop policy if exists "Own rows only" on public.daily_goals;
create policy "Own rows only" on public.daily_goals for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.daily_goals from anon;
grant select, insert, update, delete on public.daily_goals to authenticated;
