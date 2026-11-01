-- Train together: when you're added to a group workout (an invite), you get a phone notification, through the push
-- function like coach messages and "I'm here". The host is added already joined, so only the friends get one.
-- Safe to run more than once.

create extension if not exists pg_net;

create or replace function public.group_invite_push()
returns trigger language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  if new.joined then return new; end if;
  select decrypted_secret into k from vault.decrypted_secrets where name = 'push_hook' limit 1;
  if k is not null then
    begin
      perform net.http_post(
        url := 'https://utvhvzwkwhocdbiutavg.supabase.co/functions/v1/push',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', k),
        body := jsonb_build_object('type', 'group_invite', 'id', new.session_id, 'to', new.user_id),
        timeout_milliseconds := 10000
      );
    exception when others then null;
    end;
  end if;
  return new;
end;
$$;
revoke all on function public.group_invite_push() from public, anon, authenticated;

drop trigger if exists group_invite_push on public.group_session_members;
create trigger group_invite_push after insert on public.group_session_members
  for each row execute function public.group_invite_push();
