-- Gymi: Progress, health, devices and the AI coach. Phone health data, coach memory, saved reports,
-- lab report files, naps, chat cards. Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Phone health data (Apple Health / Health Connect): one summary per day
-- ---------------------------------------------------------------------------
create table if not exists public.device_readings (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  source      text not null check (source in ('apple', 'health_connect')),
  steps       integer check (steps between 0 and 200000),
  active_kcal integer check (active_kcal between 0 and 20000),
  hr_avg      smallint check (hr_avg between 20 and 250),
  hr_rest     smallint check (hr_rest between 20 and 250),
  hrv         numeric(5, 1) check (hrv between 0 and 500),
  sleep_h     numeric(4, 2) check (sleep_h between 0 and 24),
  in_bed_h    numeric(4, 2) check (in_bed_h between 0 and 24),
  sleep_eff   smallint check (sleep_eff between 0 and 100),
  weight      numeric(5, 1) check (weight > 0 and weight < 500),
  vo2         numeric(4, 1) check (vo2 between 0 and 100),
  workouts    jsonb not null default '[]'::jsonb,   -- [{ "type": "Run", "minutes": 30, "kcal": 250 }]
  hours       jsonb,                                -- { "steps": [24 numbers], "hr": [24 numbers or null] }
  updated_at  timestamptz not null default now(),
  primary key (user_id, day)
);

-- Which phone source is connected, and the order of the reading cards.
create table if not exists public.device_prefs (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  source     text check (source in ('apple', 'health_connect')),
  connected  boolean not null default false,
  card_order text[] not null default '{}',
  last_sync  timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Coach memory: a short summary the coach keeps between chats
-- ---------------------------------------------------------------------------
create table if not exists public.coach_memory (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  summary    text not null default '' check (char_length(summary) <= 1500),
  updated_at timestamptz not null default now()
);

-- Small charts and cards under a coach reply ({ "type": "weight" | "calories" | "sleep" | "meal", ... }).
alter table public.chat_messages add column if not exists card jsonb;

-- ---------------------------------------------------------------------------
-- 3. Saved coach summaries for reports (so we don't ask the AI again)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_reports (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_day   date not null,
  to_day     date not null,
  lang       text not null default 'en' check (lang in ('en', 'ar')),
  data       jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, from_day, to_day, lang)
);

-- ---------------------------------------------------------------------------
-- 4. Lab report files (PDF or photo) and naps
-- ---------------------------------------------------------------------------
alter table public.blood_tests add column if not exists file_path text check (char_length(file_path) <= 300);
alter table public.blood_tests add column if not exists file_name text check (char_length(file_name) <= 160);
alter table public.blood_tests add column if not exists file_mime text check (char_length(file_mime) <= 80);

-- Every sleep in the day: [{ "bed": "23:30", "wake": "06:45" }, { "bed": "14:00", "wake": "15:00" }]. sleep_h is their sum.
alter table public.checkins add column if not exists sleep_parts jsonb;

-- ---------------------------------------------------------------------------
-- 5. Row level security
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['device_readings', 'device_prefs', 'coach_memory', 'ai_reports'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Own rows only" on public.%I', t);
    execute format('create policy "Own rows only" on public.%I for all to authenticated
                    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Private bucket for lab report files. Each person can only reach files in their own folder: {user id}/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('health-files', 'health-files', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Health files: own folder read" on storage.objects;
create policy "Health files: own folder read" on storage.objects for select to authenticated
  using (bucket_id = 'health-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Health files: own folder insert" on storage.objects;
create policy "Health files: own folder insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'health-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Health files: own folder delete" on storage.objects;
create policy "Health files: own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'health-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
