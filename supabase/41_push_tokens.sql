-- ════════════════════════════════════════════════════════════════════
-- WHATSPLAN — 41_push_tokens.sql
-- Push nativo: tokens de FCM por teléfono. Reejecutable.
--  · push_register(token, platform): guarda/reasigna el token a quien
--    tiene la sesión (un teléfono = una cuenta a la vez)
--  · push_unregister(token): al cerrar sesión; no pide sesión (ya se cerró)
--  · la tabla no se toca directo desde la app: solo la Edge Function (service role)
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.push_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  platform    text not null default 'android' check (platform in ('android','ios','web')),
  updated_at  timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
drop policy if exists push_tokens_none on public.push_tokens;
create policy push_tokens_none on public.push_tokens for select using (false);

create or replace function public.push_register(p_token text, p_platform text default 'android')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(p_token, '') = '' then return; end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), case when p_platform in ('android','ios','web') then p_platform else 'android' end, now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

create or replace function public.push_unregister(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_tokens where token = p_token;
$$;

grant execute on function public.push_register(text, text) to authenticated;
grant execute on function public.push_unregister(text) to anon, authenticated;
