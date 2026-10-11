-- Train together: every friend gets a level. The level they picked in their plan; otherwise from how many
-- workouts they logged in the last 6 months (none counts as Beginner). Friends only.
create or replace function public.friend_levels(p_ids uuid[])
returns table (id uuid, level text)
language sql stable security definer set search_path = '' as $$
  select u.id,
         coalesce(
           (select case when tp.plan ->> 'level' in ('Beginner', 'Intermediate', 'Advanced') then tp.plan ->> 'level' end
              from public.train_plans tp where tp.user_id = u.id),
           (select case when count(*) >= 60 then 'Advanced' when count(*) >= 12 then 'Intermediate' else 'Beginner' end
              from public.workout_logs w where w.user_id = u.id and w.day > current_date - 183))
  from unnest(p_ids[1:20]) as u(id)
  where public.are_friends(auth.uid(), u.id);
$$;
revoke all on function public.friend_levels(uuid[]) from public, anon;
grant execute on function public.friend_levels(uuid[]) to authenticated;
