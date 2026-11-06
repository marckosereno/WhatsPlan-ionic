-- ====================================================================
-- WHATSPLAN — activities_plans.sql  ("Planear visita" completo)
-- Agrega a los planes (tabla activities):
--   · visibility: 'public' (todos) · 'followers' (quien te sigue) ·
--                 'invited' (solo las personas que invitaste)
--   · note: nota opcional del plan
--   · invited: personas invitadas (uuid[])
--   · ends_at: a qué hora termina (duración de 30 min a 12 h)
-- y la función create_plan(), que crea el plan y avisa a los invitados.
--
-- Seguridad: una política RESTRICTIVA de lectura. Se SUMA a las que ya
-- tengas (no las reemplaza): un plan solo se puede leer si es público,
-- si es tuyo, si vas en él, si te invitaron, o si es "para seguidores" y
-- sigues a quien lo creó. Los planes que ya existen quedan como públicos.
-- Se puede correr más de una vez.
-- ====================================================================

alter table public.activities add column if not exists visibility text not null default 'public';
alter table public.activities add column if not exists note text;
alter table public.activities add column if not exists invited uuid[] not null default '{}';

do $$ begin
  alter table public.activities add constraint activities_visibility_chk
    check (visibility in ('public', 'followers', 'invited'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.activities add constraint activities_note_len_chk check (char_length(coalesce(note, '')) <= 280);
exception when duplicate_object then null; end $$;

create index if not exists activities_invited_idx on public.activities using gin (invited);

alter table public.activities enable row level security;

drop policy if exists activities_visibility_guard on public.activities;
create policy activities_visibility_guard on public.activities
  as restrictive for select
  using (
    visibility = 'public'
    or creator_id = auth.uid()
    or auth.uid() = any (coalesce(participants, '{}'))
    or auth.uid() = any (coalesce(invited, '{}'))
    or (visibility = 'followers' and exists (
          select 1 from public.follows f
          where f.follower_id = auth.uid() and f.following_id = activities.creator_id))
  );

-- ── create_plan: crea el plan y avisa a los invitados ───────────────
-- Solo se puede invitar a gente que tú sigues (máx. 20). Devuelve la fila.
-- (v2: + p_icon = ícono 3D del tipo de actividad; se borra la versión vieja
-- para que no haya dos create_plan y la app no sepa cuál llamar)
drop function if exists public.create_plan(text, text, text, text, double precision, double precision, timestamptz, int, boolean, text, text, uuid[]);
drop function if exists public.create_plan(text, text, text, text, double precision, double precision, timestamptz, int, boolean, text, text, uuid[], text);
drop function if exists public.create_plan(text, text, text, text, double precision, double precision, timestamptz, int, boolean, text, text, uuid[], text, text[]);
drop function if exists public.create_plan(text, text, text, text, double precision, double precision, timestamptz, int, boolean, text, text, uuid[], text, text[], jsonb);
-- Hora de fin del plan (la elige quien lo crea: dura de 30 min a 12 h)
alter table public.activities add column if not exists ends_at timestamptz;
-- Reglas del plan (etiquetas que se tocan): cada quien paga, puntual, +18…
alter table public.activities add column if not exists rules text[] not null default '{}';
-- Paradas: otros lugares del mismo plan (máx. 3 además del principal).
-- Cada una: {place_id, name, lat, lng, cat, after} — after = minutos
-- desde la hora del plan (si cambias la hora, toda la ruta se recorre).
alter table public.activities add column if not exists stops jsonb not null default '[]';
create index if not exists activities_stops_gin on public.activities using gin (stops jsonb_path_ops);

-- Cada parada: {place_id, name, lat, lng, cat, after, act, emoji, icon, note, address}
--   · act/emoji/icon = qué van a hacer ahí (catálogo de Crear actividad)
--   · note = indicación SOLO de esa parada ("aquí cada quien pide lo suyo")
--   · lugar propio (no está en el mapa): place_id 'custom:…', lat/lng opcionales
create or replace function public.wp_plan_clean_stops(p jsonb, p_main text)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(x order by (x->>'after')::int), '[]'::jsonb) from (
    select jsonb_strip_nulls(jsonb_build_object(
      'place_id', left(e->>'place_id', 120), 'name', left(coalesce(nullif(trim(e->>'name'), ''), 'Lugar'), 80),
      'lat', case when (e->>'lat') ~ '^-?[0-9]+(\.[0-9]+)?$' then (e->>'lat')::float8 end,
      'lng', case when (e->>'lng') ~ '^-?[0-9]+(\.[0-9]+)?$' then (e->>'lng')::float8 end,
      'cat', left(coalesce(e->>'cat', ''), 30),
      'after', greatest(5, least(720, coalesce((e->>'after')::int, 60))),
      'act', left(e->>'act', 40), 'emoji', left(e->>'emoji', 8),
      'icon', case when (e->>'icon') ~ '^https://' then left(e->>'icon', 400) end,
      'note', nullif(left(trim(coalesce(e->>'note', '')), 140), ''),
      'address', nullif(left(trim(coalesce(e->>'address', '')), 160), ''),
      'custom', case when (e->>'place_id') like 'custom:%' then true end)) x
    from (select distinct on (e->>'place_id') e
          from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) e
          where coalesce(e->>'place_id', '') <> '' and e->>'place_id' is distinct from p_main
            and ((e->>'place_id') like 'custom:%' or ((e->>'lat') ~ '^-?[0-9.]+$' and (e->>'lng') ~ '^-?[0-9.]+$'))) d
    limit 3
  ) t;
$$;
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

-- Organizador: cambiar las paradas (avisa a los que van)
create or replace function public.set_plan_stops(p_activity uuid, p_stops jsonb)
returns public.activities
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a public.activities;
begin
  update public.activities set stops = public.wp_plan_clean_stops(p_stops, place_id)
   where id = p_activity and creator_id = me and status = 'active' returning * into a;
  if not found then raise exception 'Solo quien organiza puede cambiar las paradas'; end if;
  begin
    insert into public.notifications (user_id, type, title, body, activity_id)
    select u, 'plan_update', '🗺️ Cambió la ruta del plan',
      a.title || ' · ' || (1 + jsonb_array_length(a.stops)) || ' parada' || case when jsonb_array_length(a.stops) > 0 then 's' else '' end, a.id
    from unnest(a.participants) u where u <> me;
  exception when others then raise warning '[set_plan_stops] aviso: %', sqlerrm; end;
  return a;
end; $$;
grant execute on function public.set_plan_stops(uuid, jsonb) to authenticated;

-- ====================================================================
-- Respuestas y manejo del plan (botón "Tu plan" / "Planes aquí")
-- ====================================================================
alter table public.activities add column if not exists declined uuid[] not null default '{}';

-- Unirme / aceptar invitación (p_accept = true) · No puedo / salirme (false)
create or replace function public.respond_plan(p_activity uuid, p_accept boolean)
returns public.activities
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  a public.activities;
  can_see boolean;
  myname text;
begin
  if me is null then raise exception 'Inicia sesión'; end if;
  select * into a from public.activities where id = p_activity for update;
  if not found or a.status <> 'active' then raise exception 'Este plan ya no está activo'; end if;
  if a.creator_id = me then raise exception 'Eres quien organiza este plan'; end if;
  can_see := a.visibility = 'public' or me = any (a.invited) or me = any (a.participants)
    or (a.visibility = 'followers' and exists (select 1 from public.follows f where f.follower_id = me and f.following_id = a.creator_id));
  if not can_see then raise exception 'No tienes acceso a este plan'; end if;
  select coalesce(nullif(p.name, ''), 'Alguien') into myname from public.profiles p where p.id = me;

  if p_accept then
    if me = any (a.participants) then return a; end if;
    if cardinality(a.participants) >= a.max_participants then raise exception 'Este plan ya está lleno'; end if;
    update public.activities
       set participants = array_append(participants, me), declined = array_remove(declined, me)
     where id = a.id returning * into a;
    begin
      insert into public.notifications (user_id, type, title, body, activity_id)
      values (a.creator_id, 'plan_join', '🙌 Se unieron a tu plan', myname || ' va a ' || a.title, a.id);
    exception when others then raise warning '[respond_plan] aviso: %', sqlerrm; end;
  else
    update public.activities
       set participants = array_remove(participants, me),
           declined = case when me = any (declined) then declined else array_append(declined, me) end
     where id = a.id returning * into a;
    begin
      insert into public.notifications (user_id, type, title, body, activity_id)
      values (a.creator_id, 'plan_decline', 'Cambio en tu plan', myname || ' no podrá ir a ' || a.title, a.id);
    exception when others then raise warning '[respond_plan] aviso: %', sqlerrm; end;
  end if;
  return a;
end; $$;

-- Organizador: invitar a más gente (que sigues)
create or replace function public.invite_to_plan(p_activity uuid, p_invited uuid[])
returns public.activities
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a public.activities; nuevos uuid[]; myname text;
begin
  select * into a from public.activities where id = p_activity for update;
  if not found or a.creator_id is distinct from me then raise exception 'Solo quien organiza puede invitar'; end if;
  select coalesce(array_agg(distinct u), '{}') into nuevos from unnest(coalesce(p_invited, '{}')) u
   where u <> me and not (u = any (a.invited)) and not (u = any (a.participants))
     and exists (select 1 from public.follows f where f.follower_id = me and f.following_id = u);
  if cardinality(a.invited) + cardinality(nuevos) > 20 then raise exception 'Máximo 20 invitados por plan'; end if;
  update public.activities set invited = invited || nuevos,
         max_participants = greatest(max_participants, case when visibility = 'invited' then cardinality(participants) + cardinality(invited) + cardinality(nuevos) else max_participants end)
   where id = a.id returning * into a;
  if cardinality(nuevos) > 0 then
    select coalesce(nullif(p.name, ''), 'Alguien') into myname from public.profiles p where p.id = me;
    begin
      insert into public.notifications (user_id, type, title, body, activity_id)
      select u, 'plan_invite', '📅 Te invitaron a un plan', myname || ' te invitó: ' || a.title, a.id from unnest(nuevos) u;
    exception when others then raise warning '[invite_to_plan] avisos: %', sqlerrm; end;
  end if;
  return a;
end; $$;

-- Organizador: cambiar la hora (avisa a quienes van)
create or replace function public.reschedule_plan(p_activity uuid, p_at timestamptz)
returns public.activities
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a public.activities;
begin
  if p_at is null or p_at < now() - interval '10 minutes' then raise exception 'Elige una hora que no haya pasado'; end if;
  update public.activities set scheduled_at = p_at
   where id = p_activity and creator_id = me and status = 'active' returning * into a;
  if not found then raise exception 'Solo quien organiza puede cambiar la hora'; end if;
  begin
    insert into public.notifications (user_id, type, title, body, activity_id)
    select u, 'plan_update', '🕒 Cambió la hora del plan', a.title || ' ahora es ' || to_char(p_at at time zone 'America/Mexico_City', 'DD/MM HH24:MI'), a.id
    from unnest(a.participants) u where u <> me;
  exception when others then raise warning '[reschedule_plan] avisos: %', sqlerrm; end;
  return a;
end; $$;

-- Organizador: cancelar (avisa a quienes van y a los invitados)
create or replace function public.cancel_plan(p_activity uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a public.activities;
begin
  update public.activities set status = 'cancelled'
   where id = p_activity and creator_id = me and status = 'active' returning * into a;
  if not found then raise exception 'Solo quien organiza puede cancelar el plan'; end if;
  begin
    insert into public.notifications (user_id, type, title, body, activity_id)
    select distinct u, 'plan_cancelled', 'Se canceló un plan', a.title || ' se canceló', a.id
    from unnest(a.participants || a.invited) u where u <> me;
  exception when others then raise warning '[cancel_plan] avisos: %', sqlerrm; end;
end; $$;

grant execute on function public.respond_plan(uuid, boolean) to authenticated;
grant execute on function public.reschedule_plan(uuid, timestamptz) to authenticated;
grant execute on function public.cancel_plan(uuid) to authenticated;

-- ====================================================================
-- Plan lleno: aviso de "completo", más lugares, invitar con cupo y
-- lista de espera ("Avísame si se libera")
-- ====================================================================
alter table public.activities add column if not exists waitlist uuid[] not null default '{}';

-- Aviso al primero de la lista de espera cuando se libera un lugar
-- (sale de la lista; si no se une, puede volver a apuntarse)
create or replace function public.wp_plan_notify_spot(a public.activities)
returns void language plpgsql security definer set search_path = public as $$
declare nxt uuid;
begin
  if cardinality(a.waitlist) = 0 or cardinality(a.participants) >= a.max_participants then return; end if;
  nxt := a.waitlist[1];
  update public.activities set waitlist = array_remove(waitlist, nxt) where id = a.id;
  begin
    insert into public.notifications (user_id, type, title, body, activity_id)
    values (nxt, 'plan_spot', '🎟️ Se liberó un cupo', 'Hay cupo en ' || a.title || ' · ¡únete antes que alguien más!', a.id);
  exception when others then raise warning '[plan_spot] %', sqlerrm; end;
end; $$;

-- respond_plan: igual que antes + "¡completo!" y aviso a la lista de espera
create or replace function public.respond_plan(p_activity uuid, p_accept boolean)
returns public.activities
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  a public.activities;
  can_see boolean;
  was_full boolean;
  myname text;
begin
  if me is null then raise exception 'Inicia sesión'; end if;
  select * into a from public.activities where id = p_activity for update;
  if not found or a.status <> 'active' then raise exception 'Este plan ya no está activo'; end if;
  if a.creator_id = me then raise exception 'Eres quien organiza este plan'; end if;
  can_see := a.visibility = 'public' or me = any (a.invited) or me = any (a.participants)
    or (a.visibility = 'followers' and exists (select 1 from public.follows f where f.follower_id = me and f.following_id = a.creator_id));
  if not can_see then raise exception 'No tienes acceso a este plan'; end if;
  select coalesce(nullif(p.name, ''), 'Alguien') into myname from public.profiles p where p.id = me;
  was_full := cardinality(a.participants) >= a.max_participants;

  if p_accept then
    if me = any (a.participants) then return a; end if;
    if was_full then raise exception 'Este plan ya está lleno'; end if;
    update public.activities
       set participants = array_append(participants, me), declined = array_remove(declined, me), waitlist = array_remove(waitlist, me)
     where id = a.id returning * into a;
    begin
      insert into public.notifications (user_id, type, title, body, activity_id)
      values (a.creator_id, 'plan_join', '🙌 Se unieron a tu plan', myname || ' va a ' || a.title, a.id);
      -- ¡Se completó! → aviso a todos los que van
      if cardinality(a.participants) >= a.max_participants then
        insert into public.notifications (user_id, type, title, body, activity_id)
        select u, 'plan_full', '🎉 ¡Plan completo!', 'Ya van ' || cardinality(a.participants) || ' a ' || a.title, a.id
        from unnest(a.participants) u;
      end if;
    exception when others then raise warning '[respond_plan] aviso: %', sqlerrm; end;
  else
    update public.activities
       set participants = array_remove(participants, me),
           declined = case when me = any (declined) then declined else array_append(declined, me) end,
           waitlist = array_remove(waitlist, me)
     where id = a.id returning * into a;
    begin
      insert into public.notifications (user_id, type, title, body, activity_id)
      values (a.creator_id, 'plan_decline', 'Cambio en tu plan', myname || ' no podrá ir a ' || a.title, a.id);
    exception when others then raise warning '[respond_plan] aviso: %', sqlerrm; end;
    if was_full then perform public.wp_plan_notify_spot(a); end if;
  end if;
  return a;
end; $$;

-- Organizador: abrir más lugares (máx. 50)
create or replace function public.add_plan_spots(p_activity uuid, p_n int)
returns public.activities
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a public.activities;
begin
  update public.activities set max_participants = least(50, max_participants + greatest(1, least(coalesce(p_n, 1), 20)))
   where id = p_activity and creator_id = me and status = 'active' returning * into a;
  if not found then raise exception 'Solo quien organiza puede cambiar los cupos'; end if;
  perform public.wp_plan_notify_spot(a);
  select * into a from public.activities where id = p_activity;
  return a;
end; $$;

-- Lista de espera: apuntarme (true) o salirme (false)
create or replace function public.plan_waitlist(p_activity uuid, p_on boolean)
returns public.activities
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a public.activities; can_see boolean;
begin
  if me is null then raise exception 'Inicia sesión'; end if;
  select * into a from public.activities where id = p_activity for update;
  if not found or a.status <> 'active' then raise exception 'Este plan ya no está activo'; end if;
  can_see := a.visibility = 'public' or me = any (a.invited)
    or (a.visibility = 'followers' and exists (select 1 from public.follows f where f.follower_id = me and f.following_id = a.creator_id));
  if not can_see then raise exception 'No tienes acceso a este plan'; end if;
  if me = any (a.participants) then raise exception 'Ya vas a este plan'; end if;
  update public.activities
     set waitlist = case when p_on then (case when me = any (waitlist) then waitlist else array_append(waitlist, me) end) else array_remove(waitlist, me) end
   where id = a.id returning * into a;
  return a;
end; $$;

-- invite_to_plan: ahora revisa el cupo. Plan abierto y sin lugar para los
-- nuevos → error "PLAN_LLENO:<faltan>", salvo con p_expand = true (abre
-- los lugares que hagan falta). En planes "Invitados" el cupo crece solo.
drop function if exists public.invite_to_plan(uuid, uuid[]);
create or replace function public.invite_to_plan(p_activity uuid, p_invited uuid[], p_expand boolean default false)
returns public.activities
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a public.activities; nuevos uuid[]; myname text; pend int; need int;
begin
  select * into a from public.activities where id = p_activity for update;
  if not found or a.creator_id is distinct from me then raise exception 'Solo quien organiza puede invitar'; end if;
  select coalesce(array_agg(distinct u), '{}') into nuevos from unnest(coalesce(p_invited, '{}')) u
   where u <> me and not (u = any (a.invited)) and not (u = any (a.participants))
     and exists (select 1 from public.follows f where f.follower_id = me and f.following_id = u);
  if cardinality(a.invited) + cardinality(nuevos) > 20 then raise exception 'Máximo 20 invitados por plan'; end if;
  -- invitados que aún no responden (ocupan lugar si aceptan)
  select count(*) into pend from unnest(a.invited) u where not (u = any (a.participants)) and not (u = any (a.declined));
  need := cardinality(a.participants) + pend + cardinality(nuevos);
  if need > a.max_participants and a.visibility <> 'invited' and not coalesce(p_expand, false) then
    raise exception 'PLAN_LLENO:%', need - a.max_participants;
  end if;
  update public.activities set invited = invited || nuevos, max_participants = least(50, greatest(max_participants, need))
   where id = a.id returning * into a;
  if cardinality(nuevos) > 0 then
    select coalesce(nullif(p.name, ''), 'Alguien') into myname from public.profiles p where p.id = me;
    begin
      insert into public.notifications (user_id, type, title, body, activity_id)
      select u, 'plan_invite', '📅 Te invitaron a un plan', myname || ' te invitó: ' || a.title, a.id from unnest(nuevos) u;
    exception when others then raise warning '[invite_to_plan] avisos: %', sqlerrm; end;
  end if;
  return a;
end; $$;

-- Organizador: fijar el cupo (subir o bajar). No baja de los que ya van.
-- "Cerrar el plan" = cupo igual a los que van → queda Completo.
create or replace function public.set_plan_cupo(p_activity uuid, p_max int)
returns public.activities
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a public.activities; going int; was_full boolean; nmax int;
begin
  select * into a from public.activities where id = p_activity for update;
  if not found or a.creator_id is distinct from me or a.status <> 'active' then raise exception 'Solo quien organiza puede cambiar los cupos'; end if;
  going := cardinality(a.participants);
  if p_max is null or p_max < going then raise exception 'Ya van %: el cupo no puede ser menor', going; end if;
  nmax := least(50, greatest(1, p_max));
  was_full := going >= a.max_participants;
  update public.activities set max_participants = nmax where id = a.id returning * into a;
  if not was_full and going >= nmax and going > 1 then
    begin
      insert into public.notifications (user_id, type, title, body, activity_id)
      select u, 'plan_full', '🎉 ¡Plan completo!', 'Ya van ' || going || ' a ' || a.title, a.id
      from unnest(a.participants) u where u <> me;
    exception when others then raise warning '[set_plan_cupo] aviso: %', sqlerrm; end;
  end if;
  if nmax > going then perform public.wp_plan_notify_spot(a); select * into a from public.activities where id = p_activity; end if;
  return a;
end; $$;

revoke all on function public.wp_plan_notify_spot(public.activities) from public;
grant execute on function public.set_plan_cupo(uuid, int) to authenticated;
grant execute on function public.respond_plan(uuid, boolean) to authenticated;
grant execute on function public.add_plan_spots(uuid, int) to authenticated;
grant execute on function public.plan_waitlist(uuid, boolean) to authenticated;
grant execute on function public.invite_to_plan(uuid, uuid[], boolean) to authenticated;
