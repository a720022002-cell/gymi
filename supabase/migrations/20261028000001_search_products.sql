-- Search: products and restaurants can be browsed without typing; brands and restaurants are searchable.
create or replace function public.search_foods(p_query text, p_category text default null, p_limit int default 40)
returns setof public.foods
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select lower(trim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'))) as s),
  w as (select array_agg('%' || x || '%') as pats, count(*) as n from q, unnest(string_to_array(q.s, ' ')) x where x <> ''),
  -- Candidates use the trigram index: the whole phrase, every word in any order, or a close spelling.
  hits as (
    select f.id, 3 as score from public.foods f, q where q.s <> '' and f.search like '%' || q.s || '%'
    union all
    select f.id, 2 from public.foods f, w where w.n > 1 and f.search like all (w.pats)
    union all
    select f.id, 1 from public.foods f, q where length(q.s) > 3 and q.s operator(extensions.<%) f.search
    union all
    select f.id, 0 from public.foods f, q where q.s = '' and (f.rank = 0 or p_category in ('rest', 'product'))
  ),
  best as (select id, max(score) as score from hits group by id)
  select f.*
  from best b join public.foods f on f.id = b.id, q
  where p_category is null or f.category = p_category or (p_category = 'basic' and f.category = 'usda')
  order by b.score desc,
           f.rank,
           (lower(f.name_en) like q.s || '%' or coalesce(f.name_ar, '') like q.s || '%'
            or lower(coalesce(f.brand, f.restaurant, '')) like q.s || '%') desc,
           f.restaurant nulls last,
           length(f.name_en)
  limit least(greatest(p_limit, 1), 100);
$$;
grant execute on function public.search_foods(text, text, int) to anon, authenticated;

-- Restaurants in the database, for the chips on the Restaurants tab.
create or replace function public.food_restaurants()
returns table (restaurant text, name_ar text, items bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select f.restaurant, max(f.restaurant_ar), count(*)
  from public.foods f
  where f.category = 'rest' and f.restaurant is not null
  group by f.restaurant
  order by count(*) desc, f.restaurant;
$$;
grant execute on function public.food_restaurants() to anon, authenticated;
