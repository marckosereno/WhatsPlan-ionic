-- ════════════════════════════════════════════════════════════════════
-- 38 · Bloqueos en mensajes, seguir y avisos de la campanita
-- Se puede correr varias veces. Requiere 34, 35 y 37.
--
-- Mensajes directos
--  · Bloquear a alguien: se dejan de seguir los dos, el chat se cierra
--    para esa persona (ya no puede escribirte) y desaparece de tu lista.
--    Mientras haya bloqueo nadie puede abrir chat ni seguir al otro.
--  · Desbloquear: el chat queda neutro; para volver a hablar alguien
--    tiene que escribir otra vez (como solicitud si no se siguen los dos).
--  · Dejar de seguir: si el chat era directo y ya no se siguen los dos,
--    pasa a solicitud de quien sigue al otro (o queda neutro). Si se
--    vuelven a seguir los dos, regresa a directo.
--  · Una solicitud nueva sobre un chat viejo también avisa en la campanita.
--  · dm_open ahora devuelve cleared_at: si borraste el chat, al volver a
--    escribir desde su perfil no aparecen los mensajes de antes.
--
-- Seguir
--  · El aviso "empezó a seguirte" lo pone la base (antes lo mandaba la
--    app y podía no llegar). Guarda quién fue (data.actor_id) para poder
--    "Seguir también" desde la campanita. Si alguien sigue/deja de seguir
--    varias veces, solo avisa una vez al día.
--
-- Campanita
--  · my_notifications(): los avisos + cómo va el plan (ya pasó, vas, lo
--    rechazaste, lleno…) y la cara de quien te siguió y si ya lo sigues.
--  · notif_prune(): al abrir la campanita se limpian los avisos de planes
--    que terminaron hace más de 3 días o que ya no existen, y los de
--    gente que bloqueaste.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.user_blocks (
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

alter table public.dm_threads add column if not exists requested_at timestamptz;
alter table public.notifications add column if not exists data jsonb;

-- Desde la 36 la tabla está en tiempo real: sin llave primaria Postgres
-- no deja borrar filas ("does not have a replica identity"). Se arregla.
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.notifications'::regclass and contype = 'p') then
    alter table public.notifications replica identity full;
  end if;
end $$;

-- ¿Hay bloqueo entre los dos (en cualquier sentido)?
create or replace function public.wp_blocked_between(p_x uuid, p_y uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_blocks b
    where (b.blocker_id = p_x and b.blocked_id = p_y) or (b.blocker_id = p_y and b.blocked_id = p_x));
$$;

create or replace function public.wp_follows(p_x uuid, p_y uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.follows f where f.follower_id = p_x and f.following_id = p_y);
$$;

-- ¿Puedes escribir? Activo (o solicitud tuya) y sin bloqueo
create or replace function public.wp_dm_can_write(p_thread uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.dm_threads t where t.id = p_thread and auth.uid() in (t.a, t.b)
    and (t.status = 'active' or (t.status = 'request' and t.requested_by = auth.uid()))
    and not public.wp_blocked_between(t.a, t.b));
$$;

-- ── Abrir (o crear) el chat ──────────────────────────────────────────
drop function if exists public.dm_open(uuid);
create or replace function public.dm_open(p_other uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); lo uuid; hi uuid; t public.dm_threads; cleared timestamptz;
begin
  if me is null then raise exception 'Inicia sesión'; end if;
  if p_other is null or p_other = me then raise exception 'No puedes escribirte a ti'; end if;
  if exists (select 1 from public.user_blocks b where b.blocker_id = me and b.blocked_id = p_other) then
    raise exception 'Bloqueaste a esta persona';
  end if;
  if exists (select 1 from public.user_blocks b where b.blocker_id = p_other and b.blocked_id = me) then
    raise exception 'No recibe tus mensajes';
  end if;
  lo := least(me, p_other); hi := greatest(me, p_other);
  select * into t from public.dm_threads where a = lo and b = hi for update;

  if found then
    if t.status = 'declined' and t.requested_by = me then raise exception 'No recibe tus mensajes'; end if;
    if t.status = 'declined' then
      -- Tú la habías rechazado y ahora le escribes tú: el chat se abre
      update public.dm_threads set status = 'active', requested_by = null where id = t.id returning * into t;
    elsif t.status = 'request' and t.requested_by is null then
      -- Chat neutro (después de dejar de seguirse o desbloquear)
      if public.wp_follows(me, p_other) and public.wp_follows(p_other, me) then
        update public.dm_threads set status = 'active' where id = t.id returning * into t;
      elsif public.wp_follows(me, p_other) then
        if not coalesce((select p.allow_dms from public.profiles p where p.id = p_other), true) then
          raise exception 'No recibe mensajes';
        end if;
        update public.dm_threads set requested_by = me, requested_at = now() where id = t.id returning * into t;
      else
        raise exception 'Sigue a esta persona para escribirle';
      end if;
    end if;
  else
    if not public.wp_follows(me, p_other) then raise exception 'Sigue a esta persona para escribirle'; end if;
    if not coalesce((select p.allow_dms from public.profiles p where p.id = p_other), true) then
      raise exception 'No recibe mensajes';
    end if;
    insert into public.dm_threads (a, b, status, requested_by, requested_at)
    values (lo, hi,
      case when public.wp_follows(p_other, me) then 'active' else 'request' end,
      case when public.wp_follows(p_other, me) then null else me end,
      case when public.wp_follows(p_other, me) then null else now() end)
    returning * into t;
  end if;

  select r.cleared_at into cleared from public.dm_reads r where r.thread_id = t.id and r.user_id = me;
  return jsonb_build_object('id', t.id, 'status', t.status, 'requested_by', t.requested_by, 'cleared_at', cleared);
end; $$;
grant execute on function public.dm_open(uuid) to authenticated;

-- ── Primer mensaje de una solicitud → aviso (también en chats viejos) ─
create or replace function public.wp_dm_after_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare t public.dm_threads; other uuid;
begin
  update public.dm_threads set last_at = new.created_at where id = new.thread_id returning * into t;
  begin
    if t.status = 'request' and t.requested_by = new.user_id
       and not exists (select 1 from public.dm_messages x where x.thread_id = t.id and x.id <> new.id
         and x.user_id = new.user_id and x.created_at >= coalesce(t.requested_at, '-infinity')) then
      other := case when t.a = new.user_id then t.b else t.a end;
      insert into public.notifications (user_id, type, title, body, data)
      values (other, 'dm_request', public.wp_plan_name(new.user_id) || ' quiere enviarte un mensaje',
        case when new.image_path is not null and char_length(new.body) = 0 then 'Te mandó una foto' else left(new.body, 120) end,
        jsonb_build_object('actor_id', new.user_id));
    end if;
  exception when others then raise warning '[dm_after_message] %', sqlerrm; end;
  return new;
end; $$;

-- ── Bloquear / desbloquear ───────────────────────────────────────────
create or replace function public.wp_after_block()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    delete from public.follows
     where (follower_id = new.blocker_id and following_id = new.blocked_id)
        or (follower_id = new.blocked_id and following_id = new.blocker_id);
    -- El chat queda cerrado para quien fue bloqueado
    update public.dm_threads set status = 'declined', requested_by = new.blocked_id, requested_at = null
     where a = least(new.blocker_id, new.blocked_id) and b = greatest(new.blocker_id, new.blocked_id);
    -- Sus avisos se van de tu campanita
    delete from public.notifications
     where user_id = new.blocker_id and data->>'actor_id' = new.blocked_id::text;
    return new;
  end if;
  update public.dm_threads set status = 'request', requested_by = null, requested_at = null
   where a = least(old.blocker_id, old.blocked_id) and b = greatest(old.blocker_id, old.blocked_id)
     and not public.wp_blocked_between(old.blocker_id, old.blocked_id);
  return old;
end; $$;
drop trigger if exists wp_after_block on public.user_blocks;
create trigger wp_after_block after insert or delete on public.user_blocks
  for each row execute function public.wp_after_block();

-- ── Seguir / dejar de seguir ─────────────────────────────────────────
create or replace function public.wp_before_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.follower_id = new.following_id then return null; end if;
  if public.wp_blocked_between(new.follower_id, new.following_id) then
    raise exception 'No puedes seguir a esta persona';
  end if;
  return new;
end; $$;
drop trigger if exists wp_before_follow on public.follows;
create trigger wp_before_follow before insert on public.follows
  for each row execute function public.wp_before_follow();

create or replace function public.wp_after_follow()
returns trigger language plpgsql security definer set search_path = public as $$
declare x uuid; y uuid; lo uuid; hi uuid;
begin
  if tg_op = 'INSERT' then x := new.follower_id; y := new.following_id; else x := old.follower_id; y := old.following_id; end if;
  lo := least(x, y); hi := greatest(x, y);
  begin
    if tg_op = 'INSERT' then
      -- Se siguen los dos → el chat vuelve a ser directo
      if public.wp_follows(y, x) then
        update public.dm_threads set status = 'active', requested_by = null, requested_at = null
         where a = lo and b = hi and status = 'request';
      end if;
      -- Aviso "empezó a seguirte" (una vez al día por persona)
      if not exists (select 1 from public.notifications n where n.user_id = y and n.type = 'follow'
                       and n.data->>'actor_id' = x::text and n.created_at > now() - interval '1 day') then
        insert into public.notifications (user_id, type, title, body, data)
        values (y, 'follow', public.wp_plan_name(x) || ' empezó a seguirte',
          case when public.wp_follows(y, x) then 'Ahora se siguen los dos' else null end,
          jsonb_build_object('actor_id', x));
      end if;
    else
      -- Ya no se siguen los dos → el directo pasa a solicitud de quien sigue
      update public.dm_threads
         set status = 'request',
             requested_by = case when public.wp_follows(y, x) then y else null end,
             requested_at = now()
       where a = lo and b = hi and status = 'active';
    end if;
  exception when others then raise warning '[after_follow] %', sqlerrm; end;
  return null;
end; $$;
drop trigger if exists wp_after_follow on public.follows;
create trigger wp_after_follow after insert or delete on public.follows
  for each row execute function public.wp_after_follow();

-- ── Lista de directos: sin la gente que bloqueaste ───────────────────
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
    and not exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = o.id)
    and not (t.status = 'declined' and coalesce(t.requested_by, auth.uid()) <> auth.uid())
    -- solicitud neutra (nadie la pidió): solo si hay mensajes que ver
    and (m.id is not null or (r.cleared_at is null and (t.requested_by = auth.uid() or t.status = 'active')))
    and (r.hidden_at is null or coalesce(m.created_at, '-infinity') > r.hidden_at)
  order by coalesce(m.created_at, t.created_at) desc
  limit 100;
$$;
grant execute on function public.my_dm_chats() to authenticated;

-- ── Campanita ────────────────────────────────────────────────────────
-- plan_state: gone (ya no existe o se canceló) · past (ya terminó) ·
--   going (vas o lo organizas) · declined · full · open (puedes unirte)
-- actor_*: quien te siguió / te escribió, y si tú ya lo sigues
drop function if exists public.my_notifications(int);
create or replace function public.my_notifications(p_limit int default 40)
returns table (id text, type text, title text, body text, activity_id uuid, created_at timestamptz, read boolean, data jsonb,
  plan_state text, plan_at timestamptz, actor_id uuid, actor_name text, actor_avatar text, i_follow boolean)
language sql stable security definer set search_path = public as $$
  select n.id::text, n.type, n.title, n.body, n.activity_id, n.created_at, coalesce(n.read, false), n.data,
    case when n.activity_id is null then null
         when a.id is null or a.status in ('cancelled', 'canceled') then 'gone'
         when coalesce(a.ends_at, a.scheduled_at + interval '2 hours') < now() then 'past'
         when auth.uid() = a.creator_id or auth.uid() = any(coalesce(a.participants, '{}')) then 'going'
         when auth.uid() = any(coalesce(a.declined, '{}')) then 'declined'
         when cardinality(coalesce(a.participants, '{}')) >= coalesce(a.max_participants, 1000000) then 'full'
         else 'open' end,
    a.scheduled_at,
    p.id, coalesce(nullif(p.name, ''), case when p.username is not null then '@' || p.username end), p.avatar_url,
    case when p.id is null then null else public.wp_follows(auth.uid(), p.id) end
  from public.notifications n
  left join public.activities a on a.id = n.activity_id
  left join public.profiles p on p.id::text = n.data->>'actor_id'
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
$$;
grant execute on function public.my_notifications(int) to authenticated;

create or replace function public.notif_prune()
returns integer language plpgsql security definer set search_path = public as $$
declare k integer;
begin
  if auth.uid() is null then return 0; end if;
  delete from public.notifications n
   where n.user_id = auth.uid()
     and (
       (n.activity_id is not null and not exists (
          select 1 from public.activities a where a.id = n.activity_id
            and coalesce(a.status, 'active') not in ('cancelled', 'canceled')
            and coalesce(a.ends_at, a.scheduled_at + interval '2 hours') > now() - interval '3 days'))
       or exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id::text = n.data->>'actor_id')
     );
  get diagnostics k = row_count;
  return k;
end; $$;
grant execute on function public.notif_prune() to authenticated;

-- ── Arreglos de una vez ──────────────────────────────────────────────
-- Chats directos de gente que ya bloqueaste
update public.dm_threads t set status = 'declined', requested_by = b.blocked_id, requested_at = null
  from public.user_blocks b
 where t.a = least(b.blocker_id, b.blocked_id) and t.b = greatest(b.blocker_id, b.blocked_id)
   and not (t.status = 'declined' and t.requested_by = b.blocked_id);
-- Seguimientos que quedaron con bloqueo de por medio
delete from public.follows f using public.user_blocks b
 where (f.follower_id = b.blocker_id and f.following_id = b.blocked_id)
    or (f.follower_id = b.blocked_id and f.following_id = b.blocker_id);
