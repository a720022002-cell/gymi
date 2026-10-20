-- The app is now Adro: our own foods move from "gymi" to "adro" (source and "gymi:" ids, and the food logs that
-- point to them), coach notification settings rename their "gymi" switch, and old GYMI- codes become ADRO-.
alter table public.foods drop constraint if exists foods_source_check;
update public.foods set source = 'adro' where source = 'gymi';
update public.foods set id = 'adro:' || substr(id, 6) where id like 'gymi:%';
alter table public.foods add constraint foods_source_check check (source in ('usda', 'adro', 'off', 'user'));
update public.food_logs set food_id = 'adro:' || substr(food_id, 6) where food_id like 'gymi:%';
update public.coach_settings set notif = (notif - 'gymi') || jsonb_build_object('adro', notif -> 'gymi') where notif ? 'gymi';
update public.profiles set invite_code = 'ADRO-' || substr(invite_code, 6) where invite_code like 'GYMI-%';
update public.coach_clients set code = 'ADRO-' || substr(code, 6) where code like 'GYMI-%';
