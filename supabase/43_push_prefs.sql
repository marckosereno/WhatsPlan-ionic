-- ════════════════════════════════════════════════════════════════════
-- WHATSPLAN — 43_push_prefs.sql
-- Preferencias de avisos push. Reejecutable.
--  · push_prefs: por persona, la lista de categorías APAGADAS (vacía = todo
--    encendido). Categorías: chat, mentions, joins, invites, changes,
--    reminders, social
--  · push_prefs_get() / push_prefs_set(p_off): solo la propia persona
--  · la Edge Function (service role) las lee antes de mandar cada push
--  Solo afecta al push: la campanita sigue mostrando todo.
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.push_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  off text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.push_prefs enable row level security;
drop policy if exists push_prefs_none on public.push_prefs;
create policy push_prefs_none on public.push_prefs for select using (false);   -- solo por las funciones

create or replace function public.push_prefs_get()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce((select off from public.push_prefs where user_id = auth.uid()), '{}');
$$;

create or replace function public.push_prefs_set(p_off text[])
returns text[] language plpgsql security definer set search_path = public as $$
declare clean text[];
begin
  if auth.uid() is null then raise exception 'sin sesión'; end if;
  select coalesce(array_agg(distinct x), '{}') into clean
    from unnest(coalesce(p_off, '{}')) x
   where x in ('chat', 'mentions', 'joins', 'invites', 'changes', 'reminders', 'social');
  insert into public.push_prefs (user_id, off, updated_at) values (auth.uid(), clean, now())
  on conflict (user_id) do update set off = excluded.off, updated_at = now();
  return clean;
end; $$;

revoke all on function public.push_prefs_get() from public, anon;
revoke all on function public.push_prefs_set(text[]) from public, anon;
grant execute on function public.push_prefs_get() to authenticated;
grant execute on function public.push_prefs_set(text[]) to authenticated;
