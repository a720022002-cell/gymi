-- Gymi, Phase 3: Train. Exercise list (shared, read-only) and each user's training data.
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Exercises: one shared list everyone can read.
--    Source: Free Exercise DB (public domain, github.com/yuhonas/free-exercise-db).
--    About 67 common gym exercises have Gymi ids ('bench', 'squat'), Arabic names and steps,
--    and are shown first. The rest use the Free Exercise DB id.
-- ---------------------------------------------------------------------------
create table if not exists public.exercises (
  id            text primary key,
  name_en       text not null,
  name_ar       text,
  muscle        text not null check (muscle in ('Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Other')),
  muscles       text[] not null default '{}',     -- detailed primary muscles (English)
  equipment     text not null check (equipment in ('Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Free weight', 'Other')),
  level         text,
  category      text,
  steps_en      text[] not null default '{}',
  steps_ar      text[],
  images        text[] not null default '{}',     -- full image URLs
  machines      jsonb,                            -- [["English", "Arabic"], ...]
  timed         boolean not null default false,
  rank          smallint not null default 1,      -- 0 = common Gymi exercise (shown first)
  search        text not null
);

create index if not exists exercises_search_trgm on public.exercises using gin (search extensions.gin_trgm_ops);
create index if not exists exercises_filter on public.exercises (muscle, equipment, rank);

alter table public.exercises enable row level security;
drop policy if exists "Anyone can read exercises" on public.exercises;
create policy "Anyone can read exercises" on public.exercises for select to anon, authenticated using (true);
revoke all on public.exercises from anon, authenticated;
grant select on public.exercises to anon, authenticated;

-- Search with optional muscle and equipment filters. Common exercises first.
create or replace function public.search_exercises(p_query text, p_muscle text default null, p_equipment text default null, p_limit int default 60)
returns setof public.exercises
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select lower(trim(coalesce(p_query, ''))) as s)
  select e.*
  from public.exercises e, q
  where (p_muscle is null or e.muscle = p_muscle)
    and (p_equipment is null or e.equipment = p_equipment
         or (p_equipment = 'Free weight' and e.equipment in ('Barbell', 'Dumbbell', 'Free weight')))
    and (q.s = '' or e.search like '%' || q.s || '%'
         or (length(q.s) > 3 and extensions.word_similarity(q.s, e.search) > 0.5))
  order by e.rank,
           (lower(e.name_en) like q.s || '%' or coalesce(e.name_ar, '') like q.s || '%') desc,
           e.name_en
  limit least(greatest(p_limit, 1), 200);
$$;
grant execute on function public.search_exercises(text, text, text, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Each user's training data. Row level security: only you can see or change yours.
-- ---------------------------------------------------------------------------

-- Your training plan (setup answers, weekly plan, workouts and their exercises).
create table if not exists public.train_plans (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  setup_done  boolean not null default false,
  plan        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Finished workouts: every set you logged. Used for "last time" numbers and records.
create table if not exists public.workout_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  name        text not null check (char_length(name) <= 40),
  started_at  timestamptz not null,
  minutes     integer not null check (minutes between 0 and 600),
  volume      numeric(9, 1) not null default 0,
  sets_done   integer not null default 0,
  kcal        integer not null default 0,
  exercises   jsonb not null default '[]'::jsonb,  -- [{id, n, sets: [{w, r}]}]
  prs         jsonb not null default '[]'::jsonb,  -- [{id, n, w}]
  ups         integer not null default 0,
  downs       integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists workout_logs_user_day on public.workout_logs (user_id, day desc);

-- Cardio (walk, run, bike, swim). Calories burned are added to that day's food budget.
create table if not exists public.cardio_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  kind        text not null check (kind in ('Walk', 'Run', 'Bike', 'Swim')),
  minutes     integer not null check (minutes between 1 and 600),
  intensity   smallint not null default 1 check (intensity between 0 and 2),
  kcal        integer not null check (kcal between 0 and 5000),
  created_at  timestamptz not null default now()
);
create index if not exists cardio_logs_user_day on public.cardio_logs (user_id, day);

do $$
declare t text;
begin
  foreach t in array array['train_plans', 'workout_logs', 'cardio_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Own rows only" on public.%I', t);
    execute format('create policy "Own rows only" on public.%I for all to authenticated
                    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

drop trigger if exists train_plans_touch_updated_at on public.train_plans;
create trigger train_plans_touch_updated_at
  before update on public.train_plans
  for each row execute function public.touch_updated_at();
