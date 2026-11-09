-- ════════════════════════════════════════════════════════════════════
-- 37 · Acciones del chat: borrar, editar, fijar mensajes y ordenar chats
-- Se puede correr varias veces. Necesita 32, 33 y 35.
--
-- Mensajes (de plan y directos):
--  · Borrar para mí: el mensaje se oculta solo para ti (hidden_for).
--  · Borrar para todos: solo tus mensajes y durante 1 hora; queda la
--    línea "Se eliminó este mensaje" (deleted_at, sin texto ni foto).
--  · Editar: tus mensajes, durante 15 minutos (edited_at → "editado").
--  · Fijar: un mensaje fijado por chat de PLAN; cualquiera de los que
--    van lo pone, cambia o quita (plan_chat_pins).
-- Chats (cada quien los suyos, en plan_reads / dm_reads):
--  · Fijar arriba (pinned_at, máx. 3), ocultar (hidden_at: vuelve a
--    salir si llega un mensaje nuevo), marcar como no leído
--    (unread_mark) y, solo en directos, borrar chat para mí
--    (cleared_at: se esconde lo anterior y el chat).
-- my_plan_chats / my_dm_chats ahora devuelven esos datos.
-- ════════════════════════════════════════════════════════════════════

-- ── Columnas ────────────────────────────────────────────────────────
alter table public.plan_messages add column if not exists deleted_at timestamptz;
alter table public.plan_messages add column if not exists edited_at timestamptz;
alter table public.plan_messages add column if not exists hidden_for uuid[] not null default '{}';
alter table public.dm_messages add column if not exists deleted_at timestamptz;
alter table public.dm_messages add column if not exists edited_at timestamptz;
alter table public.dm_messages add column if not exists hidden_for uuid[] not null default '{}';

alter table public.plan_reads add column if not exists pinned_at timestamptz;
alter table public.plan_reads add column if not exists hidden_at timestamptz;
alter table public.plan_reads add column if not exists unread_mark boolean not null default false;
alter table public.dm_reads add column if not exists pinned_at timestamptz;
alter table public.dm_reads add column if not exists hidden_at timestamptz;
alter table public.dm_reads add column if not exists unread_mark boolean not null default false;
alter table public.dm_reads add column if not exists cleared_at timestamptz;

-- Un mensaje borrado para todos queda sin texto ni foto
alter table public.plan_messages drop constraint if exists plan_messages_body_or_image;
alter table public.plan_messages add constraint plan_messages_body_or_image
  check (char_length(body) <= 1000 and (char_length(body) >= 1 or image_path is not null or deleted_at is not null));
alter table public.dm_messages drop constraint if exists dm_messages_body_or_image;
alter table public.dm_messages add constraint dm_messages_body_or_image
  check (char_length(body) <= 1000 and (char_length(body) >= 1 or image_path is not null or deleted_at is not null));

-- Mensaje fijado de cada chat de plan
create table if not exists public.plan_chat_pins (
  activity_id uuid primary key references public.activities(id) on delete cascade,
  message_id uuid not null references public.plan_messages(id) on delete cascade,
  pinned_by uuid,
  pinned_at timestamptz not null default now()
);
alter table public.plan_chat_pins enable row level security;
drop policy if exists plan_chat_pins_read on public.plan_chat_pins;
create policy plan_chat_pins_read on public.plan_chat_pins for select to authenticated
  using (public.wp_plan_member(activity_id));
grant select on public.plan_chat_pins to authenticated;

-- ── Mensajes ────────────────────────────────────────────────────────
-- p_dm: true si es un mensaje directo
create or replace function public.chat_msg_delete(p_message uuid, p_everyone boolean, p_dm boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); owner uuid; made timestamptz; chat uuid;
begin
  if me is null then raise exception 'Inicia sesión'; end if;
  if p_dm then
    select user_id, created_at, thread_id into owner, made, chat from public.dm_messages where id = p_message;
    if not found or not public.wp_dm_member(chat) then raise exception 'No encontrado'; end if;
  else
    select user_id, created_at, activity_id into owner, made, chat from public.plan_messages where id = p_message;
    if not found or not public.wp_plan_member(chat) then raise exception 'No encontrado'; end if;
  end if;
  if p_everyone then
    if owner is distinct from me then raise exception 'Solo puedes borrar tus mensajes para todos'; end if;
    if made < now() - interval '1 hour' then raise exception 'Ya pasó más de 1 hora'; end if;
    if p_dm then
      update public.dm_messages set deleted_at = now(), body = '', image_path = null, reactions = '{}'::jsonb where id = p_message;
    else
      update public.plan_messages set deleted_at = now(), body = '', image_path = null, reactions = '{}'::jsonb where id = p_message;
      delete from public.plan_chat_pins where message_id = p_message;
    end if;
  else
    if p_dm then
      update public.dm_messages set hidden_for = array_append(hidden_for, me) where id = p_message and not (me = any(hidden_for));
    else
      update public.plan_messages set hidden_for = array_append(hidden_for, me) where id = p_message and not (me = any(hidden_for));
    end if;
  end if;
end; $$;
grant execute on function public.chat_msg_delete(uuid, boolean, boolean) to authenticated;

create or replace function public.chat_msg_edit(p_message uuid, p_body text, p_dm boolean default false)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); owner uuid; made timestamptz; gone timestamptz; b text := trim(coalesce(p_body, ''));
begin
  if char_length(b) < 1 or char_length(b) > 1000 then raise exception 'Escribe algo'; end if;
  if p_dm then
    select user_id, created_at, deleted_at into owner, made, gone from public.dm_messages where id = p_message;
  else
    select user_id, created_at, deleted_at into owner, made, gone from public.plan_messages where id = p_message;
  end if;
  if not found or owner is distinct from me or gone is not null then raise exception 'No puedes editar este mensaje'; end if;
  if made < now() - interval '15 minutes' then raise exception 'Ya pasaron 15 minutos'; end if;
  if p_dm then
    update public.dm_messages set body = b, edited_at = now() where id = p_message;
  else
    update public.plan_messages set body = b, edited_at = now() where id = p_message;
  end if;
  return now();
end; $$;
grant execute on function public.chat_msg_edit(uuid, text, boolean) to authenticated;

-- Fijar / quitar (p_message null = quitar)
create or replace function public.plan_chat_pin(p_activity uuid, p_message uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.wp_plan_member(p_activity) then raise exception 'No estás en este plan'; end if;
  if p_message is null then delete from public.plan_chat_pins where activity_id = p_activity; return; end if;
  if not exists (select 1 from public.plan_messages m where m.id = p_message and m.activity_id = p_activity and m.deleted_at is null and m.kind <> 'system') then
    raise exception 'Ese mensaje no se puede fijar';
  end if;
  insert into public.plan_chat_pins (activity_id, message_id, pinned_by, pinned_at)
  values (p_activity, p_message, auth.uid(), now())
  on conflict (activity_id) do update set message_id = excluded.message_id, pinned_by = excluded.pinned_by, pinned_at = excluded.pinned_at;
end; $$;
grant execute on function public.plan_chat_pin(uuid, uuid) to authenticated;

-- ── Chats (preferencias de cada quien) ─────────────────────────────
-- p_chat: id del plan, o "dm:<uuid>" para un directo.
-- Cada parámetro null = no cambiar. p_clear solo en directos.
create or replace function public.chat_pref(p_chat text, p_pin boolean default null, p_hide boolean default null,
  p_unread boolean default null, p_clear boolean default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); dm boolean := p_chat like 'dm:%'; id uuid; n int;
begin
  if me is null then raise exception 'Inicia sesión'; end if;
  id := (case when dm then substr(p_chat, 4) else p_chat end)::uuid;
  if dm then
    if not public.wp_dm_member(id) then raise exception 'No encontrado'; end if;
    if p_pin then
      select count(*) into n from public.dm_reads where user_id = me and pinned_at is not null and thread_id <> id;
      select n + count(*) into n from public.plan_reads where user_id = me and pinned_at is not null;
      if n >= 3 then raise exception 'Solo puedes fijar 3 chats'; end if;
    end if;
    insert into public.dm_reads (thread_id, user_id, last_read_at) values (id, me, now()) on conflict do nothing;
    update public.dm_reads set
      pinned_at = case when p_pin is null then pinned_at when p_pin then coalesce(pinned_at, now()) else null end,
      hidden_at = case when p_clear then now() when p_hide is null then hidden_at when p_hide then now() else null end,
      unread_mark = coalesce(p_unread, unread_mark),
      cleared_at = case when p_clear then now() else cleared_at end,
      last_read_at = case when p_clear then now() else last_read_at end
    where thread_id = id and user_id = me;
  else
    if not public.wp_plan_member(id) then raise exception 'No estás en este plan'; end if;
    if p_pin then
      select count(*) into n from public.plan_reads where user_id = me and pinned_at is not null and activity_id <> id;
      select n + count(*) into n from public.dm_reads where user_id = me and pinned_at is not null;
      if n >= 3 then raise exception 'Solo puedes fijar 3 chats'; end if;
    end if;
    insert into public.plan_reads (activity_id, user_id, last_read_at) values (id, me, now()) on conflict do nothing;
    update public.plan_reads set
      pinned_at = case when p_pin is null then pinned_at when p_pin then coalesce(pinned_at, now()) else null end,
      hidden_at = case when p_hide is null then hidden_at when p_hide then now() else null end,
      unread_mark = coalesce(p_unread, unread_mark)
    where activity_id = id and user_id = me;
  end if;
end; $$;
grant execute on function public.chat_pref(text, boolean, boolean, boolean, boolean) to authenticated;

-- Leer = quita la marca de "no leído"
create or replace function public.mark_plan_read(p_activity uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.plan_reads (activity_id, user_id, last_read_at)
  select p_activity, auth.uid(), now() where public.wp_plan_member(p_activity)
  on conflict (activity_id, user_id) do update set last_read_at = excluded.last_read_at, unread_mark = false;
$$;
create or replace function public.dm_mark_read(p_thread uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.dm_reads (thread_id, user_id, last_read_at)
  select p_thread, auth.uid(), now() where public.wp_dm_member(p_thread)
  on conflict (thread_id, user_id) do update set last_read_at = excluded.last_read_at, unread_mark = false;
$$;

-- ── Listas de chats con lo nuevo ────────────────────────────────────
-- (el último mensaje ignora los borrados-para-mí; los ocultos/borrados
--  solo vuelven si llegó algo después)
drop function if exists public.my_plan_chats();
create or replace function public.my_plan_chats()
returns table (activity_id uuid, title text, type text, place_id text, place_name text, scheduled_at timestamptz, ends_at timestamptz,
  stops jsonb, participants uuid[], creator_id uuid, status text, last_body text, last_kind text, last_user uuid, last_at timestamptz,
  last_image boolean, unread int, muted boolean, pinned_at timestamptz, unread_mark boolean, last_deleted boolean)
language sql stable security definer set search_path = public as $$
  select a.id, a.title, a.type, a.place_id, a.place_name, a.scheduled_at, a.ends_at, a.stops, a.participants, a.creator_id, a.status,
    m.body, m.kind, m.user_id, m.created_at, m.image_path is not null,
    (select count(*)::int from public.plan_messages x
      where x.activity_id = a.id and coalesce(x.user_id, '00000000-0000-0000-0000-000000000000') <> auth.uid()
        and not (auth.uid() = any(x.hidden_for))
        and x.created_at > coalesce(r.last_read_at, '-infinity')),
    coalesce(r.muted, false), r.pinned_at, coalesce(r.unread_mark, false), m.deleted_at is not null
  from public.activities a
  left join public.plan_reads r on r.activity_id = a.id and r.user_id = auth.uid()
  left join lateral (select * from public.plan_messages x where x.activity_id = a.id and not (auth.uid() = any(x.hidden_for))
    order by x.created_at desc limit 1) m on true
  where (a.creator_id = auth.uid() or auth.uid() = any(a.participants))
    and a.scheduled_at > now() - interval '30 days'
    and (r.hidden_at is null or coalesce(m.created_at, '-infinity') > r.hidden_at)
  order by coalesce(m.created_at, a.created_at) desc
  limit 100;
$$;
grant execute on function public.my_plan_chats() to authenticated;

drop function if exists public.my_dm_chats();
create or replace function public.my_dm_chats()
returns table (thread_id uuid, other_id uuid, other_name text, other_username text, other_avatar text,
  status text, requested_by uuid, last_body text, last_kind text, last_user uuid, last_at timestamptz,
  last_image boolean, unread int, muted boolean, pinned_at timestamptz, unread_mark boolean, last_deleted boolean, cleared_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, o.id, o.name, o.username, o.avatar_url, t.status, t.requested_by,
    m.body, m.kind, m.user_id, coalesce(m.created_at, t.created_at), m.image_path is not null,
    (select count(*)::int from public.dm_messages x
      where x.thread_id = t.id and x.user_id <> auth.uid() and not (auth.uid() = any(x.hidden_for))
        and x.created_at > coalesce(r.last_read_at, '-infinity')),
    coalesce(r.muted, false), r.pinned_at, coalesce(r.unread_mark, false), m.deleted_at is not null, r.cleared_at
  from public.dm_threads t
  join lateral (select p.id, p.name, p.username, p.avatar_url from public.profiles p
    where p.id = case when t.a = auth.uid() then t.b else t.a end) o on true
  left join public.dm_reads r on r.thread_id = t.id and r.user_id = auth.uid()
  left join lateral (select * from public.dm_messages x where x.thread_id = t.id and not (auth.uid() = any(x.hidden_for))
    and x.created_at > coalesce(r.cleared_at, '-infinity') order by x.created_at desc limit 1) m on true
  where auth.uid() in (t.a, t.b)
    and not (t.status = 'declined' and coalesce(t.requested_by, auth.uid()) <> auth.uid())
    and (m.id is not null or (r.cleared_at is null and (t.requested_by = auth.uid() or t.status = 'active')))
    and (r.hidden_at is null or coalesce(m.created_at, '-infinity') > r.hidden_at)
  order by coalesce(m.created_at, t.created_at) desc
  limit 100;
$$;
grant execute on function public.my_dm_chats() to authenticated;

-- Tiempo real del mensaje fijado
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plan_chat_pins') then
    execute 'alter publication supabase_realtime add table public.plan_chat_pins';
  end if;
end $$;
