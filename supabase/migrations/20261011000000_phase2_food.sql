-- Gymi, Phase 2: Food. Food database (shared, read-only) and each user's food data.
-- Safe to run more than once.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Foods: one shared list everyone can read. Sources:
--    usda = USDA FoodData Central (public domain), gymi = our own estimates
--    (Saudi and Gulf dishes, restaurant meals). Packaged products come live from
--    Open Food Facts and are not stored here.
-- ---------------------------------------------------------------------------
create table if not exists public.foods (
  id           text primary key,                 -- 'usda:171477', 'gymi:chicken-kabsa'
  source       text not null check (source in ('usda', 'gymi')),
  category     text not null check (category in ('basic', 'gulf', 'rest', 'usda')),
  name_en      text not null,
  name_ar      text,
  restaurant   text,
  serving_en   text,
  serving_ar   text,
  serving_g    numeric(7, 1) not null default 100,
  unit         text not null default 'g' check (unit in ('g', 'ml')),
  kcal_100     numeric(7, 2) not null,
  protein_100  numeric(7, 2) not null,
  carbs_100    numeric(7, 2) not null,
  fat_100      numeric(7, 2) not null,
  sugar_100    numeric(7, 2),
  fiber_100    numeric(7, 2),
  sodium_100   numeric(8, 2),                     -- mg
  parts        jsonb,                             -- dishes made of parts, grams editable
  sugar_high   boolean not null default false,
  fat_high     boolean not null default false,
  is_estimate  boolean not null default false,
  rank         smallint not null default 1,       -- 0 = featured (shown first)
  search       text not null                      -- lowercase names + keywords, both languages
);

create index if not exists foods_search_trgm on public.foods using gin (search extensions.gin_trgm_ops);
create index if not exists foods_category on public.foods (category, rank);

alter table public.foods enable row level security;
drop policy if exists "Anyone can read foods" on public.foods;
create policy "Anyone can read foods" on public.foods for select to anon, authenticated using (true);
revoke all on public.foods from anon, authenticated;
grant select on public.foods to anon, authenticated;

-- Search: featured foods first, then names that start with the words, then shorter names.
create or replace function public.search_foods(p_query text, p_category text default null, p_limit int default 40)
returns setof public.foods
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select lower(trim(coalesce(p_query, ''))) as s)
  select f.*
  from public.foods f, q
  where (p_category is null or f.category = p_category
         or (p_category = 'basic' and f.category = 'usda'))
    and (q.s = '' or f.search like '%' || q.s || '%'
         or (length(q.s) > 3 and extensions.word_similarity(q.s, f.search) > 0.45))
    and (q.s <> '' or f.rank = 0)
  order by f.rank,
           (lower(f.name_en) like q.s || '%' or coalesce(f.name_ar, '') like q.s || '%') desc,
           length(f.name_en)
  limit least(greatest(p_limit, 1), 100);
$$;
grant execute on function public.search_foods(text, text, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Each user's food data. Row level security: only you can see or change yours.
-- ---------------------------------------------------------------------------

-- Your calorie plan (answers, targets, meal times, plan choices, shopping list).
create table if not exists public.food_plans (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  setup_done  boolean not null default false,
  plan        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- What you ate.
create table if not exists public.food_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  meal        text check (char_length(meal) <= 40),
  name        text not null check (char_length(name) <= 200),
  kcal        numeric(7, 1) not null check (kcal >= 0 and kcal <= 10000),
  protein     numeric(6, 1) not null default 0 check (protein >= 0),
  carbs       numeric(6, 1) not null default 0 check (carbs >= 0),
  fat         numeric(6, 1) not null default 0 check (fat >= 0),
  sugar_high  boolean not null default false,
  fat_high    boolean not null default false,
  food_id     text,
  plan_key    text,
  barcode     text,
  created_at  timestamptz not null default now()
);
create index if not exists food_logs_user_day on public.food_logs (user_id, day);

-- Meals you built and saved.
create table if not exists public.saved_meals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) <= 80),
  items       text,
  ingredients jsonb,
  kcal        numeric(7, 1) not null,
  protein     numeric(6, 1) not null default 0,
  carbs       numeric(6, 1) not null default 0,
  fat         numeric(6, 1) not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists saved_meals_user on public.saved_meals (user_id, created_at desc);

-- Calories moved to other days (over or under your limit).
create table if not exists public.calorie_moves (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  kcal        integer not null check (kcal between -3000 and 3000),
  created_at  timestamptz not null default now()
);
create index if not exists calorie_moves_user_day on public.calorie_moves (user_id, day);

-- Water you drank (quick "+" on Home; the full water screen comes later).
create table if not exists public.water_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  ml          integer not null check (ml > 0 and ml <= 5000),
  kind        text not null default 'Water',
  created_at  timestamptz not null default now()
);
create index if not exists water_logs_user_day on public.water_logs (user_id, day);

do $$
declare t text;
begin
  foreach t in array array['food_plans', 'food_logs', 'saved_meals', 'calorie_moves', 'water_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Own rows only" on public.%I', t);
    execute format('create policy "Own rows only" on public.%I for all to authenticated
                    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

drop trigger if exists food_plans_touch_updated_at on public.food_plans;
create trigger food_plans_touch_updated_at
  before update on public.food_plans
  for each row execute function public.touch_updated_at();
