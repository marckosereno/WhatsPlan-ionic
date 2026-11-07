-- ====================================================================
-- WHATSPLAN — 29_stop_duration.sql
-- Duración de cada parada del plan ("¿Cuánto tiempo ahí?").
--   · wp_plan_clean_stops guarda 'dur' (minutos, de 15 a 720) y permite
--     que 'after' llegue a 1440 (paradas largas suman más de 12 h)
--   · set_plan_stops: el aviso "Cambió la ruta del plan" usa 🧭
-- Se puede correr varias veces (create or replace).
-- ====================================================================
create or replace function public.wp_plan_clean_stops(p jsonb, p_main text)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(x order by (x->>'after')::int), '[]'::jsonb) from (
    select jsonb_strip_nulls(jsonb_build_object(
      'place_id', left(e->>'place_id', 120), 'name', left(coalesce(nullif(trim(e->>'name'), ''), 'Lugar'), 80),
      'lat', case when (e->>'lat') ~ '^-?[0-9]+(\.[0-9]+)?$' then (e->>'lat')::float8 end,
      'lng', case when (e->>'lng') ~ '^-?[0-9]+(\.[0-9]+)?$' then (e->>'lng')::float8 end,
      'cat', left(coalesce(e->>'cat', ''), 30),
      'after', greatest(5, least(1440, coalesce(case when (e->>'after') ~ '^[0-9]+$' then (e->>'after')::int end, 60))),
      'dur', case when (e->>'dur') ~ '^[0-9]+$' then greatest(15, least(720, (e->>'dur')::int)) end,
      'act', left(e->>'act', 40), 'emoji', left(e->>'emoji', 8),
      'icon', case when (e->>'icon') ~ '^https://' then left(e->>'icon', 400) end,
      'note', nullif(left(trim(coalesce(e->>'note', '')), 140), ''),
      'address', nullif(left(trim(coalesce(e->>'address', '')), 160), ''),
      'custom', case when (e->>'place_id') like 'custom:%' then true end)) x
    from (select distinct on (e->>'place_id') e
          from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) e
          where coalesce(e->>'place_id', '') <> '' and e->>'place_id' is distinct from p_main
            and ((e->>'place_id') like 'custom:%' or ((e->>'lat') ~ '^-?[0-9.]+$' and (e->>'lng') ~ '^-?[0-9.]+$'))) d
    limit 3
  ) t;
$$;

create or replace function public.set_plan_stops(p_activity uuid, p_stops jsonb)
returns public.activities
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a public.activities;
begin
  update public.activities set stops = public.wp_plan_clean_stops(p_stops, place_id)
   where id = p_activity and creator_id = me and status = 'active' returning * into a;
  if not found then raise exception 'Solo quien organiza puede cambiar las paradas'; end if;
  begin
    insert into public.notifications (user_id, type, title, body, activity_id)
    select u, 'plan_update', '🧭 Cambió la ruta del plan',
      a.title || ' · ' || (1 + jsonb_array_length(a.stops)) || ' parada' || case when jsonb_array_length(a.stops) > 0 then 's' else '' end, a.id
    from unnest(a.participants) u where u <> me;
  exception when others then raise warning '[set_plan_stops] aviso: %', sqlerrm; end;
  return a;
end; $$;
grant execute on function public.set_plan_stops(uuid, jsonb) to authenticated;
