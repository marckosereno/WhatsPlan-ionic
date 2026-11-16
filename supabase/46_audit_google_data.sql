-- Auditoría (solo lectura): cuánto de la tabla places viene de Google Places.
-- No modifica nada. Correr en Supabase → SQL Editor.
select
  count(*)                                                                       as lugares_total,
  count(*) filter (where place_id like 'ChIJ%')                                  as con_id_de_google,
  count(*) filter (where place_id like 'custom\_%')                              as propios_custom,
  count(*) filter (where reviews is not null)                                    as con_resenas_google,
  count(*) filter (where editorial_summary is not null)                          as con_resumen_google,
  count(*) filter (where rating is not null)                                     as con_calificacion,
  count(*) filter (where formatted_phone_number is not null)                     as con_telefono,
  count(*) filter (where opening_hours is not null)                              as con_horarios,
  count(*) filter (where website is not null)                                    as con_sitio_web,
  count(*) filter (where photo_url like '%googleapis.com%'
                      or photos_urls::text like '%googleapis.com%')              as fotos_apuntan_a_google,
  count(*) filter (where photo_url like '%key=%'
                      or photos_urls::text like '%key=%')                        as fotos_con_llave_en_url,
  count(*) filter (where photo_url like '%supabase.co%'
                      or photos_urls::text like '%supabase.co%')                 as fotos_en_nuestro_storage
from public.places;
