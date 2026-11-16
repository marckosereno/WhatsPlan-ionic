-- Solo lectura: 20 lugares al azar con ID de Google, para la prueba de cruce con DENUE.
-- En Supabase → SQL Editor, correr y descargar el resultado como CSV (botón "Download CSV").
select place_id, place_name, lat, lng, formatted_address
from public.places
where place_id like 'ChIJ%'
order by random()
limit 20;
