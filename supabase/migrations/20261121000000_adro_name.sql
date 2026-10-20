-- The app is now called Adro: new coach codes start with ADRO-, the fallback invite code base is ADRO, and
-- "adro…" usernames are reserved like "gymi…" ones. Codes made before keep working.

CREATE OR REPLACE FUNCTION public.coach_invite()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  abc constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea;
  c text;
begin
  if not public.is_approved_coach(auth.uid()) then raise exception 'not_coach'; end if;
  loop
    b := extensions.gen_random_bytes(8);
    c := 'ADRO-';
    for j in 0..7 loop
      c := c || substr(abc, 1 + (get_byte(b, j) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.coach_clients where code = c);
  end loop;
  insert into public.coach_clients (coach_id, code, status) values (auth.uid(), c, 'invited');
  return c;
end;
$function$;

CREATE OR REPLACE FUNCTION public.make_invite_code(p_username text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  base text := upper(left(coalesce(nullif(regexp_replace(coalesce(p_username, ''), '[._0-9].*$', ''), ''), 'adro'), 8));
  abc  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  code text;
begin
  loop
    bytes := extensions.gen_random_bytes(6);
    code := base || '-';
    for j in 0..5 loop
      code := code || substr(abc, 1 + (get_byte(bytes, j) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.profiles where invite_code = code);
  end loop;
  return code;
end;
$function$;

CREATE OR REPLACE FUNCTION public.username_reserved(p_username text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select lower(coalesce(p_username, '')) in ('adro', 'gymi', 'admin', 'coach', 'support', 'help', 'team', 'official', 'staff', 'moderator')
      or lower(coalesce(p_username, '')) like 'gymi%'
      or lower(coalesce(p_username, '')) like 'adro%'
      or lower(coalesce(p_username, '')) like '%admin%';
$function$;

