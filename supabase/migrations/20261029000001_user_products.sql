-- Products people add from a label when the barcode isn't found. The next scan (by anyone) finds them.
alter table public.foods drop constraint if exists foods_source_check;
alter table public.foods add constraint foods_source_check check (source in ('usda', 'gymi', 'off', 'user'));
alter table public.foods add column if not exists created_by uuid references auth.users (id) on delete set null;

create or replace function public.save_user_product(
  p_barcode text, p_name text, p_brand text, p_unit text, p_serving numeric,
  p_kcal numeric, p_protein numeric, p_carbs numeric, p_fat numeric,
  p_sugar numeric default null, p_fiber numeric default null, p_sodium numeric default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text;
  v_owner uuid;
  v_code text := nullif(regexp_replace(coalesce(p_barcode, ''), '\D', '', 'g'), '');
begin
  if auth.uid() is null then raise exception 'auth'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 120 then raise exception 'name'; end if;
  if p_kcal is null or p_kcal < 0 or p_kcal > 900 or p_protein < 0 or p_carbs < 0 or p_fat < 0
     or coalesce(p_protein, 0) + coalesce(p_carbs, 0) + coalesce(p_fat, 0) > 101 then raise exception 'values'; end if;
  -- A barcode already in the database (from Open Food Facts or someone else) is kept as it is.
  if v_code is not null then
    select id, created_by into v_id, v_owner from public.foods where barcode = v_code limit 1;
    if v_id is not null and (v_owner is distinct from auth.uid() or v_id not like 'user:%') then return v_id; end if;
  end if;
  v_id := coalesce(v_id, 'user:' || coalesce(v_code, gen_random_uuid()::text));
  insert into public.foods (id, source, category, name_en, brand, barcode, serving_g, unit, kcal_100, protein_100, carbs_100, fat_100,
                            sugar_100, fiber_100, sodium_100, sugar_high, fat_high, is_estimate, rank, search, created_by)
  values (v_id, 'user', 'product', trim(p_name), nullif(trim(coalesce(p_brand, '')), ''), v_code,
          least(greatest(coalesce(p_serving, 100), 1), 2000), case when p_unit = 'ml' then 'ml' else 'g' end,
          p_kcal, coalesce(p_protein, 0), coalesce(p_carbs, 0), coalesce(p_fat, 0), p_sugar, p_fiber, p_sodium,
          coalesce(p_sugar, 0) > case when p_unit = 'ml' then 11.25 else 22.5 end, coalesce(p_fat, 0) > case when p_unit = 'ml' then 8.75 else 17.5 end,
          false, 1, lower(trim(p_name) || ' ' || coalesce(p_brand, '')), auth.uid())
  on conflict (id) do update set name_en = excluded.name_en, brand = excluded.brand, serving_g = excluded.serving_g, unit = excluded.unit,
    kcal_100 = excluded.kcal_100, protein_100 = excluded.protein_100, carbs_100 = excluded.carbs_100, fat_100 = excluded.fat_100,
    sugar_100 = excluded.sugar_100, fiber_100 = excluded.fiber_100, sodium_100 = excluded.sodium_100,
    sugar_high = excluded.sugar_high, fat_high = excluded.fat_high, search = excluded.search
  where public.foods.created_by = auth.uid();
  return v_id;
end;
$$;
revoke all on function public.save_user_product from public, anon;
grant execute on function public.save_user_product to authenticated;
