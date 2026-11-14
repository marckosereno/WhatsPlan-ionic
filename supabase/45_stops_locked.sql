-- ====================================================================
-- WHATSPLAN — 45_stops_locked.sql
-- Con alguien más aparte de quien organiza en el plan ya no se pueden
-- AGREGAR paradas: quien se unió aceptó ese itinerario. Quitar paradas
-- sigue permitido. (La app también esconde el botón "Agregar parada".)
-- Se puede correr varias veces (create or replace).
-- ====================================================================
create or replace function public.set_plan_stops(p_activity uuid, p_stops jsonb)
returns public.activities
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a public.activities; cur public.activities; nxt jsonb;
begin
  select * into cur from public.activities where id = p_activity and creator_id = me and status = 'active';
  if not found then raise exception 'Solo quien organiza puede cambiar las paradas'; end if;
  nxt := public.wp_plan_clean_stops(p_stops, cur.place_id);
  if jsonb_array_length(nxt) > jsonb_array_length(coalesce(cur.stops, '[]'::jsonb))
     and exists (select 1 from unnest(cur.participants) u where u <> me) then
    raise exception 'Ya hay personas en este plan: no se pueden agregar más paradas';
  end if;
  update public.activities set stops = nxt where id = p_activity returning * into a;
  begin
    insert into public.notifications (user_id, type, title, body, activity_id)
    select u, 'plan_update', '🧭 Cambió la ruta del plan',
      a.title || ' · ' || (1 + jsonb_array_length(a.stops)) || ' parada' || case when jsonb_array_length(a.stops) > 0 then 's' else '' end, a.id
    from unnest(a.participants) u where u <> me;
  exception when others then raise warning '[set_plan_stops] aviso: %', sqlerrm; end;
  return a;
end; $$;
grant execute on function public.set_plan_stops(uuid, jsonb) to authenticated;
