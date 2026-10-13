-- Gymi: your whole history, kept small, for badges, best streaks and personal records.
-- The app loads detailed logs for the last 120 days only; these return one short row per day or per exercise.
-- Both run as the caller, so row level security keeps them to your own rows. Safe to run more than once.

-- Food (calories, protein) and water for each day you logged any.
create or replace function public.my_day_totals()
returns table (day date, kcal numeric, protein numeric, ml bigint)
language sql stable security invoker set search_path = '' as $$
  select d.day, coalesce(sum(d.kcal), 0), coalesce(sum(d.protein), 0), coalesce(sum(d.ml), 0)
  from (
    select f.day, f.kcal, f.protein, null::integer as ml from public.food_logs f where f.user_id = auth.uid()
    union all
    select w.day, null, null, w.ml from public.water_logs w where w.user_id = auth.uid()
  ) d
  group by d.day
  order by d.day;
$$;
revoke all on function public.my_day_totals() from public, anon;
grant execute on function public.my_day_totals() to authenticated;

-- Best weight ever lifted on each exercise.
create or replace function public.my_best_lifts()
returns table (id text, w numeric)
language sql stable security invoker set search_path = '' as $$
  select e ->> 'id', max((s ->> 'w')::numeric)
  from public.workout_logs l,
       jsonb_array_elements(case when jsonb_typeof(l.exercises) = 'array' then l.exercises else '[]'::jsonb end) e,
       jsonb_array_elements(case when jsonb_typeof(e -> 'sets') = 'array' then e -> 'sets' else '[]'::jsonb end) s
  where l.user_id = auth.uid() and jsonb_typeof(s -> 'w') = 'number'
  group by 1;
$$;
revoke all on function public.my_best_lifts() from public, anon;
grant execute on function public.my_best_lifts() to authenticated;
