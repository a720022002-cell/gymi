-- Gym Bros characters you dress yourself (Bitmoji-like): face, hair and clothes are saved here as a small JSON;
-- the build still comes from the 30-day commitment. Friends and group members read it with the commitment.
-- Safe to run more than once.

alter table public.bro_levels add column if not exists look jsonb check (look is null or (jsonb_typeof(look) = 'object' and pg_column_size(look) <= 2000));

-- The return type changes (adds look), so the functions are made again.
drop function if exists public.my_crew();
create function public.my_crew()
returns table (user_id uuid, username text, name text, gender text, pct int, look jsonb)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.name, p.gender, b.pct::int, b.look
  from public.profiles p
  left join public.bro_levels b on b.user_id = p.id
  where p.id = auth.uid()
  union all
  select p.id, p.username, p.name, p.gender,
    case when coalesce(s.streak, true) then b.pct::int end, b.look
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

drop function if exists public.group_bros(uuid);
create function public.group_bros(p_group uuid)
returns table (user_id uuid, username text, name text, gender text, pct int, look jsonb)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.name, p.gender,
    case when p.id = auth.uid() or coalesce(s.streak, true) then b.pct::int end, b.look
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
