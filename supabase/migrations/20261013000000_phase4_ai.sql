-- Gymi, Phase 4: AI coach. Chat history and a daily AI limit per person.
-- Safe to run more than once.

-- Your chats with the coach.
create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role        text not null check (role in ('user', 'ai')),
  text        text not null check (char_length(text) <= 4000),
  actions     jsonb,
  created_at  timestamptz not null default now()
);
alter table public.chat_messages add column if not exists chat_id uuid not null default gen_random_uuid();
create index if not exists chat_messages_user on public.chat_messages (user_id, created_at desc);
create index if not exists chat_messages_chat on public.chat_messages (chat_id, created_at);

alter table public.chat_messages enable row level security;
drop policy if exists "Own rows only" on public.chat_messages;
create policy "Own rows only" on public.chat_messages for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.chat_messages from anon;
grant select, insert, update, delete on public.chat_messages to authenticated;

-- How many AI requests each person made today. Only the server (Edge Function) can touch it.
create table if not exists public.ai_usage (
  user_id  uuid not null references auth.users (id) on delete cascade,
  day      date not null,
  count    integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Count one request; returns false when today's limit is reached. Called by the Edge Function only.
create or replace function public.ai_take(p_user uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare n int;
begin
  insert into public.ai_usage (user_id, day, count) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into n;
  return n <= p_limit;
end;
$$;
revoke all on function public.ai_take(uuid, int) from public, anon, authenticated;
grant execute on function public.ai_take(uuid, int) to service_role;

-- Steps for each day (typed in for now; phone health data comes with devices).
create table if not exists public.step_logs (
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day      date not null,
  steps    integer not null default 0 check (steps between 0 and 200000),
  primary key (user_id, day)
);
alter table public.step_logs enable row level security;
drop policy if exists "Own rows only" on public.step_logs;
create policy "Own rows only" on public.step_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.step_logs from anon;
grant select, insert, update, delete on public.step_logs to authenticated;
