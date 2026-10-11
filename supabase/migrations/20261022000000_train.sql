-- Gymi, Train area: recovery log, scheduled group workouts, real sets in group workouts,
-- swap an exercise for everyone, join and auto-start, friends' training level.

-- ---------------------------------------------------------------------------
-- 1. Recovery you did today (stretching, nap, sauna…). Adds up to +6 to the recovery score.
-- ---------------------------------------------------------------------------
create table if not exists public.recovery_logs (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  tools       text[] not null default '{}' check (cardinality(tools) <= 10),
  updated_at  timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.recovery_logs enable row level security;
drop policy if exists "Own rows only" on public.recovery_logs;
create policy "Own rows only" on public.recovery_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.recovery_logs from anon;
grant select, insert, update, delete on public.recovery_logs to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Group workouts: a planned time, turn order, and each person's real sets.
-- ---------------------------------------------------------------------------
alter table public.group_sessions add column if not exists scheduled_at timestamptz;
alter table public.group_session_members add column if not exists pos smallint not null default 0;
-- {exercise id: {reps, sets: [{w, r, done}]}}; missing exercises use the level's sets and reps.
alter table public.group_session_members add column if not exists sets jsonb not null default '{}'::jsonb;
grant update (level, joined, done, sets, updated_at) on public.group_session_members to authenticated;

drop function if exists public.start_group_session(jsonb, uuid[], text[], text);
drop function if exists public.start_group_session(jsonb, uuid[], text[], text, timestamptz);
create function public.start_group_session(p_workout jsonb, p_members uuid[], p_levels text[], p_my_level text, p_scheduled timestamptz default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare s uuid; i int; k int := 1;
begin
  if auth.uid() is null then raise exception 'auth'; end if;
  if jsonb_typeof(p_workout) <> 'array' or jsonb_array_length(p_workout) > 12 then raise exception 'workout'; end if;
  -- Starting now ends your other running workouts (planned ones for later stay).
  if p_scheduled is null then
    update public.group_sessions set status = 'done', ended_at = now()
    where host = auth.uid() and status <> 'done' and (scheduled_at is null or scheduled_at < now() + interval '30 minutes');
  end if;
  insert into public.group_sessions (host, workout, scheduled_at) values (auth.uid(), p_workout, p_scheduled) returning id into s;
  insert into public.group_session_members (session_id, user_id, level, joined, pos)
  values (s, auth.uid(), coalesce(p_my_level, 'Intermediate'), p_scheduled is null, 0);
  for i in 1 .. least(coalesce(array_length(p_members, 1), 0), 4) loop
    if public.are_friends(auth.uid(), p_members[i]) then
      insert into public.group_session_members (session_id, user_id, level, pos)
      values (s, p_members[i], coalesce(p_levels[i], 'Intermediate'), k) on conflict do nothing;
      k := k + 1;
    end if;
  end loop;
  return s;
end;
$$;
revoke all on function public.start_group_session(jsonb, uuid[], text[], text, timestamptz) from public, anon;
grant execute on function public.start_group_session(jsonb, uuid[], text[], text, timestamptz) to authenticated;

-- Host: start ('live') or finish ('done').
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

-- Tap Start: you're in. When everyone is in, the workout starts by itself.
create or replace function public.join_group_session(p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare st text;
begin
  update public.group_session_members set joined = true, updated_at = now() where session_id = p_id and user_id = auth.uid();
  if not found then return 'none'; end if;
  update public.group_sessions set status = 'live', started_at = coalesce(started_at, now())
  where id = p_id and status = 'open'
    and not exists (select 1 from public.group_session_members m where m.session_id = p_id and not m.joined);
  select status into st from public.group_sessions where id = p_id;
  return st;
end;
$$;
revoke all on function public.join_group_session(uuid) from public, anon;
grant execute on function public.join_group_session(uuid) to authenticated;

-- Cancel: the host ends it for everyone; anyone else just leaves.
create or replace function public.leave_group_session(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.group_sessions set status = 'done', ended_at = now() where id = p_id and host = auth.uid() and status <> 'done';
  if found then return true; end if;
  delete from public.group_session_members where session_id = p_id and user_id = auth.uid() and user_id <> (select host from public.group_sessions where id = p_id);
  return found;
end;
$$;
revoke all on function public.leave_group_session(uuid) from public, anon;
grant execute on function public.leave_group_session(uuid) to authenticated;

-- Host: swap exercise number p_index (0-based) for everyone, e.g. when a machine is busy.
create or replace function public.swap_group_exercise(p_id uuid, p_index int, p_ex jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if jsonb_typeof(p_ex) <> 'object' or coalesce(p_ex ->> 'id', '') = '' or length(p_ex::text) > 400 then return false; end if;
  update public.group_sessions set workout = jsonb_set(workout, array[p_index::text], p_ex)
  where id = p_id and host = auth.uid() and status <> 'done' and p_index >= 0 and p_index < jsonb_array_length(workout);
  return found;
end;
$$;
revoke all on function public.swap_group_exercise(uuid, int, jsonb) from public, anon;
grant execute on function public.swap_group_exercise(uuid, int, jsonb) to authenticated;

-- Group workouts you're invited to or part of: running ones (last 12 hours) and planned ones.
drop function if exists public.my_group_sessions();
create function public.my_group_sessions()
returns table (id uuid, host uuid, host_name text, status text, created_at timestamptz, members int, joined boolean, scheduled_at timestamptz, people jsonb)
language sql stable security definer set search_path = '' as $$
  select s.id, s.host, p.name, s.status, s.created_at,
         (select count(*)::int from public.group_session_members x where x.session_id = s.id), m.joined, s.scheduled_at,
         (select coalesce(jsonb_agg(jsonb_build_object('id', x.user_id, 'name', q.name, 'username', q.username, 'joined', x.joined) order by x.pos), '[]'::jsonb)
            from public.group_session_members x join public.profiles q on q.id = x.user_id where x.session_id = s.id)
  from public.group_sessions s join public.group_session_members m on m.session_id = s.id and m.user_id = auth.uid()
  join public.profiles p on p.id = s.host
  where s.status <> 'done' and coalesce(s.scheduled_at, s.created_at) > now() - interval '12 hours'
  order by coalesce(s.scheduled_at, s.created_at);
$$;
revoke all on function public.my_group_sessions() from public, anon;
grant execute on function public.my_group_sessions() to authenticated;

drop function if exists public.group_session_board(uuid);
create function public.group_session_board(p_id uuid)
returns table (user_id uuid, name text, username text, level text, joined boolean, done jsonb, updated_at timestamptz, pos smallint, sets jsonb)
language sql stable security definer set search_path = '' as $$
  select m.user_id, p.name, p.username, m.level, m.joined, m.done, m.updated_at, m.pos, m.sets
  from public.group_session_members m join public.profiles p on p.id = m.user_id
  where m.session_id = p_id and public.in_session(p_id, auth.uid())
  order by m.pos;
$$;
revoke all on function public.group_session_board(uuid) from public, anon;
grant execute on function public.group_session_board(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Friends' training level for Train together: the level they picked, or a guess from
--    how many workouts they logged in the last 6 months. Null when unknown. Friends only.
-- ---------------------------------------------------------------------------
create or replace function public.friend_levels(p_ids uuid[])
returns table (id uuid, level text)
language sql stable security definer set search_path = '' as $$
  select u.id,
         coalesce(
           (select case when tp.plan ->> 'level' in ('Beginner', 'Intermediate', 'Advanced') then tp.plan ->> 'level' end
              from public.train_plans tp where tp.user_id = u.id),
           (select case when count(*) >= 60 then 'Advanced' when count(*) >= 12 then 'Intermediate' when count(*) >= 1 then 'Beginner' end
              from public.workout_logs w where w.user_id = u.id and w.day > current_date - 183))
  from unnest(p_ids[1:20]) as u(id)
  where public.are_friends(auth.uid(), u.id);
$$;
revoke all on function public.friend_levels(uuid[]) from public, anon;
grant execute on function public.friend_levels(uuid[]) to authenticated;
