-- ════════════════════════════════════════════════════════════════════
-- 39 · Discover: el feed para descubrir gente y planes
-- Se puede correr varias veces. Requiere 24, 35 y 38.
--  · profiles.discoverable (por defecto sí): si lo apagas no apareces en
--    "Quizá conozcas", "Nuevos" ni en la búsqueda de Discover (tu perfil
--    sigue abierto para quien lo tenga por liga o ya te siga).
--  · discover_feed(): { plans, suggested, newest } en una sola consulta.
--      plans      planes públicos (o de quien sigues / a los que te invitaron)
--                 de los próximos 14 días, con lugar, quién organiza y cupo.
--      suggested  gente que quizá conozcas: te siguen y no los sigues, o
--                 los siguen amigos tuyos, o fueron a un plan contigo;
--                 con el motivo ("Te sigue", "3 en común"…).
--      newest     los últimos en registrarse.
--  · discover_search(q): gente (nombre / @usuario) y planes (título / lugar).
--  Nunca salen quienes bloqueaste ni quienes te bloquearon.
-- ════════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists discoverable boolean not null default true;

create or replace function public.wp_discover_people(p_ids uuid[])
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', coalesce(nullif(p.name, ''), case when p.username is not null then '@' || p.username end),
      'username', p.username, 'avatar_url', p.avatar_url,
      'i_follow', public.wp_follows(auth.uid(), p.id)) order by u.n), '[]'::jsonb)
  from unnest(p_ids) with ordinality u(id, n) join public.profiles p on p.id = u.id;
$$;

create or replace function public.discover_feed()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); plans jsonb; sugg jsonb; newest jsonb;
begin
  if me is null then raise exception 'Inicia sesión'; end if;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into plans from (
    select a.id, a.title, a.place_name, a.place_id, a.lat, a.lng, a.scheduled_at, a.icon_url, a.max_participants,
           cardinality(coalesce(a.participants, '{}')) as going,
           a.creator_id, coalesce(nullif(c.name, ''), case when c.username is not null then '@' || c.username end) as creator_name,
           c.avatar_url as creator_avatar,
           (me = any(coalesce(a.participants, '{}'))) as i_go
    from public.activities a
    left join public.profiles c on c.id = a.creator_id
    where a.status = 'active'
      and a.scheduled_at between now() and now() + interval '14 days'
      and a.creator_id <> me
      and not public.wp_blocked_between(me, a.creator_id)
      and (a.visibility = 'public' or me = any(coalesce(a.invited, '{}'))
           or (a.visibility = 'followers' and public.wp_follows(me, a.creator_id)))
    order by a.scheduled_at
    limit 20
  ) t;

  select public.wp_discover_people(coalesce(array_agg(s.id order by s.score desc, s.id), '{}')) into sugg from (
    select c.id, sum(c.w) as score from (
      select f.follower_id as id, 3 as w from public.follows f where f.following_id = me           -- te siguen
      union all
      select f2.following_id, 2 from public.follows f1 join public.follows f2 on f2.follower_id = f1.following_id
        where f1.follower_id = me                                                                   -- los siguen tus amigos
      union all
      select u, 1 from public.activities a, unnest(coalesce(a.participants, '{}')) u
        where me = any(coalesce(a.participants, '{}'))                                              -- fueron a un plan contigo
    ) c
    join public.profiles p on p.id = c.id
    where c.id <> me and p.discoverable and not public.wp_follows(me, c.id) and not public.wp_blocked_between(me, c.id)
    group by c.id order by sum(c.w) desc limit 12
  ) s;

  select public.wp_discover_people(coalesce(array_agg(n.id order by n.ts desc), '{}')) into newest from (
    select p.id, coalesce((to_jsonb(p)->>'created_at')::timestamptz, '-infinity') as ts
    from public.profiles p
    where p.id <> me and p.discoverable and coalesce(nullif(p.name, ''), p.username) is not null
      and not public.wp_follows(me, p.id) and not public.wp_blocked_between(me, p.id)
      and (to_jsonb(p)->>'created_at') is not null
    order by ts desc limit 12
  ) n;

  return jsonb_build_object('plans', plans, 'suggested', coalesce(sugg, '[]'::jsonb), 'newest', coalesce(newest, '[]'::jsonb));
end; $$;
grant execute on function public.discover_feed() to authenticated;

create or replace function public.discover_search(p_q text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); q text := lower(trim(coalesce(p_q, ''))); ppl jsonb; pl jsonb;
begin
  if me is null then raise exception 'Inicia sesión'; end if;
  if char_length(q) < 2 then return jsonb_build_object('people', '[]'::jsonb, 'plans', '[]'::jsonb); end if;
  q := replace(replace(replace(q, '\', ''), '%', ''), '_', '');

  select public.wp_discover_people(coalesce(array_agg(x.id order by x.rk, x.nm), '{}')) into ppl from (
    select p.id, coalesce(p.name, p.username, '') as nm,
           case when lower(coalesce(p.username, '')) = ltrim(q, '@') then 0 when lower(coalesce(p.name, '')) like q || '%' then 1 else 2 end as rk
    from public.profiles p
    where p.id <> me and not public.wp_blocked_between(me, p.id)
      and (p.discoverable or public.wp_follows(me, p.id) or lower(coalesce(p.username, '')) = ltrim(q, '@'))
      and (lower(coalesce(p.name, '')) like '%' || q || '%' or lower(coalesce(p.username, '')) like '%' || ltrim(q, '@') || '%')
    order by 3, 2 limit 15
  ) x;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into pl from (
    select a.id, a.title, a.place_name, a.place_id, a.lat, a.lng, a.scheduled_at, a.icon_url, a.max_participants,
           cardinality(coalesce(a.participants, '{}')) as going, a.creator_id,
           coalesce(nullif(c.name, ''), case when c.username is not null then '@' || c.username end) as creator_name, c.avatar_url as creator_avatar,
           (me = any(coalesce(a.participants, '{}'))) as i_go
    from public.activities a left join public.profiles c on c.id = a.creator_id
    where a.status = 'active' and a.scheduled_at > now() and not public.wp_blocked_between(me, a.creator_id)
      and (a.visibility = 'public' or a.creator_id = me or me = any(coalesce(a.invited, '{}')) or me = any(coalesce(a.participants, '{}'))
           or (a.visibility = 'followers' and public.wp_follows(me, a.creator_id)))
      and (lower(coalesce(a.title, '')) like '%' || q || '%' or lower(coalesce(a.place_name, '')) like '%' || q || '%')
    order by a.scheduled_at limit 15
  ) t;

  return jsonb_build_object('people', coalesce(ppl, '[]'::jsonb), 'plans', pl);
end; $$;
grant execute on function public.discover_search(text) to authenticated;
