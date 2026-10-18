-- Report and block (needed by Apple and Google for apps where people see each other).

-- Blocks: you won't see each other in search, can't send each other requests, and the friendship ends.
create table if not exists public.user_blocks (
  blocker uuid not null default auth.uid() references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.user_blocks enable row level security;
drop policy if exists "Own blocks" on public.user_blocks;
create policy "Own blocks" on public.user_blocks for select using ((select auth.uid()) = blocker);
drop policy if exists "Unblock" on public.user_blocks;
create policy "Unblock" on public.user_blocks for delete using ((select auth.uid()) = blocker);
grant select, delete on public.user_blocks to authenticated;

/** Has either of the two blocked the other? */
create or replace function public.is_blocked(a uuid, b uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (select 1 from public.user_blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$function$;

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
  return true;
end;
$function$;
grant execute on function public.block_user(uuid) to authenticated;

-- No friend requests between blocked people (either way).
drop policy if exists "Send requests" on public.friendships;
create policy "Send requests" on public.friendships for insert
  with check ((select auth.uid()) = requester and status = 'pending' and not public.is_blocked(requester, addressee));

-- Search doesn't show someone you blocked or who blocked you.
create or replace function public.find_user(p_username text)
 returns table(id uuid, username text, name text, relation text)
 language sql
 stable security definer
 set search_path to ''
as $function$
  select p.id, p.username, p.name,
    case
      when p.id = auth.uid() then 'self'
      when exists (select 1 from public.friendships f where f.status = 'accepted' and ((f.requester = auth.uid() and f.addressee = p.id) or (f.addressee = auth.uid() and f.requester = p.id))) then 'friends'
      when exists (select 1 from public.friendships f where f.status = 'pending' and f.requester = auth.uid() and f.addressee = p.id) then 'sent'
      when exists (select 1 from public.friendships f where f.status = 'pending' and f.addressee = auth.uid() and f.requester = p.id) then 'received'
      else 'none'
    end
  from public.profiles p
  where auth.uid() is not null and p.username = lower(trim(ltrim(p_username, '@')))
    and not public.is_blocked(auth.uid(), p.id);
$function$;

-- An invite code from someone blocked (either way) doesn't work.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.claim_invite'::regproc);
  if position('is_blocked' in d) = 0 then
    d := replace(d, '  if r.id = me then return jsonb_build_object(''status'', ''self''); end if;

  -- A free month',
      '  if r.id = me then return jsonb_build_object(''status'', ''self''); end if;
  if public.is_blocked(me, r.id) then return jsonb_build_object(''status'', ''bad''); end if;

  -- A free month');
    execute d;
  end if;
end
$$;

-- Reports: anyone signed in can report a person (or a coach page, group or challenge); only the team reads them.
create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reported uuid references auth.users(id) on delete set null,
  kind text not null default 'user' check (kind in ('user', 'coach', 'group', 'challenge')),
  ref text check (char_length(ref) <= 100),
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'fake', 'other')),
  note text check (char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now()
);
alter table public.user_reports enable row level security;
drop policy if exists "Send reports" on public.user_reports;
create policy "Send reports" on public.user_reports for insert with check ((select auth.uid()) = reporter and status = 'open');
grant insert on public.user_reports to authenticated;

-- The team's list: newest open reports first, with who reported whom.
create or replace function public.admin_reports()
 returns table(id uuid, created_at timestamptz, kind text, ref text, reason text, note text, status text, reporter text, reported_id uuid, reported text, reported_name text, reports_on_them bigint)
 language sql
 stable security definer
 set search_path to ''
as $function$
  select r.id, r.created_at, r.kind, r.ref, r.reason, r.note, r.status,
    a.username, r.reported, b.username, b.name,
    (select count(*) from public.user_reports x where x.reported = r.reported)
  from public.user_reports r
  left join public.profiles a on a.id = r.reporter
  left join public.profiles b on b.id = r.reported
  where exists (select 1 from public.admins where user_id = auth.uid())
  order by (r.status = 'open') desc, r.created_at desc
  limit 300;
$function$;
grant execute on function public.admin_reports() to authenticated;

create or replace function public.admin_close_report(p_id uuid, p_open boolean default false)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then return false; end if;
  update public.user_reports set status = case when p_open then 'open' else 'done' end where id = p_id;
  return found;
end;
$function$;
grant execute on function public.admin_close_report(uuid, boolean) to authenticated;

-- The people you blocked, with their names (for the list where you can unblock them).
create or replace function public.my_blocks()
 returns table(id uuid, username text, name text)
 language sql
 stable security definer
 set search_path to ''
as $function$
  select b.blocked, p.username, p.name from public.user_blocks b left join public.profiles p on p.id = b.blocked
  where b.blocker = auth.uid() order by b.created_at desc;
$function$;
grant execute on function public.my_blocks() to authenticated;
