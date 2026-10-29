-- The free trial's daily limits (3 food photos, 4 coach messages) start again at midnight on your phone's clock,
-- not at midnight UTC. The app tells the server your time zone (set_my_tz); "today" is worked out in it.
-- A time zone can change at most once a day, so switching zones can't be used to reset the limits.
-- Safe to run more than once.

alter table public.profiles add column if not exists tz text check (tz is null or char_length(tz) <= 64);
alter table public.profiles add column if not exists tz_set_at timestamptz;
-- Only through set_my_tz.
revoke update (tz, tz_set_at) on public.profiles from anon, authenticated;

/** Today's date in someone's time zone (UTC when it isn't set or isn't a real zone). */
create or replace function public.local_day(p_user uuid)
returns date language plpgsql stable security definer set search_path = '' as $$
declare
  z text := (select tz from public.profiles where id = p_user);
begin
  if z is null then return (now() at time zone 'UTC')::date; end if;
  return (now() at time zone z)::date;
exception when others then
  return (now() at time zone 'UTC')::date;
end;
$$;
revoke all on function public.local_day(uuid) from public, anon, authenticated;
grant execute on function public.local_day(uuid) to service_role;

/** The app: "my phone's time zone is …". Kept when it's the same, or when it changed in the last 20 hours. */
create or replace function public.set_my_tz(p_tz text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_tz is null or char_length(p_tz) > 64 then return; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then return; end if;
  update public.profiles set tz = p_tz, tz_set_at = now()
  where id = auth.uid() and tz is distinct from p_tz and (tz is null or tz_set_at is null or tz_set_at < now() - interval '20 hours');
end;
$$;
revoke all on function public.set_my_tz(text) from public, anon;
grant execute on function public.set_my_tz(text) to authenticated;

/** Your own access, with today's trial use counted on your phone's day. Was: 20261130000000_subscriptions.sql. */
create or replace function public.my_access()
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.access_of(auth.uid()) || jsonb_build_object(
    'photos_today', coalesce((select count from public.ai_usage_kind where user_id = auth.uid() and day = public.local_day(auth.uid()) and kind = 'photo'), 0),
    'chats_today', coalesce((select count from public.ai_usage_kind where user_id = auth.uid() and day = public.local_day(auth.uid()) and kind = 'chat'), 0))
  where auth.uid() is not null;
$$;
revoke all on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;

/** As before (20261130000000_subscriptions.sql), with the trial's day on your phone's clock. */
create or replace function public.ai_gate(p_user uuid, p_task text, p_limit int)
returns text language plpgsql security definer set search_path = '' as $$
declare
  a jsonb := public.access_of(p_user);
  k text := public.ai_kind(p_task);
  d date := public.local_day(p_user);
  n int;
begin
  if a->>'tier' = 'free' then return 'paywall'; end if;
  if a->>'tier' = 'trial' and k <> 'other' then
    -- Only allowed requests are counted, so "3 of 3 used" stays 3.
    select count into n from public.ai_usage_kind where user_id = p_user and day = d and kind = k for update;
    if k = 'photo' and coalesce(n, 0) >= 3 then return 'trial_photos'; end if;
    if k = 'chat' and coalesce(n, 0) >= 4 then return 'trial_chat'; end if;
  end if;
  if not public.ai_take(p_user, p_limit) then return 'limit'; end if;
  if a->>'tier' = 'trial' and k <> 'other' then
    insert into public.ai_usage_kind (user_id, day, kind, count) values (p_user, d, k, 1)
    on conflict (user_id, day, kind) do update set count = public.ai_usage_kind.count + 1;
  end if;
  return 'ok';
end;
$$;
revoke all on function public.ai_gate(uuid, text, int) from public, anon, authenticated;
grant execute on function public.ai_gate(uuid, text, int) to service_role;
