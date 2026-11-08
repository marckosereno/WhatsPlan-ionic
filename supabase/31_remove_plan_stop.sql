-- ====================================================================
-- WHATSPLAN — 31_remove_plan_stop.sql
-- Quitar una parada del plan (solo quien organiza, plan activo).
--   p_index: 0 = la primera parada (después del lugar principal)
--   p_shift: true = las paradas de después se adelantan a la hora de la
--            que se quitó; false = se quedan a su hora
-- No se puede quitar una parada que ya pasó.
-- Avisa a los que van con el nombre de la parada y cómo quedó la
-- siguiente ("Daddy' Bar sigue a las 9 pm" / "ahora es a las 7:30 pm").
-- Se puede correr varias veces.
-- ====================================================================
create or replace function public.wp_plan_hhmm(t timestamptz)
returns text language sql immutable as $$
  select case when extract(minute from t at time zone 'America/Mexico_City') = 0
    then to_char(t at time zone 'America/Mexico_City', 'FMHH12') else to_char(t at time zone 'America/Mexico_City', 'FMHH12:MI') end
    || ' ' || case when extract(hour from t at time zone 'America/Mexico_City') < 12 then 'am' else 'pm' end;
$$;

create or replace function public.remove_plan_stop(p_activity uuid, p_index int, p_shift boolean default false)
returns public.activities
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); a public.activities; s jsonb; gone jsonb; nxt jsonb;
  delta int := 0; body text; hh text;
begin
  select * into a from public.activities where id = p_activity and creator_id = me and status = 'active' for update;
  if not found then raise exception 'Solo quien organiza puede quitar paradas'; end if;
  s := coalesce(a.stops, '[]'::jsonb);
  if p_index < 0 or p_index >= jsonb_array_length(s) then raise exception 'Esa parada ya no está en el plan'; end if;
  gone := s -> p_index; nxt := s -> (p_index + 1);
  if a.scheduled_at + make_interval(mins => coalesce((gone->>'after')::int, 0)) <= now() then
    raise exception 'Esa parada ya pasó';
  end if;
  if p_shift and nxt is not null then
    delta := coalesce((nxt->>'after')::int, 0) - coalesce((gone->>'after')::int, 0);
  end if;
  -- quitarla y, si se pidió, adelantar las de después
  select coalesce(jsonb_agg(case when i > p_index + 1 and delta > 0
            then e || jsonb_build_object('after', greatest(5, (e->>'after')::int - delta)) else e end order by i), '[]'::jsonb)
    into s
    from jsonb_array_elements(s) with ordinality as x(e, i)
   where i <> p_index + 1;
  update public.activities set stops = public.wp_plan_clean_stops(s, place_id) where id = a.id returning * into a;
  body := a.title;
  if nxt is not null then
    hh := public.wp_plan_hhmm(a.scheduled_at + make_interval(mins => coalesce((nxt->>'after')::int, 0) - delta));
    body := (nxt->>'name') || case when delta > 0 then ' ahora es ' else ' sigue ' end
      || case when hh like '1 %' or hh like '1:%' then 'a la ' else 'a las ' end || hh;   -- a la 1 pm
  end if;
  begin
    insert into public.notifications (user_id, type, title, body, activity_id)
    select u, 'plan_update', '🧭 Se quitó ' || coalesce(gone->>'name', 'una parada') || ' del plan', body, a.id
    from unnest(a.participants) u where u <> me;
  exception when others then raise warning '[remove_plan_stop] aviso: %', sqlerrm; end;
  return a;
end; $$;
grant execute on function public.remove_plan_stop(uuid, int, boolean) to authenticated;
