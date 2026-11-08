-- ====================================================================
-- WHATSPLAN — 32_plan_chat.sql
-- Chat de cada plan (pestaña Social).
--   · plan_messages: mensajes del plan. kind: 'text' (escrito), 'quick'
--     (respuesta rápida: "Ya llegué"…), 'system' (lo pone la base de
--     datos cuando cambia el plan; user_id vacío).
--   · plan_reads: hasta dónde leyó cada quien (para los "sin leer").
--   · Solo los del plan (quien organiza + los que van) leen y escriben.
--     Invitados que no han respondido y lista de espera, no.
--   · Mensajes del sistema automáticos: alguien se unió / ya no va,
--     nueva hora, nuevo nombre, cambió la ruta, se canceló.
--   · my_plan_chats(): tus chats con el último mensaje y cuántos sin leer.
--   · mark_plan_read(plan): marcar leído.
--   · Tiempo real: plan_messages entra a la publicación supabase_realtime
--     (respeta los permisos: cada quien recibe solo los de sus planes).
-- Se puede correr varias veces.
-- ====================================================================

create table if not exists public.plan_messages (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid,
  kind text not null default 'text' check (kind in ('text', 'quick', 'system')),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists plan_messages_act_time on public.plan_messages (activity_id, created_at desc);

create table if not exists public.plan_reads (
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null,
  last_read_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

-- ¿Estoy en este plan? (organizo o voy)
create or replace function public.wp_plan_member(p_activity uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.activities a
    where a.id = p_activity and (a.creator_id = auth.uid() or auth.uid() = any(a.participants)));
$$;

alter table public.plan_messages enable row level security;
alter table public.plan_reads enable row level security;

drop policy if exists plan_messages_read on public.plan_messages;
create policy plan_messages_read on public.plan_messages for select to authenticated
  using (public.wp_plan_member(activity_id));

drop policy if exists plan_messages_write on public.plan_messages;
create policy plan_messages_write on public.plan_messages for insert to authenticated
  with check (user_id = auth.uid() and kind in ('text', 'quick') and public.wp_plan_member(activity_id)
    and exists (select 1 from public.activities a where a.id = activity_id and a.status <> 'cancelled'));

drop policy if exists plan_reads_own on public.plan_reads;
create policy plan_reads_own on public.plan_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert on public.plan_messages to authenticated;
grant select, insert, update on public.plan_reads to authenticated;

-- ── Hora corta para los mensajes del sistema: "Sáb 14 · 8 pm" ───────
-- (wp_plan_hhmm también viene en 31; se repite para no depender del orden)
create or replace function public.wp_plan_hhmm(t timestamptz)
returns text language sql immutable as $$
  select case when extract(minute from t at time zone 'America/Mexico_City') = 0
    then to_char(t at time zone 'America/Mexico_City', 'FMHH12') else to_char(t at time zone 'America/Mexico_City', 'FMHH12:MI') end
    || ' ' || case when extract(hour from t at time zone 'America/Mexico_City') < 12 then 'am' else 'pm' end;
$$;

create or replace function public.wp_plan_day_hhmm(t timestamptz)
returns text language sql immutable as $$
  select (array['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'])[extract(dow from t at time zone 'America/Mexico_City')::int + 1]
    || ' ' || extract(day from t at time zone 'America/Mexico_City')::int || ' · ' || public.wp_plan_hhmm(t);
$$;

create or replace function public.wp_plan_name(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(split_part(trim(p.name), ' ', 1), ''), 'Alguien') from public.profiles p where p.id = p_user
  union all select 'Alguien' limit 1;
$$;

-- ── Mensajes del sistema cuando cambia el plan ─────────────────────
create or replace function public.wp_plan_chat_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare u uuid; msgs text[] := '{}';
begin
  begin
    for u in select x from unnest(new.participants) x where not (x = any(coalesce(old.participants, '{}')))
    loop msgs := msgs || (public.wp_plan_name(u) || ' se unió al plan'); end loop;
    for u in select x from unnest(old.participants) x where not (x = any(coalesce(new.participants, '{}')))
    loop msgs := msgs || (public.wp_plan_name(u) || ' ya no va'); end loop;
    if new.scheduled_at is distinct from old.scheduled_at then
      msgs := msgs || ('Cambió la hora: ' || public.wp_plan_day_hhmm(new.scheduled_at));
    end if;
    if new.title is distinct from old.title then
      msgs := msgs || ('El plan ahora se llama "' || new.title || '"');
    end if;
    if new.stops is distinct from old.stops then
      msgs := msgs || ('Cambió la ruta del plan · ' || (1 + jsonb_array_length(coalesce(new.stops, '[]'::jsonb))) || ' lugares');
    end if;
    if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
      msgs := msgs || 'El plan se canceló'::text;
    end if;
    insert into public.plan_messages (activity_id, user_id, kind, body)
    select new.id, null, 'system', m from unnest(msgs) m;
  exception when others then raise warning '[plan_chat] %', sqlerrm; end;
  return new;
end; $$;

drop trigger if exists wp_plan_chat_events on public.activities;
create trigger wp_plan_chat_events after update on public.activities
  for each row execute function public.wp_plan_chat_events();

-- ── Tus chats: último mensaje y cuántos sin leer ────────────────────
drop function if exists public.my_plan_chats();   -- (cambió lo que devuelve)
create or replace function public.my_plan_chats()
returns table (activity_id uuid, title text, type text, place_id text, place_name text, scheduled_at timestamptz, ends_at timestamptz,
  stops jsonb, participants uuid[], creator_id uuid, status text, last_body text, last_kind text, last_user uuid, last_at timestamptz, unread int)
language sql stable security definer set search_path = public as $$
  select a.id, a.title, a.type, a.place_id, a.place_name, a.scheduled_at, a.ends_at, a.stops, a.participants, a.creator_id, a.status,
    m.body, m.kind, m.user_id, m.created_at,
    (select count(*)::int from public.plan_messages x
      where x.activity_id = a.id and coalesce(x.user_id, '00000000-0000-0000-0000-000000000000') <> auth.uid()
        and x.created_at > coalesce((select r.last_read_at from public.plan_reads r where r.activity_id = a.id and r.user_id = auth.uid()), '-infinity'))
  from public.activities a
  left join lateral (select * from public.plan_messages x where x.activity_id = a.id order by x.created_at desc limit 1) m on true
  where (a.creator_id = auth.uid() or auth.uid() = any(a.participants))
    and a.scheduled_at > now() - interval '30 days'
  order by coalesce(m.created_at, a.created_at) desc
  limit 100;
$$;
grant execute on function public.my_plan_chats() to authenticated;

create or replace function public.mark_plan_read(p_activity uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.plan_reads (activity_id, user_id, last_read_at)
  select p_activity, auth.uid(), now() where public.wp_plan_member(p_activity)
  on conflict (activity_id, user_id) do update set last_read_at = excluded.last_read_at;
$$;
grant execute on function public.mark_plan_read(uuid) to authenticated;

-- ── Tiempo real ─────────────────────────────────────────────────────
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plan_messages') then
    execute 'alter publication supabase_realtime add table public.plan_messages';
  end if;
end $$;
