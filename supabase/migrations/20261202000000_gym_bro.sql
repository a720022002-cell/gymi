-- Gym Bro: each person's cartoon on Gym Bros grows with their 30-day commitment.
-- The app works the commitment out on the phone and saves it here; friends and group members read it through the
-- two functions below (only when the person shares their streak, like the friends list).

create table if not exists public.bro_levels (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  pct        smallint check (pct between 0 and 100),
  updated_at timestamptz not null default now()
);
alter table public.bro_levels enable row level security;

drop policy if exists "bro: own row" on public.bro_levels;
create policy "bro: own row" on public.bro_levels for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.bro_levels to authenticated;

-- You and your friends (accepted, not suspended): commitment and which character (male or female).
create or replace function public.my_crew()
returns table (user_id uuid, username text, name text, gender text, pct int)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.name, p.gender, b.pct::int
  from public.profiles p
  left join public.bro_levels b on b.user_id = p.id
  where p.id = auth.uid()
  union all
  select p.id, p.username, p.name, p.gender,
    case when coalesce(s.streak, true) then b.pct::int end
  from public.friendships f
  join public.profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  left join public.friend_share s on s.user_id = p.id
  left join public.bro_levels b on b.user_id = p.id
  where auth.uid() in (f.requester, f.addressee)
    and f.status = 'accepted'
    and p.suspended_at is null
    and not public._blocked_pair(auth.uid(), p.id);
$$;
revoke all on function public.my_crew() from public, anon;
grant execute on function public.my_crew() to authenticated;

-- A group's members and their commitment, for members of that group only.
create or replace function public.group_bros(p_group uuid)
returns table (user_id uuid, username text, name text, gender text, pct int)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.name, p.gender,
    case when p.id = auth.uid() or coalesce(s.streak, true) then b.pct::int end
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  left join public.friend_share s on s.user_id = p.id
  left join public.bro_levels b on b.user_id = p.id
  where gm.group_id = p_group
    and public._is_group_member(p_group, auth.uid())
    and p.suspended_at is null
    and not public._blocked_pair(auth.uid(), p.id);
$$;
revoke all on function public.group_bros(uuid) from public, anon;
grant execute on function public.group_bros(uuid) to authenticated;
