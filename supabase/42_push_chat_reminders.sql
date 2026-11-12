-- ====================================================================
-- WHATSPLAN — 42_push_chat_reminders.sql
-- Más avisos push. Se puede correr varias veces.
--  1) Mensajes del chat de un plan → push a los demás del plan:
--     · respeta el chat silenciado (plan_reads.muted) y los bloqueos
--     · agrupa: el primer mensaje avisa; los siguientes dentro de 3 min
--       solo actualizan el texto (sin otro push). Pasados los 3 min, el
--       siguiente avisa de nuevo con "N mensajes nuevos"
--     · si el mensaje te menciona, ya hay aviso de mención: no se duplica
--     · se guardan como notifications type 'chat_msg' con read = true:
--       no cuentan en la campanita ni salen en su lista (my_notifications
--       los oculta); solo sirven para que el webhook mande el push
--  2) Recordatorio ~1 hora antes del plan (pg_cron cada 5 min) a quien
--     organiza y a quienes van. Aparece en la campanita y como push.
-- ====================================================================

-- ── 1) Chat ──────────────────────────────────────────────────────────
create or replace function public.wp_plan_chat_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare a public.activities; r uuid; me text; unread int; msg text; last_read timestamptz; upd int;
begin
  if new.kind = 'system' or new.user_id is null then return new; end if;
  begin
    select * into a from public.activities where id = new.activity_id;
    if a.id is null then return new; end if;
    me := public.wp_plan_name(new.user_id);
    for r in select distinct x from unnest(array_append(coalesce(a.participants, '{}'), a.creator_id)) x
             where x is not null and x <> new.user_id
    loop
      continue when exists (select 1 from public.plan_reads pr where pr.activity_id = a.id and pr.user_id = r and pr.muted);
      continue when public.wp_blocked_between(new.user_id, r);
      continue when exists (select 1 from public.notifications n where n.user_id = r and n.type = 'chat_mention'
                              and n.activity_id = a.id and n.created_at >= new.created_at);
      select pr.last_read_at into last_read from public.plan_reads pr where pr.activity_id = a.id and pr.user_id = r;
      select count(*) into unread from public.plan_messages m
       where m.activity_id = a.id and m.kind <> 'system' and m.user_id is distinct from r
         and m.created_at > coalesce(last_read, '-infinity');
      msg := case when unread > 1 then unread || ' mensajes nuevos · ' else '' end || me || ': ' || left(new.body, 80);
      -- ya avisamos hace menos de 3 min: solo se actualiza el texto (UPDATE no dispara el push)
      update public.notifications n set body = msg
       where n.user_id = r and n.type = 'chat_msg' and n.activity_id = a.id and n.created_at > now() - interval '3 minutes';
      get diagnostics upd = row_count;
      if upd = 0 then
        delete from public.notifications n where n.user_id = r and n.type = 'chat_msg' and n.activity_id = a.id;
        insert into public.notifications (user_id, type, title, body, activity_id, read, data)
        values (r, 'chat_msg', a.title, msg, a.id, true, jsonb_build_object('actor_id', new.user_id));
      end if;
    end loop;
  exception when others then raise warning '[plan_chat_push] %', sqlerrm; end;
  return new;
end; $$;
-- 'wp_plan_chat_push' va después de 'wp_plan_chat_mentions' (orden alfabético de triggers)
drop trigger if exists wp_plan_chat_push on public.plan_messages;
create trigger wp_plan_chat_push after insert on public.plan_messages
  for each row execute function public.wp_plan_chat_push();

-- La lista de la campanita no muestra los avisos de chat
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
  where n.user_id = auth.uid() and n.type <> 'chat_msg'   -- los avisos de chat son solo para el push
  order by n.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
$$;
grant execute on function public.my_notifications(int) to authenticated;

-- ── 2) Recordatorio de 1 hora antes ──────────────────────────────────
alter table public.activities add column if not exists reminded_at timestamptz;

-- Si cambian la hora, el recordatorio se vuelve a armar
create or replace function public.wp_reset_reminder()
returns trigger language plpgsql as $$
begin
  if new.scheduled_at is distinct from old.scheduled_at then new.reminded_at := null; end if;
  return new;
end; $$;
drop trigger if exists wp_reset_reminder on public.activities;
create trigger wp_reset_reminder before update of scheduled_at on public.activities
  for each row execute function public.wp_reset_reminder();

create or replace function public.wp_plan_reminders()
returns integer language plpgsql security definer set search_path = public as $$
declare a public.activities; n integer := 0;
begin
  for a in select * from public.activities
            where coalesce(status, 'active') not in ('cancelled', 'canceled')
              and reminded_at is null
              and scheduled_at > now() + interval '50 minutes' and scheduled_at <= now() + interval '65 minutes'
  loop
    update public.activities set reminded_at = now() where id = a.id;
    insert into public.notifications (user_id, type, title, body, activity_id)
    select distinct x, 'plan_reminder', 'Tu plan es en 1 hora',
           a.title || case when coalesce(a.place_name, '') <> '' then ' · ' || a.place_name else '' end, a.id
      from unnest(array_append(coalesce(a.participants, '{}'), a.creator_id)) x where x is not null;
    n := n + 1;
  end loop;
  -- limpieza de los avisos de chat (solo sirven para el push)
  delete from public.notifications where type = 'chat_msg' and created_at < now() - interval '1 day';
  return n;
end; $$;
revoke all on function public.wp_plan_reminders() from public, anon, authenticated;

-- Cada 5 minutos. Necesita la extensión pg_cron (Database > Extensions > pg_cron)
do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'wp_plan_reminders';
  perform cron.schedule('wp_plan_reminders', '*/5 * * * *', 'select public.wp_plan_reminders()');
exception when others then
  raise notice 'pg_cron no disponible (%): actívalo en Database > Extensions y vuelve a correr este archivo', sqlerrm;
end $$;
