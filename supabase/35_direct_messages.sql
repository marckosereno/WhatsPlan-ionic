-- ════════════════════════════════════════════════════════════════════
-- 35 · Mensajes directos entre personas (Social)
-- Se puede correr varias veces.
--
-- Reglas:
--  · Para escribirle a alguien tienes que seguirle, y esa persona tiene
--    que tener "Recibir mensajes" prendido (profiles.allow_dms).
--  · Si se siguen los dos (mutuos) → el chat abre directo.
--  · Si solo tú le sigues → le llega como SOLICITUD: tú puedes escribir,
--    la otra persona ve el mensaje en "Solicitudes" y decide Aceptar o
--    Rechazar. Mientras no acepte, no puede contestar. Si rechaza, ya no
--    le llegan tus mensajes (y tú no te enteras).
--  · Los chats que ya existen siguen aunque después se apague "Recibir
--    mensajes"; el interruptor solo frena los nuevos.
--  · La primera vez que llega una solicitud se avisa en la campanita.
--
-- Tablas: dm_threads (la pareja, a < b), dm_messages, dm_reads.
-- Funciones: dm_open, dm_respond, my_dm_chats, dm_mark_read,
--   dm_set_muted, dm_react. Fotos: mismo bucket "plan-chat", ruta
--   dm/<chat>/archivo.jpg.
-- ════════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists allow_dms boolean not null default true;

create table if not exists public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  a uuid not null,
  b uuid not null,
  status text not null default 'active' check (status in ('active', 'request', 'declined')),
  requested_by uuid,
  created_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  constraint dm_threads_pair check (a < b),
  constraint dm_threads_unique unique (a, b)
);

create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  user_id uuid not null,
  kind text not null default 'text' check (kind in ('text', 'quick')),
  body text not null default '',
  reply_to uuid references public.dm_messages(id) on delete set null,
  image_path text,
  reactions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint dm_messages_body_or_image check (char_length(body) <= 1000 and (char_length(body) >= 1 or image_path is not null))
);
create index if not exists dm_messages_thread_time on public.dm_messages (thread_id, created_at desc);

create table if not exists public.dm_reads (
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  user_id uuid not null,
  last_read_at timestamptz not null default now(),
  muted boolean not null default false,
  primary key (thread_id, user_id)
);

-- ¿Estás en ese chat?
create or replace function public.wp_dm_member(p_thread uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.dm_threads t where t.id = p_thread and auth.uid() in (t.a, t.b));
$$;

-- ¿Puedes escribir? Activo, o solicitud que tú mandaste
create or replace function public.wp_dm_can_write(p_thread uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.dm_threads t where t.id = p_thread and auth.uid() in (t.a, t.b)
    and (t.status = 'active' or (t.status = 'request' and t.requested_by = auth.uid())));
$$;

alter table public.dm_threads enable row level security;
alter table public.dm_messages enable row level security;
alter table public.dm_reads enable row level security;

drop policy if exists dm_threads_read on public.dm_threads;
create policy dm_threads_read on public.dm_threads for select to authenticated
  using (auth.uid() in (a, b));

drop policy if exists dm_messages_read on public.dm_messages;
create policy dm_messages_read on public.dm_messages for select to authenticated
  using (public.wp_dm_member(thread_id));

drop policy if exists dm_messages_write on public.dm_messages;
create policy dm_messages_write on public.dm_messages for insert to authenticated
  with check (user_id = auth.uid() and kind in ('text', 'quick') and reactions = '{}'::jsonb
    and public.wp_dm_can_write(thread_id)
    and (image_path is null or image_path like 'dm/' || thread_id::text || '/%'));

drop policy if exists dm_reads_own on public.dm_reads;
create policy dm_reads_own on public.dm_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.dm_threads to authenticated;
grant select, insert on public.dm_messages to authenticated;
grant select, insert, update on public.dm_reads to authenticated;

-- Abrir (o crear) el chat con alguien → { id, status }
create or replace function public.dm_open(p_other uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); lo uuid; hi uuid; t public.dm_threads; mutual boolean;
begin
  if me is null then raise exception 'Inicia sesión'; end if;
  if p_other is null or p_other = me then raise exception 'No puedes escribirte a ti'; end if;
  lo := least(me, p_other); hi := greatest(me, p_other);
  select * into t from public.dm_threads where a = lo and b = hi;
  if found then
    -- La otra persona te había rechazado: ya no le llegan tus mensajes
    if t.status = 'declined' and t.requested_by = me then raise exception 'No recibe tus mensajes'; end if;
    -- Tú la habías rechazado y ahora le escribes tú: el chat se abre
    if t.status = 'declined' then
      update public.dm_threads set status = 'active' where id = t.id returning * into t;
    end if;
    return jsonb_build_object('id', t.id, 'status', t.status, 'requested_by', t.requested_by);
  end if;
  if not exists (select 1 from public.follows f where f.follower_id = me and f.following_id = p_other) then
    raise exception 'Sigue a esta persona para escribirle';
  end if;
  if not coalesce((select p.allow_dms from public.profiles p where p.id = p_other), true) then
    raise exception 'No recibe mensajes';
  end if;
  mutual := exists (select 1 from public.follows f where f.follower_id = p_other and f.following_id = me);
  insert into public.dm_threads (a, b, status, requested_by)
  values (lo, hi, case when mutual then 'active' else 'request' end, case when mutual then null else me end)
  returning * into t;
  return jsonb_build_object('id', t.id, 'status', t.status, 'requested_by', t.requested_by);
end; $$;
grant execute on function public.dm_open(uuid) to authenticated;

-- Aceptar / rechazar una solicitud (solo quien la recibe)
create or replace function public.dm_respond(p_thread uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare t public.dm_threads;
begin
  select * into t from public.dm_threads where id = p_thread for update;
  if not found or auth.uid() not in (t.a, t.b) then raise exception 'No encontrado'; end if;
  if t.status <> 'request' or t.requested_by = auth.uid() then return t.status; end if;
  update public.dm_threads set status = case when p_accept then 'active' else 'declined' end
    where id = p_thread returning status into t.status;
  return t.status;
end; $$;
grant execute on function public.dm_respond(uuid, boolean) to authenticated;

-- Tus chats directos (con la otra persona ya resuelta). Las solicitudes
-- que rechazaste no salen; las que te mandan salen solo si ya traen
-- mensaje.
drop function if exists public.my_dm_chats();
create or replace function public.my_dm_chats()
returns table (thread_id uuid, other_id uuid, other_name text, other_username text, other_avatar text,
  status text, requested_by uuid, last_body text, last_kind text, last_user uuid, last_at timestamptz,
  last_image boolean, unread int, muted boolean)
language sql stable security definer set search_path = public as $$
  select t.id, o.id, o.name, o.username, o.avatar_url, t.status, t.requested_by,
    m.body, m.kind, m.user_id, coalesce(m.created_at, t.created_at), m.image_path is not null,
    (select count(*)::int from public.dm_messages x
      where x.thread_id = t.id and x.user_id <> auth.uid() and x.created_at > coalesce(r.last_read_at, '-infinity')),
    coalesce(r.muted, false)
  from public.dm_threads t
  join lateral (select p.id, p.name, p.username, p.avatar_url from public.profiles p
    where p.id = case when t.a = auth.uid() then t.b else t.a end) o on true
  left join public.dm_reads r on r.thread_id = t.id and r.user_id = auth.uid()
  left join lateral (select * from public.dm_messages x where x.thread_id = t.id order by x.created_at desc limit 1) m on true
  where auth.uid() in (t.a, t.b)
    and not (t.status = 'declined' and coalesce(t.requested_by, auth.uid()) <> auth.uid())
    and (m.id is not null or t.requested_by = auth.uid() or t.status = 'active')
  order by coalesce(m.created_at, t.created_at) desc
  limit 100;
$$;
grant execute on function public.my_dm_chats() to authenticated;

create or replace function public.dm_mark_read(p_thread uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.dm_reads (thread_id, user_id, last_read_at)
  select p_thread, auth.uid(), now() where public.wp_dm_member(p_thread)
  on conflict (thread_id, user_id) do update set last_read_at = excluded.last_read_at;
$$;
grant execute on function public.dm_mark_read(uuid) to authenticated;

create or replace function public.dm_set_muted(p_thread uuid, p_muted boolean)
returns void language sql security definer set search_path = public as $$
  insert into public.dm_reads (thread_id, user_id, last_read_at, muted)
  select p_thread, auth.uid(), now(), p_muted where public.wp_dm_member(p_thread)
  on conflict (thread_id, user_id) do update set muted = excluded.muted;
$$;
grant execute on function public.dm_set_muted(uuid, boolean) to authenticated;

create or replace function public.dm_react(p_message uuid, p_emoji text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.dm_messages; me text := auth.uid()::text;
begin
  select * into m from public.dm_messages where id = p_message for update;
  if not found or not public.wp_dm_member(m.thread_id) then raise exception 'No puedes reaccionar aquí'; end if;
  if p_emoji is null or p_emoji = '' or m.reactions ->> me = p_emoji then
    update public.dm_messages set reactions = reactions - me where id = p_message returning reactions into m.reactions;
  else
    update public.dm_messages set reactions = reactions || jsonb_build_object(me, left(p_emoji, 8)) where id = p_message returning reactions into m.reactions;
  end if;
  return m.reactions;
end; $$;
grant execute on function public.dm_react(uuid, text) to authenticated;

-- Al llegar un mensaje: se mueve el chat arriba y, si es el primero de
-- una solicitud, se avisa en la campanita
create or replace function public.wp_dm_after_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare t public.dm_threads; other uuid;
begin
  update public.dm_threads set last_at = new.created_at where id = new.thread_id returning * into t;
  begin
    if t.status = 'request' and t.requested_by = new.user_id
       and not exists (select 1 from public.dm_messages x where x.thread_id = t.id and x.id <> new.id) then
      other := case when t.a = new.user_id then t.b else t.a end;
      insert into public.notifications (user_id, type, title, body)
      values (other, 'dm_request', public.wp_plan_name(new.user_id) || ' quiere enviarte un mensaje',
        case when new.image_path is not null and char_length(new.body) = 0 then 'Te mandó una foto' else left(new.body, 120) end);
    end if;
  exception when others then raise warning '[dm_after_message] %', sqlerrm; end;
  return new;
end; $$;
drop trigger if exists wp_dm_after_message on public.dm_messages;
create trigger wp_dm_after_message after insert on public.dm_messages
  for each row execute function public.wp_dm_after_message();

-- Fotos: el mismo bucket del chat de planes; las de mensajes directos
-- van en dm/<chat>/...
create or replace function public.wp_plan_member_path(p_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if split_part(p_name, '/', 1) = 'dm' then
    return public.wp_dm_member(split_part(p_name, '/', 2)::uuid);
  end if;
  return public.wp_plan_member(split_part(p_name, '/', 1)::uuid);
exception when others then return false;
end; $$;

-- Tiempo real de los mensajes directos
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dm_messages') then
    execute 'alter publication supabase_realtime add table public.dm_messages';
  end if;
end $$;
