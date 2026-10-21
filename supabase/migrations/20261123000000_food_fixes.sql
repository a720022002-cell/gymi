-- Food fixes before launch.
--
-- 1. Calorie moves: every balancing gets its own id (grp), shared by all its days, and where it came from (kind:
--    'balance' from the balance sheet; null from the weekly recap). "Already balanced today" and "Reset" work on whole
--    balancings, so a reset never leaves one day of a balancing behind. Older rows keep null (the app treats them as before).
-- 2. A client's targets (coach_client_targets, used by client_summary, coach_ranking and the commitment score) follow
--    the same rule as the app: the numbers the coach typed first, then the coach's meal plan totals; calories or protein
--    alone is enough (0 counts as not set). The client's own protein uses the app's proteinFor rule: grams per kg on the
--    weight up to 100 kg plus 40% of the weight above it, never over 250 g.

-- ---------------------------------------------------------------------------
-- 1. calorie_moves.grp and kind
-- ---------------------------------------------------------------------------
alter table public.calorie_moves add column if not exists grp uuid;
alter table public.calorie_moves add column if not exists kind text;
alter table public.calorie_moves drop constraint if exists calorie_moves_kind_ok;
alter table public.calorie_moves add constraint calorie_moves_kind_ok check (kind is null or kind in ('balance', 'recap'));
create index if not exists calorie_moves_user_grp on public.calorie_moves (user_id, grp) where grp is not null;

-- ---------------------------------------------------------------------------
-- 2. One rule for a client's targets (from 20261020000000_coach.sql, changed)
-- ---------------------------------------------------------------------------
create or replace function public.coach_client_targets(p_link uuid)
returns table (kcal int, protein int, water int, days numeric)
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(c.kcal, 0), mp.k, public.coach_num(fp.plan ->> 'kcal')::int, 2000),
         coalesce(nullif(c.protein, 0), mp.p,
                  (select least(250, round(w.kg_counted * public.coach_num(fp.plan ->> 'perKg')))::int
                   from (select case when wt <= 100 then wt else 100 + (wt - 100) * 0.4 end as kg_counted
                         from (select coalesce(public.coach_num(fp.plan ->> 'weight'), p.weight_kg, 75) as wt) x) w),
                  120),
         coalesce(public.coach_num(fp.plan ->> 'water')::int, 2500),
         least(7, greatest(1, coalesce(pg.d, public.coach_num(tp.plan ->> 'days'), 3)))
  from public.coach_clients c
  left join public.profiles p on p.id = c.client_id
  left join public.food_plans fp on fp.user_id = c.client_id
  left join public.train_plans tp on tp.user_id = c.client_id
  left join lateral (select nullif(sum(coalesce(public.coach_num(m ->> 'k'), 0)), 0)::int as k, nullif(sum(coalesce(public.coach_num(m ->> 'p'), 0)), 0)::int as p
                     from public.coach_meal_plans x, jsonb_array_elements(x.meals) m where x.id = c.meal_plan_id) mp on true
  left join lateral (select nullif(count(*), 0)::numeric as d
                     from public.coach_programs x, jsonb_array_elements(x.days) dd where x.id = c.program_id and jsonb_array_length(coalesce(dd -> 'ex', '[]'::jsonb)) > 0) pg on true
  where c.id = p_link;
$$;
revoke all on function public.coach_client_targets(uuid) from public, anon, authenticated;
