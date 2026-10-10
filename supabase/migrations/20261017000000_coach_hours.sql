-- Coach gym hours: in-person coaches say when they're at the gym, clients ask to meet then.
-- hours = [{ "days": [0..6], "from": "17:00", "to": "22:00" }, ...]  (0 = Sunday)

alter table public.coach_profiles add column if not exists hours jsonb not null default '[]'::jsonb;
alter table public.coach_applications add column if not exists hours jsonb not null default '[]'::jsonb;
alter table public.coach_profiles drop constraint if exists coach_profiles_hours_ok;
alter table public.coach_profiles add constraint coach_profiles_hours_ok check (jsonb_typeof(hours) = 'array' and jsonb_array_length(hours) <= 7);
alter table public.coach_applications drop constraint if exists coach_applications_hours_ok;
alter table public.coach_applications add constraint coach_applications_hours_ok check (jsonb_typeof(hours) = 'array' and jsonb_array_length(hours) <= 7);

-- Apply now also keeps the gym hours.
create or replace function public.apply_coach(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a uuid; h jsonb := coalesce(p -> 'hours', '[]'::jsonb);
begin
  if auth.uid() is null then raise exception 'auth'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and coach_status = 'approved') then raise exception 'already_coach'; end if;
  if jsonb_typeof(h) <> 'array' or jsonb_array_length(h) > 7 then h := '[]'::jsonb; end if;
  update public.coach_applications set status = 'withdrawn' where user_id = auth.uid() and status = 'pending';
  insert into public.coach_applications (user_id, coach_type, gym, city, years, specialties, certs, socials, bio, hours)
  values (auth.uid(), coalesce(p ->> 'coach_type', 'Personal'), left(coalesce(p ->> 'gym', ''), 80), left(coalesce(p ->> 'city', ''), 60),
          left(coalesce(p ->> 'years', ''), 20), coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p -> 'specialties', '[]'::jsonb)) x), '{}'),
          left(coalesce(p ->> 'certs', ''), 500), coalesce(p -> 'socials', '{}'::jsonb), left(coalesce(p ->> 'bio', ''), 600), h)
  returning id into a;
  update public.profiles set account_type = 'coach', coach_status = 'pending' where id = auth.uid();
  return a;
end;
$$;
revoke all on function public.apply_coach(jsonb) from public, anon;
grant execute on function public.apply_coach(jsonb) to authenticated;

-- Approving a coach also starts their coach profile from the application (if they don't have one yet).
create or replace function public.admin_decide_coach(p_user uuid, p_approve boolean, p_reason text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare a public.coach_applications;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.profiles set coach_status = case when p_approve then 'approved' else 'rejected' end
  where id = p_user and account_type = 'coach';
  select * into a from public.coach_applications where user_id = p_user and status in ('pending', 'approved', 'rejected') order by created_at desc limit 1;
  update public.coach_applications set status = case when p_approve then 'approved' else 'rejected' end,
         reason = case when p_approve then null else left(p_reason, 300) end, reviewed_by = auth.uid(), reviewed_at = now()
  where id = a.id;
  if p_approve and a.id is not null then
    insert into public.coach_profiles (user_id, bio, specialties, city, gym, years, coach_type, socials, hours)
    values (p_user, a.bio, a.specialties, a.city, a.gym,
            case a.years when 'Under 1' then 0 when '1 to 2' then 1 when '3 to 5' then 3 when '6 to 10' then 6 when 'Over 10' then 10 end,
            a.coach_type, a.socials, a.hours)
    on conflict (user_id) do update set hours = excluded.hours where public.coach_profiles.hours = '[]'::jsonb;
  end if;
  return exists (select 1 from public.profiles where id = p_user);
end;
$$;
revoke all on function public.admin_decide_coach(uuid, boolean, text) from public, anon;
grant execute on function public.admin_decide_coach(uuid, boolean, text) to authenticated;

-- Find a coach now shows gym hours.
drop function if exists public.list_coaches();
create function public.list_coaches()
returns table (id uuid, name text, username text, bio text, specialties text[], city text, gym text, price_month int, years int, clients int, coach_type text, packages jsonb, spots int, socials jsonb, hours jsonb)
language sql stable security definer set search_path = '' as $$
  select * from (
    select p.id, p.name, p.username, cp.bio, cp.specialties, cp.city, cp.gym, cp.price_month, cp.years::int,
      (select count(*)::int from public.coach_clients c where c.coach_id = p.id and c.status = 'active') as clients,
      cp.coach_type, cp.packages, cp.max_clients, cp.socials, cp.hours
    from public.coach_profiles cp join public.profiles p on p.id = cp.user_id
    where cp.listed and p.account_type = 'coach' and p.coach_status = 'approved' and auth.uid() is not null
  ) x
  where x.clients < x.max_clients
  order by x.name;
$$;
revoke all on function public.list_coaches() from public, anon;
grant execute on function public.list_coaches() to authenticated;

-- My coach now includes where and when they're at the gym.
drop function if exists public.my_coach();
create function public.my_coach()
returns table (id uuid, coach_id uuid, name text, username text, status text, kcal int, protein int, bio text, specialties text[], gym text, coach_type text, hours jsonb)
language sql stable security definer set search_path = '' as $$
  select c.id, c.coach_id, p.name, p.username, c.status, c.kcal, c.protein, cp.bio, cp.specialties, cp.gym, cp.coach_type, coalesce(cp.hours, '[]'::jsonb)
  from public.coach_clients c join public.profiles p on p.id = c.coach_id
  left join public.coach_profiles cp on cp.user_id = c.coach_id
  where c.client_id = auth.uid() and c.status in ('active', 'requested')
  order by c.status limit 1;
$$;
revoke all on function public.my_coach() from public, anon;
grant execute on function public.my_coach() to authenticated;
