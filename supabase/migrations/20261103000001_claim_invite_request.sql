-- A username (from older links) now only sends a friend request; only the private invite code makes you friends right away.
create or replace function public.claim_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  c  text := upper(trim(coalesce(p_code, '')));
  r  public.profiles;
  st text := 'friends';
begin
  if me is null then return jsonb_build_object('status', 'auth'); end if;
  select * into r from public.profiles where invite_code = c;
  if r.id is null then
    select * into r from public.profiles where username = lower(ltrim(trim(coalesce(p_code, '')), '@'));
    if r.id is null then return jsonb_build_object('status', 'bad'); end if;
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
