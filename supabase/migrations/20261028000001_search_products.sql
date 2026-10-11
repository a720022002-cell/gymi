-- Search: products and restaurants can be browsed without typing; brands and restaurants are searchable.
create or replace function public.search_foods(p_query text, p_category text default null, p_limit int default 40)
returns setof public.foods
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select lower(trim(coalesce(p_query, ''))) as s)
  select f.*
  from public.foods f, q
  where (p_category is null or f.category = p_category
         or (p_category = 'basic' and f.category = 'usda'))
    and (q.s = '' or f.search like '%' || q.s || '%'
         or (length(q.s) > 3 and extensions.word_similarity(q.s, f.search) > 0.45))
    and (q.s <> '' or f.rank = 0 or p_category in ('rest', 'product'))
  order by f.rank,
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
