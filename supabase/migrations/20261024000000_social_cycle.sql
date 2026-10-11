-- Gymi: Gym Bros and cycle tracking, round 2.
-- Fair challenges (exercise, weight goal, steps, progress), nudges, progress photos for friends,
-- and more cycle settings (reminders, watch temperature, pregnancy). Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Challenges: new kinds. Old kinds (workouts, volume) keep working.
-- ---------------------------------------------------------------------------
alter table public.challenges drop constraint if exists challenges_kind_check;
alter table public.challenges add constraint challenges_kind_check
  check (kind in ('exercise', 'weight', 'steps', 'progress', 'workouts', 'volume'));
alter table public.challenges add column if not exists exercise text check (char_length(exercise) <= 60);
alter table public.challenges add column if not exists exercise_name text check (char_length(exercise_name) <= 60);

-- Each person's own goal weight for a weight challenge (only they see it).
alter table public.challenge_members add column if not exists goal_weight numeric(4, 1) check (goal_weight between 30 and 250);

-- Best weight lifted on one exercise for a person in a date range.
create or replace function public.best_lift(p_user uuid, p_ex text, p_from date, p_to date)
returns numeric language sql stable security definer set search_path = '' as $$
  select max((s ->> 'w')::numeric)
  from public.workout_logs w,
       jsonb_array_elements(case when jsonb_typeof(w.exercises) = 'array' then w.exercises else '[]'::jsonb end) e,
       jsonb_array_elements(case when jsonb_typeof(e -> 'sets') = 'array' then e -> 'sets' else '[]'::jsonb end) s
  where w.user_id = p_user and w.day between p_from and p_to and e ->> 'id' = p_ex;
$$;
revoke all on function public.best_lift(uuid, text, date, date) from public, anon, authenticated;

-- One person's score in a challenge. Each kind is fair whatever the person's goal:
--   exercise: kg added to their best set on the exercise (vs. before the challenge)
--   weight:   % of the way from their start weight to their own goal weight
--   progress: % stronger on average across exercises they also did in the 60 days before
create or replace function public.challenge_score(p_kind text, p_ex text, p_start date, p_end date, p_user uuid, p_goal numeric)
returns numeric language plpgsql stable security definer set search_path = '' as $$
declare v numeric; a numeric; b numeric; first_day date;
begin
  if p_kind = 'steps' then
    select coalesce(sum(s.steps), 0) into v from public.step_logs s where s.user_id = p_user and s.day between p_start and p_end;
  elsif p_kind = 'workouts' then
    select count(*) into v from public.workout_logs w where w.user_id = p_user and w.day between p_start and p_end;
  elsif p_kind = 'volume' then
    select coalesce(sum(w.volume), 0) into v from public.workout_logs w where w.user_id = p_user and w.day between p_start and p_end;
  elsif p_kind = 'exercise' then
    a := public.best_lift(p_user, p_ex, p_start, p_end);
    b := public.best_lift(p_user, p_ex, p_start - 90, p_start - 1);
    if a is not null and b is null then
      -- First time on this exercise: start from the first session in the challenge.
      select min(w.day) into first_day from public.workout_logs w, jsonb_array_elements(case when jsonb_typeof(w.exercises) = 'array' then w.exercises else '[]'::jsonb end) e
      where w.user_id = p_user and w.day between p_start and p_end and e ->> 'id' = p_ex;
      b := public.best_lift(p_user, p_ex, first_day, first_day);
    end if;
    v := greatest(0, coalesce(a - b, 0));
  elsif p_kind = 'weight' then
    if p_goal is null then return 0; end if;
    select m.value into b from public.measurements m where m.user_id = p_user and m.kind = 'weight' and m.day < p_start order by m.day desc limit 1;
    if b is null then
      select m.value into b from public.measurements m where m.user_id = p_user and m.kind = 'weight' and m.day between p_start and p_end order by m.day limit 1;
    end if;
    select m.value into a from public.measurements m where m.user_id = p_user and m.kind = 'weight' and m.day between p_start and p_end order by m.day desc limit 1;
    if a is null or b is null or b = p_goal then return 0; end if;
    v := least(100, greatest(0, (b - a) / (b - p_goal) * 100));
  elsif p_kind = 'progress' then
    select avg(d.best / x.best - 1) * 100 into v
    from (select e ->> 'id' as id, max((s ->> 'w')::numeric) as best
          from public.workout_logs w,
               jsonb_array_elements(case when jsonb_typeof(w.exercises) = 'array' then w.exercises else '[]'::jsonb end) e,
               jsonb_array_elements(case when jsonb_typeof(e -> 'sets') = 'array' then e -> 'sets' else '[]'::jsonb end) s
          where w.user_id = p_user and w.day between p_start and p_end group by 1) d
    join (select e ->> 'id' as id, max((s ->> 'w')::numeric) as best
          from public.workout_logs w,
               jsonb_array_elements(case when jsonb_typeof(w.exercises) = 'array' then w.exercises else '[]'::jsonb end) e,
               jsonb_array_elements(case when jsonb_typeof(e -> 'sets') = 'array' then e -> 'sets' else '[]'::jsonb end) s
          where w.user_id = p_user and w.day between p_start - 60 and p_start - 1 group by 1) x on x.id = d.id
    where x.best > 0;
    v := greatest(0, coalesce(v, 0));
  end if;
  return round(coalesce(v, 0), 1);
end;
$$;
revoke all on function public.challenge_score(text, text, date, date, uuid, numeric) from public, anon, authenticated;

drop function if exists public.create_challenge(text, int, uuid[]);
create or replace function public.create_challenge(p_kind text, p_days int, p_members uuid[], p_exercise text default null, p_exercise_name text default null, p_goal numeric default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c uuid; m uuid;
begin
  if auth.uid() is null then raise exception 'auth'; end if;
  if p_kind = 'exercise' and coalesce(p_exercise, '') = '' then raise exception 'exercise'; end if;
  insert into public.challenges (creator, kind, start_day, end_day, exercise, exercise_name)
  values (auth.uid(), p_kind, current_date, current_date + greatest(1, least(p_days, 60)) - 1,
          case when p_kind = 'exercise' then left(p_exercise, 60) end, case when p_kind = 'exercise' then left(p_exercise_name, 60) end)
  returning id into c;
  insert into public.challenge_members (challenge_id, user_id, goal_weight) values (c, auth.uid(), case when p_kind = 'weight' then p_goal end);
  foreach m in array coalesce(p_members, '{}') loop
    if public.are_friends(auth.uid(), m) then insert into public.challenge_members (challenge_id, user_id) values (c, m) on conflict do nothing; end if;
  end loop;
  return c;
end;
$$;
revoke all on function public.create_challenge(text, int, uuid[], text, text, numeric) from public, anon;
grant execute on function public.create_challenge(text, int, uuid[], text, text, numeric) to authenticated;

-- Set your own goal weight for a weight challenge.
create or replace function public.set_challenge_goal(p_id uuid, p_goal numeric)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.challenge_members set goal_weight = p_goal where challenge_id = p_id and user_id = auth.uid();
  return found;
end;
$$;
revoke all on function public.set_challenge_goal(uuid, numeric) from public, anon;
grant execute on function public.set_challenge_goal(uuid, numeric) to authenticated;

drop function if exists public.challenge_board(uuid);
create function public.challenge_board(p_id uuid)
returns table (user_id uuid, name text, value numeric, has_goal boolean, goal numeric)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, public.challenge_score(c.kind, c.exercise, c.start_day, c.end_day, p.id, m.goal_weight),
    m.goal_weight is not null, case when p.id = auth.uid() then m.goal_weight end
  from public.challenges c
  join public.challenge_members m on m.challenge_id = c.id
  join public.profiles p on p.id = m.user_id
  where c.id = p_id and public.is_challenge_member(p_id, auth.uid());
$$;
revoke all on function public.challenge_board(uuid) from public, anon;
grant execute on function public.challenge_board(uuid) to authenticated;

-- Your challenges with your place on each board ("You're #2 of 4").
drop function if exists public.my_challenges();
create function public.my_challenges()
returns table (id uuid, kind text, start_day date, end_day date, members int, creator_name text, exercise_name text, my_rank int)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select c.* from public.challenges c where public.is_challenge_member(c.id, auth.uid()) order by c.end_day desc limit 30
  ), scores as (
    select m.challenge_id, m.user_id, public.challenge_score(c.kind, c.exercise, c.start_day, c.end_day, m.user_id, m.goal_weight) as v
    from mine c join public.challenge_members m on m.challenge_id = c.id
  )
  select c.id, c.kind, c.start_day, c.end_day,
    (select count(*)::int from scores s where s.challenge_id = c.id), p.name, c.exercise_name,
    1 + (select count(*)::int from scores s where s.challenge_id = c.id and s.v > (select s2.v from scores s2 where s2.challenge_id = c.id and s2.user_id = auth.uid()))
  from mine c join public.profiles p on p.id = c.creator
  order by c.end_day desc;
$$;
revoke all on function public.my_challenges() from public, anon;
grant execute on function public.my_challenges() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Nudges: remind the others in a challenge, once a day per challenge.
-- ---------------------------------------------------------------------------
create table if not exists public.challenge_nudges (
  challenge_id  uuid not null references public.challenges (id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day           date not null default current_date,
  created_at    timestamptz not null default now(),
  primary key (challenge_id, user_id, day)
);
alter table public.challenge_nudges enable row level security;
revoke all on public.challenge_nudges from anon, authenticated;
drop policy if exists "See own nudges" on public.challenge_nudges;
create policy "See own nudges" on public.challenge_nudges for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.challenge_nudges to authenticated;

-- 'sent', or 'already' when you nudged this challenge today.
create or replace function public.nudge_challenge(p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_challenge_member(p_id, auth.uid()) then return 'no'; end if;
  insert into public.challenge_nudges (challenge_id, user_id) values (p_id, auth.uid()) on conflict do nothing;
  return case when found then 'sent' else 'already' end;
end;
$$;
revoke all on function public.nudge_challenge(uuid) from public, anon;
grant execute on function public.nudge_challenge(uuid) to authenticated;

-- Nudges other people sent in your challenges (for the in-app banner).
create or replace function public.my_nudges(p_since timestamptz)
returns table (challenge_id uuid, kind text, exercise_name text, from_id uuid, from_name text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.challenge_id, c.kind, c.exercise_name, n.user_id, coalesce(p.name, p.username), n.created_at
  from public.challenge_nudges n
  join public.challenges c on c.id = n.challenge_id
  join public.profiles p on p.id = n.user_id
  where n.user_id <> auth.uid() and n.created_at > p_since and public.is_challenge_member(n.challenge_id, auth.uid())
  order by n.created_at desc limit 20;
$$;
revoke all on function public.my_nudges(timestamptz) from public, anon;
grant execute on function public.my_nudges(timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. What friends see: progress photos, and badges follow "Streaks and badges".
-- ---------------------------------------------------------------------------
alter table public.friend_share add column if not exists photos boolean not null default false;

create or replace function public.friend_profile(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s public.friend_share; p public.profiles; out jsonb;
begin
  if not public.are_friends(auth.uid(), p_id) then return null; end if;
  select * into p from public.profiles where id = p_id;
  select * into s from public.friend_share where user_id = p_id;
  out := jsonb_build_object('id', p.id, 'username', p.username, 'name', p.name,
    'share', jsonb_build_object('workouts', coalesce(s.workouts, true), 'prs', coalesce(s.prs, true), 'streak', coalesce(s.streak, true),
                                'weight', coalesce(s.weight, false), 'body', coalesce(s.body, false), 'photos', coalesce(s.photos, false)));
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
  if coalesce(s.photos, false) then
    out := out || jsonb_build_object('photos', coalesce((select jsonb_agg(x order by x.day) from (select ph.day, ph.path from public.progress_photos ph where ph.user_id = p_id order by ph.day desc limit 6) x), '[]'::jsonb));
  end if;
  return out;
end;
$$;
revoke all on function public.friend_profile(uuid) from public, anon;
grant execute on function public.friend_profile(uuid) to authenticated;

-- Pinned badges show only with "Streaks and badges", pinned records only with "Personal records".
create or replace function public.friend_showcase(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when p_id = auth.uid() then (select jsonb_build_object('badges', s.badges, 'prs', s.prs) from public.profile_showcase s where s.user_id = p_id)
    when public.are_friends(auth.uid(), p_id) then (
      select jsonb_build_object(
        'badges', case when coalesce(f.streak, true) then s.badges else '[]'::jsonb end,
        'prs', case when coalesce(f.prs, true) then s.prs else '[]'::jsonb end)
      from public.profile_showcase s left join public.friend_share f on f.user_id = s.user_id
      where s.user_id = p_id) end;
$$;
revoke all on function public.friend_showcase(uuid) from public, anon;
grant execute on function public.friend_showcase(uuid) to authenticated;

-- Friends can open your progress photos only while you share them.
create or replace function public.can_see_photos(p_owner text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friend_share s where s.user_id::text = p_owner and s.photos)
     and exists (select 1 from public.friendships f where f.status = 'accepted'
                 and ((f.requester::text = p_owner and f.addressee = auth.uid()) or (f.addressee::text = p_owner and f.requester = auth.uid())));
$$;
revoke all on function public.can_see_photos(text) from public, anon;
grant execute on function public.can_see_photos(text) to authenticated;

drop policy if exists "Progress photos: friends read when shared" on storage.objects;
create policy "Progress photos: friends read when shared" on storage.objects for select to authenticated
  using (bucket_id = 'progress' and public.can_see_photos((storage.foldername(name))[1]));

-- ---------------------------------------------------------------------------
-- 4. Cycle settings: reminders, watch temperature, pregnancy options and checklist.
-- ---------------------------------------------------------------------------
alter table public.cycle_settings add column if not exists reminders jsonb not null default '{}'::jsonb;
alter table public.cycle_settings add column if not exists temp_watch boolean not null default false;
alter table public.cycle_settings add column if not exists preg_adjust boolean not null default false;
alter table public.cycle_settings add column if not exists checklist jsonb not null default '{}'::jsonb;
