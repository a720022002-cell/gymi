-- Social decisions (24 Nov 2026). Safe to run more than once.
--
-- 1. Groups and challenges: adding someone sends an invite they accept or decline. The owner (group owner,
--    challenge creator) can remove members and delete the group or challenge; members can leave.
-- 2. Push notifications for coach messages: phones register an Expo push token (push_tokens); a trigger on
--    coach_messages calls the "push" Edge Function, which sends the notification.
--
-- Redefined here (latest earlier versions: 20261122000000_audit_fixes.sql, 20261123000001_social_fixes.sql):
--   public.create_group(text, uuid[])        friends get an invite instead of being added
--   public.add_group_member(uuid, uuid)      sends an invite instead of adding (same name and return type)
--   public.create_challenge(text, int, uuid[], text, text, numeric)   invites instead of adding
-- Everything else below is new.
--
-- ONE-TIME SETUP for push (nothing secret is in this file):
--   a) Pick a long random string and save it in two places:
--        select vault.create_secret('<random string>', 'push_hook', 'Shared secret for the push Edge Function');
--        supabase secrets set PUSH_HOOK_SECRET=<same random string>
--   b) Deploy the function without JWT checks (the database calls it with the shared secret instead):
--        supabase functions deploy push --no-verify-jwt
--   c) Optional: with "Enhanced security for push notifications" on in Expo, also set EXPO_ACCESS_TOKEN.
--   Until the vault secret exists the trigger does nothing, so messages are never held up.

-- ---------------------------------------------------------------------------
-- 1. Invites
-- ---------------------------------------------------------------------------
create table if not exists public.group_invites (
  group_id    uuid not null references public.groups (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  invited_by  uuid references auth.users (id) on delete set null,
  status      text not null default 'pending' check (status in ('pending', 'declined')),
  -- When it was sent (or declined).
  created_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_invites_user on public.group_invites (user_id) where status = 'pending';

create table if not exists public.challenge_invites (
  challenge_id  uuid not null references public.challenges (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  invited_by    uuid references auth.users (id) on delete set null,
  status        text not null default 'pending' check (status in ('pending', 'declined')),
  created_at    timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
create index if not exists challenge_invites_user on public.challenge_invites (user_id) where status = 'pending';

-- Read-only from the app (your own invites, sent or received); changes go through the functions below.
alter table public.group_invites enable row level security;
alter table public.challenge_invites enable row level security;
drop policy if exists "See own invites" on public.group_invites;
create policy "See own invites" on public.group_invites for select to authenticated using ((select auth.uid()) in (user_id, invited_by));
drop policy if exists "See own invites" on public.challenge_invites;
create policy "See own invites" on public.challenge_invites for select to authenticated using ((select auth.uid()) in (user_id, invited_by));
revoke all on public.group_invites from anon, authenticated;
revoke all on public.challenge_invites from anon, authenticated;
grant select on public.group_invites to authenticated;
grant select on public.challenge_invites to authenticated;

-- Invite a friend to a group (internal). Not someone blocked by (or blocking) anyone already in it.
-- Someone who declined can be invited again after a day.
create or replace function public._invite_to_group(g uuid, p_from uuid, p_to uuid)
 returns boolean language plpgsql security definer set search_path to '' as $function$
begin
  if p_to is null or p_from is null or p_to = p_from then return false; end if;
  if not public._are_friends(p_from, p_to) then return false; end if;
  if public._is_group_member(g, p_to) then return true; end if;
  if exists (select 1 from public.group_members gm where gm.group_id = g and public._blocked_pair(gm.user_id, p_to)) then return false; end if;
  insert into public.group_invites (group_id, user_id, invited_by) values (g, p_to, p_from)
  on conflict (group_id, user_id) do update set status = 'pending', invited_by = excluded.invited_by, created_at = now()
    where public.group_invites.status = 'declined' and public.group_invites.created_at < now() - interval '1 day';
  return true;
end;
$function$;
revoke execute on function public._invite_to_group(uuid, uuid, uuid) from public, anon, authenticated;

-- Invite to a challenge (internal): friends or people in a group with you, not blocked, challenge not over.
create or replace function public._invite_to_challenge(c uuid, p_from uuid, p_to uuid)
 returns boolean language plpgsql security definer set search_path to '' as $function$
begin
  if p_to is null or p_from is null or p_to = p_from then return false; end if;
  if not (public._are_friends(p_from, p_to) or public._share_group(p_from, p_to)) or public._blocked_pair(p_from, p_to) then return false; end if;
  if public._is_challenge_member(c, p_to) then return true; end if;
  if not exists (select 1 from public.challenges x where x.id = c and x.end_day >= current_date) then return false; end if;
  insert into public.challenge_invites (challenge_id, user_id, invited_by) values (c, p_to, p_from)
  on conflict (challenge_id, user_id) do update set status = 'pending', invited_by = excluded.invited_by, created_at = now()
    where public.challenge_invites.status = 'declined' and public.challenge_invites.created_at < now() - interval '1 day';
  return true;
end;
$function$;
revoke execute on function public._invite_to_challenge(uuid, uuid, uuid) from public, anon, authenticated;

-- REDEFINED: a new group has only you; the friends you picked get an invite.
create or replace function public.create_group(p_name text, p_members uuid[])
 returns uuid language plpgsql security definer set search_path to '' as $function$
declare g uuid; m uuid;
begin
  if auth.uid() is null then raise exception 'auth'; end if;
  insert into public.groups (name, owner) values (left(trim(p_name), 30), auth.uid()) returning id into g;
  insert into public.group_members (group_id, user_id) values (g, auth.uid());
  foreach m in array coalesce(p_members[1:30], '{}') loop
    perform public._invite_to_group(g, auth.uid(), m);
  end loop;
  return g;
end;
$function$;
revoke all on function public.create_group(text, uuid[]) from public, anon;
grant execute on function public.create_group(text, uuid[]) to authenticated;

-- REDEFINED: a member "adding" a friend sends them an invite. true = invited (or already in).
create or replace function public.add_group_member(p_group uuid, p_user uuid)
 returns boolean language plpgsql security definer set search_path to '' as $function$
begin
  if auth.uid() is null or not public._is_group_member(p_group, auth.uid()) then return false; end if;
  return public._invite_to_group(p_group, auth.uid(), p_user);
end;
$function$;
revoke all on function public.add_group_member(uuid, uuid) from public, anon;
grant execute on function public.add_group_member(uuid, uuid) to authenticated;

-- REDEFINED: the challenge starts with you; the people you picked get an invite.
create or replace function public.create_challenge(p_kind text, p_days int, p_members uuid[], p_exercise text default null, p_exercise_name text default null, p_goal numeric default null)
 returns uuid language plpgsql security definer set search_path to '' as $function$
declare c uuid; m uuid;
begin
  if auth.uid() is null then raise exception 'auth'; end if;
  if p_kind = 'exercise' and coalesce(p_exercise, '') = '' then raise exception 'exercise'; end if;
  insert into public.challenges (creator, kind, start_day, end_day, exercise, exercise_name)
  values (auth.uid(), p_kind, current_date, current_date + greatest(1, least(p_days, 60)) - 1,
          case when p_kind = 'exercise' then left(p_exercise, 60) end, case when p_kind = 'exercise' then left(p_exercise_name, 60) end)
  returning id into c;
  insert into public.challenge_members (challenge_id, user_id, goal_weight) values (c, auth.uid(), case when p_kind = 'weight' then p_goal end);
  foreach m in array coalesce(p_members[1:30], '{}') loop
    perform public._invite_to_challenge(c, auth.uid(), m);
  end loop;
  return c;
end;
$function$;
revoke all on function public.create_challenge(text, int, uuid[], text, text, numeric) from public, anon;
grant execute on function public.create_challenge(text, int, uuid[], text, text, numeric) to authenticated;

-- Invite a friend (or group mate) to a challenge you're in.
create or replace function public.invite_to_challenge(p_id uuid, p_user uuid)
 returns boolean language plpgsql security definer set search_path to '' as $function$
begin
  if auth.uid() is null or not public._is_challenge_member(p_id, auth.uid()) then return false; end if;
  return public._invite_to_challenge(p_id, auth.uid(), p_user);
end;
$function$;
revoke all on function public.invite_to_challenge(uuid, uuid) from public, anon;
grant execute on function public.invite_to_challenge(uuid, uuid) to authenticated;

-- Your open invites (not from someone blocked; challenges that haven't ended).
create or replace function public.my_social_invites()
 returns table (kind text, id uuid, title text, challenge_kind text, exercise_name text, end_day date, from_id uuid, from_name text, members int, created_at timestamptz)
 language sql stable security definer set search_path to '' as $function$
  select * from (
    select 'group'::text, g.id, g.name, null::text, null::text, null::date, i.invited_by, coalesce(p.name, p.username),
           (select count(*)::int from public.group_members x where x.group_id = g.id), i.created_at
    from public.group_invites i
    join public.groups g on g.id = i.group_id
    left join public.profiles p on p.id = i.invited_by
    where i.user_id = auth.uid() and i.status = 'pending'
      and (i.invited_by is null or not public._blocked_pair(auth.uid(), i.invited_by))
    union all
    select 'challenge'::text, c.id, null::text, c.kind, c.exercise_name, c.end_day, i.invited_by, coalesce(p.name, p.username),
           (select count(*)::int from public.challenge_members x where x.challenge_id = c.id), i.created_at
    from public.challenge_invites i
    join public.challenges c on c.id = i.challenge_id
    left join public.profiles p on p.id = i.invited_by
    where i.user_id = auth.uid() and i.status = 'pending' and c.end_day >= current_date
      and (i.invited_by is null or not public._blocked_pair(auth.uid(), i.invited_by))
  ) x
  order by 10 desc
  limit 30;
$function$;
revoke all on function public.my_social_invites() from public, anon;
grant execute on function public.my_social_invites() to authenticated;

-- Accept or decline a group invite: 'joined', 'declined', 'gone' (no such invite) or 'blocked'.
create or replace function public.respond_group_invite(p_group uuid, p_accept boolean)
 returns text language plpgsql security definer set search_path to '' as $function$
declare me uuid := auth.uid();
begin
  if me is null then return 'auth'; end if;
  perform 1 from public.group_invites where group_id = p_group and user_id = me and status = 'pending' for update;
  if not found then return 'gone'; end if;
  if not coalesce(p_accept, false) then
    update public.group_invites set status = 'declined', created_at = now() where group_id = p_group and user_id = me;
    return 'declined';
  end if;
  delete from public.group_invites where group_id = p_group and user_id = me;
  if exists (select 1 from public.group_members gm where gm.group_id = p_group and public._blocked_pair(gm.user_id, me)) then return 'blocked'; end if;
  insert into public.group_members (group_id, user_id) values (p_group, me) on conflict do nothing;
  return 'joined';
end;
$function$;
revoke all on function public.respond_group_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_group_invite(uuid, boolean) to authenticated;

-- Accept or decline a challenge invite: 'joined', 'declined', 'gone', 'ended' or 'blocked'.
create or replace function public.respond_challenge_invite(p_id uuid, p_accept boolean)
 returns text language plpgsql security definer set search_path to '' as $function$
declare me uuid := auth.uid(); c public.challenges;
begin
  if me is null then return 'auth'; end if;
  perform 1 from public.challenge_invites where challenge_id = p_id and user_id = me and status = 'pending' for update;
  if not found then return 'gone'; end if;
  if not coalesce(p_accept, false) then
    update public.challenge_invites set status = 'declined', created_at = now() where challenge_id = p_id and user_id = me;
    return 'declined';
  end if;
  delete from public.challenge_invites where challenge_id = p_id and user_id = me;
  select * into c from public.challenges where id = p_id;
  if c.id is null then return 'gone'; end if;
  if c.end_day < current_date then return 'ended'; end if;
  if public._blocked_pair(c.creator, me) then return 'blocked'; end if;
  insert into public.challenge_members (challenge_id, user_id) values (p_id, me) on conflict do nothing;
  return 'joined';
end;
$function$;
revoke all on function public.respond_challenge_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_challenge_invite(uuid, boolean) to authenticated;

-- Members and open invites of a group (names only). Open invites show to the owner and to whoever sent them.
create or replace function public.group_people(p_group uuid)
 returns table (user_id uuid, name text, username text, pending boolean)
 language sql stable security definer set search_path to '' as $function$
  select p.id, p.name, p.username, false
  from public.group_members gm join public.profiles p on p.id = gm.user_id
  where gm.group_id = p_group and public._is_group_member(p_group, auth.uid()) and not public._blocked_pair(auth.uid(), p.id)
  union all
  select p.id, p.name, p.username, true
  from public.group_invites i join public.profiles p on p.id = i.user_id
  where i.group_id = p_group and i.status = 'pending' and public._is_group_member(p_group, auth.uid())
    and (i.invited_by = auth.uid() or exists (select 1 from public.groups g where g.id = p_group and g.owner = auth.uid()))
    and not public._blocked_pair(auth.uid(), p.id);
$function$;
revoke all on function public.group_people(uuid) from public, anon;
grant execute on function public.group_people(uuid) to authenticated;

create or replace function public.challenge_people(p_id uuid)
 returns table (user_id uuid, name text, username text, pending boolean)
 language sql stable security definer set search_path to '' as $function$
  select p.id, p.name, p.username, false
  from public.challenge_members m join public.profiles p on p.id = m.user_id
  where m.challenge_id = p_id and public._is_challenge_member(p_id, auth.uid()) and not public._blocked_pair(auth.uid(), p.id)
  union all
  select p.id, p.name, p.username, true
  from public.challenge_invites i join public.profiles p on p.id = i.user_id
  where i.challenge_id = p_id and i.status = 'pending' and public._is_challenge_member(p_id, auth.uid())
    and (i.invited_by = auth.uid() or exists (select 1 from public.challenges c where c.id = p_id and c.creator = auth.uid()))
    and not public._blocked_pair(auth.uid(), p.id);
$function$;
revoke all on function public.challenge_people(uuid) from public, anon;
grant execute on function public.challenge_people(uuid) to authenticated;

-- The owner removes a member (or takes back an invite). Not themselves: they leave instead.
create or replace function public.remove_group_member(p_group uuid, p_user uuid)
 returns boolean language plpgsql security definer set search_path to '' as $function$
declare n int;
begin
  if auth.uid() is null or p_user is null or p_user = auth.uid() then return false; end if;
  if not exists (select 1 from public.groups where id = p_group and owner = auth.uid()) then return false; end if;
  delete from public.group_members where group_id = p_group and user_id = p_user;
  get diagnostics n = row_count;
  delete from public.group_invites where group_id = p_group and user_id = p_user;
  return n > 0 or found;
end;
$function$;
revoke all on function public.remove_group_member(uuid, uuid) from public, anon;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;

create or replace function public.remove_challenge_member(p_id uuid, p_user uuid)
 returns boolean language plpgsql security definer set search_path to '' as $function$
declare n int;
begin
  if auth.uid() is null or p_user is null or p_user = auth.uid() then return false; end if;
  if not exists (select 1 from public.challenges where id = p_id and creator = auth.uid()) then return false; end if;
  delete from public.challenge_members where challenge_id = p_id and user_id = p_user;
  get diagnostics n = row_count;
  delete from public.challenge_invites where challenge_id = p_id and user_id = p_user;
  return n > 0 or found;
end;
$function$;
revoke all on function public.remove_challenge_member(uuid, uuid) from public, anon;
grant execute on function public.remove_challenge_member(uuid, uuid) to authenticated;

-- The owner deletes the whole group / challenge (members, invites, posts and nudges go with it).
create or replace function public.delete_group(p_group uuid)
 returns boolean language plpgsql security definer set search_path to '' as $function$
begin
  if auth.uid() is null then return false; end if;
  delete from public.groups where id = p_group and owner = auth.uid();
  return found;
end;
$function$;
revoke all on function public.delete_group(uuid) from public, anon;
grant execute on function public.delete_group(uuid) to authenticated;

create or replace function public.delete_challenge(p_id uuid)
 returns boolean language plpgsql security definer set search_path to '' as $function$
begin
  if auth.uid() is null then return false; end if;
  delete from public.challenges where id = p_id and creator = auth.uid();
  return found;
end;
$function$;
revoke all on function public.delete_challenge(uuid) from public, anon;
grant execute on function public.delete_challenge(uuid) to authenticated;

-- The owner leaving hands the group (or challenge) to another member; the last one out deletes it.
create or replace function public.group_members_owner_left()
 returns trigger language plpgsql security definer set search_path to '' as $function$
declare nxt uuid;
begin
  if exists (select 1 from public.groups g where g.id = old.group_id and g.owner = old.user_id) then
    select gm.user_id into nxt from public.group_members gm where gm.group_id = old.group_id limit 1;
    if nxt is null then
      delete from public.groups where id = old.group_id;
    else
      update public.groups set owner = nxt where id = old.group_id;
    end if;
  end if;
  return null;
end;
$function$;
revoke all on function public.group_members_owner_left() from public, anon, authenticated;
drop trigger if exists group_members_owner_left on public.group_members;
create trigger group_members_owner_left after delete on public.group_members for each row execute function public.group_members_owner_left();

create or replace function public.challenge_members_creator_left()
 returns trigger language plpgsql security definer set search_path to '' as $function$
declare nxt uuid;
begin
  if exists (select 1 from public.challenges c where c.id = old.challenge_id and c.creator = old.user_id) then
    select m.user_id into nxt from public.challenge_members m where m.challenge_id = old.challenge_id limit 1;
    if nxt is null then
      delete from public.challenges where id = old.challenge_id;
    else
      update public.challenges set creator = nxt where id = old.challenge_id;
    end if;
  end if;
  return null;
end;
$function$;
revoke all on function public.challenge_members_creator_left() from public, anon, authenticated;
drop trigger if exists challenge_members_creator_left on public.challenge_members;
create trigger challenge_members_creator_left after delete on public.challenge_members for each row execute function public.challenge_members_creator_left();

-- ---------------------------------------------------------------------------
-- 2. Push notifications for coach messages
-- ---------------------------------------------------------------------------
-- One row per phone. messages/quiet/tz come from the phone's Notifications settings (for clients; a coach's
-- message alerts follow their coach notification settings).
create table if not exists public.push_tokens (
  token       text primary key check (char_length(token) between 10 and 200),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  platform    text check (platform in ('ios', 'android')),
  messages    boolean not null default true,
  quiet       jsonb,
  tz          text check (char_length(tz) <= 64),
  updated_at  timestamptz not null default now()
);
create index if not exists push_tokens_user on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
drop policy if exists "Own rows only" on public.push_tokens;
create policy "Own rows only" on public.push_tokens for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.push_tokens from anon;
grant select, insert, update, delete on public.push_tokens to authenticated;

-- Save this phone's token for you. A phone that someone else signed in on before moves to you (their row goes).
create or replace function public.save_push_token(p_token text, p_platform text, p_messages boolean default true, p_quiet jsonb default null, p_tz text default null)
 returns boolean language plpgsql security definer set search_path to '' as $function$
declare me uuid := auth.uid();
begin
  if me is null or p_token is null or p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,190}\]$' then return false; end if;
  delete from public.push_tokens where token = p_token and user_id <> me;
  insert into public.push_tokens (token, user_id, platform, messages, quiet, tz, updated_at)
  values (p_token, me, case when p_platform in ('ios', 'android') then p_platform end, coalesce(p_messages, true),
          case when jsonb_typeof(p_quiet) = 'object' then p_quiet end, left(p_tz, 64), now())
  on conflict (token) do update set platform = excluded.platform, messages = excluded.messages, quiet = excluded.quiet,
                                    tz = excluded.tz, updated_at = now();
  -- At most 10 phones per person (the oldest go).
  delete from public.push_tokens where user_id = me and token in (
    select token from public.push_tokens where user_id = me order by updated_at desc offset 10);
  return true;
end;
$function$;
revoke all on function public.save_push_token(text, text, boolean, jsonb, text) from public, anon;
grant execute on function public.save_push_token(text, text, boolean, jsonb, text) to authenticated;

-- New message: ask the push function to tell the other person. Never holds up or fails the message.
create extension if not exists pg_net;

create or replace function public.coach_messages_push()
 returns trigger language plpgsql security definer set search_path to '' as $function$
declare k text;
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = 'push_hook' limit 1;
  if k is null then return null; end if;
  perform net.http_post(
    url := 'https://utvhvzwkwhocdbiutavg.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', k),
    body := jsonb_build_object('type', 'coach_message', 'id', new.id),
    timeout_milliseconds := 10000
  );
  return null;
exception when others then
  return null;
end;
$function$;
revoke all on function public.coach_messages_push() from public, anon, authenticated;
drop trigger if exists coach_messages_push on public.coach_messages;
create trigger coach_messages_push after insert on public.coach_messages for each row execute function public.coach_messages_push();
