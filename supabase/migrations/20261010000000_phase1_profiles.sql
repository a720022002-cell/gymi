-- Gymi, Phase 1: profiles, row level security, and sign-up / log-in helpers.
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Profiles: one row per user, created automatically when they sign up.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  username       text not null unique
                 check (username ~ '^[a-z][a-z0-9._]{2,19}$'
                        and username !~ '[._]$'
                        and username !~ '[._]{2}'),
  name           text check (char_length(name) <= 60),
  email          text,
  phone          text check (char_length(phone) <= 20),
  gender         text check (gender in ('male', 'female')),
  date_of_birth  date check (date_of_birth > date '1900-01-01'),
  height_cm      numeric(4, 1) check (height_cm between 120 and 230),
  weight_kg      numeric(4, 1) check (weight_kg between 30 and 250),
  account_type   text not null default 'member' check (account_type in ('member', 'coach')),
  coach_status   text check (coach_status in ('pending', 'approved', 'rejected')),
  language       text not null default 'en' check (language in ('en', 'ar')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.profiles is 'One row per Gymi user. Each user can only read and edit their own row.';

-- ---------------------------------------------------------------------------
-- 2. Row level security: a user can only see and change their own profile.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No insert or delete policies: rows are created by the trigger below,
-- and removed automatically when the account is deleted.

-- Users may only edit these columns. account_type, coach_status and email
-- can only be changed by the Gymi team (or the email-sync trigger).
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, name, phone, gender, date_of_birth, height_cm, weight_kg, language)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Keep updated_at fresh.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Create the profile when someone signs up (from the sign-up form data).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta  jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  uname text  := lower(coalesce(meta ->> 'username', ''));
  role  text  := case when meta ->> 'account_type' = 'coach' then 'coach' else 'member' end;
begin
  if uname !~ '^[a-z][a-z0-9._]{2,19}$' or uname ~ '[._]$' or uname ~ '[._]{2}'
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the profile email in sync if the user changes it.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- 5. Is a username free? (Usernames are public handles in Gym Bros.)
-- ---------------------------------------------------------------------------
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.profiles where username = lower(p_username))
     and lower(p_username) not in ('gymi', 'admin', 'coach', 'support', 'help', 'team', 'official');
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Log in with a username.
--    Returns the account email ONLY if the password is right, so nobody can
--    look up someone's email from their username. Limited to 10 wrong tries
--    per username every 15 minutes.
-- ---------------------------------------------------------------------------
create table if not exists public.login_attempts (
  id           bigint generated always as identity primary key,
  username     text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists login_attempts_username_time on public.login_attempts (username, attempted_at);
alter table public.login_attempts enable row level security; -- no policies: nobody can read it from the app
revoke all on public.login_attempts from anon, authenticated;

create or replace function public.email_for_username_login(p_username text, p_password text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uname text := lower(trim(p_username));
  found_email text;
  hash text;
begin
  delete from public.login_attempts where attempted_at < now() - interval '1 day';

  if (select count(*) from public.login_attempts
        where username = uname and attempted_at > now() - interval '15 minutes') >= 10 then
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

  insert into public.login_attempts (username) values (uname);
  return null;
end;
$$;

revoke all on function public.email_for_username_login(text, text) from public;
grant execute on function public.email_for_username_login(text, text) to anon, authenticated;
