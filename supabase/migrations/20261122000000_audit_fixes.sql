-- Audit fixes (21 Oct 2026).

-- 1. Wearable sign-in: the keys wait here until the signed-in app that started it confirms ("finish"), so a sign-in
--    link sent to someone else can't put their band on the sender's account.
alter table public.oauth_states add column if not exists pending jsonb;

-- 2. Blocking. The pair check itself, for the database's own functions only.
create or replace function public._blocked_pair(a uuid, b uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (select 1 from public.user_blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$function$;
revoke execute on function public._blocked_pair(uuid, uuid) from public, anon, authenticated;

-- What the app may ask: only about yourself and someone else (not whether two other people blocked each other).
create or replace function public.is_blocked(a uuid, b uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select (auth.uid() is null or auth.uid() in (a, b)) and public._blocked_pair(a, b);
$function$;

-- Nobody can be added to a group with someone who blocked them (or whom they blocked).
create or replace function public.add_group_member(p_group uuid, p_user uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if not public.is_group_member(p_group, auth.uid()) or not public.are_friends(auth.uid(), p_user) then return false; end if;
  if exists (select 1 from public.group_members gm where gm.group_id = p_group and public._blocked_pair(gm.user_id, p_user)) then return false; end if;
  insert into public.group_members values (p_group, p_user) on conflict do nothing;
  return true;
end;
$function$;

create or replace function public.create_group(p_name text, p_members uuid[])
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare g uuid; m uuid;
begin
  if auth.uid() is null then raise exception 'auth'; end if;
  insert into public.groups (name, owner) values (left(trim(p_name), 30), auth.uid()) returning id into g;
  insert into public.group_members values (g, auth.uid());
  foreach m in array coalesce(p_members, '{}') loop
    if public.are_friends(auth.uid(), m)
       and not exists (select 1 from public.group_members gm where gm.group_id = g and public._blocked_pair(gm.user_id, m)) then
      insert into public.group_members values (g, m) on conflict do nothing;
    end if;
  end loop;
  return g;
end;
$function$;

-- In a shared group you don't see posts or rows from someone blocked (either way).
create or replace function public.group_feed(p_group uuid)
 returns table(id uuid, user_id uuid, name text, text text, created_at timestamptz)
 language sql
 stable security definer
 set search_path to ''
as $function$
  select gp.id, gp.user_id, p.name, gp.text, gp.created_at
  from public.group_posts gp join public.profiles p on p.id = gp.user_id
  where gp.group_id = p_group and gp.kind = 'workout' and public.is_group_member(p_group, auth.uid())
    and not public._blocked_pair(auth.uid(), gp.user_id)
  order by gp.created_at desc limit 50;
$function$;

create or replace function public.group_board(p_group uuid)
 returns table(user_id uuid, name text, username text, workouts integer, volume numeric)
 language sql
 stable security definer
 set search_path to ''
as $function$
  select p.id, p.name, p.username,
    case when p.id = auth.uid() or coalesce(s.workouts, false) then (select count(*)::int from public.workout_logs w where w.user_id = p.id and w.day >= date_trunc('week', current_date + 1)::date - 1) end,
    case when p.id = auth.uid() or coalesce(s.workouts, false) then (select coalesce(sum(w.volume), 0) from public.workout_logs w where w.user_id = p.id and w.day >= date_trunc('week', current_date + 1)::date - 1) end
  from public.group_members gm join public.profiles p on p.id = gm.user_id
  left join public.friend_share s on s.user_id = p.id
  where gm.group_id = p_group and public.is_group_member(p_group, auth.uid())
    and not public._blocked_pair(auth.uid(), p.id);
$function$;

-- 3. Codes shared before the new name (GYMI-…) keep working: they were renamed to ADRO-….
create or replace function public.claim_invite(p_code text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  me uuid := auth.uid();
  c  text := regexp_replace(upper(trim(coalesce(p_code, ''))), '^GYMI-', 'ADRO-');
  r  public.profiles;
  f  public.friendships;
  ref boolean := false;
begin
  if me is null then return jsonb_build_object('status', 'auth'); end if;
  if not public.code_tries_left(me) then return jsonb_build_object('status', 'slow'); end if;
  select * into r from public.profiles where invite_code = c;
  if r.id is null then
    select * into r from public.profiles where username = lower(ltrim(trim(coalesce(p_code, '')), '@'));
  end if;
  if r.id is null then
    insert into public.code_attempts (user_id) values (me);
    return jsonb_build_object('status', 'bad');
  end if;
  if r.id = me then return jsonb_build_object('status', 'self'); end if;
  if public.is_blocked(me, r.id) then return jsonb_build_object('status', 'bad'); end if;

  -- A free month for the code's owner: only for a new account, once, and not both ways.
  if r.invite_code = c
     and not exists (select 1 from public.referrals where referred = me)
     and not exists (select 1 from public.referrals where referred = r.id and referrer = me)
     and (select created_at from auth.users where id = me) >= now() - interval '14 days' then
    insert into public.referrals (referred, referrer) values (me, r.id);
    ref := true;
  end if;

  select * into f from public.friendships
  where least(requester, addressee) = least(me, r.id) and greatest(requester, addressee) = greatest(me, r.id);
  if f.status = 'accepted' then
    return jsonb_build_object('status', 'friends', 'name', r.name, 'username', r.username, 'referral', ref);
  end if;
  if f.requester = r.id then
    -- They asked you first: this is a yes.
    update public.friendships set status = 'accepted' where id = f.id;
    return jsonb_build_object('status', 'friends', 'name', r.name, 'username', r.username, 'referral', ref);
  end if;
  insert into public.friendships (requester, addressee, status) values (me, r.id, 'pending')
  on conflict ((least(requester, addressee)), (greatest(requester, addressee))) do nothing;
  return jsonb_build_object('status', 'requested', 'name', r.name, 'username', r.username, 'referral', ref);
end;
$function$;

create or replace function public.redeem_coach_code(p_code text)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare l public.coach_clients;
begin
  if auth.uid() is null then return 'auth'; end if;
  if not public.code_tries_left(auth.uid()) then return 'slow'; end if;
  if exists (select 1 from public.coach_clients where client_id = auth.uid() and status = 'active') then return 'has_coach'; end if;
  select * into l from public.coach_clients where code = regexp_replace(upper(trim(p_code)), '^GYMI-', 'ADRO-') and status = 'invited' for update;
  if l.id is null then
    insert into public.code_attempts (user_id) values (auth.uid());
    return 'bad_code';
  end if;
  if l.coach_id = auth.uid() then return 'self'; end if;
  -- One at a time per coach, so two people can't take the last spot together.
  perform 1 from public.coach_profiles where user_id = l.coach_id for update;
  if public.coach_is_full(l.coach_id) then return 'full'; end if;
  update public.coach_clients set client_id = auth.uid(), status = 'active', code = null where id = l.id;
  return 'ok';
end;
$function$;

-- 4. A friend's level only counts their workouts when they share workouts (their plan's own level always shows).
create or replace function public.friend_levels(p_ids uuid[])
 returns table(id uuid, level text)
 language sql
 stable security definer
 set search_path to ''
as $function$
  select u.id,
         coalesce(
           (select case when tp.plan ->> 'level' in ('Beginner', 'Intermediate', 'Advanced') then tp.plan ->> 'level' end
              from public.train_plans tp where tp.user_id = u.id),
           (select case when count(*) >= 60 then 'Advanced' when count(*) >= 12 then 'Intermediate' else 'Beginner' end
              from public.workout_logs w where w.user_id = u.id and w.day > current_date - 183
                and coalesce((select s.workouts from public.friend_share s where s.user_id = u.id), false)))
  from unnest(p_ids[1:20]) as u(id)
  where public.are_friends(auth.uid(), u.id);
$function$;

-- 5. One open report per person about the same person, so reports can't be piled up.
create unique index if not exists user_reports_one_open on public.user_reports (reporter, reported) where status = 'open';
