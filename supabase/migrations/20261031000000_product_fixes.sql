-- Fix a scanned product's numbers when the data is wrong. A fix is personal: the next scan shows your numbers,
-- and nobody else's product changes.
alter table public.foods drop constraint if exists foods_category_check;
alter table public.foods add constraint foods_category_check check (category in ('basic', 'gulf', 'rest', 'usda', 'product', 'fix'));
alter table public.foods add column if not exists fix_barcode text;
create index if not exists foods_fix on public.foods (fix_barcode, created_by) where fix_barcode is not null;

create or replace function public.fix_product(
  p_barcode text, p_name text, p_brand text, p_unit text, p_serving numeric,
  p_kcal numeric, p_protein numeric, p_carbs numeric, p_fat numeric,
  p_sugar numeric default null, p_fiber numeric default null, p_sodium numeric default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := nullif(regexp_replace(coalesce(p_barcode, ''), '\D', '', 'g'), '');
  v_id text;
begin
  if auth.uid() is null then raise exception 'auth'; end if;
  if v_code is null then raise exception 'barcode'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 120 then raise exception 'name'; end if;
  if p_kcal is null or p_kcal < 0 or p_kcal > 900 or p_protein < 0 or p_carbs < 0 or p_fat < 0
     or coalesce(p_protein, 0) + coalesce(p_carbs, 0) + coalesce(p_fat, 0) > 101 then raise exception 'values'; end if;
  v_id := 'fix:' || auth.uid() || ':' || v_code;
  insert into public.foods (id, source, category, name_en, brand, barcode, fix_barcode, serving_g, unit, kcal_100, protein_100, carbs_100, fat_100,
                            sugar_100, fiber_100, sodium_100, sugar_high, fat_high, is_estimate, rank, search, created_by)
  values (v_id, 'user', 'fix', trim(p_name), nullif(trim(coalesce(p_brand, '')), ''), null, v_code,
          least(greatest(coalesce(p_serving, 100), 1), 2000), case when p_unit = 'ml' then 'ml' else 'g' end,
          p_kcal, coalesce(p_protein, 0), coalesce(p_carbs, 0), coalesce(p_fat, 0), p_sugar, p_fiber, p_sodium,
          coalesce(p_sugar, 0) > case when p_unit = 'ml' then 11.25 else 22.5 end, coalesce(p_fat, 0) > case when p_unit = 'ml' then 8.75 else 17.5 end,
          false, 1, lower(trim(p_name) || ' ' || coalesce(p_brand, '')), auth.uid())
  on conflict (id) do update set name_en = excluded.name_en, brand = excluded.brand, serving_g = excluded.serving_g, unit = excluded.unit,
    kcal_100 = excluded.kcal_100, protein_100 = excluded.protein_100, carbs_100 = excluded.carbs_100, fat_100 = excluded.fat_100,
    sugar_100 = excluded.sugar_100, fiber_100 = excluded.fiber_100, sodium_100 = excluded.sodium_100,
    sugar_high = excluded.sugar_high, fat_high = excluded.fat_high, search = excluded.search;
  return v_id;
end;
$$;
revoke all on function public.fix_product from public, anon;
grant execute on function public.fix_product to authenticated;

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
  where (p_category is null or f.category = p_category or (p_category = 'basic' and f.category = 'usda'))
    -- Someone's own fix of a product's numbers is only theirs.
    and (f.category <> 'fix' or f.created_by = (select auth.uid()))
  order by b.score desc,
           f.rank,
           (lower(f.name_en) like q.s || '%' or coalesce(f.name_ar, '') like q.s || '%'
            or lower(coalesce(f.brand, f.restaurant, '')) like q.s || '%') desc,
           f.restaurant nulls last,
           length(f.name_en)
  limit least(greatest(p_limit, 1), 100);
$$;
grant execute on function public.search_foods(text, text, int) to anon, authenticated;
