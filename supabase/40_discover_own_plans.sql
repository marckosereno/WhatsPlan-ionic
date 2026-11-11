-- ════════════════════════════════════════════════════════════════════
-- WHATSPLAN — 40_discover_own_plans.sql
-- Discover: "Planes para hoy" y "Planes más cercanos" ahora incluyen
-- TUS planes (antes se excluían) y los que ya empezaron hace menos de
-- 2 horas ("Ahora"), igual que la pestaña Planes. Reejecutable.
-- ════════════════════════════════════════════════════════════════════

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
      and a.scheduled_at between now() - interval '2 hours' and now() + interval '14 days'
      and not public.wp_blocked_between(me, a.creator_id)
      and (a.creator_id = me or a.visibility = 'public' or me = any(coalesce(a.invited, '{}'))
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
