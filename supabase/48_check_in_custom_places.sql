-- 48_check_in_custom_places.sql
-- "Estuve aquí" (check_in) ahora también acepta los lugares de custom_places (los de DENUE).
-- Antes solo buscaba en public.places, y al ocultar los lugares de Google (SQL 47) no quedaba
-- ningún lugar donde registrar visitas. Es la misma función de siempre; solo cambia la búsqueda
-- de las coordenadas del lugar. Se puede volver a correr.

CREATE OR REPLACE FUNCTION public.check_in(p_place_id text, p_lat double precision, p_lng double precision)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
me     uuid := auth.uid();
plat   double precision;
plng   double precision;
d      double precision;
tz     constant text := 'America/Matamoros';
today  date := (now() at time zone tz)::date;
n      int;
got    int;
earned int := 0;
awards jsonb := '[]'::jsonb;
c      record;
tot    int;
nb     text[];
myname text;
begin
if me is null then raise exception 'NO_AUTH'; end if;
if p_lat is null or p_lng is null then raise exception 'NO_COORDS'; end if;
select q.lat, q.lng into plat, plng
from (
  select lat::double precision as lat, lng::double precision as lng
    from public.places where place_id = p_place_id and coalesce(hidden, false) = false
  union all
  select lat::double precision, lng::double precision
    from public.custom_places where place_id = p_place_id and coalesce(visible, true) = true
) q
limit 1;
if not found or plat is null or plng is null then raise exception 'NO_PLACE'; end if;
d := 2 * 6371000 * asin(sqrt(
power(sin(radians(p_lat - plat) / 2), 2) +
cos(radians(plat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - plng) / 2), 2)));
if d > 100 then raise exception 'TOO_FAR:%', round(d)::int; end if;
if exists (select 1 from public.place_visits where user_id = me and place_id = p_place_id and visit_day = today) then
raise exception 'ALREADY_TODAY';
end if;
insert into public.place_visits (user_id, place_id, visit_day, dist_m)
values (me, p_place_id, today, round(d)::int);
select count(*) into n from public.place_visits where user_id = me and place_id = p_place_id;
-- Lugar nuevo / repetido
if n = 1 then
insert into public.user_points (user_id, kind, ref, points) values (me, 'new_place', p_place_id, 10)
on conflict do nothing;
get diagnostics got = row_count;
if got > 0 then earned := earned + 10; awards := awards || jsonb_build_object('kind', 'new_place', 'points', 10); end if;
else
insert into public.user_points (user_id, kind, ref, points) values (me, 'repeat', p_place_id || ':' || today, 2)
on conflict do nothing;
get diagnostics got = row_count;
if got > 0 then earned := earned + 2; awards := awards || jsonb_build_object('kind', 'repeat', 'points', 2); end if;
end if;
-- Zona nueva de la niebla
insert into public.user_hexes (user_id, hex)
select me, h from unnest(public.wp_hex_reveal(plat, plng)) h
on conflict do nothing;
get diagnostics got = row_count;
if got > 0 then
insert into public.user_points (user_id, kind, ref, points) values (me, 'zone', p_place_id, 5)
on conflict do nothing;
get diagnostics got = row_count;
if got > 0 then earned := earned + 5; awards := awards || jsonb_build_object('kind', 'zone', 'points', 5); end if;
end if;
-- Colecciones que esta visita completa (tuyas o públicas, de 3+ lugares)
for c in
select pc.id, pc.name, pc.emoji, pc.user_id
from public.place_collections pc
join public.place_collection_items i on i.collection_id = pc.id and i.place_id = p_place_id
where (pc.is_public or pc.user_id = me)
and (select count(*) from public.place_collection_items i3 where i3.collection_id = pc.id) >= 3
and not exists (
select 1 from public.place_collection_items i2
where i2.collection_id = pc.id
and not exists (select 1 from public.place_visits v where v.user_id = me and v.place_id = i2.place_id)
)
loop
insert into public.collection_completions (user_id, collection_id) values (me, c.id)
on conflict do nothing;
get diagnostics got = row_count;
if got > 0 then
insert into public.user_points (user_id, kind, ref, points) values (me, 'collection', c.id::text, 50)
on conflict do nothing;
earned := earned + 50;
awards := awards || jsonb_build_object('kind', 'collection', 'points', 50, 'name', trim(coalesce(c.emoji, '') || ' ' || c.name));
-- Aviso al dueño (si no es tuya). Si no muestras tus visitas, sale "Alguien".
if c.user_id <> me then
select case when coalesce(p.show_visits, true) then coalesce(nullif(p.name, ''), '@' || p.username, 'Alguien') else 'Alguien' end
into myname from public.profiles p where p.id = me;
begin
insert into public.notifications (user_id, type, title, body)
values (c.user_id, 'collection_done', '🏁 Completaron tu colección',
coalesce(myname, 'Alguien') || ' visitó todos los lugares de ' || trim(coalesce(c.emoji, '') || ' ' || c.name));
exception when others then
raise warning '[check_in] aviso al dueño: %', sqlerrm; -- el aviso no debe tumbar la visita
end;
end if;
end if;
end loop;
select coalesce(sum(points), 0)::int into tot from public.user_points where user_id = me;
nb := public.wp_badges_check(me);
return jsonb_build_object('ok', true, 'first', n = 1, 'visits', n, 'dist_m', round(d)::int,
'points', earned, 'total', tot, 'level', public.wp_level(tot), 'awards', awards,
'badges', to_jsonb(coalesce(nb, '{}'::text[])));
end $function$;
