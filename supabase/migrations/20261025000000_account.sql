-- Gymi: account area. Profile photo and bio, avatars storage, personal invite codes
-- (claiming one makes you Gym Bros right away), and avatar lookup for other people.
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Profile photo, bio and personal invite code
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists invite_code text;
alter table public.profiles drop constraint if exists profiles_avatar_url_len;
alter table public.profiles add constraint profiles_avatar_url_len check (avatar_url is null or char_length(avatar_url) <= 500);
alter table public.profiles drop constraint if exists profiles_bio_len;
alter table public.profiles add constraint profiles_bio_len check (bio is null or char_length(bio) <= 120);
create unique index if not exists profiles_invite_code on public.profiles (invite_code);

grant update (avatar_url, bio) on public.profiles to authenticated;

-- "OMAR-7K2": the start of the username plus 3 random letters or digits (no look-alikes).
create or replace function public.make_invite_code(p_username text)
returns text language plpgsql volatile set search_path = '' as $$
declare
  base text := upper(left(coalesce(nullif(regexp_replace(coalesce(p_username, ''), '[._0-9].*$', ''), ''), 'gymi'), 8));
  abc  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int := 0;
begin
  loop
    code := base || '-' || substr(abc, 1 + floor(random() * 32)::int, 1) || substr(abc, 1 + floor(random() * 32)::int, 1) || substr(abc, 1 + floor(random() * 32)::int, 1);
    exit when not exists (select 1 from public.profiles where invite_code = code);
    i := i + 1;
    if i > 20 then base := 'GYMI' || floor(random() * 1000)::int; end if;
  end loop;
  return code;
end;
$$;
revoke all on function public.make_invite_code(text) from public, anon, authenticated;

create or replace function public.profiles_set_invite_code()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.invite_code is null then new.invite_code := public.make_invite_code(new.username); end if;
  return new;
end;
$$;
drop trigger if exists profiles_invite_code on public.profiles;
create trigger profiles_invite_code before insert on public.profiles
  for each row execute function public.profiles_set_invite_code();

-- Give everyone who signed up before this a code.
update public.profiles set invite_code = public.make_invite_code(username) where invite_code is null;

-- ---------------------------------------------------------------------------
-- 2. Avatars: public to read, each user writes only their own folder (avatars/<user id>/...)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatars: upload own" on storage.objects;
create policy "Avatars: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Avatars: update own" on storage.objects;
create policy "Avatars: update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Avatars: delete own" on storage.objects;
create policy "Avatars: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Owners can list their own files (needed to replace / remove them).
drop policy if exists "Avatars: read own" on storage.objects;
create policy "Avatars: read own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Photo URLs for a list of people (by user id or username). Photos are public anyway.
create or replace function public.avatar_urls(p_keys text[])
returns table (key text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select k, p.avatar_url
  from unnest(p_keys[1:200]) k
  join public.profiles p on p.id::text = k or p.username = k
  where auth.uid() is not null;
$$;
revoke all on function public.avatar_urls(text[]) from public, anon;
grant execute on function public.avatar_urls(text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Invites: type a friend's code (or open their link). You become Gym Bros right away,
--    and new members (first 14 days) count toward the friend's free month (every 5 friends).
-- ---------------------------------------------------------------------------
create or replace function public.claim_invite(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  c  text := upper(trim(coalesce(p_code, '')));
  r  public.profiles;
  st text := 'friends';
begin
  if me is null then return jsonb_build_object('status', 'auth'); end if;
  select * into r from public.profiles where invite_code = c;
  -- Older links carry the username instead of the code.
  if r.id is null then select * into r from public.profiles where username = lower(ltrim(trim(coalesce(p_code, '')), '@')); end if;
  if r.id is null then return jsonb_build_object('status', 'bad'); end if;
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
revoke all on function public.claim_invite(text) from public, anon;
grant execute on function public.claim_invite(text) to authenticated;

-- Kept for older app versions: same as claim_invite, answers with just the status.
create or replace function public.claim_referral(p_username text)
returns text language plpgsql security definer set search_path = '' as $$
declare s text;
begin
  s := public.claim_invite(p_username) ->> 'status';
  return case when s = 'friends' then 'done' else s end;
end;
$$;
revoke all on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;

-- Your code, how many friends joined with it and the free months earned (1 per 5 friends).
create or replace function public.my_invite()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'code', (select invite_code from public.profiles where id = auth.uid()),
    'count', (select count(*)::int from public.referrals where referrer = auth.uid()),
    'months', (select (count(*) / 5)::int from public.referrals where referrer = auth.uid()))
  where auth.uid() is not null;
$$;
revoke all on function public.my_invite() from public, anon;
grant execute on function public.my_invite() to authenticated;
