-- Adro subscription (one plan, unlimited, 29 SAR a month or 299 a year) bought through Apple and kept by RevenueCat.
-- Free trial: the first 7 days after sign-up, AI limited to 3 photos and 4 coach messages a day.
-- After the trial without a subscription: the app stays open, with no AI.
-- Free months from invites (5 friends = 1 month) add access after the trial.
-- Safe to run more than once. Nothing changes for anyone until the ai function's PAYWALL switch is on.

-- Who is subscribed. Written only by the revenuecat function (RevenueCat's webhook); you can read your own row.
create table if not exists public.subscriptions (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  active      boolean not null default false,
  product     text,
  period      text,                  -- 'monthly' or 'yearly'
  expires_at  timestamptz,           -- when the paid time ends (renewals move it on)
  will_renew  boolean not null default true,
  store       text,
  last_event  text,
  updated_at  timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "Read own subscription" on public.subscriptions;
create policy "Read own subscription" on public.subscriptions for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.subscriptions from anon;
revoke insert, update, delete on public.subscriptions from authenticated;
grant select on public.subscriptions to authenticated;

-- RevenueCat events already handled (it may send one twice).
create table if not exists public.subscription_events (
  id          text primary key,
  user_id     uuid,
  type        text not null,
  at          timestamptz not null default now(),
  body        jsonb
);
alter table public.subscription_events enable row level security;
revoke all on public.subscription_events from anon, authenticated;

-- Photos and coach messages used each day (for the trial's daily limits). Only the server touches it.
create table if not exists public.ai_usage_kind (
  user_id  uuid not null references auth.users (id) on delete cascade,
  day      date not null,
  kind     text not null check (kind in ('photo', 'chat')),
  count    integer not null default 0,
  primary key (user_id, day, kind)
);
alter table public.ai_usage_kind enable row level security;
revoke all on public.ai_usage_kind from anon, authenticated;

/** What kind of AI request a task is: a photo, a coach message, or other. */
create or replace function public.ai_kind(p_task text)
returns text language sql immutable set search_path = '' as $$
  select case when p_task in ('meal_photo', 'label_photo', 'machine') then 'photo'
              when p_task = 'chat' then 'chat' else 'other' end;
$$;

/** Your access: 'sub' (subscribed, or free months from invites), 'trial' (first 7 days) or 'free' (no AI),
 * with when it ends. Used by the server and shown in the app. */
create or replace function public.access_of(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with u as (select created_at from auth.users where id = p_user),
       s as (select active, expires_at from public.subscriptions where user_id = p_user),
       inv as (select (count(*) / 5)::int as months from public.referrals r where r.referrer = p_user and public.referral_active(r.referred)),
       t as (select (select created_at from u) + interval '7 days' as trial_end)
  select case
    when exists (select 1 from public.admins where user_id = p_user) then jsonb_build_object('tier', 'sub', 'until', null, 'why', 'admin')
    when exists (select 1 from s where active and (expires_at is null or expires_at > now()))
      then jsonb_build_object('tier', 'sub', 'until', (select expires_at from s), 'why', 'paid')
    when now() < (select trial_end from t) then jsonb_build_object('tier', 'trial', 'until', (select trial_end from t), 'why', 'trial')
    when now() < (select trial_end from t) + make_interval(days => 30 * (select months from inv))
      then jsonb_build_object('tier', 'sub', 'until', (select trial_end from t) + make_interval(days => 30 * (select months from inv)), 'why', 'invites')
    else jsonb_build_object('tier', 'free', 'until', null, 'why', 'free') end;
$$;
revoke all on function public.access_of(uuid) from public, anon, authenticated;
grant execute on function public.access_of(uuid) to service_role;

/** The app asks for your own access (to show the trial days left and the subscription page). */
create or replace function public.my_access()
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.access_of(auth.uid()) || jsonb_build_object(
    'photos_today', coalesce((select count from public.ai_usage_kind where user_id = auth.uid() and day = current_date and kind = 'photo'), 0),
    'chats_today', coalesce((select count from public.ai_usage_kind where user_id = auth.uid() and day = current_date and kind = 'chat'), 0))
  where auth.uid() is not null;
$$;
revoke all on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;

/**
 * May this AI request go ahead? Counts it when it may. Answers:
 * 'ok', 'limit' (the daily safety cap), 'trial_photos' (3 a day used), 'trial_chat' (4 a day used), 'paywall' (no AI).
 * Called by the ai function only.
 */
create or replace function public.ai_gate(p_user uuid, p_task text, p_limit int)
returns text language plpgsql security definer set search_path = '' as $$
declare
  a jsonb := public.access_of(p_user);
  k text := public.ai_kind(p_task);
  n int;
begin
  if a->>'tier' = 'free' then return 'paywall'; end if;
  if a->>'tier' = 'trial' and k <> 'other' then
    -- Only allowed requests are counted, so "3 of 3 used" stays 3.
    select count into n from public.ai_usage_kind where user_id = p_user and day = current_date and kind = k for update;
    if k = 'photo' and coalesce(n, 0) >= 3 then return 'trial_photos'; end if;
    if k = 'chat' and coalesce(n, 0) >= 4 then return 'trial_chat'; end if;
  end if;
  if not public.ai_take(p_user, p_limit) then return 'limit'; end if;
  if a->>'tier' = 'trial' and k <> 'other' then
    insert into public.ai_usage_kind (user_id, day, kind, count) values (p_user, current_date, k, 1)
    on conflict (user_id, day, kind) do update set count = public.ai_usage_kind.count + 1;
  end if;
  return 'ok';
end;
$$;
revoke all on function public.ai_gate(uuid, text, int) from public, anon, authenticated;
grant execute on function public.ai_gate(uuid, text, int) to service_role;
