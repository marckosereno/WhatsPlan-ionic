-- 47_ocultar_google.sql
-- Oculta del mapa los lugares de Google (tabla places) para que no se dupliquen con los de DENUE.
-- No borra nada: places y places_respaldo_google conservan todas sus filas. Se puede volver a correr.
-- Requiere haber corrido antes 46_custom_places_denue.sql (el respaldo guarda el valor original de "hidden").

update public.places set hidden = true where coalesce(hidden, false) = false;

select count(*) filter (where hidden) as ocultos, count(*) filter (where not coalesce(hidden, false)) as visibles
from public.places;

-- PARA DESHACER (volver a como estaba antes, según el respaldo). Descomenta y corre solo esto:
-- update public.places p set hidden = r.hidden
--   from public.places_respaldo_google r where r.place_id = p.place_id;
