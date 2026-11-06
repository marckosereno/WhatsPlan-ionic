-- ====================================================================
-- WHATSPLAN — 25_plan_duration.sql  (hora de fin del plan)
-- Agrega activities.ends_at y el parámetro p_duration a create_plan
-- (minutos, de 30 a 720 = 12 h; por defecto 120). Se puede correr más
-- de una vez. Requiere haber corrido antes 24_activities_plans.sql.
-- ====================================================================

alter table public.activities add column if not exists ends_at timestamptz;

-- la versión anterior (sin duración), para que no haya dos create_plan
drop function if exists public.create_plan(text, text, text, text, double precision, double precision, timestamptz, int, boolean, text, text, uuid[], text, text[], jsonb);

create or replace function public.create_plan(
  p_title text, p_type text, p_place_name text, p_place_id text,
  p_lat double precision, p_lng double precision, p_at timestamptz,
  p_max int default 4, p_spontaneous boolean default false,
  p_visibility text default 'public', p_note text default null,
  p_invited uuid[] default '{}', p_icon text default null, p_rules text[] default '{}',
  p_stops jsonb default '[]', p_duration int default 120
) returns public.activities
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  inv uuid[];
  a public.activities;
  myname text;
begin
  if me is null then raise exception 'Inicia sesión para planear una visita'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Ponle un nombre al plan'; end if;
  if p_at is null or p_at < now() - interval '10 minutes' then raise exception 'Elige una hora que no haya pasado'; end if;
  if p_visibility not in ('public', 'followers', 'invited') then p_visibility := 'public'; end if;

  -- Un plan activo por lugar (la misma regla que ya tenía la app)
  if exists (
    select 1 from public.activities x
    where x.creator_id = me and x.status = 'active'
      and x.scheduled_at > now() - interval '2 hours'
      and lower(trim(coalesce(x.place_name, ''))) = lower(trim(coalesce(p_place_name, '')))
      and coalesce(p_place_name, '') <> ''
  ) then
    raise exception 'Ya tienes un plan activo en este lugar. Cancélalo antes de crear otro.';
  end if;

  -- Invitados: solo gente que sigues, sin repetir, sin ti, máx. 20
  select coalesce(array_agg(distinct u), '{}') into inv
  from unnest(coalesce(p_invited, '{}')) u
  where u <> me and exists (select 1 from public.follows f where f.follower_id = me and f.following_id = u);
  inv := inv[1:20];

  if p_visibility = 'invited' and cardinality(inv) = 0 then
    raise exception 'Invita al menos a una persona o cambia quién puede verlo';
  end if;

  insert into public.activities
    (title, type, place_name, place_id, lat, lng, scheduled_at, max_participants,
     creator_id, participants, status, is_spontaneous, visibility, note, invited, icon_url, rules, stops, ends_at)
  values
    (left(trim(p_title), 60), coalesce(nullif(p_type, ''), 'hangout'), p_place_name, nullif(p_place_id, ''),
     p_lat, p_lng, p_at, greatest(2, least(coalesce(p_max, 4), 50)),
     me, array[me], 'active', coalesce(p_spontaneous, false), p_visibility,
     nullif(left(trim(coalesce(p_note, '')), 280), ''), inv,
     case when p_icon ~ '^https://' then left(p_icon, 400) end,
     coalesce((select array_agg(distinct r) from unnest(coalesce(p_rules, '{}')) r
               where r in ('split','treat','cash','punctual','ride','parking','adults','kids','pets')), '{}'),
     public.wp_plan_clean_stops(p_stops, nullif(p_place_id, '')),
     p_at + make_interval(mins => greatest(30, least(coalesce(p_duration, 120), 720))))
  returning * into a;

  -- Avisos a los invitados (si falla un aviso, el plan igual se crea)
  if cardinality(inv) > 0 then
    select coalesce(nullif(p.name, ''), 'Alguien') into myname from public.profiles p where p.id = me;
    begin
      insert into public.notifications (user_id, type, title, body, activity_id)
      select u, 'plan_invite', '📅 Te invitaron a un plan',
             coalesce(myname, 'Alguien') || ' te invitó: ' || a.title, a.id
      from unnest(inv) u;
    exception when others then
      raise warning '[create_plan] avisos: %', sqlerrm;
    end;
  end if;

  return a;
end;
$$;

grant execute on function public.create_plan(text, text, text, text, double precision, double precision, timestamptz, int, boolean, text, text, uuid[], text, text[], jsonb, int) to authenticated;
