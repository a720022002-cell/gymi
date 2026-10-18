-- I1: an invite code sends a friend request; the code's owner accepts it (no instant friendship with a stranger
-- who got hold of your code). If they had already asked you, it's accepted right away. Referrals still count.
create or replace function public.claim_invite(p_code text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  me uuid := auth.uid();
  c  text := upper(trim(coalesce(p_code, '')));
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

-- I2: sharing with friends starts closed for new accounts; you open what you want.
-- People who already have an account keep what they had (the old defaults are written down for them first).
insert into public.friend_share (user_id, workouts, prs, streak, weight, body, photos)
select p.id, true, true, true, false, false, false
from public.profiles p
where not exists (select 1 from public.friend_share s where s.user_id = p.id);

alter table public.friend_share alter column workouts set default false;
alter table public.friend_share alter column prs set default false;
alter table public.friend_share alter column streak set default false;

-- Someone with no sharing row shares nothing (it used to mean workouts, records and streak).
do $$
declare
  r record;
  d text;
begin
  for r in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc ilike '%friend_share%'
      and p.prosrc ~* 'coalesce\(\s*\w+\.(workouts|prs|streak)\s*,\s*true\)'
  loop
    d := pg_get_functiondef(r.oid);
    d := regexp_replace(d, 'coalesce\((\s*\w+\.(workouts|prs|streak))\s*,\s*true\)', 'coalesce(\1, false)', 'gi');
    execute d;
  end loop;
end
$$;
