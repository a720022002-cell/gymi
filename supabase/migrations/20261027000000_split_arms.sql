-- Biceps, triceps and forearms as their own filters. Exercises keep muscle = 'Arms'
-- (the plan builder uses the big groups); the first entry in muscles says which part.
create or replace function public.search_exercises(p_query text, p_muscle text default null, p_equipment text default null, p_limit int default 60)
returns setof public.exercises
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select lower(trim(coalesce(p_query, ''))) as s)
  select e.*
  from public.exercises e, q
  where (p_muscle is null or e.muscle = p_muscle
         or (p_muscle in ('Biceps', 'Triceps', 'Forearms') and e.muscle = 'Arms' and e.muscles[1] = lower(p_muscle)))
    and (p_equipment is null or e.equipment = p_equipment
         or (p_equipment = 'Free weight' and e.equipment in ('Barbell', 'Dumbbell', 'Free weight')))
    and (q.s = '' or e.search like '%' || q.s || '%'
         or (length(q.s) > 3 and extensions.word_similarity(q.s, e.search) > 0.5))
  order by e.rank,
           (lower(e.name_en) like q.s || '%' or coalesce(e.name_ar, '') like q.s || '%') desc,
           e.name_en
  limit least(greatest(p_limit, 1), 200);
$$;
grant execute on function public.search_exercises(text, text, text, int) to anon, authenticated;
