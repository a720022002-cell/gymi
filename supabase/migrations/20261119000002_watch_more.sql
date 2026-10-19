-- More from the phone's health app: body fat, sleep stages and bedtime, breathing, blood oxygen and wrist temperature;
-- whether Gymi also writes its own data back; and heart rate during Gymi workouts.

alter table public.device_readings
  add column if not exists body_fat numeric check (body_fat between 2 and 75),
  add column if not exists deep_h numeric check (deep_h between 0 and 24),
  add column if not exists rem_h numeric check (rem_h between 0 and 24),
  -- When you fell asleep, in minutes from midnight (negative = before midnight, like -45 for 23:15).
  add column if not exists bed_min smallint check (bed_min between -720 and 720),
  add column if not exists resp_rate numeric check (resp_rate between 4 and 60),
  add column if not exists spo2 numeric check (spo2 between 50 and 100),
  -- Apple Watch: wrist temperature while asleep (°C). Health Connect: change from your baseline.
  add column if not exists wrist_temp numeric check (wrist_temp between 25 and 45),
  add column if not exists temp_dev numeric check (temp_dev between -10 and 10);
-- Period days from the health app are never stored here: they go straight into cycle tracking, which may be kept on
-- the phone only.
alter table public.device_readings drop column if exists period;

-- Off until you turn it on: Gymi's workouts, meals, water and weight are written to Apple Health / Health Connect.
alter table public.device_prefs add column if not exists write_back boolean not null default false;

-- Heart rate the watch measured during a Gymi workout.
alter table public.workout_logs
  add column if not exists avg_hr smallint check (avg_hr between 30 and 250),
  add column if not exists max_hr smallint check (max_hr between 30 and 250);
