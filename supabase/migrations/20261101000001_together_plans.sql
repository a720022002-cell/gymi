-- Train together builds one workout from everyone's plan. The invite keeps its title (like "Push") and,
-- for each person, what joining changes in their plan.
alter table public.group_sessions add column if not exists title text;
alter table public.group_sessions add column if not exists notes jsonb not null default '{}'::jsonb;

-- Host only: the workout's title and each person's note {user id: {text, action, day}}.
create or replace function public.set_group_session_info(p_id uuid, p_title text, p_notes jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.group_sessions set title = left(p_title, 60), notes = coalesce(p_notes, '{}'::jsonb)
  where id = p_id and host = auth.uid();
  return found;
end;
$$;
revoke all on function public.set_group_session_info(uuid, text, jsonb) from public, anon;
grant execute on function public.set_group_session_info(uuid, text, jsonb) to authenticated;

-- Friends' training for a day: their level, the workout their plan has that weekday (with its exercises),
-- injuries and their workouts in the last 7 days. Friends only.
create or replace function public.friend_training(p_ids uuid[], p_day date)
returns table (id uuid, name text, level text, planned text, planned_ex jsonb, injuries jsonb, recent jsonb)
language sql stable security definer set search_path = '' as $$
  select u.id, p.name,
         coalesce(case when tp.plan ->> 'level' in ('Beginner', 'Intermediate', 'Advanced') then tp.plan ->> 'level' end,
                  (select case when count(*) >= 60 then 'Advanced' when count(*) >= 12 then 'Intermediate' else 'Beginner' end
                     from public.workout_logs w where w.user_id = u.id and w.day > current_date - 183)),
         tp.plan -> 'week' -> extract(dow from p_day)::int ->> 'w',
         tp.plan -> 'workouts' -> (tp.plan -> 'week' -> extract(dow from p_day)::int ->> 'w') -> 'ex',
         coalesce(tp.plan -> 'injuries', '[]'::jsonb),
         coalesce((select jsonb_agg(jsonb_build_object('day', w.day, 'name', w.name) order by w.day desc)
                     from public.workout_logs w where w.user_id = u.id and w.day > p_day - 7 and w.day <= p_day), '[]'::jsonb)
  from unnest(p_ids[1:5]) as u(id)
  join public.profiles p on p.id = u.id
  left join public.train_plans tp on tp.user_id = u.id
  where public.are_friends(auth.uid(), u.id);
$$;
revoke all on function public.friend_training(uuid[], date) from public, anon;
grant execute on function public.friend_training(uuid[], date) to authenticated;
