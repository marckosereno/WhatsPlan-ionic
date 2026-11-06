-- ====================================================================
-- WHATSPLAN — 26_reschedule_duration.sql
-- Cambiar la hora de un plan ahora también recorre su hora de fin
-- (conserva la duración), y se puede cambiar la duración desde
-- "Tu plan" (p_duration en minutos, de 30 a 720; null = la misma).
-- Se puede correr más de una vez. Requiere 25_plan_duration.sql.
-- ====================================================================

drop function if exists public.reschedule_plan(uuid, timestamptz);

create or replace function public.reschedule_plan(p_activity uuid, p_at timestamptz, p_duration int default null)
returns public.activities
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a public.activities; dur int;
begin
  if p_at is null or p_at < now() - interval '10 minutes' then raise exception 'Elige una hora que no haya pasado'; end if;
  select * into a from public.activities where id = p_activity and creator_id = me and status = 'active' for update;
  if not found then raise exception 'Solo quien organiza puede cambiar la hora'; end if;
  dur := coalesce(p_duration, extract(epoch from (a.ends_at - a.scheduled_at))::int / 60, 120);
  dur := greatest(30, least(dur, 720));
  update public.activities set scheduled_at = p_at, ends_at = p_at + make_interval(mins => dur)
   where id = a.id returning * into a;
  begin
    insert into public.notifications (user_id, type, title, body, activity_id)
    select u, 'plan_update', '🕒 Cambió la hora del plan',
           a.title || ' ahora es ' || to_char(p_at at time zone 'America/Mexico_City', 'DD/MM HH24:MI')
             || ' a ' || to_char(a.ends_at at time zone 'America/Mexico_City', 'HH24:MI'), a.id
    from unnest(a.participants) u where u <> me;
  exception when others then raise warning '[reschedule_plan] avisos: %', sqlerrm; end;
  return a;
end; $$;

grant execute on function public.reschedule_plan(uuid, timestamptz, int) to authenticated;
