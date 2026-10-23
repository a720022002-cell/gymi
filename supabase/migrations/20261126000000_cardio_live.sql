-- Live cardio sessions (screen: cardio-live). A finished session is saved as a normal cardio_logs row, so the calorie
-- budget, training load, recovery and history keep working from "kind", "minutes", "intensity" and "kcal". These
-- columns add what the session measured. All optional: manual logs and older app versions leave them empty.
--
-- kind stays one of Walk, Run, Bike, Swim, Other (older app versions only know these); the exact sport (Row,
-- Elliptical, Stairs, HIIT…) is in "sport". Safe to run more than once.

alter table public.cardio_logs add column if not exists avg_hr smallint check (avg_hr between 30 and 250);
alter table public.cardio_logs add column if not exists max_hr smallint check (max_hr between 30 and 250);
alter table public.cardio_logs add column if not exists distance_m integer check (distance_m between 0 and 500000);
-- Seconds spent in heart rate zones 1 to 5: [z1, z2, z3, z4, z5].
alter table public.cardio_logs add column if not exists zones jsonb check (zones is null or (jsonb_typeof(zones) = 'array' and jsonb_array_length(zones) = 5));
alter table public.cardio_logs add column if not exists sport text check (char_length(sport) <= 20);
-- Where the heart rate came from: a Bluetooth sensor, the Apple Watch (through Apple Health), or none (time and effort only).
alter table public.cardio_logs add column if not exists source text check (source in ('ble', 'apple', 'none'));
-- The weekly cardio plan item this session came from (passed through by the app).
alter table public.cardio_logs add column if not exists plan_ref text check (char_length(plan_ref) <= 80);
alter table public.cardio_logs add column if not exists ai_note text check (char_length(ai_note) <= 300);
-- When the session started (the row's created_at is when it ended), so a watch workout at the same time can be matched.
alter table public.cardio_logs add column if not exists started_at timestamptz;

-- Row level security is unchanged ("Own rows only" from phase 3); kept on in case it was ever turned off.
alter table public.cardio_logs enable row level security;
