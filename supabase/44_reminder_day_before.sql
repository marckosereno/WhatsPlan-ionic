-- ====================================================================
-- WHATSPLAN — 44_reminder_day_before.sql
-- Recordatorio de "mañana" para los planes con anticipación: ~24 h antes
-- aviso "Tu plan es mañana" a quien organiza y a quienes van (además del
-- de 1 hora antes del SQL 42). Se puede correr varias veces.
--  · solo si el plan se creó hace más de 3 h (no avisar lo que acabas de armar)
--  · cae en la campanita y como push (categoría "Recordatorios" de Avisos)
--  · si cambian la hora del plan, ambos recordatorios se vuelven a armar
-- Usa el mismo job de pg_cron del SQL 42 (cada 5 min): no hay que programar nada nuevo.
-- ====================================================================
alter table public.activities add column if not exists reminded_day_at timestamptz;

create or replace function public.wp_reset_reminder()
returns trigger language plpgsql as $$
begin
  if new.scheduled_at is distinct from old.scheduled_at then
    new.reminded_at := null;
    new.reminded_day_at := null;
  end if;
  return new;
end; $$;

create or replace function public.wp_plan_reminders()
returns integer language plpgsql security definer set search_path = public as $$
declare a public.activities; n integer := 0;
begin
  -- ~1 hora antes
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

  -- ~1 día antes (solo planes creados con anticipación)
  for a in select * from public.activities
            where coalesce(status, 'active') not in ('cancelled', 'canceled')
              and reminded_day_at is null
              and scheduled_at > now() + interval '23 hours' and scheduled_at <= now() + interval '25 hours'
              and created_at < now() - interval '3 hours'
  loop
    update public.activities set reminded_day_at = now() where id = a.id;
    insert into public.notifications (user_id, type, title, body, activity_id)
    select distinct x, 'plan_reminder', 'Tu plan es mañana',
           a.title || case when coalesce(a.place_name, '') <> '' then ' · ' || a.place_name else '' end, a.id
      from unnest(array_append(coalesce(a.participants, '{}'), a.creator_id)) x where x is not null;
    n := n + 1;
  end loop;

  -- limpieza de los avisos de chat (solo sirven para el push)
  delete from public.notifications where type = 'chat_msg' and created_at < now() - interval '1 day';
  return n;
end; $$;
revoke all on function public.wp_plan_reminders() from public, anon, authenticated;
