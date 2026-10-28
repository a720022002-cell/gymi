-- Adro+ gifts: an admin gives someone Adro+ for a set time (a week to a year), with no Apple subscription and no
-- payment. When it ends, the person is back on the regular version (free, or the free week if they're still in it).
-- A new gift for someone who already has one starts when the current one ends. Safe to run more than once.

create table if not exists public.gifts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  days       int not null check (days between 1 and 366),
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz not null,
  note       text check (char_length(note) <= 200),
  given_by   uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists gifts_user on public.gifts (user_id, ends_at desc);
alter table public.gifts enable row level security;
-- Only through the functions below.
revoke all on public.gifts from anon, authenticated;

/** Your access: 'sub' (subscribed, a gift, or free months from invites), 'trial' (first 7 days) or 'free' (no AI),
 * with when it ends. Used by the server and shown in the app. Was: 20261130000000_subscriptions.sql (adds gifts). */
create or replace function public.access_of(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with u as (select created_at from auth.users where id = p_user),
       s as (select active, expires_at from public.subscriptions where user_id = p_user),
       g as (select max(ends_at) as ends_at from public.gifts where user_id = p_user and starts_at <= now() and ends_at > now()),
       inv as (select (count(*) / 5)::int as months from public.referrals r where r.referrer = p_user and public.referral_active(r.referred)),
       t as (select (select created_at from u) + interval '7 days' as trial_end)
  select case
    when exists (select 1 from public.admins where user_id = p_user) then jsonb_build_object('tier', 'sub', 'until', null, 'why', 'admin')
    when exists (select 1 from s where active and (expires_at is null or expires_at > now()))
      then jsonb_build_object('tier', 'sub', 'until', (select expires_at from s), 'why', 'paid')
    when (select ends_at from g) is not null
      -- Back-to-back gifts count as one, to the end of the last.
      then jsonb_build_object('tier', 'sub', 'until', (select max(ends_at) from public.gifts where user_id = p_user and ends_at > now()), 'why', 'gift')
    when now() < (select trial_end from t) then jsonb_build_object('tier', 'trial', 'until', (select trial_end from t), 'why', 'trial')
    when now() < (select trial_end from t) + make_interval(days => 30 * (select months from inv))
      then jsonb_build_object('tier', 'sub', 'until', (select trial_end from t) + make_interval(days => 30 * (select months from inv)), 'why', 'invites')
    else jsonb_build_object('tier', 'free', 'until', null, 'why', 'free') end;
$$;
revoke all on function public.access_of(uuid) from public, anon, authenticated;
grant execute on function public.access_of(uuid) to service_role;

/** Admins: give someone (by username) Adro+ for some days. Starts now, or when their current gift ends. */
create or replace function public.admin_give_gift(p_username text, p_days int, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_name text;
  v_start timestamptz;
  v_id uuid;
  v_end timestamptz;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_days is null or p_days < 1 or p_days > 366 then raise exception 'days' using errcode = '22023'; end if;
  select id, username into v_user, v_name from public.profiles where lower(username) = lower(trim(both '@' from trim(p_username)));
  if v_user is null then return jsonb_build_object('error', 'no_user'); end if;
  select greatest(now(), coalesce(max(ends_at), now())) into v_start from public.gifts where user_id = v_user and ends_at > now();
  insert into public.gifts (user_id, days, starts_at, ends_at, note, given_by)
  values (v_user, p_days, v_start, v_start + make_interval(days => p_days), nullif(left(trim(coalesce(p_note, '')), 200), ''), auth.uid())
  returning id, ends_at into v_id, v_end;
  return jsonb_build_object('id', v_id, 'username', v_name, 'starts_at', v_start, 'ends_at', v_end);
end;
$$;
revoke all on function public.admin_give_gift(text, int, text) from public, anon;
grant execute on function public.admin_give_gift(text, int, text) to authenticated;

/** Admins: the latest gifts, newest first. */
create or replace function public.admin_gifts()
returns table (id uuid, username text, name text, days int, starts_at timestamptz, ends_at timestamptz, note text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select g.id, p.username, p.name, g.days, g.starts_at, g.ends_at, g.note, g.created_at
  from public.gifts g join public.profiles p on p.id = g.user_id
  where public.is_admin()
  order by g.created_at desc
  limit 200;
$$;
revoke all on function public.admin_gifts() from public, anon;
grant execute on function public.admin_gifts() to authenticated;

/** Admins: end a gift now (or remove one that hasn't started yet). */
create or replace function public.admin_end_gift(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from public.gifts where id = p_id and starts_at > now();
  update public.gifts set ends_at = now() where id = p_id and ends_at > now();
end;
$$;
revoke all on function public.admin_end_gift(uuid) from public, anon;
grant execute on function public.admin_end_gift(uuid) to authenticated;
