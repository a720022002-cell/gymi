-- Small audit fixes (S3, S16, S18).

-- S3: a coach can only set sensible targets (no 0 kcal goal), even when calling the server directly.
create or replace function public.coach_set_targets(p_link uuid, p_kcal integer, p_protein integer)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if p_kcal is null or p_kcal < 800 or p_kcal > 6000 or p_protein is null or p_protein < 20 or p_protein > 400 then
    return false;
  end if;
  update public.coach_clients set kcal = p_kcal, protein = p_protein
  where id = p_link and coach_id = auth.uid() and status = 'active';
  return found;
end;
$function$;

-- S16: coach codes and shared meal codes are 8 random characters (from a secure random source), not 4,
-- so they can't be guessed. Codes already given out keep working.
create or replace function public.coach_invite()
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  abc constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea;
  c text;
begin
  if not public.is_approved_coach(auth.uid()) then raise exception 'not_coach'; end if;
  loop
    b := extensions.gen_random_bytes(8);
    c := 'GYMI-';
    for j in 0..7 loop
      c := c || substr(abc, 1 + (get_byte(b, j) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.coach_clients where code = c);
  end loop;
  insert into public.coach_clients (coach_id, code, status) values (auth.uid(), c, 'invited');
  return c;
end;
$function$;

create or replace function public.new_meal_code()
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  abc constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea;
  c text;
begin
  loop
    b := extensions.gen_random_bytes(8);
    c := 'MEAL-';
    for j in 0..7 loop
      c := c || substr(abc, 1 + (get_byte(b, j) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.saved_meals where code = c);
  end loop;
  return c;
end;
$function$;

-- Wrong meal codes count toward the same hourly limit as friend and coach codes.
create or replace function public.add_meal_by_code(p_code text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  c text := upper(trim(coalesce(p_code, '')));
  m public.saved_meals;
  r public.saved_meals;
  me uuid := auth.uid();
begin
  if me is null then return jsonb_build_object('status', 'auth'); end if;
  if not public.code_tries_left(me) then return jsonb_build_object('status', 'slow'); end if;
  select * into m from public.saved_meals where code = c;
  if not found then
    insert into public.code_attempts (user_id) values (me);
    return jsonb_build_object('status', 'not_found');
  end if;
  if m.user_id = me or exists (select 1 from public.saved_meals where user_id = me and from_code = c) then
    return jsonb_build_object('status', 'exists');
  end if;
  insert into public.saved_meals (user_id, name, items, ingredients, kcal, protein, carbs, fat, from_code, steps, servings, source)
  values (me, m.name, m.items, m.ingredients, m.kcal, m.protein, m.carbs, m.fat, c, m.steps, m.servings, m.source)
  returning * into r;
  return jsonb_build_object('status', 'ok', 'meal', to_jsonb(r));
end;
$function$;

-- S18: new tables are safe even if a migration forgets.
-- 1) Every new table in public gets row level security turned on right away (no policy = nobody can read it).
create or replace function public.ensure_rls()
 returns event_trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare r record;
begin
  for r in select * from pg_event_trigger_ddl_commands() where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') loop
    if r.schema_name = 'public' then
      execute format('alter table %s enable row level security', r.object_identity);
    end if;
  end loop;
end;
$function$;
drop event trigger if exists ensure_rls;
create event trigger ensure_rls on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.ensure_rls();

-- 2) Signed-out visitors (anon) get nothing new by default: tables, sequences and functions made from now on
--    must be granted to them on purpose. Signed-in users keep the defaults (row level security guards them).
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;
