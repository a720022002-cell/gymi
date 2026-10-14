-- Gymi: smaller fixes from the October 2026 audit (S1, S2, S3, S4, S7, S18, S19, S21, S22, S25).
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- S1. Reserved usernames ("gymi", "admin", ...) are checked by the database, not only on the sign-up screen.
-- ---------------------------------------------------------------------------
create or replace function public.username_reserved(p_username text)
returns boolean language sql immutable set search_path = '' as $$
  select lower(coalesce(p_username, '')) in ('gymi', 'admin', 'coach', 'support', 'help', 'team', 'official', 'staff', 'moderator')
      or lower(coalesce(p_username, '')) like 'gymi%'
      or lower(coalesce(p_username, '')) like '%admin%';
$$;

create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.profiles where username = lower(p_username))
     and not public.username_reserved(p_username);
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta  jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  uname text  := lower(coalesce(meta ->> 'username', ''));
  role  text  := case when meta ->> 'account_type' = 'coach' then 'coach' else 'member' end;
begin
  if uname !~ '^[a-z][a-z0-9._]{2,19}$' or uname ~ '[._]$' or uname ~ '[._]{2}'
     or public.username_reserved(uname)
     or exists (select 1 from public.profiles where username = uname) then
    uname := 'user_' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;

  insert into public.profiles (id, username, name, email, phone, account_type, coach_status, language)
  values (
    new.id,
    uname,
    nullif(left(trim(meta ->> 'name'), 60), ''),
    new.email,
    nullif(left(meta ->> 'phone', 20), ''),
    role,
    case when role = 'coach' then 'pending' end,
    case when meta ->> 'language' = 'ar' then 'ar' else 'en' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Changing your username later: a reserved one is refused (server-side SQL, with no signed-in user, can still set one).
create or replace function public.profiles_reserved_username()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and public.username_reserved(new.username)
     and (tg_op = 'INSERT' or new.username is distinct from old.username) then
    raise exception 'username_reserved' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.profiles_reserved_username() from public, anon, authenticated;
drop trigger if exists profiles_reserved_username on public.profiles;
create trigger profiles_reserved_username before insert or update of username on public.profiles
  for each row execute function public.profiles_reserved_username();

-- ---------------------------------------------------------------------------
-- S2. A friend counts toward your free month only once they've really used Gymi (something logged on 2 different days),
-- so made-up accounts don't earn months.
-- ---------------------------------------------------------------------------
create or replace function public.referral_active(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select count(distinct d) from (
            select day as d from public.food_logs where user_id = p_user
            union select day from public.workout_logs where user_id = p_user
            union select day from public.checkins where user_id = p_user
            union select day from public.water_logs where user_id = p_user
          ) x) >= 2;
$$;
revoke all on function public.referral_active(uuid) from public, anon, authenticated;

create or replace function public.my_invite()
returns jsonb language sql stable security definer set search_path = '' as $$
  with r as (select public.referral_active(referred) as active from public.referrals where referrer = auth.uid())
  select jsonb_build_object(
    'code', (select invite_code from public.profiles where id = auth.uid()),
    'count', (select count(*)::int from r where active),
    'waiting', (select count(*)::int from r where not active),
    'months', (select (count(*) / 5)::int from r where active))
  where auth.uid() is not null;
$$;

-- ---------------------------------------------------------------------------
-- S3. Deleting your account no longer deletes a group, challenge or group workout for everyone:
-- another member takes it over. With nobody else in it, it goes with the account as before.
-- (Only members whose account still exists, so deleting several accounts at once works.)
-- ---------------------------------------------------------------------------
create or replace function public.hand_over_on_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.groups g
     set owner = (select m.user_id from public.group_members m where m.group_id = g.id and m.user_id <> old.id and exists (select 1 from auth.users x where x.id = m.user_id) order by m.user_id limit 1)
   where g.owner = old.id
     and exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id <> old.id and exists (select 1 from auth.users x where x.id = m.user_id));

  update public.challenges c
     set creator = (select m.user_id from public.challenge_members m where m.challenge_id = c.id and m.user_id <> old.id and exists (select 1 from auth.users x where x.id = m.user_id) order by m.user_id limit 1)
   where c.creator = old.id
     and exists (select 1 from public.challenge_members m where m.challenge_id = c.id and m.user_id <> old.id and exists (select 1 from auth.users x where x.id = m.user_id));

  update public.group_sessions s
     set host = (select m.user_id from public.group_session_members m where m.session_id = s.id and m.user_id <> old.id and exists (select 1 from auth.users x where x.id = m.user_id)
                 order by m.joined desc, m.pos nulls last, m.user_id limit 1)
   where s.host = old.id
     and exists (select 1 from public.group_session_members m where m.session_id = s.id and m.user_id <> old.id and exists (select 1 from auth.users x where x.id = m.user_id));
  return old;
end;
$$;
revoke all on function public.hand_over_on_delete() from public, anon, authenticated;
drop trigger if exists on_auth_user_hand_over on auth.users;
create trigger on_auth_user_hand_over before delete on auth.users for each row execute function public.hand_over_on_delete();

-- ---------------------------------------------------------------------------
-- S4. Turning off sharing hides what you already shared: workouts and records in the friends feed,
-- and your plan and recent workouts in "Train together". (Injuries stay, only so a group workout never hurts you.)
-- ---------------------------------------------------------------------------
create or replace function public.feed(p_limit integer default 40)
returns table(id uuid, user_id uuid, name text, username text, kind text, text text, data jsonb, created_at timestamptz, cheers integer, cheered boolean)
language sql stable security definer set search_path = '' as $$
  select a.id, a.user_id, p.name, p.username, a.kind, a.text, a.data, a.created_at,
    (select count(*)::int from public.cheers c where c.activity_id = a.id),
    exists (select 1 from public.cheers c where c.activity_id = a.id and c.user_id = auth.uid())
  from public.activities a
  join public.profiles p on p.id = a.user_id
  left join public.friend_share s on s.user_id = a.user_id
  where (a.user_id = auth.uid() or public.are_friends(a.user_id, auth.uid()))
    and (a.user_id = auth.uid()
         or case a.kind when 'workout' then coalesce(s.workouts, true)
                        when 'pr' then coalesce(s.prs, true)
                        when 'streak' then coalesce(s.streak, true)
                        else true end)
  order by a.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.friend_training(p_ids uuid[], p_day date)
returns table(id uuid, name text, level text, planned text, planned_ex jsonb, injuries jsonb, recent jsonb)
language sql stable security definer set search_path = '' as $$
  select u.id, p.name,
         coalesce(case when tp.plan ->> 'level' in ('Beginner', 'Intermediate', 'Advanced') then tp.plan ->> 'level' end,
                  case when coalesce(s.workouts, true) then
                    (select case when count(*) >= 60 then 'Advanced' when count(*) >= 12 then 'Intermediate' else 'Beginner' end
                       from public.workout_logs w where w.user_id = u.id and w.day > current_date - 183)
                  else 'Beginner' end),
         case when coalesce(s.workouts, true) then tp.plan -> 'week' -> extract(dow from p_day)::int ->> 'w' end,
         case when coalesce(s.workouts, true) then tp.plan -> 'workouts' -> (tp.plan -> 'week' -> extract(dow from p_day)::int ->> 'w') -> 'ex' end,
         coalesce(tp.plan -> 'injuries', '[]'::jsonb),
         case when coalesce(s.workouts, true) then
           coalesce((select jsonb_agg(jsonb_build_object('day', w.day, 'name', w.name) order by w.day desc)
                       from public.workout_logs w where w.user_id = u.id and w.day > p_day - 7 and w.day <= p_day), '[]'::jsonb)
         else '[]'::jsonb end
  from unnest(p_ids[1:5]) as u(id)
  join public.profiles p on p.id = u.id
  left join public.train_plans tp on tp.user_id = u.id
  left join public.friend_share s on s.user_id = u.id
  where public.are_friends(auth.uid(), u.id);
$$;

-- ---------------------------------------------------------------------------
-- S7. A failed AI request gives its use back (called by the AI server function).
-- ---------------------------------------------------------------------------
create or replace function public.ai_refund(p_user uuid)
returns void language sql security definer set search_path = '' as $$
  update public.ai_usage set count = count - 1 where user_id = p_user and day = current_date and count > 0;
$$;
revoke all on function public.ai_refund(uuid) from public, anon, authenticated;
grant execute on function public.ai_refund(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- S18. A coach can't go over their client limit through an invite code or by accepting a request.
-- ---------------------------------------------------------------------------
create or replace function public.coach_is_full(p_coach uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.coach_clients where coach_id = p_coach and status = 'active')
         >= coalesce((select max_clients from public.coach_profiles where user_id = p_coach), 20);
$$;
revoke all on function public.coach_is_full(uuid) from public, anon;
grant execute on function public.coach_is_full(uuid) to authenticated;

create or replace function public.redeem_coach_code(p_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare l public.coach_clients;
begin
  if auth.uid() is null then return 'auth'; end if;
  if exists (select 1 from public.coach_clients where client_id = auth.uid() and status = 'active') then return 'has_coach'; end if;
  select * into l from public.coach_clients where code = upper(trim(p_code)) and status = 'invited' for update;
  if l.id is null then return 'bad_code'; end if;
  if l.coach_id = auth.uid() then return 'self'; end if;
  -- One at a time per coach, so two people can't take the last spot together.
  perform 1 from public.coach_profiles where user_id = l.coach_id for update;
  if public.coach_is_full(l.coach_id) then return 'full'; end if;
  update public.coach_clients set client_id = auth.uid(), status = 'active', code = null where id = l.id;
  return 'ok';
end;
$$;

create or replace function public.coach_respond(p_link uuid, p_accept boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare l public.coach_clients;
begin
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

-- ---------------------------------------------------------------------------
-- S19. A coach only sees when someone last logged once they're an active client.
-- ---------------------------------------------------------------------------
create or replace function public.coach_list()
returns table(id uuid, client_id uuid, name text, username text, status text, code text, kcal integer, protein integer, created_at timestamptz, last_day date, streak integer, package text, program_id uuid, meal_plan_id uuid)
language sql stable security definer set search_path = '' as $$
  select c.id, c.client_id, p.name, p.username, c.status, c.code, c.kcal, c.protein, c.created_at,
    case when c.status = 'active' then
      greatest((select max(day) from public.food_logs f where f.user_id = c.client_id), (select max(day) from public.workout_logs w where w.user_id = c.client_id)) end,
    case when c.status = 'active' then public.user_streak(c.client_id) end, c.package, c.program_id, c.meal_plan_id
  from public.coach_clients c left join public.profiles p on p.id = c.client_id
  where c.coach_id = auth.uid() and c.status <> 'ended'
  order by c.status, c.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- S21. Log in with a username: also limited per device (internet address), not only per username.
-- ---------------------------------------------------------------------------
alter table public.login_attempts add column if not exists ip text;
create index if not exists login_attempts_ip on public.login_attempts (ip, attempted_at);

create or replace function public.email_for_username_login(p_username text, p_password text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  uname text := lower(trim(p_username));
  h jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  v_ip text := nullif(trim(coalesce(h ->> 'cf-connecting-ip', split_part(h ->> 'x-forwarded-for', ',', 1), h ->> 'x-real-ip', '')), '');
  found_email text;
  hash text;
begin
  delete from public.login_attempts where attempted_at < now() - interval '1 day';

  if (select count(*) from public.login_attempts
        where username = uname and attempted_at > now() - interval '15 minutes') >= 10 then
    raise exception 'too many login attempts' using errcode = 'P0001';
  end if;
  -- One device trying many usernames.
  if v_ip is not null and (select count(*) from public.login_attempts a
        where a.ip = v_ip and a.attempted_at > now() - interval '15 minutes') >= 20 then
    raise exception 'too many login attempts' using errcode = 'P0001';
  end if;

  select u.email, u.encrypted_password into found_email, hash
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username = uname;

  if found_email is not null and hash is not null
     and extensions.crypt(p_password, hash) = hash then
    return found_email;
  end if;

  insert into public.login_attempts (username, ip) values (uname, v_ip);
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- S22. A challenge board only shows you and your Gym Bros, not members you aren't friends with.
-- ---------------------------------------------------------------------------
create or replace function public.challenge_board(p_id uuid)
returns table(user_id uuid, name text, value numeric, has_goal boolean, goal numeric)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, public.challenge_score(c.kind, c.exercise, c.start_day, c.end_day, p.id, m.goal_weight),
    m.goal_weight is not null, case when p.id = auth.uid() then m.goal_weight end
  from public.challenges c
  join public.challenge_members m on m.challenge_id = c.id
  join public.profiles p on p.id = m.user_id
  where c.id = p_id and public.is_challenge_member(p_id, auth.uid())
    and (p.id = auth.uid() or public.are_friends(p.id, auth.uid()));
$$;

-- ---------------------------------------------------------------------------
-- S25. Long cycles (like PCOS): your usual cycle can be set up to 90 days.
-- ---------------------------------------------------------------------------
alter table public.cycle_settings drop constraint if exists cycle_settings_cycle_len_check;
alter table public.cycle_settings add constraint cycle_settings_cycle_len_check check (cycle_len between 18 and 90);
