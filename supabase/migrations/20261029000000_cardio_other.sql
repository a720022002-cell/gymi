-- Cardio: "Other" activity with your own name and calories (football, padel, boxing…).
alter table public.cardio_logs drop constraint if exists cardio_logs_kind_check;
alter table public.cardio_logs add constraint cardio_logs_kind_check check (kind in ('Walk', 'Run', 'Bike', 'Swim', 'Other'));
alter table public.cardio_logs add column if not exists name text check (char_length(name) <= 40);
