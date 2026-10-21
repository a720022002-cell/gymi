-- Social and coaching fixes (pre-launch audit). Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Membership checks only answer about the caller.
--    The app (and RLS policies) may only ask "am I friends with / a member of …"; the database's own functions
--    use the internal _versions, which the app can't call (same pattern as _blocked_pair).
-- ---------------------------------------------------------------------------
create or replace function public._are_friends(a uuid, b uuid)
 returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.friendships f
                 where f.status = 'accepted'
                   and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a)));
$function$;
revoke execute on function public._are_friends(uuid, uuid) from public, anon, authenticated;

create or replace function public._is_group_member(g uuid, u uuid)
 returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.group_members where group_id = g and user_id = u);
$function$;
revoke execute on function public._is_group_member(uuid, uuid) from public, anon, authenticated;

create or replace function public._is_challenge_member(c uuid, u uuid)
 returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.challenge_members where challenge_id = c and user_id = u);
$function$;
revoke execute on function public._is_challenge_member(uuid, uuid) from public, anon, authenticated;

create or replace function public._in_session(s uuid, u uuid)
 returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.group_session_members where session_id = s and user_id = u);
$function$;
revoke execute on function public._in_session(uuid, uuid) from public, anon, authenticated;

-- A coach link counts only while it's active and the coach is still approved.
create or replace function public._coach_link_member(l uuid, u uuid)
 returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.coach_clients c
                 where c.id = l and c.status = 'active' and u in (c.coach_id, c.client_id) and public.is_approved_coach(c.coach_id));
$function$;
revoke execute on function public._coach_link_member(uuid, uuid) from public, anon, authenticated;

-- Two people in the same group.
create or replace function public._share_group(a uuid, b uuid)
 returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.group_members x join public.group_members y on y.group_id = x.group_id
                 where x.user_id = a and y.user_id = b);
$function$;
revoke execute on function public._share_group(uuid, uuid) from public, anon, authenticated;

-- Public versions (used by RLS policies and the app): the caller must be one of the pair / the member.
-- Every existing caller passes auth.uid(), so they keep working.
create or replace function public.are_friends(a uuid, b uuid)
 returns boolean language sql stable security definer set search_path to '' as $function$
  select (auth.uid() is null or auth.uid() in (a, b)) and public._are_friends(a, b);
$function$;

create or replace function public.is_group_member(g uuid, u uuid)
 returns boolean language sql stable security definer set search_path to '' as $function$
  select (auth.uid() is null or auth.uid() = u) and public._is_group_member(g, u);
$function$;

create or replace function public.is_challenge_member(c uuid, u uuid)
 returns boolean language sql stable security definer set search_path to '' as $function$
  select (auth.uid() is null or auth.uid() = u) and public._is_challenge_member(c, u);
$function$;

create or replace function public.in_session(s uuid, u uuid)
 returns boolean language sql stable security definer set search_path to '' as $function$
  select (auth.uid() is null or auth.uid() = u) and public._in_session(s, u);
$function$;

create or replace function public.coach_link_member(l uuid, u uuid)
 returns boolean language sql stable security definer set search_path to '' as $function$
  select (auth.uid() is null or auth.uid() = u) and public._coach_link_member(l, u);
$function$;

-- ---------------------------------------------------------------------------
-- 2. Removing a coach's approval ends their client links; coach-side functions need an approved coach.
-- ---------------------------------------------------------------------------
create or replace function public.admin_decide_coach(p_user uuid, p_approve boolean, p_reason text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare a public.coach_applications;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.profiles set coach_status = case when p_approve then 'approved' else 'rejected' end
  where id = p_user and account_type = 'coach';
  select * into a from public.coach_applications where user_id = p_user and status in ('pending', 'approved', 'rejected') order by created_at desc limit 1;
  update public.coach_applications set status = case when p_approve then 'approved' else 'rejected' end,
         reason = case when p_approve then null else left(p_reason, 300) end, reviewed_by = auth.uid(), reviewed_at = now()
  where id = a.id;
  if p_approve and a.id is not null then
    insert into public.coach_profiles (user_id, bio, specialties, city, gym, years, coach_type, socials, hours)
    values (p_user, a.bio, a.specialties, a.city, a.gym,
            case a.years when 'Under 1' then 0 when '1 to 2' then 1 when '3 to 5' then 3 when '6 to 10' then 6 when 'Over 10' then 10 end,
            a.coach_type, a.socials, a.hours)
    on conflict (user_id) do update set hours = excluded.hours where public.coach_profiles.hours = '[]'::jsonb;
  end if;
  -- No longer approved: clients, requests and open invites end (they stop seeing anything of their clients).
  if not p_approve then
    update public.coach_clients set status = 'ended' where coach_id = p_user and status in ('active', 'requested', 'invited');
  end if;
  return exists (select 1 from public.profiles where id = p_user);
end;
$$;
revoke all on function public.admin_decide_coach(uuid, boolean, text) from public, anon;
grant execute on function public.admin_decide_coach(uuid, boolean, text) to authenticated;

-- Coaches who already lost their approval.
update public.coach_clients c set status = 'ended'
where c.status in ('active', 'requested', 'invited') and not public.is_approved_coach(c.coach_id);

-- One client's progress for the coach. Only what the client is told the coach sees (food, workouts, weight,
-- sleep and check-ins, steps, water, goal and allergies); the plan's free-text notes, city, shopping list and
-- recipes are left out.
create or replace function public.client_summary(p_client uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.profiles; fp public.food_plans; l uuid; tg record;
begin
  if not public.is_approved_coach(auth.uid()) then return null; end if;
  select id into l from public.coach_clients where coach_id = auth.uid() and client_id = p_client and status = 'active' limit 1;
  if l is null then return null; end if;
  select * into p from public.profiles where id = p_client;
  select * into fp from public.food_plans where user_id = p_client;
  select * into tg from public.coach_client_targets(l);
  return jsonb_build_object(
    'name', p.name, 'username', p.username, 'gender', p.gender, 'dob', p.date_of_birth, 'height', p.height_cm,
    'plan', coalesce(fp.plan, '{}'::jsonb) - array['notes', 'city', 'shop', 'custom', 'aiRecipes', 'picks', 'plateauDay'],
    'streak', public.user_streak(p_client),
    'targets', jsonb_build_object('kcal', tg.kcal, 'protein', tg.protein, 'water', tg.water, 'days', tg.days),
    'weights', coalesce((select jsonb_agg(x order by x.day) from (select day, value from public.measurements where user_id = p_client and kind = 'weight' and day > current_date - 90) x), '[]'::jsonb),
    'workouts', coalesce((select jsonb_agg(x order by x.day desc) from (select day, name, minutes, volume, prs from public.workout_logs where user_id = p_client and day > current_date - 49) x), '[]'::jsonb),
    'food', coalesce((select jsonb_agg(x order by x.day desc) from (select day, sum(kcal)::int as kcal, round(sum(protein))::int as protein from public.food_logs where user_id = p_client and day > current_date - 14 group by day) x), '[]'::jsonb),
    'today', coalesce((select jsonb_agg(x) from (select name, meal, kcal, protein from public.food_logs where user_id = p_client and day = current_date order by created_at) x), '[]'::jsonb),
    'checkins', coalesce((select jsonb_agg(x order by x.day desc) from (select day, sleep_h, energy, sore, score from public.checkins where user_id = p_client and day > current_date - 14) x), '[]'::jsonb),
    'water', coalesce((select jsonb_agg(x order by x.day desc) from (select day, sum(ml)::int as ml from public.water_logs where user_id = p_client and day > current_date - 7 group by day) x), '[]'::jsonb),
    'steps', coalesce((select jsonb_agg(x order by x.day desc) from (select day, steps from public.step_logs where user_id = p_client and day > current_date - 7) x), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.client_summary(uuid) from public, anon;
grant execute on function public.client_summary(uuid) to authenticated;

create or replace function public.coach_respond(p_link uuid, p_accept boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare l public.coach_clients;
begin
  if not public.is_approved_coach(auth.uid()) then return false; end if;
  select * into l from public.coach_clients where id = p_link and coach_id = auth.uid() and status = 'requested';
  if l.id is null then return false; end if;
  if p_accept then
    perform 1 from public.coach_profiles where user_id = l.coach_id for update;
    if public.coach_is_full(l.coach_id) then return false; end if;
    if exists (select 1 from public.coach_clients where client_id = l.client_id and status = 'active') then return false; end if;
  end if;
  update public.coach_clients set status = case when p_accept then 'active' else 'ended' end where id = p_link;
  return true;
end;
$$;

create or replace function public.coach_set_targets(p_link uuid, p_kcal integer, p_protein integer)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if not public.is_approved_coach(auth.uid()) then return false; end if;
  if p_kcal is null or p_kcal < 800 or p_kcal > 6000 or p_protein is null or p_protein < 20 or p_protein > 400 then
    return false;
  end if;
  update public.coach_clients set kcal = p_kcal, protein = p_protein
  where id = p_link and coach_id = auth.uid() and status = 'active';
  return found;
end;
$function$;

create or replace function public.coach_assign(p_link uuid, p_program uuid, p_meal uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_approved_coach(auth.uid()) then return false; end if;
  if p_program is not null and not exists (select 1 from public.coach_programs where id = p_program and coach_id = auth.uid()) then return false; end if;
  if p_meal is not null and not exists (select 1 from public.coach_meal_plans where id = p_meal and coach_id = auth.uid()) then return false; end if;
  update public.coach_clients set program_id = p_program, meal_plan_id = p_meal where id = p_link and coach_id = auth.uid() and status in ('active', 'invited');
  return found;
end;
$$;

create or replace function public.coach_ranking()
returns table (link_id uuid, client_id uuid, commit int, prev int, parts jsonb, joined_at timestamptz, last_food date, last_workout date, welcomed boolean, todos int)
language sql stable security definer set search_path = '' as $$
  select c.id, c.client_id, (x.cur ->> 'total')::int, (x.prv ->> 'total')::int, x.cur, c.joined_at,
    (select max(f.day) from public.food_logs f where f.user_id = c.client_id),
    (select max(w.day) from public.workout_logs w where w.user_id = c.client_id),
    exists (select 1 from public.coach_messages m where m.link_id = c.id and m.sender = c.coach_id),
    (select count(*)::int from public.coach_todos t where t.link_id = c.id and not t.done)
  from public.coach_clients c
  cross join lateral public.coach_client_targets(c.id) tg
  cross join lateral (select public.coach_commit_parts(c.client_id, current_date - 29, current_date, tg.kcal, tg.protein, tg.water, tg.days) as cur,
                             public.coach_commit_parts(c.client_id, current_date - 59, current_date - 30, tg.kcal, tg.protein, tg.water, tg.days) as prv) x
  where c.coach_id = auth.uid() and c.status = 'active' and public.is_approved_coach(auth.uid())
  order by 3 desc nulls last;
$$;

create or replace function public.coach_meeting_reply(p_msg uuid, p_ok boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_approved_coach(auth.uid()) then return false; end if;
  update public.coach_messages m set meta = coalesce(m.meta, '{}'::jsonb) || jsonb_build_object('status', case when p_ok then 'confirmed' else 'declined' end)
  where m.id = p_msg and m.kind = 'meet' and coalesce(m.meta ->> 'status', 'pending') = 'pending'
    and exists (select 1 from public.coach_clients c where c.id = m.link_id and c.coach_id = auth.uid() and c.status = 'active');
  return found;
end;
$$;

-- Coach notes: writing needs an approved coach with the client active.
drop policy if exists "Coach notes" on public.coach_notes;
create policy "Coach notes" on public.coach_notes for all to authenticated
  using ((select auth.uid()) = coach_id)
  with check ((select auth.uid()) = coach_id and public.is_approved_coach((select auth.uid()))
              and exists (select 1 from public.coach_clients c where c.coach_id = (select auth.uid()) and c.client_id = coach_notes.client_id and c.status = 'active'));

-- ---------------------------------------------------------------------------
-- 3. One open coach request at a time; when a link becomes active, the member's other requests end.
-- ---------------------------------------------------------------------------
create or replace function public.request_coach(p_coach uuid)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return 'auth'; end if;
  if not public.is_approved_coach(p_coach) or p_coach = auth.uid() then return 'bad_coach'; end if;
  if exists (select 1 from public.coach_clients where client_id = auth.uid() and status = 'active') then return 'has_coach'; end if;
  if exists (select 1 from public.coach_clients where client_id = auth.uid() and coach_id = p_coach and status = 'requested') then return 'ok'; end if;
  if exists (select 1 from public.coach_clients where client_id = auth.uid() and status = 'requested') then return 'has_request'; end if;
  if (select count(*) from public.coach_clients where coach_id = p_coach and status = 'active')
     >= coalesce((select max_clients from public.coach_profiles where user_id = p_coach), 20) then return 'full'; end if;
  insert into public.coach_clients (coach_id, client_id, status) values (p_coach, auth.uid(), 'requested');
  return 'ok';
end;
$$;
revoke all on function public.request_coach(uuid) from public, anon;
grant execute on function public.request_coach(uuid) to authenticated;

create or replace function public.coach_clients_end_requests()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.coach_clients set status = 'ended'
  where client_id = new.client_id and status = 'requested' and id <> new.id;
  return null;
end;
$$;
revoke all on function public.coach_clients_end_requests() from public, anon, authenticated;
drop trigger if exists coach_clients_end_requests on public.coach_clients;
create trigger coach_clients_end_requests after update of status on public.coach_clients for each row
  when (new.status = 'active' and old.status is distinct from 'active' and new.client_id is not null)
  execute function public.coach_clients_end_requests();

-- Members who already have a coach and an old open request.
update public.coach_clients r set status = 'ended'
where r.status = 'requested'
  and exists (select 1 from public.coach_clients a where a.client_id = r.client_id and a.status = 'active');

-- ---------------------------------------------------------------------------
-- 4. Challenges: each person's numbers show only if they share them with you (or it's you); steps count up to
--    60,000 a day; a shared group counts as a link (group challenges); your rank is among the people shown.
-- ---------------------------------------------------------------------------
-- Does this challenge member's score show to the caller?
--   weight: "Weight and trend"; exercise: "Personal records"; steps, workouts, volume, progress: "Workouts".
create or replace function public._challenge_shows(p_kind text, p_user uuid)
 returns boolean language sql stable security definer set search_path to '' as $function$
  select p_user = auth.uid()
      or ((public._are_friends(auth.uid(), p_user) or public._share_group(auth.uid(), p_user))
          and not public._blocked_pair(auth.uid(), p_user)
          and coalesce((select case p_kind when 'weight' then s.weight when 'exercise' then s.prs else s.workouts end
                        from public.friend_share s where s.user_id = p_user), false));
$function$;
revoke execute on function public._challenge_shows(text, uuid) from public, anon, authenticated;

create or replace function public.challenge_score(p_kind text, p_ex text, p_start date, p_end date, p_user uuid, p_goal numeric)
returns numeric language plpgsql stable security definer set search_path = '' as $$
declare v numeric; a numeric; b numeric; first_day date;
begin
  if p_kind = 'steps' then
    -- A day counts up to 60,000 steps (steps can be typed in by hand).
    select coalesce(sum(least(s.steps, 60000)), 0) into v from public.step_logs s where s.user_id = p_user and s.day between p_start and p_end;
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

create or replace function public.challenge_board(p_id uuid)
returns table(user_id uuid, name text, value numeric, has_goal boolean, goal numeric)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, public.challenge_score(c.kind, c.exercise, c.start_day, c.end_day, p.id, m.goal_weight),
    m.goal_weight is not null, case when p.id = auth.uid() then m.goal_weight end
  from public.challenges c
  join public.challenge_members m on m.challenge_id = c.id
  join public.profiles p on p.id = m.user_id
  where c.id = p_id and public._is_challenge_member(p_id, auth.uid())
    and public._challenge_shows(c.kind, p.id);
$$;
revoke all on function public.challenge_board(uuid) from public, anon;
grant execute on function public.challenge_board(uuid) to authenticated;

-- Your place among the people on the board ("You're #2 of 4").
create or replace function public.my_challenges()
returns table (id uuid, kind text, start_day date, end_day date, members int, creator_name text, exercise_name text, my_rank int)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select c.* from public.challenges c where public._is_challenge_member(c.id, auth.uid()) order by c.end_day desc limit 30
  ), scores as (
    select m.challenge_id, m.user_id, public.challenge_score(c.kind, c.exercise, c.start_day, c.end_day, m.user_id, m.goal_weight) as v
    from mine c join public.challenge_members m on m.challenge_id = c.id
    where public._challenge_shows(c.kind, m.user_id)
  )
  select c.id, c.kind, c.start_day, c.end_day,
    (select count(*)::int from scores s where s.challenge_id = c.id), p.name, c.exercise_name,
    1 + (select count(*)::int from scores s where s.challenge_id = c.id and s.v > (select s2.v from scores s2 where s2.challenge_id = c.id and s2.user_id = auth.uid()))
  from mine c join public.profiles p on p.id = c.creator
  order by c.end_day desc;
$$;
revoke all on function public.my_challenges() from public, anon;
grant execute on function public.my_challenges() to authenticated;

-- Friends or people in a group with you (not blocked) can be added.
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
    if (public._are_friends(auth.uid(), m) or public._share_group(auth.uid(), m)) and not public._blocked_pair(auth.uid(), m) then
      insert into public.challenge_members (challenge_id, user_id) values (c, m) on conflict do nothing;
    end if;
  end loop;
  return c;
end;
$$;
revoke all on function public.create_challenge(text, int, uuid[], text, text, numeric) from public, anon;
grant execute on function public.create_challenge(text, int, uuid[], text, text, numeric) to authenticated;

-- Train together: friends or people in a group with you (not blocked).
create or replace function public.start_group_session(p_workout jsonb, p_members uuid[], p_levels text[], p_my_level text, p_scheduled timestamptz default null)
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
    if (public._are_friends(auth.uid(), p_members[i]) or public._share_group(auth.uid(), p_members[i]))
       and not public._blocked_pair(auth.uid(), p_members[i]) then
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

-- ---------------------------------------------------------------------------
-- 5. Nudges: nothing from (or to) someone blocked.
-- ---------------------------------------------------------------------------
create or replace function public.my_nudges(p_since timestamptz)
returns table (challenge_id uuid, kind text, exercise_name text, from_id uuid, from_name text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.challenge_id, c.kind, c.exercise_name, n.user_id, coalesce(p.name, p.username), n.created_at
  from public.challenge_nudges n
  join public.challenges c on c.id = n.challenge_id
  join public.profiles p on p.id = n.user_id
  where n.user_id <> auth.uid() and n.created_at > p_since and public._is_challenge_member(n.challenge_id, auth.uid())
    and not public._blocked_pair(auth.uid(), n.user_id)
  order by n.created_at desc limit 20;
$$;
revoke all on function public.my_nudges(timestamptz) from public, anon;
grant execute on function public.my_nudges(timestamptz) to authenticated;

-- A nudge needs someone in the challenge you haven't blocked (and who hasn't blocked you).
create or replace function public.nudge_challenge(p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if not public._is_challenge_member(p_id, auth.uid()) then return 'no'; end if;
  if not exists (select 1 from public.challenge_members m
                 where m.challenge_id = p_id and m.user_id <> auth.uid() and not public._blocked_pair(auth.uid(), m.user_id)) then
    return 'no';
  end if;
  insert into public.challenge_nudges (challenge_id, user_id) values (p_id, auth.uid()) on conflict do nothing;
  return case when found then 'sent' else 'already' end;
end;
$$;
revoke all on function public.nudge_challenge(uuid) from public, anon;
grant execute on function public.nudge_challenge(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Blocking your coach or client (from the message thread) also ends coaching between you.
-- ---------------------------------------------------------------------------
create or replace function public.block_user(p_user uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare me uuid := auth.uid();
begin
  if me is null or p_user is null or p_user = me then return false; end if;
  insert into public.user_blocks (blocker, blocked) values (me, p_user) on conflict do nothing;
  delete from public.friendships where (requester = me and addressee = p_user) or (requester = p_user and addressee = me);
  update public.coach_clients set status = 'ended'
  where status in ('active', 'requested') and ((coach_id = me and client_id = p_user) or (coach_id = p_user and client_id = me));
  return true;
end;
$function$;
grant execute on function public.block_user(uuid) to authenticated;
