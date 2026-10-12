-- The same training answers always give the same AI plan: the first plan built for a set of answers is kept and reused.
-- Holds no personal data (only the answers' fingerprint and the exercise plan). Only the server (service role) reads or writes it.
create table if not exists public.ai_plan_cache (
  key text primary key,
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.ai_plan_cache enable row level security;
revoke all on public.ai_plan_cache from anon, authenticated;
