-- ====================================================================
-- WHATSPLAN — 33_plan_chat_extras.sql   (después de 32_plan_chat.sql)
-- Lo que le faltaba al chat de los planes:
--   · Reacciones: plan_messages.reactions = { user_id: emoji } (una por
--     persona; tocar la misma la quita). react_message(mensaje, emoji).
--     Llegan en tiempo real como UPDATE del mensaje.
--   · Responder a un mensaje: plan_messages.reply_to.
--   · Fotos: plan_messages.image_path (bucket privado "plan-chat", ruta
--     <plan>/<archivo>.jpg; solo los del plan suben y ven). El texto puede
--     ir vacío si hay foto.
--   · @menciones: si un mensaje dice "@Ana", a Ana le llega un aviso a la
--     campanita (lo único del chat que va ahí).
--   · Silenciar un chat: plan_reads.muted + set_plan_muted(plan, sí/no).
--     my_plan_chats() ahora dice si está silenciado.
-- Se puede correr varias veces.
-- ====================================================================

alter table public.plan_messages add column if not exists reactions jsonb not null default '{}'::jsonb;
alter table public.plan_messages add column if not exists reply_to uuid references public.plan_messages(id) on delete set null;
alter table public.plan_messages add column if not exists image_path text;
alter table public.plan_reads add column if not exists muted boolean not null default false;

-- texto vacío permitido solo si hay foto
alter table public.plan_messages drop constraint if exists plan_messages_body_check;
alter table public.plan_messages drop constraint if exists plan_messages_body_or_image;
alter table public.plan_messages add constraint plan_messages_body_or_image
  check (char_length(body) <= 1000 and (char_length(body) >= 1 or image_path is not null));

-- al escribir: la foto tiene que estar en la carpeta del plan
drop policy if exists plan_messages_write on public.plan_messages;
create policy plan_messages_write on public.plan_messages for insert to authenticated
  with check (user_id = auth.uid() and kind in ('text', 'quick') and public.wp_plan_member(activity_id)
    and (image_path is null or image_path like activity_id::text || '/%')
    and reactions = '{}'::jsonb
    and exists (select 1 from public.activities a where a.id = activity_id and a.status <> 'cancelled'));

-- ── Reacciones ──────────────────────────────────────────────────────
create or replace function public.react_message(p_message uuid, p_emoji text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.plan_messages; me text := auth.uid()::text;
begin
  select * into m from public.plan_messages where id = p_message for update;
  if not found or not public.wp_plan_member(m.activity_id) then raise exception 'No puedes reaccionar aquí'; end if;
  if p_emoji is null or p_emoji = '' or m.reactions ->> me = p_emoji then
    update public.plan_messages set reactions = reactions - me where id = p_message returning reactions into m.reactions;
  else
    update public.plan_messages set reactions = reactions || jsonb_build_object(me, left(p_emoji, 8)) where id = p_message returning reactions into m.reactions;
  end if;
  return m.reactions;
end; $$;
grant execute on function public.react_message(uuid, text) to authenticated;

-- ── Silenciar ───────────────────────────────────────────────────────
create or replace function public.set_plan_muted(p_activity uuid, p_muted boolean)
returns void language sql security definer set search_path = public as $$
  insert into public.plan_reads (activity_id, user_id, last_read_at, muted)
  select p_activity, auth.uid(), now(), p_muted where public.wp_plan_member(p_activity)
  on conflict (activity_id, user_id) do update set muted = excluded.muted;
$$;
grant execute on function public.set_plan_muted(uuid, boolean) to authenticated;

drop function if exists public.my_plan_chats();
create or replace function public.my_plan_chats()
returns table (activity_id uuid, title text, type text, place_id text, place_name text, scheduled_at timestamptz, ends_at timestamptz,
  stops jsonb, participants uuid[], creator_id uuid, status text, last_body text, last_kind text, last_user uuid, last_at timestamptz,
  last_image boolean, unread int, muted boolean)
language sql stable security definer set search_path = public as $$
  select a.id, a.title, a.type, a.place_id, a.place_name, a.scheduled_at, a.ends_at, a.stops, a.participants, a.creator_id, a.status,
    m.body, m.kind, m.user_id, m.created_at, m.image_path is not null,
    (select count(*)::int from public.plan_messages x
      where x.activity_id = a.id and coalesce(x.user_id, '00000000-0000-0000-0000-000000000000') <> auth.uid()
        and x.created_at > coalesce(r.last_read_at, '-infinity')),
    coalesce(r.muted, false)
  from public.activities a
  left join public.plan_reads r on r.activity_id = a.id and r.user_id = auth.uid()
  left join lateral (select * from public.plan_messages x where x.activity_id = a.id order by x.created_at desc limit 1) m on true
  where (a.creator_id = auth.uid() or auth.uid() = any(a.participants))
    and a.scheduled_at > now() - interval '30 days'
  order by coalesce(m.created_at, a.created_at) desc
  limit 100;
$$;
grant execute on function public.my_plan_chats() to authenticated;

-- ── @menciones → aviso a la campanita ──────────────────────────────
create or replace function public.wp_plan_chat_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
declare a public.activities; u uuid; nm text;
begin
  if new.kind <> 'text' or position('@' in new.body) = 0 then return new; end if;
  begin
    select * into a from public.activities where id = new.activity_id;
    for u in select x from unnest(array_append(a.participants, a.creator_id)) x where x is distinct from new.user_id
    loop
      select nullif(split_part(trim(p.name), ' ', 1), '') into nm from public.profiles p where p.id = u;
      if nm is not null and new.body ~* ('@' || regexp_replace(nm, '([.^$*+?()[\]{}|\\])', '\\\1', 'g') || '(\M|$)') then
        insert into public.notifications (user_id, type, title, body, activity_id)
        values (u, 'chat_mention', public.wp_plan_name(new.user_id) || ' te mencionó en ' || a.title, left(new.body, 120), a.id);
      end if;
    end loop;
  exception when others then raise warning '[plan_chat_mentions] %', sqlerrm; end;
  return new;
end; $$;
drop trigger if exists wp_plan_chat_mentions on public.plan_messages;
create trigger wp_plan_chat_mentions after insert on public.plan_messages
  for each row execute function public.wp_plan_chat_mentions();

-- ── Fotos: bucket privado "plan-chat" (solo en Supabase) ───────────
create or replace function public.wp_plan_member_path(p_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return public.wp_plan_member(split_part(p_name, '/', 1)::uuid);
exception when others then return false;
end; $$;

do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('plan-chat', 'plan-chat', false) on conflict (id) do nothing;
    execute 'drop policy if exists plan_chat_read on storage.objects';
    execute 'drop policy if exists plan_chat_upload on storage.objects';
    execute $p$create policy plan_chat_read on storage.objects for select to authenticated
      using (bucket_id = 'plan-chat' and public.wp_plan_member_path(name))$p$;
    execute $p$create policy plan_chat_upload on storage.objects for insert to authenticated
      with check (bucket_id = 'plan-chat' and public.wp_plan_member_path(name))$p$;
  end if;
end $$;
