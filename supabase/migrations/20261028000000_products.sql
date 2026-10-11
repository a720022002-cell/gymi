-- Packaged products (Open Food Facts) and restaurant brands in the food search.
alter table public.foods drop constraint if exists foods_source_check;
alter table public.foods add constraint foods_source_check check (source in ('usda', 'gymi', 'off'));
alter table public.foods drop constraint if exists foods_category_check;
alter table public.foods add constraint foods_category_check check (category in ('basic', 'gulf', 'rest', 'usda', 'product'));
alter table public.foods add column if not exists brand text;
alter table public.foods add column if not exists barcode text;
alter table public.foods add column if not exists restaurant_ar text;
create index if not exists foods_barcode on public.foods (barcode) where barcode is not null;
