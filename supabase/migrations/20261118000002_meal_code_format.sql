-- Shared meal codes are 8 characters now (older ones have 4): the format check takes both.
alter table public.saved_meals drop constraint if exists saved_meals_code_format;
alter table public.saved_meals add constraint saved_meals_code_format check (code ~ '^MEAL-([A-Z0-9]{4}|[A-Z0-9]{8})$');
