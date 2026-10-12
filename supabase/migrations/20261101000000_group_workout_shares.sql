-- Groups have no chat any more: the group page shows only workouts shared to the group after finishing.
alter table public.group_posts add column if not exists kind text not null default 'chat' check (kind in ('chat', 'workout'));

create or replace function public.group_feed(p_group uuid)
returns table (id uuid, user_id uuid, name text, text text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select gp.id, gp.user_id, p.name, gp.text, gp.created_at
  from public.group_posts gp join public.profiles p on p.id = gp.user_id
  where gp.group_id = p_group and gp.kind = 'workout' and public.is_group_member(p_group, auth.uid())
  order by gp.created_at desc limit 50;
$$;
revoke all on function public.group_feed(uuid) from public, anon;
grant execute on function public.group_feed(uuid) to authenticated;
