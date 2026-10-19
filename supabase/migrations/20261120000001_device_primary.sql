-- Which device's sleep, HRV and heart rate win when two send them (a phone health app and a ring or band):
-- 'auto' (the ring or band), 'phone', or one wearable.
alter table public.device_prefs add column if not exists "primary" text not null default 'auto' check ("primary" in ('auto', 'phone', 'whoop', 'oura', 'polar'));
