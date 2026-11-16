-- Solo lectura: los lugares cuya URL de foto trae la llave de Google (key=...).
-- Se muestra la URL sin la llave para no volver a copiarla.
select place_id, place_name,
       regexp_replace(coalesce(photo_url, ''), 'key=[^&]+', 'key=***') as photo_url,
       (photos_urls::text like '%supabase.co%') as tiene_copia_en_storage
from public.places
where photo_url like '%key=%' or photos_urls::text like '%key=%'
order by place_name;
