-- 49 · Liga cada lugar de DENUE con su place_id de Google (solo el ID, que sí se puede guardar).
-- Sirve para el botón "Fotos y reseñas de Google": la tarjeta oficial de Google se abre con ese ID.
-- No copia nada de Google: solo empareja por cercanía y parecido de nombre contra tu respaldo
-- (places_respaldo_google). Se puede deshacer con la última línea.

create extension if not exists pg_trgm;
alter table public.custom_places add column if not exists google_place_id text;

with norm as (
  select place_id,
         lat::double precision as lat, lng::double precision as lng,
         lower(translate(coalesce(place_name,''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')) as nom
    from public.places_respaldo_google
   where lat is not null and lng is not null and place_id like 'ChIJ%'
), den as (
  select id, lat, lng,
         lower(translate(coalesce(name,''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')) as nom
    from public.custom_places
   where source = 'denue' and google_place_id is null
), par as (
  select d.id, n.place_id,
         sqrt( power((d.lat - n.lat) * 111320, 2)
             + power((d.lng - n.lng) * 111320 * cos(radians(d.lat)), 2) ) as metros,
         similarity(d.nom, n.nom) as parecido
    from den d join norm n
      on abs(d.lat - n.lat) < 0.002 and abs(d.lng - n.lng) < 0.002
), buenos as (
  select distinct on (id) id, place_id, metros, parecido
    from par
   where (metros <= 150 and parecido >= 0.45) or (metros <= 40 and parecido >= 0.25)
   order by id, parecido desc, metros
)
update public.custom_places c
   set google_place_id = b.place_id
  from buenos b
 where c.id = b.id;

-- Resultado: cuántos quedaron ligados y una muestra para revisar a ojo
select count(*) filter (where google_place_id is not null) as ligados,
       count(*) as total_denue
  from public.custom_places where source = 'denue';

select c.name as denue, r.place_name as google
  from public.custom_places c
  join public.places_respaldo_google r on r.place_id = c.google_place_id
 order by random() limit 15;

-- Deshacer (quitar todas las ligas):
--   update public.custom_places set google_place_id = null;
