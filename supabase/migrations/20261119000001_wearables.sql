-- Wearables connected directly (WHOOP, Oura; later Polar, Fitbit, Garmin), through their own sign-in (OAuth).
-- The server keeps the keys they give us; the app never sees them.

-- One row per person and wearable. Tokens are only read by the server (no policy lets the app read this table).
create table if not exists public.device_links (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('whoop', 'oura', 'polar', 'fitbit', 'garmin')),
  provider_user text,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scopes text,
  status text not null default 'ok' check (status in ('ok', 'expired', 'error')),
  last_sync timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  primary key (user_id, provider)
);
alter table public.device_links enable row level security;
revoke all on public.device_links from anon, authenticated;

-- A sign-in that's in progress: the random "state" sent to the wearable and checked when it comes back (10 minutes).
create table if not exists public.oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  return_to text not null,
  created_at timestamptz not null default now()
);
alter table public.oauth_states enable row level security;
revoke all on public.oauth_states from anon, authenticated;

-- What the app may know about your links: which wearable, whether it works, when it last synced.
create or replace function public.my_device_links()
 returns table(provider text, status text, last_sync timestamptz, created_at timestamptz)
 language sql
 stable security definer
 set search_path to ''
as $function$
  select provider, status, last_sync, created_at from public.device_links where user_id = auth.uid() order by created_at;
$function$;
grant execute on function public.my_device_links() to authenticated;

-- One summary per day from each wearable. The app reads its own rows; the server writes them.
create table if not exists public.wearable_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  day date not null,
  -- WHOOP recovery or Oura readiness, 0–100.
  recovery smallint check (recovery between 0 and 100),
  -- WHOOP strain (0–21) or Oura activity score (0–100).
  strain numeric check (strain between 0 and 100),
  sleep_score smallint check (sleep_score between 0 and 100),
  hrv numeric check (hrv between 0 and 500),
  hr_rest smallint check (hr_rest between 20 and 250),
  hr_avg smallint check (hr_avg between 20 and 250),
  sleep_h numeric check (sleep_h between 0 and 24),
  in_bed_h numeric check (in_bed_h between 0 and 24),
  sleep_eff smallint check (sleep_eff between 0 and 100),
  spo2 numeric check (spo2 between 50 and 100),
  temp_dev numeric check (temp_dev between -10 and 10),
  steps integer check (steps between 0 and 200000),
  active_kcal integer check (active_kcal between 0 and 20000),
  workouts jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  primary key (user_id, provider, day)
);
alter table public.wearable_days enable row level security;
drop policy if exists "Own wearable days" on public.wearable_days;
create policy "Own wearable days" on public.wearable_days for select using ((select auth.uid()) = user_id);
grant select on public.wearable_days to authenticated;

-- Old sign-ins are cleared after a day.
create or replace function public.clean_oauth_states()
 returns void
 language sql
 security definer
 set search_path to ''
as $function$
  delete from public.oauth_states where created_at < now() - interval '1 day';
$function$;
