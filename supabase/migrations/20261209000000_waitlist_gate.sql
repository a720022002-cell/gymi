-- Invite-only launch: before signing in, the app asks for a code. Anyone can join the waitlist with their email and
-- gets their own code to share; every friend who joins with it moves them up (priority = friends who joined, then who
-- joined first). The team lets people in from the admin page: each one gets a personal code by email.
-- People already signed in are never stopped. The gate can be switched off for everyone. Safe to run more than once.

-- On or off for everyone (one row).
create table if not exists public.app_gate (
  id boolean primary key default true check (id),
  is_on boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.app_gate (id, is_on) values (true, true) on conflict (id) do nothing;
alter table public.app_gate enable row level security;

-- Shared codes the team makes ("FRIENDS" for the first 30, one for Apple's reviewer). max_uses null = no limit.
create table if not exists public.gate_codes (
  code       text primary key check (code ~ '^[A-Z0-9]{4,16}$'),
  label      text not null default '' check (char_length(label) <= 60),
  max_uses   integer check (max_uses is null or max_uses > 0),
  uses       integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.gate_codes enable row level security;

-- The waitlist. ref: their own code to share. ref_by: the code of the friend who sent them.
-- invite: the personal code they got when let in; used_at: when they opened the app with it.
create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null check (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  lang       text not null default 'en' check (lang in ('en', 'ar')),
  ref        text not null unique,
  ref_by     text,
  created_at timestamptz not null default now(),
  invite     text unique,
  invited_at timestamptz,
  emailed_at timestamptz,
  used_at    timestamptz
);
create unique index if not exists waitlist_email on public.waitlist (lower(email));
create index if not exists waitlist_ref_by on public.waitlist (ref_by);
alter table public.waitlist enable row level security;
-- No policies on these three tables: only the functions below (and the server) read or write them.

/** A random code of n letters and digits (no 0/O or 1/I, so it's easy to type). */
create or replace function public.gate_rand(n int)
returns text language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, n);
$$;

/** Is the gate on? (Anyone can ask, signed in or not.) */
create or replace function public.gate_on()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select is_on from public.app_gate where id), false);
$$;

/** Try a code: a shared one (counts a use) or a personal invite. true = the app opens. */
create or replace function public.gate_try(p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare c text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
begin
  if char_length(c) < 4 or char_length(c) > 16 then return false; end if;
  update public.gate_codes set uses = uses + 1
   where code = c and active and (max_uses is null or uses < max_uses);
  if found then return true; end if;
  update public.waitlist set used_at = coalesce(used_at, now()) where invite = c;
  return found;
end;
$$;

/** Join the waitlist (or find your place again): returns your own code to share. */
create or replace function public.waitlist_join(p_email text, p_ref text default null, p_lang text default 'en')
returns text language plpgsql security definer set search_path = '' as $$
declare
  e text := lower(trim(coalesce(p_email, '')));
  r text := upper(nullif(trim(coalesce(p_ref, '')), ''));
  mine text;
begin
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(e) > 200 then raise exception 'email'; end if;
  select ref into mine from public.waitlist where lower(email) = e;
  if mine is not null then return mine; end if;
  -- Only a real friend's code counts.
  if r is not null and not exists (select 1 from public.waitlist where ref = r) then r := null; end if;
  loop
    mine := public.gate_rand(6);
    exit when not exists (select 1 from public.waitlist where ref = mine);
  end loop;
  insert into public.waitlist (email, lang, ref, ref_by) values (e, case when p_lang = 'ar' then 'ar' else 'en' end, mine, r);
  return mine;
end;
$$;

/** How many friends joined with your code (no place in line is shown). */
create or replace function public.waitlist_friends(p_ref text)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.waitlist where ref_by = upper(trim(coalesce(p_ref, ''))) and char_length(coalesce(p_ref, '')) >= 4;
$$;

revoke all on function public.gate_rand(int) from public, anon, authenticated;
revoke all on function public.gate_on(), public.gate_try(text), public.waitlist_join(text, text, text), public.waitlist_friends(text) from public;
grant execute on function public.gate_on(), public.gate_try(text), public.waitlist_join(text, text, text), public.waitlist_friends(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The team (admins only)
-- ---------------------------------------------------------------------------

/** Everything for the dashboard: the switch, the shared codes, numbers, and the list by priority. */
create or replace function public.admin_waitlist()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'on', public.gate_on(),
    'codes', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'label', label, 'max', max_uses, 'uses', uses, 'active', active) order by created_at desc) from public.gate_codes), '[]'::jsonb),
    'total', (select count(*) from public.waitlist),
    'today', (select count(*) from public.waitlist where created_at > now() - interval '1 day'),
    'week', (select count(*) from public.waitlist where created_at > now() - interval '7 days'),
    'from_friends', (select count(*) from public.waitlist where ref_by is not null),
    'invited', (select count(*) from public.waitlist where invited_at is not null),
    'opened', (select count(*) from public.waitlist where used_at is not null),
    'list', coalesce((
      select jsonb_agg(x order by x.waiting desc, x.friends desc, x.created_at)
      from (
        select w.id, w.email, w.lang, w.ref, w.ref_by, w.created_at, w.invite, w.invited_at, w.emailed_at, w.used_at,
               (select count(*) from public.waitlist f where f.ref_by = w.ref)::int as friends,
               (w.invited_at is null) as waiting
        from public.waitlist w
        order by (w.invited_at is null) desc, friends desc, w.created_at
        limit 500
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

/** Switch the gate on or off for everyone. */
create or replace function public.admin_gate_set(p_on boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  update public.app_gate set is_on = p_on, updated_at = now() where id;
  return p_on;
end;
$$;

/** Make or change a shared code (active false turns it off). */
create or replace function public.admin_gate_code(p_code text, p_label text, p_max int, p_active boolean default true)
returns boolean language plpgsql security definer set search_path = '' as $$
declare c text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if c !~ '^[A-Z0-9]{4,16}$' then raise exception 'code'; end if;
  insert into public.gate_codes (code, label, max_uses, active) values (c, left(coalesce(p_label, ''), 60), p_max, coalesce(p_active, true))
  on conflict (code) do update set label = excluded.label, max_uses = excluded.max_uses, active = excluded.active;
  return true;
end;
$$;

/** Let people in: each gets a personal code (kept if they had one). The invite email is sent by the gate function. */
create or replace function public.admin_waitlist_invite(p_ids uuid[])
returns integer language plpgsql security definer set search_path = '' as $$
declare n int := 0; r record; c text;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  for r in select id from public.waitlist where id = any(p_ids) and invite is null loop
    loop
      c := public.gate_rand(8);
      exit when not exists (select 1 from public.waitlist where invite = c) and not exists (select 1 from public.gate_codes where code = c);
    end loop;
    update public.waitlist set invite = c, invited_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.admin_waitlist(), public.admin_gate_set(boolean), public.admin_gate_code(text, text, int, boolean), public.admin_waitlist_invite(uuid[]) from public, anon;
grant execute on function public.admin_waitlist(), public.admin_gate_set(boolean), public.admin_gate_code(text, text, int, boolean), public.admin_waitlist_invite(uuid[]) to authenticated;
