-- Moderation tools for the Adro team (App Store guideline 1.2: act on reports, remove content, ban abusive users).
-- Safe to run more than once.
--
-- 1. Suspended accounts: profiles.suspended_at / suspend_reason. Only admins can set them (through the functions
--    below; users have no update right on these columns). A suspended person:
--      - can still log in, but the app shows "Your account is suspended" (with support and Log out);
--      - is hidden from everyone else: search, invites, friends, feed, friend pages, groups (feed and board),
--        challenges (boards, nudges), group workouts, coach listing and coach pages, coach messages, photos;
--      - can't post to groups, send friend requests or coach messages.
--    Most of this goes through the shared checks _blocked_pair (a suspended person counts as blocked with
--    everyone), _are_friends and _coach_link_member, so every function built on them follows.
-- 2. Hidden content: group posts and coach messages can be hidden by an admin (hidden_at). Hidden rows aren't shown.
--    Admins can also reset a profile's name, username, bio, photo and coach page text.
-- 3. Reports can be dismissed or resolved; the team's list shows if the person is already suspended.
-- 4. Every admin action is logged in admin_actions.

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists suspended_at timestamptz;
alter table public.profiles add column if not exists suspend_reason text;
alter table public.profiles drop constraint if exists profiles_suspend_reason_len;
alter table public.profiles add constraint profiles_suspend_reason_len check (suspend_reason is null or char_length(suspend_reason) <= 300);
-- Users only have update rights on listed columns (phase 1 and account migrations); make sure these never are.
revoke update (suspended_at, suspend_reason) on public.profiles from anon, authenticated;
create index if not exists profiles_suspended on public.profiles (suspended_at) where suspended_at is not null;

alter table public.group_posts add column if not exists hidden_at timestamptz;
alter table public.coach_messages add column if not exists hidden_at timestamptz;

-- Reports: "dismissed" (nothing wrong) next to "done" (acted on).
alter table public.user_reports drop constraint if exists user_reports_status_check;
alter table public.user_reports add constraint user_reports_status_check check (status in ('open', 'done', 'dismissed'));

-- ---------------------------------------------------------------------------
-- 2. Admin action log (only admins read it; written by the functions below)
-- ---------------------------------------------------------------------------
create table if not exists public.admin_actions (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid references auth.users (id) on delete set null,
  action       text not null check (char_length(action) <= 40),
  target_user  uuid references auth.users (id) on delete set null,
  target_ref   text check (char_length(target_ref) <= 100),
  note         text check (char_length(note) <= 300),
  created_at   timestamptz not null default now()
);
create index if not exists admin_actions_target on public.admin_actions (target_user, created_at desc);
alter table public.admin_actions enable row level security;
revoke all on public.admin_actions from anon, authenticated;
drop policy if exists "Admins read actions" on public.admin_actions;
create policy "Admins read actions" on public.admin_actions for select to authenticated using (public.is_admin());
grant select on public.admin_actions to authenticated;

create or replace function public._admin_log(p_action text, p_user uuid, p_ref text default null, p_note text default null)
 returns void language sql security definer set search_path to '' as $function$
  insert into public.admin_actions (admin_id, action, target_user, target_ref, note)
  values (auth.uid(), left(p_action, 40), p_user, left(p_ref, 100), left(nullif(trim(coalesce(p_note, '')), ''), 300));
$function$;
revoke execute on function public._admin_log(text, uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Suspension checks
-- ---------------------------------------------------------------------------
-- For the database's own functions only.
create or replace function public._suspended(u uuid)
 returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.profiles where id = u and suspended_at is not null);
$function$;
revoke execute on function public._suspended(uuid) from public, anon, authenticated;

-- Is the caller suspended? (Only about yourself; used by RLS policies.)
create or replace function public.am_suspended()
 returns boolean language sql stable security definer set search_path to '' as $function$
  select public._suspended(auth.uid());
$function$;
revoke execute on function public.am_suspended() from public, anon;
grant execute on function public.am_suspended() to authenticated;

-- Blocking, now also "either one is suspended" (two different people). Every function that hides blocked
-- people (search, invites, friend requests, group feed and board, challenges, nudges, group workouts) hides
-- suspended people too. Was: 20261122000000_audit_fixes.sql.
create or replace function public._blocked_pair(a uuid, b uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (select 1 from public.user_blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a))
      or (a is distinct from b and exists (select 1 from public.profiles where id in (a, b) and suspended_at is not null));
$function$;
revoke execute on function public._blocked_pair(uuid, uuid) from public, anon, authenticated;

-- Friends only count while neither is suspended (feed, friend pages, showcase, training, levels, cycle partner,
-- cheers, adding to groups and challenges). The friendship itself stays. Was: 20261123000001_social_fixes.sql.
create or replace function public._are_friends(a uuid, b uuid)
 returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.friendships f
                 where f.status = 'accepted'
                   and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a)))
     and not exists (select 1 from public.profiles where id in (a, b) and suspended_at is not null);
$function$;
revoke execute on function public._are_friends(uuid, uuid) from public, anon, authenticated;

-- A coach link is paused (no messages either way) while the coach or the client is suspended.
-- Was: 20261123000001_social_fixes.sql.
create or replace function public._coach_link_member(l uuid, u uuid)
 returns boolean language sql stable security definer set search_path to '' as $function$
  select exists (select 1 from public.coach_clients c
                 where c.id = l and c.status = 'active' and u in (c.coach_id, c.client_id) and public.is_approved_coach(c.coach_id)
                   and not public._suspended(c.coach_id) and not public._suspended(c.client_id));
$function$;
revoke execute on function public._coach_link_member(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. RLS: hidden rows aren't shown; suspended people can't post
-- ---------------------------------------------------------------------------
drop policy if exists "Not hidden" on public.coach_messages;
create policy "Not hidden" on public.coach_messages as restrictive for select to authenticated using (hidden_at is null);
drop policy if exists "Not suspended, not hidden" on public.coach_messages;
create policy "Not suspended, not hidden" on public.coach_messages as restrictive for insert to authenticated
  with check (hidden_at is null and not public.am_suspended());

drop policy if exists "Not suspended, not hidden" on public.group_posts;
create policy "Not suspended, not hidden" on public.group_posts as restrictive for insert to authenticated
  with check (hidden_at is null and not public.am_suspended());

-- Progress photos shared with friends: not from a suspended person. Was: 20261024000000_social_cycle.sql.
create or replace function public.can_see_photos(p_owner text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friend_share s where s.user_id::text = p_owner and s.photos)
     and exists (select 1 from public.friendships f where f.status = 'accepted'
                 and ((f.requester::text = p_owner and f.addressee = auth.uid()) or (f.addressee::text = p_owner and f.requester = auth.uid())))
     and not exists (select 1 from public.profiles p where p.suspended_at is not null and (p.id::text = p_owner or p.id = auth.uid()));
$$;
revoke all on function public.can_see_photos(text) from public, anon;
grant execute on function public.can_see_photos(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Functions that show other people and don't go through the checks above
-- ---------------------------------------------------------------------------
-- Friends and requests: suspended people aren't listed. Was: 20261015000000_phase6_social.sql.
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
    and p.suspended_at is null
  order by f.status, p.name;
$$;
revoke all on function public.my_friends() from public, anon;
grant execute on function public.my_friends() to authenticated;

-- Group feed: hidden posts aren't shown (suspended people already are, through _blocked_pair).
-- Was: 20261122000000_audit_fixes.sql.
create or replace function public.group_feed(p_group uuid)
 returns table(id uuid, user_id uuid, name text, text text, created_at timestamptz)
 language sql
 stable security definer
 set search_path to ''
as $function$
  select gp.id, gp.user_id, p.name, gp.text, gp.created_at
  from public.group_posts gp join public.profiles p on p.id = gp.user_id
  where gp.group_id = p_group and gp.kind = 'workout' and public.is_group_member(p_group, auth.uid())
    and gp.hidden_at is null
    and not public._blocked_pair(auth.uid(), gp.user_id)
  order by gp.created_at desc limit 50;
$function$;

-- Find a coach: suspended coaches aren't listed. Was: 20261020000000_coach.sql.
create or replace function public.list_coaches()
returns table (id uuid, name text, username text, bio text, specialties text[], city text, gym text, price_month int, years int, clients int, coach_type text, packages jsonb, spots int, socials jsonb, hours jsonb, headline text, about text, sessions int)
language sql stable security definer set search_path = '' as $$
  select * from (
    select p.id, p.name, p.username, cp.bio, cp.specialties, cp.city, cp.gym, cp.price_month, cp.years::int,
      (select count(*)::int from public.coach_clients c where c.coach_id = p.id and c.status = 'active') as clients,
      cp.coach_type, cp.packages, cp.max_clients, cp.socials, cp.hours, cp.headline, cp.about, cp.sessions::int
    from public.coach_profiles cp join public.profiles p on p.id = cp.user_id
    where cp.listed and p.account_type = 'coach' and p.coach_status = 'approved' and auth.uid() is not null
      and p.suspended_at is null
  ) x
  where x.clients < x.max_clients
  order by x.name;
$$;
revoke all on function public.list_coaches() from public, anon;
grant execute on function public.list_coaches() to authenticated;

-- A coach's page: not for a suspended coach (except their own preview). Was: 20261020000000_coach.sql.
create or replace function public.coach_card(p_id uuid)
returns table (id uuid, name text, username text, bio text, specialties text[], city text, gym text, price_month int, years int, clients int, coach_type text, packages jsonb, spots int, socials jsonb, hours jsonb, headline text, about text, sessions int, listed boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.username, cp.bio, cp.specialties, cp.city, cp.gym, cp.price_month, cp.years::int,
    (select count(*)::int from public.coach_clients c where c.coach_id = p.id and c.status = 'active'),
    cp.coach_type, cp.packages, cp.max_clients, cp.socials, cp.hours, cp.headline, cp.about, cp.sessions::int, cp.listed
  from public.coach_profiles cp join public.profiles p on p.id = cp.user_id
  where cp.user_id = p_id and p.account_type = 'coach' and p.coach_status = 'approved' and auth.uid() is not null
    and (p.suspended_at is null or p_id = auth.uid())
    and (cp.listed or p_id = auth.uid()
         or exists (select 1 from public.coach_clients c where c.coach_id = p_id and c.client_id = auth.uid() and c.status in ('active', 'requested')));
$$;
revoke all on function public.coach_card(uuid) from public, anon;
grant execute on function public.coach_card(uuid) to authenticated;

-- Coach inbox: no suspended clients, no hidden messages. Was: 20261016000000_phase8_admin_coach.sql.
create or replace function public.coach_inbox()
returns table (link_id uuid, client_id uuid, name text, username text, last_text text, last_sender uuid, last_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.client_id, p.name, p.username, m.text, m.sender, m.created_at
  from public.coach_clients c join public.profiles p on p.id = c.client_id
  left join lateral (select * from public.coach_messages x where x.link_id = c.id and x.hidden_at is null order by x.created_at desc limit 1) m on true
  where c.coach_id = auth.uid() and c.status = 'active' and p.suspended_at is null
  order by m.created_at desc nulls last, p.name;
$$;
revoke all on function public.coach_inbox() from public, anon;
grant execute on function public.coach_inbox() to authenticated;

-- Photos by user id or username: none for suspended people (except yourself). Was: 20261025000000_account.sql.
create or replace function public.avatar_urls(p_keys text[])
returns table (key text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select k, p.avatar_url
  from unnest(p_keys[1:200]) k
  join public.profiles p on p.id::text = k or p.username = k
  where auth.uid() is not null and (p.suspended_at is null or p.id = auth.uid());
$$;
revoke all on function public.avatar_urls(text[]) from public, anon;
grant execute on function public.avatar_urls(text[]) to authenticated;

-- Group workouts: a suspended host's workout isn't shown; suspended people aren't in the list.
-- Was: 20261022000000_train.sql.
create or replace function public.my_group_sessions()
returns table (id uuid, host uuid, host_name text, status text, created_at timestamptz, members int, joined boolean, scheduled_at timestamptz, people jsonb)
language sql stable security definer set search_path = '' as $$
  select s.id, s.host, p.name, s.status, s.created_at,
         (select count(*)::int from public.group_session_members x where x.session_id = s.id), m.joined, s.scheduled_at,
         (select coalesce(jsonb_agg(jsonb_build_object('id', x.user_id, 'name', q.name, 'username', q.username, 'joined', x.joined) order by x.pos), '[]'::jsonb)
            from public.group_session_members x join public.profiles q on q.id = x.user_id
            where x.session_id = s.id and (q.id = auth.uid() or q.suspended_at is null))
  from public.group_sessions s join public.group_session_members m on m.session_id = s.id and m.user_id = auth.uid()
  join public.profiles p on p.id = s.host
  where s.status <> 'done' and coalesce(s.scheduled_at, s.created_at) > now() - interval '12 hours'
    and (s.host = auth.uid() or p.suspended_at is null)
  order by coalesce(s.scheduled_at, s.created_at);
$$;
revoke all on function public.my_group_sessions() from public, anon;
grant execute on function public.my_group_sessions() to authenticated;

-- Was: 20261022000000_train.sql.
create or replace function public.group_session_board(p_id uuid)
returns table (user_id uuid, name text, username text, level text, joined boolean, done jsonb, updated_at timestamptz, pos smallint, sets jsonb)
language sql stable security definer set search_path = '' as $$
  select m.user_id, p.name, p.username, m.level, m.joined, m.done, m.updated_at, m.pos, m.sets
  from public.group_session_members m join public.profiles p on p.id = m.user_id
  where m.session_id = p_id and public.in_session(p_id, auth.uid())
    and (m.user_id = auth.uid() or p.suspended_at is null)
  order by m.pos;
$$;
revoke all on function public.group_session_board(uuid) from public, anon;
grant execute on function public.group_session_board(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Team tools
-- ---------------------------------------------------------------------------
-- Users list, now with suspension. Was: 20261016000000_phase8_admin_coach.sql (same search and order).
drop function if exists public.admin_users(text);
create function public.admin_users(p_q text default '')
returns table (id uuid, name text, username text, email text, account_type text, coach_status text, joined timestamptz, last_day date, is_admin boolean, suspended_at timestamptz, suspend_reason text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
  select p.id, p.name, p.username, p.email, p.account_type, p.coach_status, p.created_at,
         greatest((select max(f.day) from public.food_logs f where f.user_id = p.id), (select max(w.day) from public.workout_logs w where w.user_id = p.id)),
         exists (select 1 from public.admins ad where ad.user_id = p.id),
         p.suspended_at, p.suspend_reason
  from public.profiles p
  where coalesce(p_q, '') = '' or p.username ilike '%' || p_q || '%' or p.name ilike '%' || p_q || '%' or p.email ilike '%' || p_q || '%'
  order by p.created_at desc limit 100;
end;
$$;
revoke all on function public.admin_users(text) from public, anon;
grant execute on function public.admin_users(text) to authenticated;

-- Reports list, now with whether the person is suspended. Was: 20261119000000_report_block.sql.
drop function if exists public.admin_reports();
create function public.admin_reports()
 returns table(id uuid, created_at timestamptz, kind text, ref text, reason text, note text, status text, reporter text, reported_id uuid, reported text, reported_name text, reports_on_them bigint, reported_suspended boolean)
 language sql
 stable security definer
 set search_path to ''
as $function$
  select r.id, r.created_at, r.kind, r.ref, r.reason, r.note, r.status,
    a.username, r.reported, b.username, b.name,
    (select count(*) from public.user_reports x where x.reported = r.reported),
    b.suspended_at is not null
  from public.user_reports r
  left join public.profiles a on a.id = r.reporter
  left join public.profiles b on b.id = r.reported
  where exists (select 1 from public.admins where user_id = auth.uid())
  order by (r.status = 'open') desc, r.created_at desc
  limit 300;
$function$;
revoke all on function public.admin_reports() from public, anon;
grant execute on function public.admin_reports() to authenticated;

-- Close or reopen a report (kept for older app versions), now logged. Was: 20261119000000_report_block.sql.
create or replace function public.admin_close_report(p_id uuid, p_open boolean default false)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare who uuid;
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then return false; end if;
  update public.user_reports set status = case when p_open then 'open' else 'done' end where id = p_id returning reported into who;
  if not found then return false; end if;
  perform public._admin_log(case when p_open then 'report_reopen' else 'report_done' end, who, p_id::text);
  return true;
end;
$function$;
revoke all on function public.admin_close_report(uuid, boolean) from public, anon;
grant execute on function public.admin_close_report(uuid, boolean) to authenticated;

-- Set a report to open, done (acted on) or dismissed (nothing wrong).
create or replace function public.admin_set_report(p_id uuid, p_status text)
 returns boolean language plpgsql security definer set search_path to '' as $function$
declare who uuid;
begin
  if not public.is_admin() or coalesce(p_status, '') not in ('open', 'done', 'dismissed') then return false; end if;
  update public.user_reports set status = p_status where id = p_id returning reported into who;
  if not found then return false; end if;
  perform public._admin_log('report_' || p_status, who, p_id::text);
  return true;
end;
$function$;
revoke all on function public.admin_set_report(uuid, text) from public, anon;
grant execute on function public.admin_set_report(uuid, text) to authenticated;

-- Suspend or unsuspend an account. Admins can't be suspended (remove them from admins first).
create or replace function public.admin_suspend(p_user uuid, p_suspend boolean, p_reason text default null)
 returns boolean language plpgsql security definer set search_path to '' as $function$
begin
  if not public.is_admin() or p_user is null or p_suspend is null or p_user = auth.uid() then return false; end if;
  if p_suspend and exists (select 1 from public.admins where user_id = p_user) then return false; end if;
  if p_suspend then
    update public.profiles set suspended_at = coalesce(suspended_at, now()),
           suspend_reason = left(nullif(trim(coalesce(p_reason, '')), ''), 300)
    where id = p_user;
  else
    update public.profiles set suspended_at = null, suspend_reason = null where id = p_user;
  end if;
  if not found then return false; end if;
  perform public._admin_log(case when p_suspend then 'suspend' else 'unsuspend' end, p_user, null, p_reason);
  return true;
end;
$function$;
revoke all on function public.admin_suspend(uuid, boolean, text) from public, anon;
grant execute on function public.admin_suspend(uuid, boolean, text) to authenticated;

-- Reset offensive profile fields. p_fields: any of 'name', 'username', 'bio', 'photo', 'coach'
-- ('coach' empties the coach page's about text and takes it off Find a coach until the coach lists it again).
create or replace function public.admin_reset_profile(p_user uuid, p_fields text[])
 returns boolean language plpgsql security definer set search_path to '' as $function$
declare u text; n int := 0;
begin
  if not public.is_admin() or p_user is null or coalesce(array_length(p_fields, 1), 0) = 0 then return false; end if;
  if not exists (select 1 from public.profiles where id = p_user) then return false; end if;
  if 'name' = any(p_fields) then update public.profiles set name = null where id = p_user; end if;
  if 'bio' = any(p_fields) then update public.profiles set bio = null where id = p_user; end if;
  if 'photo' = any(p_fields) then update public.profiles set avatar_url = null where id = p_user; end if;
  if 'username' = any(p_fields) then
    u := 'user' || substr(replace(p_user::text, '-', ''), 1, 8);
    while exists (select 1 from public.profiles where username = u and id <> p_user) and n < 20 loop
      u := 'user' || substr(md5(random()::text), 1, 10);
      n := n + 1;
    end loop;
    update public.profiles set username = u where id = p_user;
  end if;
  if 'coach' = any(p_fields) then
    update public.coach_profiles set bio = '', headline = '', about = '', listed = false where user_id = p_user;
  end if;
  perform public._admin_log('reset_profile', p_user, null, array_to_string(p_fields, ', '));
  return true;
end;
$function$;
revoke all on function public.admin_reset_profile(uuid, text[]) from public, anon;
grant execute on function public.admin_reset_profile(uuid, text[]) to authenticated;

-- Hide or show one group post ('post') or coach message ('message').
create or replace function public.admin_hide_content(p_kind text, p_id uuid, p_hide boolean default true)
 returns boolean language plpgsql security definer set search_path to '' as $function$
declare who uuid;
begin
  if not public.is_admin() then return false; end if;
  if p_kind = 'post' then
    update public.group_posts set hidden_at = case when p_hide then coalesce(hidden_at, now()) end where id = p_id returning user_id into who;
  elsif p_kind = 'message' then
    update public.coach_messages set hidden_at = case when p_hide then coalesce(hidden_at, now()) end where id = p_id returning sender into who;
  else
    return false;
  end if;
  if not found then return false; end if;
  perform public._admin_log(case when p_hide then 'hide_' else 'show_' end || p_kind, who, p_id::text);
  return true;
end;
$function$;
revoke all on function public.admin_hide_content(text, uuid, boolean) from public, anon;
grant execute on function public.admin_hide_content(text, uuid, boolean) to authenticated;

-- One person for the team: profile text, recent group posts, and the team's past actions on them.
-- Their coach messages are included only when someone reported them (messages are private otherwise).
create or replace function public.admin_user_content(p_user uuid)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare p public.profiles; cp public.coach_profiles;
begin
  if not public.is_admin() then return null; end if;
  select * into p from public.profiles where id = p_user;
  if p.id is null then return null; end if;
  select * into cp from public.coach_profiles where user_id = p_user;
  return jsonb_build_object(
    'id', p.id, 'name', p.name, 'username', p.username, 'email', p.email, 'bio', p.bio, 'avatar_url', p.avatar_url,
    'account_type', p.account_type, 'suspended_at', p.suspended_at, 'suspend_reason', p.suspend_reason,
    'is_admin', exists (select 1 from public.admins where user_id = p_user),
    'coach', case when cp.user_id is null then null else jsonb_build_object('bio', cp.bio, 'headline', cp.headline, 'about', cp.about, 'listed', cp.listed) end,
    'reports', (select count(*) from public.user_reports r where r.reported = p_user),
    'posts', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select gp.id, gp.text, gp.created_at, gp.hidden_at, g.name as group_name
        from public.group_posts gp left join public.groups g on g.id = gp.group_id
        where gp.user_id = p_user order by gp.created_at desc limit 30) x), '[]'::jsonb),
    'messages', case when exists (select 1 from public.user_reports r where r.reported = p_user) then
        coalesce((select jsonb_agg(x order by x.created_at desc) from (
          select m.id, m.text, m.created_at, m.hidden_at
          from public.coach_messages m where m.sender = p_user and m.kind = 'text' order by m.created_at desc limit 30) x), '[]'::jsonb)
      else '[]'::jsonb end,
    'actions', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select a.action, a.note, a.created_at, q.username as admin
        from public.admin_actions a left join public.profiles q on q.id = a.admin_id
        where a.target_user = p_user order by a.created_at desc limit 20) x), '[]'::jsonb)
  );
end;
$function$;
revoke all on function public.admin_user_content(uuid) from public, anon;
grant execute on function public.admin_user_content(uuid) to authenticated;
