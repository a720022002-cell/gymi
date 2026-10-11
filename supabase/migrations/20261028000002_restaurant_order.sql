-- Restaurants tab: Saudi chains first, then the best-known international chains.
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
  order by coalesce(array_position(array['Al Baik', 'Kudu', 'Herfy', 'Shawarmer', 'Al Tazaj', 'Hamburgini', 'Dr.Cafe', 'Barn''s',
             'McDonald''s', 'KFC', 'Burger King', 'Hardee''s', 'Starbucks', 'Pizza Hut', 'Domino''s', 'Subway', 'Popeyes', 'Texas Chicken',
             'Five Guys', 'Shake Shack', 'Papa John''s', 'Little Caesars', 'Tim Hortons', 'Dunkin''', 'Costa Coffee', 'Caribou Coffee',
             'Krispy Kreme', 'Baskin Robbins', 'Cinnabon', 'Nando''s', 'Chili''s', 'Applebee''s'], f.restaurant), 999), f.restaurant;
$$;
grant execute on function public.food_restaurants() to anon, authenticated;
