-- Gymi, Phase 8: admin, coach applications, programs and meal plans, packages, profile showcase,
-- invites, live group workouts and cycle partner sharing. Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Admins (only the server can add or remove admins)
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Coach applications
-- ---------------------------------------------------------------------------
create table if not exists public.coach_applications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  coach_type   text not null default 'Personal' check (coach_type in ('Personal', 'Online', 'Both')),
  gym          text not null default '' check (char_length(gym) <= 80),
  city         text not null default '' check (char_length(city) <= 60),
  years        text not null default '' check (char_length(years) <= 20),
  specialties  text[] not null default '{}',
  certs        text not null default '' check (char_length(certs) <= 500),
  socials      jsonb not null default '{}'::jsonb,
  bio          text not null default '' check (char_length(bio) <= 600),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  reason       text check (char_length(reason) <= 300),
  reviewed_by  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);
create index if not exists coach_applications_user on public.coach_applications (user_id, created_at desc);
alter table public.coach_applications enable row level security;
drop policy if exists "See own applications" on public.coach_applications;
create policy "See own applications" on public.coach_applications for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.coach_applications from anon, authenticated;
grant select on public.coach_applications to authenticated;

-- Apply (or apply again). Members become "coach, pending" until the team decides.
create or replace function public.apply_coach(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a uuid;
begin
  if auth.uid() is null then raise exception 'auth'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and coach_status = 'approved') then raise exception 'already_coach'; end if;
  update public.coach_applications set status = 'withdrawn' where user_id = auth.uid() and status = 'pending';
  insert into public.coach_applications (user_id, coach_type, gym, city, years, specialties, certs, socials, bio)
  values (auth.uid(), coalesce(p ->> 'coach_type', 'Personal'), left(coalesce(p ->> 'gym', ''), 80), left(coalesce(p ->> 'city', ''), 60),
          left(coalesce(p ->> 'years', ''), 20), coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p -> 'specialties', '[]'::jsonb)) x), '{}'),
          left(coalesce(p ->> 'certs', ''), 500), coalesce(p -> 'socials', '{}'::jsonb), left(coalesce(p ->> 'bio', ''), 600))
  returning id into a;
  update public.profiles set account_type = 'coach', coach_status = 'pending' where id = auth.uid();
  return a;
end;
$$;
revoke all on function public.apply_coach(jsonb) from public, anon;
grant execute on function public.apply_coach(jsonb) to authenticated;

create or replace function public.withdraw_coach_application()
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.coach_applications set status = 'withdrawn' where user_id = auth.uid() and status = 'pending';
  update public.profiles set account_type = 'member', coach_status = null where id = auth.uid() and coach_status = 'pending';
  return true;
end;
$$;
revoke all on function public.withdraw_coach_application() from public, anon;
grant execute on function public.withdraw_coach_application() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Admin tools
-- ---------------------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'new_week', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'active_today', (select count(distinct user_id) from (
        select user_id from public.food_logs where day = current_date
        union select user_id from public.workout_logs where day = current_date
        union select user_id from public.checkins where day = current_date) x),
    'coaches', (select count(*) from public.profiles where account_type = 'coach' and coach_status = 'approved'),
    'pending', (select count(*) from public.profiles where account_type = 'coach' and coach_status = 'pending'),
    'workouts_week', (select count(*) from public.workout_logs where day > current_date - 7),
    'meals_week', (select count(*) from public.food_logs where day > current_date - 7),
    'ai_today', (select coalesce(sum(count), 0) from public.ai_usage where day = current_date)
  );
end;
$$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- Coaches waiting for review (with their latest application, if any) and recent decisions.
create or replace function public.admin_coach_queue()
returns table (user_id uuid, name text, username text, email text, phone text, coach_status text, joined timestamptz,
               app_id uuid, coach_type text, gym text, city text, years text, specialties text[], certs text, socials jsonb, bio text, applied timestamptz, reason text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
  select p.id, p.name, p.username, p.email, p.phone, p.coach_status, p.created_at,
         a.id, a.coach_type, a.gym, a.city, a.years, a.specialties, a.certs, a.socials, a.bio, a.created_at, a.reason
  from public.profiles p
  left join lateral (select * from public.coach_applications x where x.user_id = p.id and x.status <> 'withdrawn' order by x.created_at desc limit 1) a on true
  where p.account_type = 'coach'
  order by (p.coach_status = 'pending') desc, coalesce(a.created_at, p.created_at) desc
  limit 200;
end;
$$;
revoke all on function public.admin_coach_queue() from public, anon;
grant execute on function public.admin_coach_queue() to authenticated;

create or replace function public.admin_decide_coach(p_user uuid, p_approve boolean, p_reason text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.profiles set coach_status = case when p_approve then 'approved' else 'rejected' end
  where id = p_user and account_type = 'coach';
  update public.coach_applications set status = case when p_approve then 'approved' else 'rejected' end,
         reason = case when p_approve then null else left(p_reason, 300) end, reviewed_by = auth.uid(), reviewed_at = now()
  where id = (select id from public.coach_applications where user_id = p_user and status in ('pending', 'approved', 'rejected') order by created_at desc limit 1);
  return found or exists (select 1 from public.profiles where id = p_user);
end;
$$;
revoke all on function public.admin_decide_coach(uuid, boolean, text) from public, anon;
grant execute on function public.admin_decide_coach(uuid, boolean, text) to authenticated;

-- Find users (by name, username or email) for support.
create or replace function public.admin_users(p_q text default '')
returns table (id uuid, name text, username text, email text, account_type text, coach_status text, joined timestamptz, last_day date, is_admin boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
  select p.id, p.name, p.username, p.email, p.account_type, p.coach_status, p.created_at,
         greatest((select max(f.day) from public.food_logs f where f.user_id = p.id), (select max(w.day) from public.workout_logs w where w.user_id = p.id)),
         exists (select 1 from public.admins ad where ad.user_id = p.id)
  from public.profiles p
  where coalesce(p_q, '') = '' or p.username ilike '%' || p_q || '%' or p.name ilike '%' || p_q || '%' or p.email ilike '%' || p_q || '%'
  order by p.created_at desc limit 100;
end;
$$;
revoke all on function public.admin_users(text) from public, anon;
grant execute on function public.admin_users(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Coach programs, meal plans, packages, assignment, inbox, broadcast
-- ---------------------------------------------------------------------------
create table if not exists public.coach_programs (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  days        jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);
create table if not exists public.coach_meal_plans (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  meals       jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);
do $$
declare t text;
begin
  foreach t in array array['coach_programs', 'coach_meal_plans'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Coach owns" on public.%I', t);
    execute format('create policy "Coach owns" on public.%I for all to authenticated
                    using ((select auth.uid()) = coach_id) with check ((select auth.uid()) = coach_id and public.is_approved_coach((select auth.uid())))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

alter table public.coach_clients add column if not exists program_id uuid references public.coach_programs (id) on delete set null;
alter table public.coach_clients add column if not exists meal_plan_id uuid references public.coach_meal_plans (id) on delete set null;
alter table public.coach_clients add column if not exists package text check (char_length(package) <= 60);
alter table public.coach_profiles add column if not exists coach_type text not null default 'Personal';
alter table public.coach_profiles add column if not exists packages jsonb not null default '[]'::jsonb;
alter table public.coach_profiles add column if not exists max_clients integer not null default 20 check (max_clients between 1 and 500);
alter table public.coach_profiles add column if not exists socials jsonb not null default '{}'::jsonb;

create or replace function public.coach_assign(p_link uuid, p_program uuid, p_meal uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_program is not null and not exists (select 1 from public.coach_programs where id = p_program and coach_id = auth.uid()) then return false; end if;
  if p_meal is not null and not exists (select 1 from public.coach_meal_plans where id = p_meal and coach_id = auth.uid()) then return false; end if;
  update public.coach_clients set program_id = p_program, meal_plan_id = p_meal where id = p_link and coach_id = auth.uid() and status = 'active';
  return found;
end;
$$;
revoke all on function public.coach_assign(uuid, uuid, uuid) from public, anon;
grant execute on function public.coach_assign(uuid, uuid, uuid) to authenticated;

-- Client: the program and meal plan your coach gave you.
create or replace function public.my_coach_plans()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'program', (select jsonb_build_object('id', p.id, 'name', p.name, 'days', p.days, 'updated_at', p.updated_at) from public.coach_programs p where p.id = c.program_id),
    'meals', (select jsonb_build_object('id', m.id, 'name', m.name, 'meals', m.meals, 'updated_at', m.updated_at) from public.coach_meal_plans m where m.id = c.meal_plan_id))
  from public.coach_clients c where c.client_id = auth.uid() and c.status = 'active' limit 1;
$$;
revoke all on function public.my_coach_plans() from public, anon;
grant execute on function public.my_coach_plans() to authenticated;

-- Coach inbox: one row per active client with the last message.
create or replace function public.coach_inbox()
returns table (link_id uuid, client_id uuid, name text, username text, last_text text, last_sender uuid, last_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.client_id, p.name, p.username, m.text, m.sender, m.created_at
  from public.coach_clients c join public.profiles p on p.id = c.client_id
  left join lateral (select * from public.coach_messages x where x.link_id = c.id order by x.created_at desc limit 1) m on true
  where c.coach_id = auth.uid() and c.status = 'active'
  order by m.created_at desc nulls last, p.name;
$$;
revoke all on function public.coach_inbox() from public, anon;
grant execute on function public.coach_inbox() to authenticated;

create or replace function public.coach_broadcast(p_text text)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not public.is_approved_coach(auth.uid()) or char_length(trim(p_text)) = 0 then return 0; end if;
  insert into public.coach_messages (link_id, sender, text)
  select id, auth.uid(), left(trim(p_text), 2000) from public.coach_clients where coach_id = auth.uid() and status = 'active';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.coach_broadcast(text) from public, anon;
grant execute on function public.coach_broadcast(text) to authenticated;

-- Listing now includes packages, spots left and coach type; full coaches are hidden.
drop function if exists public.list_coaches();
create or replace function public.list_coaches()
returns table (id uuid, name text, username text, bio text, specialties text[], city text, gym text, price_month int, years int, clients int, coach_type text, packages jsonb, spots int, socials jsonb)
language sql stable security definer set search_path = '' as $$
  select * from (
    select p.id, p.name, p.username, cp.bio, cp.specialties, cp.city, cp.gym, cp.price_month, cp.years::int,
      (select count(*)::int from public.coach_clients c where c.coach_id = p.id and c.status = 'active') as clients,
      cp.coach_type, cp.packages, cp.max_clients, cp.socials
    from public.coach_profiles cp join public.profiles p on p.id = cp.user_id
    where cp.listed and p.account_type = 'coach' and p.coach_status = 'approved' and auth.uid() is not null
  ) x
  where x.clients < x.max_clients
  order by x.name;
$$;
revoke all on function public.list_coaches() from public, anon;
grant execute on function public.list_coaches() to authenticated;

-- Request a coach with a chosen package.
create or replace function public.request_coach_package(p_coach uuid, p_package text)
returns text language plpgsql security definer set search_path = '' as $$
declare r text;
begin
  r := public.request_coach(p_coach);
  if r = 'ok' then
    update public.coach_clients set package = left(p_package, 60) where client_id = auth.uid() and coach_id = p_coach and status = 'requested';
  end if;
  return r;
end;
$$;
revoke all on function public.request_coach_package(uuid, text) from public, anon;
grant execute on function public.request_coach_package(uuid, text) to authenticated;

-- coach_list now also returns the package, program and meal plan.
drop function if exists public.coach_list();
create or replace function public.coach_list()
returns table (id uuid, client_id uuid, name text, username text, status text, code text, kcal int, protein int, created_at timestamptz, last_day date, streak int, package text, program_id uuid, meal_plan_id uuid)
language sql stable security definer set search_path = '' as $$
  select c.id, c.client_id, p.name, p.username, c.status, c.code, c.kcal, c.protein, c.created_at,
    greatest((select max(day) from public.food_logs f where f.user_id = c.client_id), (select max(day) from public.workout_logs w where w.user_id = c.client_id)),
    case when c.status = 'active' then public.user_streak(c.client_id) end, c.package, c.program_id, c.meal_plan_id
  from public.coach_clients c left join public.profiles p on p.id = c.client_id
  where c.coach_id = auth.uid() and c.status <> 'ended'
  order by c.status, c.created_at desc;
$$;
revoke all on function public.coach_list() from public, anon;
grant execute on function public.coach_list() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Profile showcase (badges and records you pin for friends)
-- ---------------------------------------------------------------------------
create table if not exists public.profile_showcase (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  badges      jsonb not null default '[]'::jsonb,
  prs         jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.profile_showcase enable row level security;
drop policy if exists "Own rows only" on public.profile_showcase;
create policy "Own rows only" on public.profile_showcase for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.profile_showcase from anon;
grant select, insert, update, delete on public.profile_showcase to authenticated;

create or replace function public.friend_showcase(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when p_id = auth.uid() or public.are_friends(auth.uid(), p_id)
    then (select jsonb_build_object('badges', s.badges, 'prs', s.prs) from public.profile_showcase s where s.user_id = p_id) end;
$$;
revoke all on function public.friend_showcase(uuid) from public, anon;
grant execute on function public.friend_showcase(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Invites
-- ---------------------------------------------------------------------------
create table if not exists public.referrals (
  referred    uuid primary key references auth.users (id) on delete cascade,
  referrer    uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  check (referred <> referrer)
);
alter table public.referrals enable row level security;
drop policy if exists "See own referrals" on public.referrals;
create policy "See own referrals" on public.referrals for select to authenticated using ((select auth.uid()) in (referrer, referred));
revoke all on public.referrals from anon, authenticated;
grant select on public.referrals to authenticated;

-- A new member says who invited them (once, within 14 days of joining).
create or replace function public.claim_referral(p_username text)
returns text language plpgsql security definer set search_path = '' as $$
declare r uuid;
begin
  if auth.uid() is null then return 'auth'; end if;
  if exists (select 1 from public.referrals where referred = auth.uid()) then return 'done'; end if;
  if (select created_at from auth.users where id = auth.uid()) < now() - interval '14 days' then return 'too_late'; end if;
  select id into r from public.profiles where username = lower(trim(ltrim(p_username, '@')));
  if r is null or r = auth.uid() then return 'bad'; end if;
  insert into public.referrals (referred, referrer) values (auth.uid(), r);
  return 'ok';
end;
$$;
revoke all on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;

create or replace function public.my_referrals()
returns table (name text, username text, joined timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.name, p.username, r.created_at from public.referrals r join public.profiles p on p.id = r.referred
  where r.referrer = auth.uid() order by r.created_at desc;
$$;
revoke all on function public.my_referrals() from public, anon;
grant execute on function public.my_referrals() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Live group workouts
-- ---------------------------------------------------------------------------
create table if not exists public.group_sessions (
  id          uuid primary key default gen_random_uuid(),
  host        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout     jsonb not null,
  status      text not null default 'open' check (status in ('open', 'live', 'done')),
  created_at  timestamptz not null default now(),
  started_at  timestamptz,
  ended_at    timestamptz
);
create table if not exists public.group_session_members (
  session_id  uuid not null references public.group_sessions (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  level       text not null default 'Intermediate' check (level in ('Beginner', 'Intermediate', 'Advanced')),
  joined      boolean not null default false,
  done        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (session_id, user_id)
);
alter table public.group_sessions enable row level security;
alter table public.group_session_members enable row level security;
revoke all on public.group_sessions, public.group_session_members from anon, authenticated;

create or replace function public.in_session(s uuid, u uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_session_members where session_id = s and user_id = u);
$$;
revoke all on function public.in_session(uuid, uuid) from public, anon;
grant execute on function public.in_session(uuid, uuid) to authenticated;

drop policy if exists "Members see sessions" on public.group_sessions;
create policy "Members see sessions" on public.group_sessions for select to authenticated using (public.in_session(id, (select auth.uid())));
grant select on public.group_sessions to authenticated;
drop policy if exists "Members see members" on public.group_session_members;
create policy "Members see members" on public.group_session_members for select to authenticated using (public.in_session(session_id, (select auth.uid())));
drop policy if exists "Update own progress" on public.group_session_members;
create policy "Update own progress" on public.group_session_members for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select on public.group_session_members to authenticated;
grant update (level, joined, done, updated_at) on public.group_session_members to authenticated;

-- Start a group workout with friends (up to 4).
create or replace function public.start_group_session(p_workout jsonb, p_members uuid[], p_levels text[], p_my_level text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare s uuid; i int;
begin
  if auth.uid() is null then raise exception 'auth'; end if;
  update public.group_sessions set status = 'done', ended_at = now() where host = auth.uid() and status <> 'done';
  insert into public.group_sessions (host, workout) values (auth.uid(), p_workout) returning id into s;
  insert into public.group_session_members (session_id, user_id, level, joined) values (s, auth.uid(), coalesce(p_my_level, 'Intermediate'), true);
  for i in 1 .. least(coalesce(array_length(p_members, 1), 0), 4) loop
    if public.are_friends(auth.uid(), p_members[i]) then
      insert into public.group_session_members (session_id, user_id, level) values (s, p_members[i], coalesce(p_levels[i], 'Intermediate')) on conflict do nothing;
    end if;
  end loop;
  return s;
end;
$$;
revoke all on function public.start_group_session(jsonb, uuid[], text[], text) from public, anon;
grant execute on function public.start_group_session(jsonb, uuid[], text[], text) to authenticated;

create or replace function public.set_group_session_status(p_id uuid, p_status text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.group_sessions set status = p_status,
    started_at = case when p_status = 'live' then coalesce(started_at, now()) else started_at end,
    ended_at = case when p_status = 'done' then now() else ended_at end
  where id = p_id and host = auth.uid() and p_status in ('live', 'done');
  return found;
end;
$$;
revoke all on function public.set_group_session_status(uuid, text) from public, anon;
grant execute on function public.set_group_session_status(uuid, text) to authenticated;

-- Group workouts you're invited to or part of (last 12 hours).
create or replace function public.my_group_sessions()
returns table (id uuid, host uuid, host_name text, status text, created_at timestamptz, members int, joined boolean)
language sql stable security definer set search_path = '' as $$
  select s.id, s.host, p.name, s.status, s.created_at, (select count(*)::int from public.group_session_members x where x.session_id = s.id), m.joined
  from public.group_sessions s join public.group_session_members m on m.session_id = s.id and m.user_id = auth.uid()
  join public.profiles p on p.id = s.host
  where s.status <> 'done' and s.created_at > now() - interval '12 hours'
  order by s.created_at desc;
$$;
revoke all on function public.my_group_sessions() from public, anon;
grant execute on function public.my_group_sessions() to authenticated;

create or replace function public.group_session_board(p_id uuid)
returns table (user_id uuid, name text, username text, level text, joined boolean, done jsonb, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.user_id, p.name, p.username, m.level, m.joined, m.done, m.updated_at
  from public.group_session_members m join public.profiles p on p.id = m.user_id
  where m.session_id = p_id and public.in_session(p_id, auth.uid());
$$;
revoke all on function public.group_session_board(uuid) from public, anon;
grant execute on function public.group_session_board(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Cycle partner sharing (you choose a friend and what they see)
-- ---------------------------------------------------------------------------
create table if not exists public.cycle_partner (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  partner_id  uuid not null references auth.users (id) on delete cascade,
  share       jsonb not null default '{"phase": true, "period": true, "fertile": false}'::jsonb,
  summary     jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.cycle_partner enable row level security;
drop policy if exists "Own rows only" on public.cycle_partner;
create policy "Own rows only" on public.cycle_partner for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and public.are_friends((select auth.uid()), partner_id));
revoke all on public.cycle_partner from anon;
grant select, insert, update, delete on public.cycle_partner to authenticated;

-- Partner: what the people who share their cycle with you chose to show.
create or replace function public.partner_cycles()
returns table (user_id uuid, name text, summary jsonb, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.user_id, p.name, c.summary, c.updated_at
  from public.cycle_partner c join public.profiles p on p.id = c.user_id
  where c.partner_id = auth.uid() and public.are_friends(c.user_id, auth.uid());
$$;
revoke all on function public.partner_cycles() from public, anon;
grant execute on function public.partner_cycles() to authenticated;

-- Cycle mode settings get a couple of privacy options.
alter table public.cycle_settings add column if not exists lock boolean not null default false;

-- Keep the profile email in step when someone changes their login email.
create or replace function public.sync_profile_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;
drop trigger if exists on_auth_email_change on auth.users;
create trigger on_auth_email_change after update of email on auth.users
  for each row when (old.email is distinct from new.email) execute function public.sync_profile_email();
