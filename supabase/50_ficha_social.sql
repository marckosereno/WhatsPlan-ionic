-- 50_ficha_social.sql
-- Ficha al estilo "quién ha estado aquí": datos sociales de un lugar a partir de las visitas ("Estuve aquí")
-- + columna para guardar la descripción corta que escribe la IA con los datos públicos de DENUE.
-- Se puede volver a correr. No borra nada.

-- 1) Descripción generada con IA solo a partir de datos de DENUE (giro, subcategoría, dirección). Sin contenido de Google.
alter table public.custom_places add column if not exists descripcion_ia text;

-- 2) Lo social de un lugar: visitas, personas, tus amigos que fueron y los que más han ido.
--    Respeta "mostrar mis visitas" (show_visits) y los bloqueos: quien no muestra sus visitas cuenta en los totales
--    pero no aparece con nombre. Funciona con cualquier place_id (DENUE o no).
create or replace function public.place_social(p_place_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  me  uuid := auth.uid();
  res jsonb;
begin
  with v as (
    select pv.user_id, count(*)::int as n, max(pv.visit_day) as ultima
      from public.place_visits pv
     where pv.place_id = p_place_id
     group by pv.user_id
  ), vv as (
    select v.user_id, v.n, v.ultima,
           coalesce(nullif(p.name, ''), case when p.username is not null then '@' || p.username end, 'Alguien') as nombre,
           p.avatar_url,
           coalesce(p.show_visits, true) as vis,
           (me is not null and exists (select 1 from public.follows f where f.follower_id = me and f.following_id = v.user_id)) as sigo
      from v
      left join public.profiles p on p.id = v.user_id
     where me is null or not public.wp_blocked_between(me, v.user_id)
  )
  select jsonb_build_object(
    'visitas',  coalesce((select sum(n) from vv), 0),
    'personas', (select count(*) from vv),
    'ultima',   (select max(ultima) from vv),
    'mias',     coalesce((select n from vv where user_id = me), 0),
    'amigos',   coalesce((select jsonb_agg(jsonb_build_object('id', user_id, 'nombre', nombre, 'avatar', avatar_url, 'visitas', n) order by n desc)
                            from (select * from vv where vis and sigo and user_id is distinct from me order by n desc limit 8) a), '[]'::jsonb),
    'top',      coalesce((select jsonb_agg(jsonb_build_object('id', user_id, 'nombre', nombre, 'avatar', avatar_url, 'visitas', n, 'yo', user_id is not distinct from me) order by n desc, ultima desc)
                            from (select * from vv where vis or user_id is not distinct from me order by n desc, ultima desc limit 5) t), '[]'::jsonb)
  ) into res;
  return res;
end;
$function$;

grant execute on function public.place_social(text) to anon, authenticated;

-- Prueba rápida (debe devolver un json con visitas, personas, amigos y top; con un lugar sin visitas, ceros y listas vacías):
select public.place_social((select place_id from public.custom_places where coalesce(visible, true) limit 1));
