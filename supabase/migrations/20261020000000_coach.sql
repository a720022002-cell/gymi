-- Gymi, coaches and admin round 2: commitment ranking, to-dos, meeting requests, coach settings,
-- fixed-duration packages, listing rules, invite plans, certificate uploads. Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Small helpers (internal only)
-- ---------------------------------------------------------------------------
-- Text to number, or null when it isn't one (plans are stored as JSON the app writes).
create or replace function public.coach_num(v text)
returns numeric language sql immutable set search_path = '' as $$
  select case when v ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' then v::numeric end;
$$;
revoke all on function public.coach_num(text) from public, anon, authenticated;

-- Is this coach link yours (active client or open invite)?
create or replace function public.coach_owns_link(l uuid, u uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coach_clients c where c.id = l and c.coach_id = u and c.status in ('active', 'invited'));
$$;
revoke all on function public.coach_owns_link(uuid, uuid) from public, anon;
grant execute on function public.coach_owns_link(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Coach profile: program headline, what clients get, sessions, re-listing
-- ---------------------------------------------------------------------------
alter table public.coach_profiles add column if not exists headline text not null default '' check (char_length(headline) <= 60);
alter table public.coach_profiles add column if not exists about text not null default '' check (char_length(about) <= 300);
alter table public.coach_profiles add column if not exists sessions smallint not null default 2 check (sessions between 0 and 30);
alter table public.coach_profiles add column if not exists auto_relist boolean not null default true;

-- Packages become 4 fixed durations: [{id:'m1'|'m3'|'m6'|'m12', name, months, weeks, on, price, desc, inc:[]}].
-- Old free-form packages move to the closest duration (first one wins), keeping price and description.
do $$
declare r record; x jsonb; k text; slots jsonb;
  defs jsonb := '[["m1","Monthly",1],["m3","3 months",3],["m6","6 months",6],["m12","1 year",12]]';
begin
  for r in select user_id, packages from public.coach_profiles
           where jsonb_typeof(packages) = 'array' and jsonb_array_length(packages) > 0 and not (packages -> 0 ? 'months') loop
    slots := '{}'::jsonb;
    for x in select * from jsonb_array_elements(r.packages) loop
      k := case when coalesce(public.coach_num(x ->> 'weeks'), 4) <= 6 then 'm1'
                when public.coach_num(x ->> 'weeks') <= 18 then 'm3'
                when public.coach_num(x ->> 'weeks') <= 39 then 'm6' else 'm12' end;
      if not slots ? k then slots := slots || jsonb_build_object(k, x); end if;
    end loop;
    update public.coach_profiles set packages = (
      select jsonb_agg(jsonb_build_object('id', d ->> 0, 'name', d ->> 1, 'months', (d ->> 2)::int, 'weeks', (d ->> 2)::int * 4,
               'on', slots ? (d ->> 0), 'price', coalesce(public.coach_num(slots -> (d ->> 0) ->> 'price'), 0),
               'desc', coalesce(slots -> (d ->> 0) ->> 'desc', ''), 'inc', '[]'::jsonb) order by (d ->> 2)::int)
      from jsonb_array_elements(defs) d)
    where user_id = r.user_id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Coach links: when a client joined; spots that open respect "Show again when a spot opens"
-- ---------------------------------------------------------------------------
alter table public.coach_clients add column if not exists joined_at timestamptz;
update public.coach_clients set joined_at = created_at where status = 'active' and joined_at is null;

create or replace function public.coach_clients_touch()
returns trigger language plpgsql security definer set search_path = '' as $$
declare cp public.coach_profiles; n int;
begin
  if new.status = 'active' and old.status is distinct from 'active' then new.joined_at := now(); end if;
  -- A client leaves a full coach who doesn't want to re-list automatically: hide them until they turn it back on.
  if old.status = 'active' and new.status <> 'active' then
    select * into cp from public.coach_profiles where user_id = new.coach_id;
    if cp.user_id is not null and not cp.auto_relist and cp.listed then
      select count(*) into n from public.coach_clients where coach_id = new.coach_id and status = 'active';
      if n >= cp.max_clients then update public.coach_profiles set listed = false where user_id = new.coach_id; end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.coach_clients_touch() from public, anon, authenticated;
drop trigger if exists coach_clients_touch on public.coach_clients;
create trigger coach_clients_touch before update on public.coach_clients for each row execute function public.coach_clients_touch();

-- Plans can be picked for an invite too; they apply when the client joins with the code.
create or replace function public.coach_assign(p_link uuid, p_program uuid, p_meal uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_program is not null and not exists (select 1 from public.coach_programs where id = p_program and coach_id = auth.uid()) then return false; end if;
  if p_meal is not null and not exists (select 1 from public.coach_meal_plans where id = p_meal and coach_id = auth.uid()) then return false; end if;
  update public.coach_clients set program_id = p_program, meal_plan_id = p_meal where id = p_link and coach_id = auth.uid() and status in ('active', 'invited');
  return found;
end;
$$;
revoke all on function public.coach_assign(uuid, uuid, uuid) from public, anon;
grant execute on function public.coach_assign(uuid, uuid, uuid) to authenticated;

-- Requests to a full coach are refused.
create or replace function public.request_coach(p_coach uuid)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return 'auth'; end if;
  if not public.is_approved_coach(p_coach) or p_coach = auth.uid() then return 'bad_coach'; end if;
  if exists (select 1 from public.coach_clients where client_id = auth.uid() and status = 'active') then return 'has_coach'; end if;
  if exists (select 1 from public.coach_clients where client_id = auth.uid() and coach_id = p_coach and status = 'requested') then return 'ok'; end if;
  if (select count(*) from public.coach_clients where coach_id = p_coach and status = 'active')
     >= coalesce((select max_clients from public.coach_profiles where user_id = p_coach), 20) then return 'full'; end if;
  insert into public.coach_clients (coach_id, client_id, status) values (p_coach, auth.uid(), 'requested');
  return 'ok';
end;
$$;
revoke all on function public.request_coach(uuid) from public, anon;
grant execute on function public.request_coach(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. To-dos per client (only the coach sees them)
-- ---------------------------------------------------------------------------
create table if not exists public.coach_todos (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  link_id     uuid not null references public.coach_clients (id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 200),
  due         text check (due in ('Today', 'Tomorrow', 'Next session', 'This week')),
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists coach_todos_link on public.coach_todos (link_id, created_at);
alter table public.coach_todos enable row level security;
drop policy if exists "Coach owns todos" on public.coach_todos;
create policy "Coach owns todos" on public.coach_todos for all to authenticated
  using ((select auth.uid()) = coach_id)
  with check ((select auth.uid()) = coach_id and public.coach_owns_link(link_id, (select auth.uid())));
revoke all on public.coach_todos from anon;
grant select, insert, update, delete on public.coach_todos to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Commitment over a period: workouts as planned, calories on target, protein, water, sleep 7 h+
-- ---------------------------------------------------------------------------
-- A client's targets: coach targets first, then the coach's meal plan, then their own plan.
create or replace function public.coach_client_targets(p_link uuid)
returns table (kcal int, protein int, water int, days numeric)
language sql stable security definer set search_path = '' as $$
  select coalesce(c.kcal, mp.k, public.coach_num(fp.plan ->> 'kcal')::int, 2000),
         coalesce(c.protein, mp.p, round(public.coach_num(fp.plan ->> 'perKg') * coalesce(public.coach_num(fp.plan ->> 'weight'), p.weight_kg, 75))::int, 120),
         coalesce(public.coach_num(fp.plan ->> 'water')::int, 2500),
         least(7, greatest(1, coalesce(pg.d, public.coach_num(tp.plan ->> 'days'), 3)))
  from public.coach_clients c
  left join public.profiles p on p.id = c.client_id
  left join public.food_plans fp on fp.user_id = c.client_id
  left join public.train_plans tp on tp.user_id = c.client_id
  left join lateral (select nullif(sum(coalesce(public.coach_num(m ->> 'k'), 0)), 0)::int as k, nullif(sum(coalesce(public.coach_num(m ->> 'p'), 0)), 0)::int as p
                     from public.coach_meal_plans x, jsonb_array_elements(x.meals) m where x.id = c.meal_plan_id) mp on true
  left join lateral (select nullif(count(*), 0)::numeric as d
                     from public.coach_programs x, jsonb_array_elements(x.days) dd where x.id = c.program_id and jsonb_array_length(coalesce(dd -> 'ex', '[]'::jsonb)) > 0) pg on true
  where c.id = p_link;
$$;
revoke all on function public.coach_client_targets(uuid) from public, anon, authenticated;

create or replace function public.coach_commit_parts(p_user uuid, p_from date, p_to date, p_kcal int, p_protein int, p_water int, p_days numeric)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare f date; n int; w numeric; k numeric; pr numeric; wa numeric; s numeric;
begin
  select greatest(p_from, (created_at at time zone 'utc')::date) into f from public.profiles where id = p_user;
  n := p_to - f + 1;
  if n is null or n < 1 then return null; end if;
  select count(distinct day) into w from public.workout_logs where user_id = p_user and day between f and p_to;
  select count(*) filter (where kc between p_kcal * 0.85 and p_kcal * 1.15), count(*) filter (where pt >= p_protein * 0.9) into k, pr
  from (select sum(kcal) as kc, sum(protein) as pt from public.food_logs where user_id = p_user and day between f and p_to group by day) x;
  select count(*) into wa from (select 1 from public.water_logs where user_id = p_user and day between f and p_to group by day having sum(ml) >= p_water * 0.9) x;
  select count(*) into s from public.checkins where user_id = p_user and day between f and p_to and sleep_h >= 7;
  w := least(100, round(100 * w / greatest(1, p_days * n / 7.0)));
  k := round(100 * k / n); pr := round(100 * pr / n); wa := round(100 * wa / n); s := round(100 * s / n);
  return jsonb_build_object('workouts', w, 'calories', k, 'protein', pr, 'water', wa, 'sleep', s, 'total', round((w + k + pr + wa + s) / 5), 'days', n);
end;
$$;
revoke all on function public.coach_commit_parts(uuid, date, date, int, int, int, numeric) from public, anon, authenticated;

-- Coach: active clients with commitment over the last 30 days and the 30 before (for the trend).
create or replace function public.coach_ranking()
returns table (link_id uuid, client_id uuid, commit int, prev int, parts jsonb, joined_at timestamptz, last_food date, last_workout date, welcomed boolean, todos int)
language sql stable security definer set search_path = '' as $$
  select c.id, c.client_id, (x.cur ->> 'total')::int, (x.prv ->> 'total')::int, x.cur, c.joined_at,
    (select max(f.day) from public.food_logs f where f.user_id = c.client_id),
    (select max(w.day) from public.workout_logs w where w.user_id = c.client_id),
    exists (select 1 from public.coach_messages m where m.link_id = c.id and m.sender = c.coach_id),
    (select count(*)::int from public.coach_todos t where t.link_id = c.id and not t.done)
  from public.coach_clients c
  cross join lateral public.coach_client_targets(c.id) tg
  cross join lateral (select public.coach_commit_parts(c.client_id, current_date - 29, current_date, tg.kcal, tg.protein, tg.water, tg.days) as cur,
                             public.coach_commit_parts(c.client_id, current_date - 59, current_date - 30, tg.kcal, tg.protein, tg.water, tg.days) as prv) x
  where c.coach_id = auth.uid() and c.status = 'active'
  order by 3 desc nulls last;
$$;

revoke all on function public.coach_ranking() from public, anon;
grant execute on function public.coach_ranking() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Coach settings (notifications)
-- ---------------------------------------------------------------------------
create table if not exists public.coach_settings (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  notif       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.coach_settings enable row level security;
drop policy if exists "Own rows only" on public.coach_settings;
create policy "Own rows only" on public.coach_settings for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.coach_settings from anon;
grant select, insert, update, delete on public.coach_settings to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Messages: meeting requests and check-in nudges
-- ---------------------------------------------------------------------------
alter table public.coach_messages add column if not exists kind text not null default 'text';
alter table public.coach_messages add column if not exists meta jsonb;
alter table public.coach_messages drop constraint if exists coach_messages_kind_ok;
alter table public.coach_messages add constraint coach_messages_kind_ok check (kind in ('text', 'meet', 'nudge'));

-- New meeting requests always start as pending.
drop policy if exists "Send coach messages" on public.coach_messages;
create policy "Send coach messages" on public.coach_messages for insert to authenticated
  with check ((select auth.uid()) = sender and public.coach_link_member(link_id, (select auth.uid()))
              and (kind <> 'meet' or coalesce(meta ->> 'status', 'pending') = 'pending'));

-- Coach answers a meeting request: confirm or ask for another time.
create or replace function public.coach_meeting_reply(p_msg uuid, p_ok boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.coach_messages m set meta = coalesce(m.meta, '{}'::jsonb) || jsonb_build_object('status', case when p_ok then 'confirmed' else 'declined' end)
  where m.id = p_msg and m.kind = 'meet' and coalesce(m.meta ->> 'status', 'pending') = 'pending'
    and exists (select 1 from public.coach_clients c where c.id = m.link_id and c.coach_id = auth.uid() and c.status = 'active');
  return found;
end;
$$;
revoke all on function public.coach_meeting_reply(uuid, boolean) from public, anon;
grant execute on function public.coach_meeting_reply(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Find a coach, a coach's page, my coach, my coach's plans
-- ---------------------------------------------------------------------------
drop function if exists public.list_coaches();
create function public.list_coaches()
returns table (id uuid, name text, username text, bio text, specialties text[], city text, gym text, price_month int, years int, clients int, coach_type text, packages jsonb, spots int, socials jsonb, hours jsonb, headline text, about text, sessions int)
language sql stable security definer set search_path = '' as $$
  select * from (
    select p.id, p.name, p.username, cp.bio, cp.specialties, cp.city, cp.gym, cp.price_month, cp.years::int,
      (select count(*)::int from public.coach_clients c where c.coach_id = p.id and c.status = 'active') as clients,
      cp.coach_type, cp.packages, cp.max_clients, cp.socials, cp.hours, cp.headline, cp.about, cp.sessions::int
    from public.coach_profiles cp join public.profiles p on p.id = cp.user_id
    where cp.listed and p.account_type = 'coach' and p.coach_status = 'approved' and auth.uid() is not null
  ) x
  where x.clients < x.max_clients
  order by x.name;
$$;
revoke all on function public.list_coaches() from public, anon;
grant execute on function public.list_coaches() to authenticated;

-- One coach's page: listed coaches (full ones too), your own coach, or yourself (preview).
drop function if exists public.coach_card(uuid);
create function public.coach_card(p_id uuid)
returns table (id uuid, name text, username text, bio text, specialties text[], city text, gym text, price_month int, years int, clients int, coach_type text, packages jsonb, spots int, socials jsonb, hours jsonb, headline text, about text, sessions int, listed boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.username, cp.bio, cp.specialties, cp.city, cp.gym, cp.price_month, cp.years::int,
    (select count(*)::int from public.coach_clients c where c.coach_id = p.id and c.status = 'active'),
    cp.coach_type, cp.packages, cp.max_clients, cp.socials, cp.hours, cp.headline, cp.about, cp.sessions::int, cp.listed
  from public.coach_profiles cp join public.profiles p on p.id = cp.user_id
  where cp.user_id = p_id and p.account_type = 'coach' and p.coach_status = 'approved' and auth.uid() is not null
    and (cp.listed or p_id = auth.uid()
         or exists (select 1 from public.coach_clients c where c.coach_id = p_id and c.client_id = auth.uid() and c.status in ('active', 'requested')));
$$;
revoke all on function public.coach_card(uuid) from public, anon;
grant execute on function public.coach_card(uuid) to authenticated;

-- My coach now includes the package and when you joined (no package = joined with a code).
drop function if exists public.my_coach();
create function public.my_coach()
returns table (id uuid, coach_id uuid, name text, username text, status text, kcal int, protein int, bio text, specialties text[], gym text, coach_type text, hours jsonb, package text, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.coach_id, p.name, p.username, c.status, c.kcal, c.protein, cp.bio, cp.specialties, cp.gym, cp.coach_type, coalesce(cp.hours, '[]'::jsonb), c.package, c.joined_at
  from public.coach_clients c join public.profiles p on p.id = c.coach_id
  left join public.coach_profiles cp on cp.user_id = c.coach_id
  where c.client_id = auth.uid() and c.status in ('active', 'requested')
  order by c.status limit 1;
$$;
revoke all on function public.my_coach() from public, anon;
grant execute on function public.my_coach() to authenticated;

-- Client: the program and meal plan your coach gave you, with the coach's name and the plan's daily totals.
create or replace function public.my_coach_plans()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'link_id', c.id, 'coach_id', c.coach_id, 'coach', coalesce(pr.name, pr.username), 'kcal', c.kcal, 'protein', c.protein,
    'program', (select jsonb_build_object('id', p.id, 'name', p.name, 'days', p.days, 'updated_at', p.updated_at) from public.coach_programs p where p.id = c.program_id),
    'meals', (select jsonb_build_object('id', m.id, 'name', m.name, 'meals', m.meals, 'updated_at', m.updated_at,
                'kcal', (select coalesce(sum(coalesce(public.coach_num(x ->> 'k'), 0)), 0)::int from jsonb_array_elements(m.meals) x),
                'protein', (select coalesce(sum(coalesce(public.coach_num(x ->> 'p'), 0)), 0)::int from jsonb_array_elements(m.meals) x))
              from public.coach_meal_plans m where m.id = c.meal_plan_id))
  from public.coach_clients c join public.profiles pr on pr.id = c.coach_id
  where c.client_id = auth.uid() and c.status = 'active' limit 1;
$$;
revoke all on function public.my_coach_plans() from public, anon;
grant execute on function public.my_coach_plans() to authenticated;

-- ---------------------------------------------------------------------------
-- 9. One client's progress for the coach: longer workout history, steps and targets
-- ---------------------------------------------------------------------------
create or replace function public.client_summary(p_client uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.profiles; fp public.food_plans; l uuid; tg record;
begin
  select id into l from public.coach_clients where coach_id = auth.uid() and client_id = p_client and status = 'active' limit 1;
  if l is null then return null; end if;
  select * into p from public.profiles where id = p_client;
  select * into fp from public.food_plans where user_id = p_client;
  select * into tg from public.coach_client_targets(l);
  return jsonb_build_object(
    'name', p.name, 'username', p.username, 'gender', p.gender, 'dob', p.date_of_birth, 'height', p.height_cm,
    'plan', coalesce(fp.plan, '{}'::jsonb), 'streak', public.user_streak(p_client),
    'targets', jsonb_build_object('kcal', tg.kcal, 'protein', tg.protein, 'water', tg.water, 'days', tg.days),
    'weights', coalesce((select jsonb_agg(x order by x.day) from (select day, value from public.measurements where user_id = p_client and kind = 'weight' and day > current_date - 90) x), '[]'::jsonb),
    'workouts', coalesce((select jsonb_agg(x order by x.day desc) from (select day, name, minutes, volume, prs from public.workout_logs where user_id = p_client and day > current_date - 49) x), '[]'::jsonb),
    'food', coalesce((select jsonb_agg(x order by x.day desc) from (select day, sum(kcal)::int as kcal, round(sum(protein))::int as protein from public.food_logs where user_id = p_client and day > current_date - 14 group by day) x), '[]'::jsonb),
    'today', coalesce((select jsonb_agg(x) from (select name, meal, kcal, protein from public.food_logs where user_id = p_client and day = current_date order by created_at) x), '[]'::jsonb),
    'checkins', coalesce((select jsonb_agg(x order by x.day desc) from (select day, sleep_h, energy, sore, score from public.checkins where user_id = p_client and day > current_date - 14) x), '[]'::jsonb),
    'water', coalesce((select jsonb_agg(x order by x.day desc) from (select day, sum(ml)::int as ml from public.water_logs where user_id = p_client and day > current_date - 7 group by day) x), '[]'::jsonb),
    'steps', coalesce((select jsonb_agg(x order by x.day desc) from (select day, steps from public.step_logs where user_id = p_client and day > current_date - 7) x), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.client_summary(uuid) from public, anon;
grant execute on function public.client_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Coach applications: certificate files in a private bucket
-- ---------------------------------------------------------------------------
alter table public.coach_applications add column if not exists cert_files jsonb not null default '[]'::jsonb;
alter table public.coach_applications drop constraint if exists coach_applications_cert_files_ok;
alter table public.coach_applications add constraint coach_applications_cert_files_ok check (jsonb_typeof(cert_files) = 'array' and jsonb_array_length(cert_files) <= 5);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coach-certs', 'coach-certs', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Files live under "<user id>/...". The owner uploads and reads them; the Gymi team reads them.
drop policy if exists "Coach certs: upload own" on storage.objects;
create policy "Coach certs: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'coach-certs' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Coach certs: read own or admin" on storage.objects;
create policy "Coach certs: read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'coach-certs' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
drop policy if exists "Coach certs: delete own" on storage.objects;
create policy "Coach certs: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'coach-certs' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Apply now keeps uploaded certificate files (only your own folder).
create or replace function public.apply_coach(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a uuid; h jsonb := coalesce(p -> 'hours', '[]'::jsonb); cf jsonb;
begin
  if auth.uid() is null then raise exception 'auth'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and coach_status = 'approved') then raise exception 'already_coach'; end if;
  if jsonb_typeof(h) <> 'array' or jsonb_array_length(h) > 7 then h := '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('path', x ->> 'path', 'name', left(coalesce(x ->> 'name', 'Certificate'), 120))), '[]'::jsonb) into cf
  from (select x from jsonb_array_elements(case when jsonb_typeof(p -> 'cert_files') = 'array' then p -> 'cert_files' else '[]'::jsonb end) x limit 5) s
  where x ->> 'path' like auth.uid()::text || '/%';
  update public.coach_applications set status = 'withdrawn' where user_id = auth.uid() and status = 'pending';
  insert into public.coach_applications (user_id, coach_type, gym, city, years, specialties, certs, socials, bio, hours, cert_files)
  values (auth.uid(), coalesce(p ->> 'coach_type', 'Personal'), left(coalesce(p ->> 'gym', ''), 80), left(coalesce(p ->> 'city', ''), 60),
          left(coalesce(p ->> 'years', ''), 20), coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p -> 'specialties', '[]'::jsonb)) x), '{}'),
          left(coalesce(p ->> 'certs', ''), 500), coalesce(p -> 'socials', '{}'::jsonb), left(coalesce(p ->> 'bio', ''), 600), h, cf)
  returning id into a;
  update public.profiles set account_type = 'coach', coach_status = 'pending' where id = auth.uid();
  return a;
end;
$$;
revoke all on function public.apply_coach(jsonb) from public, anon;
grant execute on function public.apply_coach(jsonb) to authenticated;

-- The review queue includes certificate files and gym hours.
drop function if exists public.admin_coach_queue();
create function public.admin_coach_queue()
returns table (user_id uuid, name text, username text, email text, phone text, coach_status text, joined timestamptz,
               app_id uuid, coach_type text, gym text, city text, years text, specialties text[], certs text, socials jsonb, bio text, applied timestamptz, reason text,
               cert_files jsonb, hours jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
  select p.id, p.name, p.username, p.email, p.phone, p.coach_status, p.created_at,
         a.id, a.coach_type, a.gym, a.city, a.years, a.specialties, a.certs, a.socials, a.bio, a.created_at, a.reason,
         coalesce(a.cert_files, '[]'::jsonb), coalesce(a.hours, '[]'::jsonb)
  from public.profiles p
  left join lateral (select * from public.coach_applications x where x.user_id = p.id and x.status <> 'withdrawn' order by x.created_at desc limit 1) a on true
  where p.account_type = 'coach'
  order by (p.coach_status = 'pending') desc, coalesce(a.created_at, p.created_at) desc
  limit 200;
end;
$$;
revoke all on function public.admin_coach_queue() from public, anon;
grant execute on function public.admin_coach_queue() to authenticated;
