-- 46_custom_places_denue.sql
-- Prepara la carga de negocios de DENUE (INEGI) en custom_places y respalda la tabla places (datos de Google).
-- Se puede volver a correr. No borra ni cambia filas de places.

-- 1) Subcategoría por lugar (la app ya lee row.subcategory_tags en _transformCustomPlace).
alter table public.custom_places add column if not exists subcategory_tags text;

-- 2) Respaldo de places tal como está hoy (solo se crea la primera vez).
create table if not exists public.places_respaldo_google as table public.places;

-- Sin políticas y con RLS encendido: la llave pública (anon) no puede leer el respaldo.
alter table public.places_respaldo_google enable row level security;

-- 3) Comprobación rápida (debe dar el mismo número en las dos columnas la primera vez).
select (select count(*) from public.places)                  as filas_places,
       (select count(*) from public.places_respaldo_google)  as filas_respaldo,
       (select count(*) from public.custom_places)           as filas_custom;
