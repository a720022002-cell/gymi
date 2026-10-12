-- Recipes saved from a video (TikTok, Instagram, YouTube or an uploaded clip): cooking steps,
-- how many servings the whole recipe makes, and where it came from. Kcal and macros stay per serving.
alter table public.saved_meals add column if not exists steps text[];
alter table public.saved_meals add column if not exists servings int;
alter table public.saved_meals add column if not exists source text;
alter table public.saved_meals drop constraint if exists saved_meals_steps_len;
alter table public.saved_meals add constraint saved_meals_steps_len check (steps is null or cardinality(steps) <= 40);
alter table public.saved_meals drop constraint if exists saved_meals_source_len;
alter table public.saved_meals add constraint saved_meals_source_len check (source is null or length(source) <= 500);

-- Copying a meal by code brings its steps along.
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
  insert into public.saved_meals (user_id, name, items, ingredients, kcal, protein, carbs, fat, from_code, steps, servings, source)
  values (me, m.name, m.items, m.ingredients, m.kcal, m.protein, m.carbs, m.fat, c, m.steps, m.servings, m.source)
  returning * into r;
  return jsonb_build_object('status', 'ok', 'meal', to_jsonb(r));
end;
$$;
revoke all on function public.add_meal_by_code(text) from public, anon;
grant execute on function public.add_meal_by_code(text) to authenticated;
