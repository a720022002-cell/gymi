-- Audit 15 Oct 2026 (A1, A12).

-- A1: invite codes were the username and 3 random characters (32,768 to try), and a matching code makes you friends
-- right away. Now 6 random characters (about a billion), and wrong codes are limited to 20 an hour per person.
create or replace function public.make_invite_code(p_username text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  base text := upper(left(coalesce(nullif(regexp_replace(coalesce(p_username, ''), '[._0-9].*$', ''), ''), 'gymi'), 8));
  abc  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  code text;
begin
  loop
    bytes := extensions.gen_random_bytes(6);
    code := base || '-';
    for j in 0..5 loop
      code := code || substr(abc, 1 + (get_byte(bytes, j) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.profiles where invite_code = code);
  end loop;
  return code;
end;
$$;

-- Everyone's code becomes a new, long one (the old short ones could be guessed).
update public.profiles set invite_code = public.make_invite_code(username);

-- Wrong codes (friend invites and coach codes), to slow down guessing.
create table if not exists public.code_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists code_attempts_user_at on public.code_attempts (user_id, at);
alter table public.code_attempts enable row level security;
revoke all on public.code_attempts from anon, authenticated;

create or replace function public.code_tries_left(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) < 20 from public.code_attempts where user_id = p_user and at > now() - interval '1 hour';
$$;
revoke execute on function public.code_tries_left(uuid) from public, anon, authenticated;

create or replace function public.claim_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  c  text := upper(trim(coalesce(p_code, '')));
  r  public.profiles;
  st text := 'friends';
begin
  if me is null then return jsonb_build_object('status', 'auth'); end if;
  if not public.code_tries_left(me) then return jsonb_build_object('status', 'slow'); end if;
  select * into r from public.profiles where invite_code = c;
  if r.id is null then
    select * into r from public.profiles where username = lower(ltrim(trim(coalesce(p_code, '')), '@'));
    if r.id is null then
      insert into public.code_attempts (user_id) values (me);
      return jsonb_build_object('status', 'bad');
    end if;
    if r.id = me then return jsonb_build_object('status', 'self'); end if;
    insert into public.friendships (requester, addressee, status) values (me, r.id, 'pending')
    on conflict ((least(requester, addressee)), (greatest(requester, addressee))) do nothing;
    return jsonb_build_object('status', 'requested', 'name', r.name, 'username', r.username);
  end if;
  if r.id = me then return jsonb_build_object('status', 'self'); end if;

  insert into public.friendships (requester, addressee, status) values (r.id, me, 'accepted')
  on conflict ((least(requester, addressee)), (greatest(requester, addressee))) do update set status = 'accepted';

  if not exists (select 1 from public.referrals where referred = me)
     and not exists (select 1 from public.referrals where referred = r.id and referrer = me)
     and (select created_at from auth.users where id = me) >= now() - interval '14 days' then
    insert into public.referrals (referred, referrer) values (me, r.id);
    st := 'ok';
  end if;
  return jsonb_build_object('status', st, 'name', r.name, 'username', r.username);
end;
$$;

create or replace function public.redeem_coach_code(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare l public.coach_clients;
begin
  if auth.uid() is null then return 'auth'; end if;
  if not public.code_tries_left(auth.uid()) then return 'slow'; end if;
  if exists (select 1 from public.coach_clients where client_id = auth.uid() and status = 'active') then return 'has_coach'; end if;
  select * into l from public.coach_clients where code = upper(trim(p_code)) and status = 'invited' for update;
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
$$;

-- A12: injuries were shown to friends even with workout sharing off.
create or replace function public.friend_training(p_ids uuid[], p_day date)
returns table(id uuid, name text, level text, planned text, planned_ex jsonb, injuries jsonb, recent jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, p.name,
         coalesce(case when tp.plan ->> 'level' in ('Beginner', 'Intermediate', 'Advanced') then tp.plan ->> 'level' end,
                  case when coalesce(s.workouts, true) then
                    (select case when count(*) >= 60 then 'Advanced' when count(*) >= 12 then 'Intermediate' else 'Beginner' end
                       from public.workout_logs w where w.user_id = u.id and w.day > current_date - 183)
                  else 'Beginner' end),
         case when coalesce(s.workouts, true) then tp.plan -> 'week' -> extract(dow from p_day)::int ->> 'w' end,
         case when coalesce(s.workouts, true) then tp.plan -> 'workouts' -> (tp.plan -> 'week' -> extract(dow from p_day)::int ->> 'w') -> 'ex' end,
         case when coalesce(s.workouts, true) then coalesce(tp.plan -> 'injuries', '[]'::jsonb) else '[]'::jsonb end,
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
