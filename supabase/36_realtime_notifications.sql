-- ════════════════════════════════════════════════════════════════════
-- 36 · Notificaciones en tiempo real
-- Se puede correr varias veces.
-- La campanita escucha los avisos nuevos con Supabase Realtime, pero la
-- tabla `notifications` nunca se agregó a la publicación de tiempo real,
-- así que los avisos solo aparecían al abrir la campanita. Aquí:
--  · notifications entra a supabase_realtime (como plan_messages y
--    dm_messages, que ya estaban).
--  · Cada quien puede leer SUS avisos (Realtime solo entrega filas que
--    la persona puede ver). Si la tabla no tiene RLS, esto no cambia
--    nada; si la tiene, asegura el permiso de lectura propio.
-- Revisa al final: la consulta debe devolver las 3 tablas.
-- ════════════════════════════════════════════════════════════════════

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end $$;

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications for select to authenticated
  using (user_id = auth.uid());
grant select on public.notifications to authenticated;

-- Comprobación: deben salir notifications, plan_messages y dm_messages
select tablename from pg_publication_tables
 where pubname = 'supabase_realtime' and schemaname = 'public'
   and tablename in ('notifications', 'plan_messages', 'dm_messages')
 order by tablename;
