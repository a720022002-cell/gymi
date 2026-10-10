-- Gymi, Phase 6: Gym Bros (friends, feed, groups, challenges), coaches, and cycle tracking.
-- Friends only ever see what the other person chose to share. Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Friends
-- ---------------------------------------------------------------------------
create table if not exists public.friend_share (
  user_id   uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  workouts  boolean not null default true,
  prs       boolean not null default true,
  streak    boolean not null default true,
  weight    boolean not null default false,
  body      boolean not null default false
);

create table if not exists public.friendships (
  id          uuid primary key default gen_random_uuid(),
  requester   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  addressee   uuid not null references auth.users (id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at  timestamptz not null default now(),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships f
                 where f.status = 'accepted'
                   and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a)));
$$;
revoke all on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- Days in a row with anything logged (food, water, workout, check-in), up to 400.
create or replace function public.user_streak(p_user uuid)
returns int language plpgsql stable security definer set search_path = '' as $$
declare d date := current_date; n int := 0;
begin
  if not exists (select 1 from public.food_logs where user_id = p_user and day = d)
     and not exists (select 1 from public.water_logs where user_id = p_user and day = d)
     and not exists (select 1 from public.workout_logs where user_id = p_user and day = d)
     and not exists (select 1 from public.checkins where user_id = p_user and day = d) then
    d := d - 1;
  end if;
  loop
    exit when n >= 400;
    exit when not (exists (select 1 from public.food_logs where user_id = p_user and day = d)
                or exists (select 1 from public.water_logs where user_id = p_user and day = d)
                or exists (select 1 from public.workout_logs where user_id = p_user and day = d)
                or exists (select 1 from public.checkins where user_id = p_user and day = d));
    n := n + 1;
    d := d - 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.user_streak(uuid) from public, anon, authenticated;

-- Find someone by their exact username (no browsing or partial search, for privacy).
create or replace function public.find_user(p_username text)
returns table (id uuid, username text, name text, relation text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.name,
    case
      when p.id = auth.uid() then 'self'
      when exists (select 1 from public.friendships f where f.status = 'accepted' and ((f.requester = auth.uid() and f.addressee = p.id) or (f.addressee = auth.uid() and f.requester = p.id))) then 'friends'
      when exists (select 1 from public.friendships f where f.status = 'pending' and f.requester = auth.uid() and f.addressee = p.id) then 'sent'
      when exists (select 1 from public.friendships f where f.status = 'pending' and f.addressee = auth.uid() and f.requester = p.id) then 'received'
      else 'none'
    end
  from public.profiles p
  where auth.uid() is not null and p.username = lower(trim(ltrim(p_username, '@')));
$$;
revoke all on function public.find_user(text) from public, anon;
grant execute on function public.find_user(text) to authenticated;

-- Your friends and requests, with what each friend shares on their card.
create or replace function public.my_friends()
returns table (friendship_id uuid, id uuid, username text, name text, status text, incoming boolean, streak int, last_workout text, last_day date)
language sql stable security definer set search_path = '' as $$
  select f.id, p.id, p.username, p.name, f.status, f.addressee = auth.uid(),
    case when f.status = 'accepted' and coalesce(s.streak, true) then public.user_streak(p.id) end,
    case when f.status = 'accepted' and coalesce(s.workouts, true) then (select w.name from public.workout_logs w where w.user_id = p.id order by w.started_at desc limit 1) end,
    case when f.status = 'accepted' and coalesce(s.workouts, true) then (select w.day from public.workout_logs w where w.user_id = p.id order by w.started_at desc limit 1) end
  from public.friendships f
  join public.profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  left join public.friend_share s on s.user_id = p.id
  where auth.uid() in (f.requester, f.addressee)
  order by f.status, p.name;
$$;
revoke all on function public.my_friends() from public, anon;
grant execute on function public.my_friends() to authenticated;

-- One friend's profile: only what they chose to share.
create or replace function public.friend_profile(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s public.friend_share; p public.profiles; out jsonb;
begin
  if not public.are_friends(auth.uid(), p_id) then return null; end if;
  select * into p from public.profiles where id = p_id;
  select * into s from public.friend_share where user_id = p_id;
  out := jsonb_build_object('id', p.id, 'username', p.username, 'name', p.name,
    'share', jsonb_build_object('workouts', coalesce(s.workouts, true), 'prs', coalesce(s.prs, true), 'streak', coalesce(s.streak, true), 'weight', coalesce(s.weight, false), 'body', coalesce(s.body, false)));
  if coalesce(s.streak, true) then out := out || jsonb_build_object('streak', public.user_streak(p_id)); end if;
  if coalesce(s.workouts, true) then
    out := out || jsonb_build_object(
      'week', (select count(*) from public.workout_logs w where w.user_id = p_id and w.day > current_date - 7),
      'workouts', coalesce((select jsonb_agg(x) from (select w.name, w.day, w.minutes, w.volume from public.workout_logs w where w.user_id = p_id order by w.started_at desc limit 5) x), '[]'::jsonb));
  end if;
  if coalesce(s.prs, true) then
    out := out || jsonb_build_object('prs', coalesce((
      select jsonb_agg(x) from (
        select r ->> 'n' as n, max((r ->> 'w')::numeric) as w
        from public.workout_logs w, jsonb_array_elements(w.prs) r
        where w.user_id = p_id group by r ->> 'n' order by max((r ->> 'w')::numeric) desc limit 5) x), '[]'::jsonb));
  end if;
  if coalesce(s.weight, false) then
    out := out || jsonb_build_object('weights', coalesce((select jsonb_agg(x order by x.day) from (select m.day, m.value from public.measurements m where m.user_id = p_id and m.kind = 'weight' order by m.day desc limit 20) x), '[]'::jsonb));
  end if;
  if coalesce(s.body, false) then
    out := out || jsonb_build_object('body', coalesce((select jsonb_object_agg(x.kind, x.value) from (select distinct on (m.kind) m.kind, m.value from public.measurements m where m.user_id = p_id and m.kind <> 'weight' order by m.kind, m.day desc) x), '{}'::jsonb));
  end if;
  return out;
end;
$$;
revoke all on function public.friend_profile(uuid) from public, anon;
grant execute on function public.friend_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Activity feed and cheers
-- ---------------------------------------------------------------------------
create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('workout', 'pr', 'streak', 'badge', 'post')),
  text        text not null check (char_length(text) between 1 and 300),
  data        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists activities_user_time on public.activities (user_id, created_at desc);

create table if not exists public.cheers (
  activity_id  uuid not null references public.activities (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (activity_id, user_id)
);

-- Friends' activity (and yours) with names and cheer counts.
create or replace function public.feed(p_limit int default 40)
returns table (id uuid, user_id uuid, name text, username text, kind text, text text, data jsonb, created_at timestamptz, cheers int, cheered boolean)
language sql stable security definer set search_path = '' as $$
  select a.id, a.user_id, p.name, p.username, a.kind, a.text, a.data, a.created_at,
    (select count(*)::int from public.cheers c where c.activity_id = a.id),
    exists (select 1 from public.cheers c where c.activity_id = a.id and c.user_id = auth.uid())
  from public.activities a join public.profiles p on p.id = a.user_id
  where a.user_id = auth.uid() or public.are_friends(a.user_id, auth.uid())
  order by a.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;
revoke all on function public.feed(int) from public, anon;
grant execute on function public.feed(int) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Groups
-- ---------------------------------------------------------------------------
create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 30),
  owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create table if not exists public.group_members (
  group_id  uuid not null references public.groups (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  primary key (group_id, user_id)
);
create table if not exists public.group_posts (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 300),
  created_at  timestamptz not null default now()
);

create or replace function public.is_group_member(g uuid, u uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members where group_id = g and user_id = u);
$$;
revoke all on function public.is_group_member(uuid, uuid) from public, anon;
grant execute on function public.is_group_member(uuid, uuid) to authenticated;

-- Make a group with friends. Only friends can be added.
create or replace function public.create_group(p_name text, p_members uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare g uuid; m uuid;
begin
  if auth.uid() is null then raise exception 'auth'; end if;
  insert into public.groups (name, owner) values (left(trim(p_name), 30), auth.uid()) returning id into g;
  insert into public.group_members values (g, auth.uid());
  foreach m in array coalesce(p_members, '{}') loop
    if public.are_friends(auth.uid(), m) then insert into public.group_members values (g, m) on conflict do nothing; end if;
  end loop;
  return g;
end;
$$;
revoke all on function public.create_group(text, uuid[]) from public, anon;
grant execute on function public.create_group(text, uuid[]) to authenticated;

create or replace function public.add_group_member(p_group uuid, p_user uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_group_member(p_group, auth.uid()) or not public.are_friends(auth.uid(), p_user) then return false; end if;
  insert into public.group_members values (p_group, p_user) on conflict do nothing;
  return true;
end;
$$;
revoke all on function public.add_group_member(uuid, uuid) from public, anon;
grant execute on function public.add_group_member(uuid, uuid) to authenticated;

-- Members with workouts and volume this week (only for people who share workouts).
create or replace function public.group_board(p_group uuid)
returns table (user_id uuid, name text, username text, workouts int, volume numeric)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.username,
    case when p.id = auth.uid() or coalesce(s.workouts, true) then (select count(*)::int from public.workout_logs w where w.user_id = p.id and w.day >= date_trunc('week', current_date + 1)::date - 1) end,
    case when p.id = auth.uid() or coalesce(s.workouts, true) then (select coalesce(sum(w.volume), 0) from public.workout_logs w where w.user_id = p.id and w.day >= date_trunc('week', current_date + 1)::date - 1) end
  from public.group_members gm join public.profiles p on p.id = gm.user_id
  left join public.friend_share s on s.user_id = p.id
  where gm.group_id = p_group and public.is_group_member(p_group, auth.uid());
$$;
revoke all on function public.group_board(uuid) from public, anon;
grant execute on function public.group_board(uuid) to authenticated;

create or replace function public.group_feed(p_group uuid)
returns table (id uuid, user_id uuid, name text, text text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select gp.id, gp.user_id, p.name, gp.text, gp.created_at
  from public.group_posts gp join public.profiles p on p.id = gp.user_id
  where gp.group_id = p_group and public.is_group_member(p_group, auth.uid())
  order by gp.created_at desc limit 50;
$$;
revoke all on function public.group_feed(uuid) from public, anon;
grant execute on function public.group_feed(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Challenges
-- ---------------------------------------------------------------------------
create table if not exists public.challenges (
  id          uuid primary key default gen_random_uuid(),
  creator     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('steps', 'workouts', 'volume')),
  start_day   date not null,
  end_day     date not null,
  created_at  timestamptz not null default now(),
  check (end_day >= start_day and end_day - start_day <= 60)
);
create table if not exists public.challenge_members (
  challenge_id  uuid not null references public.challenges (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  primary key (challenge_id, user_id)
);

create or replace function public.is_challenge_member(c uuid, u uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.challenge_members where challenge_id = c and user_id = u);
$$;
revoke all on function public.is_challenge_member(uuid, uuid) from public, anon;
grant execute on function public.is_challenge_member(uuid, uuid) to authenticated;

create or replace function public.create_challenge(p_kind text, p_days int, p_members uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare c uuid; m uuid;
begin
  if auth.uid() is null then raise exception 'auth'; end if;
  insert into public.challenges (creator, kind, start_day, end_day)
  values (auth.uid(), p_kind, current_date, current_date + greatest(1, least(p_days, 60)) - 1) returning id into c;
  insert into public.challenge_members values (c, auth.uid());
  foreach m in array coalesce(p_members, '{}') loop
    if public.are_friends(auth.uid(), m) then insert into public.challenge_members values (c, m) on conflict do nothing; end if;
  end loop;
  return c;
end;
$$;
revoke all on function public.create_challenge(text, int, uuid[]) from public, anon;
grant execute on function public.create_challenge(text, int, uuid[]) to authenticated;

create or replace function public.my_challenges()
returns table (id uuid, kind text, start_day date, end_day date, members int, creator_name text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.kind, c.start_day, c.end_day, (select count(*)::int from public.challenge_members x where x.challenge_id = c.id), p.name
  from public.challenges c join public.profiles p on p.id = c.creator
  where public.is_challenge_member(c.id, auth.uid())
  order by c.end_day desc limit 30;
$$;
revoke all on function public.my_challenges() from public, anon;
grant execute on function public.my_challenges() to authenticated;

create or replace function public.challenge_board(p_id uuid)
returns table (user_id uuid, name text, value numeric)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name,
    case c.kind
      when 'steps' then (select coalesce(sum(s.steps), 0) from public.step_logs s where s.user_id = p.id and s.day between c.start_day and c.end_day)
      when 'workouts' then (select count(*) from public.workout_logs w where w.user_id = p.id and w.day between c.start_day and c.end_day)
      else (select coalesce(sum(w.volume), 0) from public.workout_logs w where w.user_id = p.id and w.day between c.start_day and c.end_day)
    end
  from public.challenges c
  join public.challenge_members m on m.challenge_id = c.id
  join public.profiles p on p.id = m.user_id
  where c.id = p_id and public.is_challenge_member(p_id, auth.uid());
$$;
revoke all on function public.challenge_board(uuid) from public, anon;
grant execute on function public.challenge_board(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Coaches
-- ---------------------------------------------------------------------------
create or replace function public.is_approved_coach(u uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = u and account_type = 'coach' and coach_status = 'approved');
$$;
revoke all on function public.is_approved_coach(uuid) from public, anon;
grant execute on function public.is_approved_coach(uuid) to authenticated;

create table if not exists public.coach_profiles (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  bio          text not null default '' check (char_length(bio) <= 600),
  specialties  text[] not null default '{}',
  city         text not null default '' check (char_length(city) <= 60),
  gym          text not null default '' check (char_length(gym) <= 80),
  price_month  integer check (price_month between 0 and 100000),
  years        smallint check (years between 0 and 60),
  listed       boolean not null default true,
  updated_at   timestamptz not null default now()
);

create table if not exists public.coach_clients (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references auth.users (id) on delete cascade,
  client_id   uuid references auth.users (id) on delete cascade,
  code        text unique,
  status      text not null check (status in ('invited', 'requested', 'active', 'ended')),
  kcal        integer check (kcal between 800 and 6000),
  protein     integer check (protein between 20 and 400),
  created_at  timestamptz not null default now(),
  check (coach_id <> client_id)
);
create index if not exists coach_clients_coach on public.coach_clients (coach_id, status);
create index if not exists coach_clients_client on public.coach_clients (client_id, status);

create table if not exists public.coach_notes (
  coach_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id  uuid not null references auth.users (id) on delete cascade,
  text       text not null default '' check (char_length(text) <= 2000),
  primary key (coach_id, client_id)
);

create table if not exists public.coach_messages (
  id          uuid primary key default gen_random_uuid(),
  link_id     uuid not null references public.coach_clients (id) on delete cascade,
  sender      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists coach_messages_link on public.coach_messages (link_id, created_at);

create or replace function public.coach_link_member(l uuid, u uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coach_clients c where c.id = l and c.status = 'active' and u in (c.coach_id, c.client_id));
$$;
revoke all on function public.coach_link_member(uuid, uuid) from public, anon;
grant execute on function public.coach_link_member(uuid, uuid) to authenticated;

-- Listed, approved coaches.
create or replace function public.list_coaches()
returns table (id uuid, name text, username text, bio text, specialties text[], city text, gym text, price_month int, years int, clients int)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.username, cp.bio, cp.specialties, cp.city, cp.gym, cp.price_month, cp.years,
    (select count(*)::int from public.coach_clients c where c.coach_id = p.id and c.status = 'active')
  from public.coach_profiles cp join public.profiles p on p.id = cp.user_id
  where cp.listed and p.account_type = 'coach' and p.coach_status = 'approved' and auth.uid() is not null
  order by p.name;
$$;
revoke all on function public.list_coaches() from public, anon;
grant execute on function public.list_coaches() to authenticated;

-- Coach: make an invite code for a new client.
create or replace function public.coach_invite()
returns text language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  if not public.is_approved_coach(auth.uid()) then raise exception 'not_coach'; end if;
  loop
    c := 'GYMI-' || upper(substr(translate(encode(extensions.gen_random_bytes(6), 'base64'), '+/=0O1Il', ''), 1, 4));
    exit when length(c) = 9 and not exists (select 1 from public.coach_clients where code = c);
  end loop;
  insert into public.coach_clients (coach_id, code, status) values (auth.uid(), c, 'invited');
  return c;
end;
$$;
revoke all on function public.coach_invite() from public, anon;
grant execute on function public.coach_invite() to authenticated;

-- Member: join a coach with their code. One coach at a time.
create or replace function public.redeem_coach_code(p_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare l public.coach_clients;
begin
  if auth.uid() is null then return 'auth'; end if;
  if exists (select 1 from public.coach_clients where client_id = auth.uid() and status = 'active') then return 'has_coach'; end if;
  select * into l from public.coach_clients where code = upper(trim(p_code)) and status = 'invited' for update;
  if l.id is null then return 'bad_code'; end if;
  if l.coach_id = auth.uid() then return 'self'; end if;
  update public.coach_clients set client_id = auth.uid(), status = 'active', code = null where id = l.id;
  return 'ok';
end;
$$;
revoke all on function public.redeem_coach_code(text) from public, anon;
grant execute on function public.redeem_coach_code(text) to authenticated;

-- Member: ask a listed coach to coach you.
create or replace function public.request_coach(p_coach uuid)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return 'auth'; end if;
  if not public.is_approved_coach(p_coach) or p_coach = auth.uid() then return 'bad_coach'; end if;
  if exists (select 1 from public.coach_clients where client_id = auth.uid() and status = 'active') then return 'has_coach'; end if;
  if exists (select 1 from public.coach_clients where client_id = auth.uid() and coach_id = p_coach and status = 'requested') then return 'ok'; end if;
  insert into public.coach_clients (coach_id, client_id, status) values (p_coach, auth.uid(), 'requested');
  return 'ok';
end;
$$;
revoke all on function public.request_coach(uuid) from public, anon;
grant execute on function public.request_coach(uuid) to authenticated;

-- Coach accepts or declines a request; either side can end coaching.
create or replace function public.coach_respond(p_link uuid, p_accept boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare l public.coach_clients;
begin
  select * into l from public.coach_clients where id = p_link and coach_id = auth.uid() and status = 'requested';
  if l.id is null then return false; end if;
  if p_accept and exists (select 1 from public.coach_clients where client_id = l.client_id and status = 'active') then return false; end if;
  update public.coach_clients set status = case when p_accept then 'active' else 'ended' end where id = p_link;
  return true;
end;
$$;
revoke all on function public.coach_respond(uuid, boolean) from public, anon;
grant execute on function public.coach_respond(uuid, boolean) to authenticated;

create or replace function public.end_coaching(p_link uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.coach_clients set status = 'ended', code = null
  where id = p_link and auth.uid() in (coach_id, client_id) and status in ('active', 'requested', 'invited');
  return found;
end;
$$;
revoke all on function public.end_coaching(uuid) from public, anon;
grant execute on function public.end_coaching(uuid) to authenticated;

-- Coach: set a client's daily calories and protein.
create or replace function public.coach_set_targets(p_link uuid, p_kcal int, p_protein int)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.coach_clients set kcal = p_kcal, protein = p_protein
  where id = p_link and coach_id = auth.uid() and status = 'active';
  return found;
end;
$$;
revoke all on function public.coach_set_targets(uuid, int, int) from public, anon;
grant execute on function public.coach_set_targets(uuid, int, int) to authenticated;

-- Coach: all clients and invites, with names and last activity.
create or replace function public.coach_list()
returns table (id uuid, client_id uuid, name text, username text, status text, code text, kcal int, protein int, created_at timestamptz, last_day date, streak int)
language sql stable security definer set search_path = '' as $$
  select c.id, c.client_id, p.name, p.username, c.status, c.code, c.kcal, c.protein, c.created_at,
    greatest((select max(day) from public.food_logs f where f.user_id = c.client_id), (select max(day) from public.workout_logs w where w.user_id = c.client_id)),
    case when c.status = 'active' then public.user_streak(c.client_id) end
  from public.coach_clients c left join public.profiles p on p.id = c.client_id
  where c.coach_id = auth.uid() and c.status <> 'ended'
  order by c.status, c.created_at desc;
$$;
revoke all on function public.coach_list() from public, anon;
grant execute on function public.coach_list() to authenticated;

-- Member: your coach (active or requested).
create or replace function public.my_coach()
returns table (id uuid, coach_id uuid, name text, username text, status text, kcal int, protein int, bio text, specialties text[])
language sql stable security definer set search_path = '' as $$
  select c.id, c.coach_id, p.name, p.username, c.status, c.kcal, c.protein, cp.bio, cp.specialties
  from public.coach_clients c join public.profiles p on p.id = c.coach_id
  left join public.coach_profiles cp on cp.user_id = c.coach_id
  where c.client_id = auth.uid() and c.status in ('active', 'requested')
  order by c.status limit 1;
$$;
revoke all on function public.my_coach() from public, anon;
grant execute on function public.my_coach() to authenticated;

-- Coach: one active client's progress. Clients agree to this when they join a coach.
create or replace function public.client_summary(p_client uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.profiles; fp public.food_plans;
begin
  if not exists (select 1 from public.coach_clients where coach_id = auth.uid() and client_id = p_client and status = 'active') then return null; end if;
  select * into p from public.profiles where id = p_client;
  select * into fp from public.food_plans where user_id = p_client;
  return jsonb_build_object(
    'name', p.name, 'username', p.username, 'gender', p.gender, 'dob', p.date_of_birth, 'height', p.height_cm,
    'plan', coalesce(fp.plan, '{}'::jsonb), 'streak', public.user_streak(p_client),
    'weights', coalesce((select jsonb_agg(x order by x.day) from (select day, value from public.measurements where user_id = p_client and kind = 'weight' and day > current_date - 90) x), '[]'::jsonb),
    'workouts', coalesce((select jsonb_agg(x order by x.day desc) from (select day, name, minutes, volume, prs from public.workout_logs where user_id = p_client and day > current_date - 28) x), '[]'::jsonb),
    'food', coalesce((select jsonb_agg(x order by x.day desc) from (select day, sum(kcal)::int as kcal, round(sum(protein))::int as protein from public.food_logs where user_id = p_client and day > current_date - 14 group by day) x), '[]'::jsonb),
    'today', coalesce((select jsonb_agg(x) from (select name, meal, kcal, protein from public.food_logs where user_id = p_client and day = current_date order by created_at) x), '[]'::jsonb),
    'checkins', coalesce((select jsonb_agg(x order by x.day desc) from (select day, sleep_h, energy, sore, score from public.checkins where user_id = p_client and day > current_date - 14) x), '[]'::jsonb),
    'water', coalesce((select jsonb_agg(x order by x.day desc) from (select day, sum(ml)::int as ml from public.water_logs where user_id = p_client and day > current_date - 7 group by day) x), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.client_summary(uuid) from public, anon;
grant execute on function public.client_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Cycle tracking (never shared with friends or coaches)
-- ---------------------------------------------------------------------------
create table if not exists public.cycle_settings (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  mode        text not null default 'track' check (mode in ('track', 'ttc', 'preg', 'post', 'peri')),
  cycle_len   smallint not null default 28 check (cycle_len between 18 and 45),
  period_len  smallint not null default 5 check (period_len between 1 and 10),
  preg_week   smallint check (preg_week between 1 and 42),
  post_week   smallint check (post_week between 0 and 104),
  updated_at  timestamptz not null default now()
);
create table if not exists public.cycle_periods (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_day  date not null,
  end_day    date,
  unique (user_id, start_day),
  check (end_day is null or end_day >= start_day)
);
create table if not exists public.cycle_logs (
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day      date not null,
  data     jsonb not null default '{}'::jsonb,
  primary key (user_id, day)
);

-- ---------------------------------------------------------------------------
-- 7. Row level security
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  -- Tables only their owner can touch.
  foreach t in array array['friend_share', 'cycle_settings', 'cycle_periods', 'cycle_logs', 'activities'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Own rows only" on public.%I', t);
    execute format('create policy "Own rows only" on public.%I for all to authenticated
                    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
  -- Everything else is read through the functions above; direct access is limited below.
  foreach t in array array['friendships', 'cheers', 'groups', 'group_members', 'group_posts', 'challenges', 'challenge_members', 'coach_profiles', 'coach_clients', 'coach_notes', 'coach_messages'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Friendships: you see yours; you send requests; the other person accepts; either can remove.
drop policy if exists "See own friendships" on public.friendships;
create policy "See own friendships" on public.friendships for select to authenticated using ((select auth.uid()) in (requester, addressee));
drop policy if exists "Send requests" on public.friendships;
create policy "Send requests" on public.friendships for insert to authenticated with check ((select auth.uid()) = requester and status = 'pending');
drop policy if exists "Accept requests" on public.friendships;
create policy "Accept requests" on public.friendships for update to authenticated using ((select auth.uid()) = addressee) with check ((select auth.uid()) = addressee and status = 'accepted');
drop policy if exists "Remove friendships" on public.friendships;
create policy "Remove friendships" on public.friendships for delete to authenticated using ((select auth.uid()) in (requester, addressee));
grant select, insert, delete on public.friendships to authenticated;
grant update (status) on public.friendships to authenticated;

-- Cheers: on your friends' activity only.
create or replace function public.can_cheer(p_activity uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.activities a
                 where a.id = p_activity and a.user_id <> auth.uid() and public.are_friends(a.user_id, auth.uid()));
$$;
revoke all on function public.can_cheer(uuid) from public, anon;
grant execute on function public.can_cheer(uuid) to authenticated;

drop policy if exists "Cheer friends" on public.cheers;
create policy "Cheer friends" on public.cheers for insert to authenticated with check ((select auth.uid()) = user_id and public.can_cheer(activity_id));
drop policy if exists "Own cheers" on public.cheers;
create policy "Own cheers" on public.cheers for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Remove own cheers" on public.cheers;
create policy "Remove own cheers" on public.cheers for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, delete on public.cheers to authenticated;

-- Groups: members see them; posts by members; you can leave.
drop policy if exists "Members see groups" on public.groups;
create policy "Members see groups" on public.groups for select to authenticated using (public.is_group_member(id, (select auth.uid())));
drop policy if exists "Owner renames or deletes" on public.groups;
create policy "Owner renames or deletes" on public.groups for delete to authenticated using ((select auth.uid()) = owner);
grant select, delete on public.groups to authenticated;
drop policy if exists "Members see members" on public.group_members;
create policy "Members see members" on public.group_members for select to authenticated using (public.is_group_member(group_id, (select auth.uid())));
drop policy if exists "Leave a group" on public.group_members;
create policy "Leave a group" on public.group_members for delete to authenticated using ((select auth.uid()) = user_id);
grant select, delete on public.group_members to authenticated;
drop policy if exists "Members post" on public.group_posts;
create policy "Members post" on public.group_posts for insert to authenticated with check ((select auth.uid()) = user_id and public.is_group_member(group_id, (select auth.uid())));
drop policy if exists "Delete own posts" on public.group_posts;
create policy "Delete own posts" on public.group_posts for delete to authenticated using ((select auth.uid()) = user_id);
grant insert, delete on public.group_posts to authenticated;

-- Challenges: members see them and can leave.
drop policy if exists "Members see challenges" on public.challenges;
create policy "Members see challenges" on public.challenges for select to authenticated using (public.is_challenge_member(id, (select auth.uid())));
grant select on public.challenges to authenticated;
drop policy if exists "Leave a challenge" on public.challenge_members;
create policy "Leave a challenge" on public.challenge_members for delete to authenticated using ((select auth.uid()) = user_id);
grant delete on public.challenge_members to authenticated;

-- Coach profile: coaches edit their own.
drop policy if exists "Coach edits own profile" on public.coach_profiles;
create policy "Coach edits own profile" on public.coach_profiles for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.account_type = 'coach'));
grant select, insert, update on public.coach_profiles to authenticated;

-- Coach links: both sides can read their own; changes go through the functions above.
drop policy if exists "See own coach links" on public.coach_clients;
create policy "See own coach links" on public.coach_clients for select to authenticated using ((select auth.uid()) in (coach_id, client_id));
grant select on public.coach_clients to authenticated;

-- Coach notes: private to the coach.
drop policy if exists "Coach notes" on public.coach_notes;
create policy "Coach notes" on public.coach_notes for all to authenticated
  using ((select auth.uid()) = coach_id)
  with check ((select auth.uid()) = coach_id and exists (select 1 from public.coach_clients c where c.coach_id = (select auth.uid()) and c.client_id = coach_notes.client_id and c.status = 'active'));
grant select, insert, update, delete on public.coach_notes to authenticated;

-- Messages between a coach and an active client.
drop policy if exists "Read coach messages" on public.coach_messages;
create policy "Read coach messages" on public.coach_messages for select to authenticated using (public.coach_link_member(link_id, (select auth.uid())));
drop policy if exists "Send coach messages" on public.coach_messages;
create policy "Send coach messages" on public.coach_messages for insert to authenticated with check ((select auth.uid()) = sender and public.coach_link_member(link_id, (select auth.uid())));
grant select, insert on public.coach_messages to authenticated;
