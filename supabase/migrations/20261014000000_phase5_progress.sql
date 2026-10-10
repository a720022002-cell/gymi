-- Gymi, Phase 5: Progress and health. Morning check-in, body measurements, progress photos,
-- vitamins and blood tests. Safe to run more than once.

-- One check-in per day: sleep, how you feel, and the recovery score at that moment.
create table if not exists public.checkins (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  sleep_h     numeric(3, 1) check (sleep_h between 0 and 24),
  sleep_q     smallint check (sleep_q between 0 and 2),        -- 0 poor, 1 okay, 2 great
  bed         text check (bed ~ '^\d{2}:\d{2}$'),
  wake        text check (wake ~ '^\d{2}:\d{2}$'),
  energy      smallint check (energy between 0 and 2),         -- 0 tired, 1 normal, 2 great
  sore        smallint check (sore between 0 and 2),           -- 0 none, 1 a little, 2 very sore
  score       smallint check (score between 0 and 100),
  updated_at  timestamptz not null default now(),
  primary key (user_id, day)
);

-- Weight and tape measurements. One value per kind per day.
create table if not exists public.measurements (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day      date not null,
  kind     text not null check (kind in ('weight', 'waist', 'chest', 'arm', 'neck', 'shoulders', 'hips', 'thigh', 'calf', 'forearm', 'bf')),
  value    numeric(6, 1) not null check (value > 0 and value < 1000),
  unique (user_id, day, kind)
);
create index if not exists measurements_user_kind on public.measurements (user_id, kind, day);

-- Progress photos. The picture itself is in the private "progress" storage bucket.
create table if not exists public.progress_photos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  path        text not null check (char_length(path) <= 300),
  created_at  timestamptz not null default now()
);
create index if not exists progress_photos_user on public.progress_photos (user_id, day);

-- Vitamins and supplements you take. Gymi only logs them, it never suggests doses.
create table if not exists public.supplements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  dose        text not null default '' check (char_length(dose) <= 30),
  unit        text not null default 'mg' check (unit in ('IU', 'mg', 'g', 'mcg')),
  freq        text not null default 'Daily' check (freq in ('Daily', 'Weekly', 'Monthly')),
  active      boolean not null default true,
  remind      boolean not null default false,
  time        text not null default '09:00' check (time ~ '^\d{2}:\d{2}$'),
  created_at  timestamptz not null default now()
);

-- Blood test results read from a lab report photo.
create table if not exists public.blood_tests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  title       text not null default '' check (char_length(title) <= 120),
  "values"    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['checkins', 'measurements', 'progress_photos', 'supplements', 'blood_tests'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Own rows only" on public.%I', t);
    execute format('create policy "Own rows only" on public.%I for all to authenticated
                    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Private bucket for progress photos. Each person can only reach files in their own folder: {user id}/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress', 'progress', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Progress photos: own folder read" on storage.objects;
create policy "Progress photos: own folder read" on storage.objects for select to authenticated
  using (bucket_id = 'progress' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Progress photos: own folder insert" on storage.objects;
create policy "Progress photos: own folder insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Progress photos: own folder delete" on storage.objects;
create policy "Progress photos: own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'progress' and (storage.foldername(name))[1] = (select auth.uid())::text);
