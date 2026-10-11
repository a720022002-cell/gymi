-- Admin tools: accounting for the three partners, AI cost log, server stats.
-- Everything here is for the Gymi team only (admins).

-- ---------------------------------------------------------------------------
-- 1. Partners (Ali, Hamdan, Ahmed). user_id links a partner to their admin login.
-- ---------------------------------------------------------------------------
create table if not exists public.partners (
  id       text primary key,
  name     text not null,
  user_id  uuid unique references auth.users (id) on delete set null,
  sort     smallint not null default 0
);
insert into public.partners (id, name, sort) values ('ali', 'Ali', 1), ('hamdan', 'Hamdan', 2), ('ahmed', 'Ahmed', 3)
on conflict (id) do nothing;
alter table public.partners enable row level security;
revoke all on public.partners from anon, authenticated;
grant select on public.partners to authenticated;
drop policy if exists "Admins read partners" on public.partners;
create policy "Admins read partners" on public.partners for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. Purchases and how each one is split
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  day         date not null default current_date,
  title       text not null check (char_length(title) between 1 and 120),
  category    text not null default 'Other' check (char_length(category) <= 40),
  amount      numeric(12, 2) not null check (amount > 0 and amount < 10000000),
  currency    text not null default 'SAR' check (currency in ('SAR', 'USD')),
  paid_by     text references public.partners (id),
  bought      boolean not null default true,
  split       text not null default 'equal' check (split in ('equal', 'custom', 'one')),
  note        text not null default '' check (char_length(note) <= 500),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists expenses_day on public.expenses (day desc);

create table if not exists public.expense_shares (
  expense_id  uuid not null references public.expenses (id) on delete cascade,
  partner_id  text not null references public.partners (id),
  amount      numeric(12, 2) not null check (amount >= 0),
  settled     boolean not null default false,
  primary key (expense_id, partner_id)
);

alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;
revoke all on public.expenses, public.expense_shares from anon, authenticated;
grant select, insert, update, delete on public.expenses, public.expense_shares to authenticated;
drop policy if exists "Admins manage expenses" on public.expenses;
create policy "Admins manage expenses" on public.expenses for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins manage shares" on public.expense_shares;
create policy "Admins manage shares" on public.expense_shares for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. AI calls: tokens and real cost, written by the AI function (service role).
-- ---------------------------------------------------------------------------
create table if not exists public.ai_calls (
  id                 bigserial primary key,
  at                 timestamptz not null default now(),
  user_id            uuid references auth.users (id) on delete set null,
  task               text not null default '',
  model              text not null default '',
  prompt_tokens      integer not null default 0,
  completion_tokens  integer not null default 0,
  cost_usd           numeric(12, 6) not null default 0,
  ok                 boolean not null default true,
  error              text
);
create index if not exists ai_calls_at on public.ai_calls (at desc);
alter table public.ai_calls enable row level security;
revoke all on public.ai_calls from anon, authenticated;

-- Cost summary for a date range: totals, per day and per task.
create or replace function public.admin_ai_costs(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return jsonb_build_object(
    'total', (select jsonb_build_object('calls', count(*), 'errors', count(*) filter (where not ok), 'cost', coalesce(sum(cost_usd), 0),
                'prompt', coalesce(sum(prompt_tokens), 0), 'completion', coalesce(sum(completion_tokens), 0), 'users', count(distinct user_id))
              from public.ai_calls where at::date between p_from and p_to),
    'days', coalesce((select jsonb_agg(x order by x.day) from (
              select at::date as day, count(*) as calls, round(sum(cost_usd), 6) as cost from public.ai_calls
              where at::date between p_from and p_to group by 1) x), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(x order by x.cost desc) from (
              select task, count(*) as calls, round(sum(cost_usd), 6) as cost, sum(prompt_tokens + completion_tokens) as tokens from public.ai_calls
              where at::date between p_from and p_to group by 1) x), '[]'::jsonb),
    'models', coalesce((select jsonb_agg(x order by x.calls desc) from (
              select model, count(*) as calls, round(sum(cost_usd), 6) as cost from public.ai_calls
              where at::date between p_from and p_to and model <> '' group by 1) x), '[]'::jsonb),
    'errors', coalesce((select jsonb_agg(x) from (
              select at, task, error from public.ai_calls where at::date between p_from and p_to and not ok order by at desc limit 10) x), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.admin_ai_costs(date, date) from public, anon;
grant execute on function public.admin_ai_costs(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Server stats: database and storage size, users, activity.
-- ---------------------------------------------------------------------------
create or replace function public.admin_server_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'storage', coalesce((select jsonb_agg(x order by x.bytes desc) from (
                select bucket_id as bucket, count(*) as files, coalesce(sum((metadata ->> 'size')::bigint), 0) as bytes
                from storage.objects group by 1) x), '[]'::jsonb),
    'users', (select count(*) from auth.users),
    'new_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'active_today', (select count(*) from auth.users where last_sign_in_at > now() - interval '1 day'),
    'active_30d', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'ai_today', (select count(*) from public.ai_calls where at > now() - interval '1 day'),
    'ai_errors_today', (select count(*) from public.ai_calls where at > now() - interval '1 day' and not ok),
    'tables', coalesce((select jsonb_agg(x order by x.rows desc) from (
                select relname as name, n_live_tup as rows, pg_total_relation_size(relid) as bytes
                from pg_catalog.pg_stat_user_tables where schemaname = 'public' order by n_live_tup desc limit 8) x), '[]'::jsonb),
    'version', current_setting('server_version')
  );
end;
$$;
revoke all on function public.admin_server_stats() from public, anon;
grant execute on function public.admin_server_stats() to authenticated;
