-- Welcome email: once someone confirms their email, the database asks the welcome function to send it (once per
-- account). The function checks a shared secret kept in the vault ("welcome_hook") and as the Edge Function secret
-- WELCOME_HOOK_SECRET (set outside this file). Until the vault secret exists, nothing is sent.
create extension if not exists pg_net;

-- Who got it already, so it's never sent twice. Only the server reads or writes it.
create table if not exists public.welcome_emails (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.welcome_emails enable row level security;

create or replace function public.send_welcome_email()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'welcome_hook';
  if secret is null then
    return new;
  end if;
  perform net.http_post(
    url := 'https://utvhvzwkwhocdbiutavg.supabase.co/functions/v1/welcome',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', secret),
    body := jsonb_build_object('user_id', new.id),
    timeout_milliseconds := 15000
  );
  return new;
exception when others then
  -- A welcome email must never stop anyone from confirming their account.
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed_welcome on auth.users;
create trigger on_auth_user_confirmed_welcome
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.send_welcome_email();
