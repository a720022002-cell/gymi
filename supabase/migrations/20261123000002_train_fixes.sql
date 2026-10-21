-- Train fixes.
--
-- A group workout is saved to your history once. The app records which group workout a log came from and checks it
-- before saving; this makes the database refuse a second log for the same group workout too (two taps, two phones, or
-- coming back to the workout later while it's still listed).
alter table public.workout_logs
  add column if not exists group_session uuid references public.group_sessions (id) on delete set null;

create unique index if not exists workout_logs_one_per_group_session
  on public.workout_logs (user_id, group_session)
  where group_session is not null;
