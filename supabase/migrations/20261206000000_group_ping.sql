-- Train together: "I'm here, starting without you". Someone in a group workout taps it and everyone who hasn't
-- joined yet gets a phone notification (through the push function, like coach messages). At most once every
-- 2 minutes per person per workout. Safe to run more than once.

create table if not exists public.group_pings (
  session_id uuid not null references public.group_sessions (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  at         timestamptz not null default now(),
  primary key (session_id, user_id)
);
alter table public.group_pings enable row level security;
-- No policies: only group_ping and the push function (service role) touch it.

create extension if not exists pg_net;

/** 'ok', 'wait' (pinged in the last 2 minutes), 'none' (not in it, or it's over). */
create or replace function public.group_ping(p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  if auth.uid() is null then return 'none'; end if;
  if not exists (select 1 from public.group_session_members m join public.group_sessions s on s.id = m.session_id
                 where m.session_id = p_id and m.user_id = auth.uid() and m.joined and s.status <> 'done') then
    return 'none';
  end if;
  if exists (select 1 from public.group_pings where session_id = p_id and user_id = auth.uid() and at > now() - interval '2 minutes') then
    return 'wait';
  end if;
  insert into public.group_pings (session_id, user_id, at) values (p_id, auth.uid(), now())
  on conflict (session_id, user_id) do update set at = now();
  select decrypted_secret into k from vault.decrypted_secrets where name = 'push_hook' limit 1;
  if k is not null then
    begin
      perform net.http_post(
        url := 'https://utvhvzwkwhocdbiutavg.supabase.co/functions/v1/push',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', k),
        body := jsonb_build_object('type', 'group_ping', 'id', p_id, 'from', auth.uid()),
        timeout_milliseconds := 10000
      );
    exception when others then null;
    end;
  end if;
  return 'ok';
end;
$$;
revoke all on function public.group_ping(uuid) from public, anon;
grant execute on function public.group_ping(uuid) to authenticated;
