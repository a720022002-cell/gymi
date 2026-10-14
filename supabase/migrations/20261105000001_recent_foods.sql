-- Gymi: recent foods in search, and your own name for a food or scanned product (only you see it).
-- Safe to run more than once.

alter table public.food_facts_mine alter column nutrients set default '{}'::jsonb;
alter table public.food_facts_mine add column if not exists name text;
alter table public.food_facts_mine drop constraint if exists food_facts_mine_name_len;
alter table public.food_facts_mine add constraint food_facts_mine_name_len check (name is null or char_length(name) between 1 and 120);

-- The foods and scanned products you logged lately, newest first (one row each).
create or replace function public.my_recent_foods(p_limit integer default 20)
returns table (food_key text, food_id text, barcode text, log_name text, last_at timestamptz, food jsonb)
language sql stable security invoker set search_path = '' as $$
  select r.food_key, r.food_id, r.barcode, r.name, r.created_at, to_jsonb(f) - 'search'
  from (
    select distinct on (coalesce(l.food_id, 'bc:' || l.barcode))
      coalesce(l.food_id, 'bc:' || l.barcode) as food_key, l.food_id, l.barcode, l.name, l.created_at
    from public.food_logs l
    where l.user_id = auth.uid() and (l.food_id is not null or l.barcode is not null)
      and l.created_at > now() - interval '120 days'
    order by coalesce(l.food_id, 'bc:' || l.barcode), l.created_at desc
  ) r
  left join public.foods f on f.id = r.food_id
  order by r.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;
revoke all on function public.my_recent_foods(integer) from public, anon;
grant execute on function public.my_recent_foods(integer) to authenticated;
