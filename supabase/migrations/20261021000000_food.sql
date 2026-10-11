-- Food: shareable meal codes (MEAL-XXXX) for saved meals, and adding a meal by its code.

-- A new code nobody has yet. Letters and digits that are easy to read (no O/0, I/1).
create or replace function public.new_meal_code()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  a constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := 'MEAL-';
    for i in 1..4 loop
      c := c || substr(a, 1 + floor(random() * 32)::int, 1);
    end loop;
    exit when not exists (select 1 from public.saved_meals where code = c);
  end loop;
  return c;
end;
$$;
revoke all on function public.new_meal_code() from public, anon;
grant execute on function public.new_meal_code() to authenticated;

alter table public.saved_meals add column if not exists code text;
alter table public.saved_meals add column if not exists from_code text;
update public.saved_meals set code = public.new_meal_code() where code is null;
alter table public.saved_meals alter column code set default public.new_meal_code();
alter table public.saved_meals alter column code set not null;
create unique index if not exists saved_meals_code on public.saved_meals (code);
alter table public.saved_meals drop constraint if exists saved_meals_code_format;
alter table public.saved_meals add constraint saved_meals_code_format check (code ~ '^MEAL-[A-Z0-9]{4}$');

-- Copy someone's saved meal into your own saved meals by its code.
-- status: ok (meal = the new row), not_found, exists (you already have it).
create or replace function public.add_meal_by_code(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c text := upper(trim(coalesce(p_code, '')));
  m public.saved_meals;
  r public.saved_meals;
  me uuid := auth.uid();
begin
  if me is null then return jsonb_build_object('status', 'auth'); end if;
  select * into m from public.saved_meals where code = c;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if m.user_id = me or exists (select 1 from public.saved_meals where user_id = me and from_code = c) then
    return jsonb_build_object('status', 'exists');
  end if;
  insert into public.saved_meals (user_id, name, items, ingredients, kcal, protein, carbs, fat, from_code)
  values (me, m.name, m.items, m.ingredients, m.kcal, m.protein, m.carbs, m.fat, c)
  returning * into r;
  return jsonb_build_object('status', 'ok', 'meal', to_jsonb(r));
end;
$$;
revoke all on function public.add_meal_by_code(text) from public, anon;
grant execute on function public.add_meal_by_code(text) to authenticated;
