-- ════════════════════════════════════════════════════════════════════
-- 34 · Notificaciones: borrar, marcar leída/no leída y limpieza sola
-- Se puede correr varias veces.
--  · notif_delete(ids, solo_leidas): borra avisos TUYOS — los ids que
--    pases, o todos (o solo los leídos) si no pasas ids.
--  · notif_set_read(id, leida): marca un aviso tuyo como leído / no leído.
--  · Limpieza: al llegar un aviso nuevo se borran los de esa persona con
--    más de 30 días (así la lista nunca crece de más).
-- Los id van como texto: sirve igual si la tabla usa número o uuid.
-- Funciones "security definer" que solo tocan filas de auth.uid(): no
-- dependen de cómo estén las políticas de la tabla.
-- ════════════════════════════════════════════════════════════════════

alter table public.notifications add column if not exists read boolean default false;

-- (versiones anteriores de este archivo, con id numérico)
drop function if exists public.notif_delete(bigint[], boolean);
drop function if exists public.notif_set_read(bigint, boolean);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create or replace function public.notif_delete(p_ids text[] default null, p_only_read boolean default false)
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  delete from public.notifications
   where user_id = auth.uid()
     and (p_ids is null or id::text = any(p_ids))
     and (not p_only_read or coalesce(read, false));
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.notif_set_read(p_id text, p_read boolean default true)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  update public.notifications set read = p_read where id::text = p_id and user_id = auth.uid();
end $$;

grant execute on function public.notif_delete(text[], boolean) to authenticated;
grant execute on function public.notif_set_read(text, boolean) to authenticated;

-- Limpieza: avisos de más de 30 días de la misma persona
create or replace function public.wp_notif_cleanup()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.notifications
   where user_id = new.user_id and created_at < now() - interval '30 days';
  return null;
end $$;

drop trigger if exists wp_notif_cleanup on public.notifications;
create trigger wp_notif_cleanup after insert on public.notifications
  for each row execute function public.wp_notif_cleanup();

-- Limpieza de una vez de lo que ya había
delete from public.notifications where created_at < now() - interval '30 days';
