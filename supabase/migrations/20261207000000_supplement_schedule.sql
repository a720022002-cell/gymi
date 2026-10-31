-- Vitamins: the reminder's date and how it repeats, like Apple's Reminders (never, daily, weekdays, weekends, weekly
-- on chosen days, monthly, yearly, every few days). freq stays (Daily, Weekly or Monthly) for older app versions.
-- Safe to run more than once.
alter table public.supplements add column if not exists schedule jsonb
  check (schedule is null or (jsonb_typeof(schedule) = 'object' and pg_column_size(schedule) < 1000));
