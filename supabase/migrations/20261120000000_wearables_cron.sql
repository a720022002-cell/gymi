-- WHOOP, Oura and Polar stay up to date without opening the app: every 3 hours the database calls the wearables
-- function, which syncs the links not synced for 3 hours. The function checks a shared secret kept in the vault
-- ("wearables_cron") and as the Edge Function secret WEARABLES_CRON_SECRET (set outside this file).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('wearables-sync') where exists (select 1 from cron.job where jobname = 'wearables-sync');
select cron.schedule(
  'wearables-sync',
  '17 */3 * * *',
  $$
  select net.http_post(
    url := 'https://utvhvzwkwhocdbiutavg.supabase.co/functions/v1/wearables',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'wearables_cron')),
    body := '{"action":"cron"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
