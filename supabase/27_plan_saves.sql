-- ====================================================================
-- WHATSPLAN — 27_plan_saves.sql
-- Planes guardados: cualquiera puede guardar un plan de "Planes aquí"
-- para ir después y verlo en su perfil ("Planes guardados").
-- Solo tú ves y cambias tus guardados (RLS). Si el plan se borra, se
-- borra también de tus guardados. Se puede correr más de una vez.
-- ====================================================================

create table if not exists public.plan_saves (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, activity_id)
);
create index if not exists plan_saves_user_idx on public.plan_saves (user_id, created_at desc);

alter table public.plan_saves enable row level security;

drop policy if exists plan_saves_select on public.plan_saves;
create policy plan_saves_select on public.plan_saves for select to authenticated using (user_id = auth.uid());
drop policy if exists plan_saves_insert on public.plan_saves;
create policy plan_saves_insert on public.plan_saves for insert to authenticated with check (user_id = auth.uid());
drop policy if exists plan_saves_delete on public.plan_saves;
create policy plan_saves_delete on public.plan_saves for delete to authenticated using (user_id = auth.uid());

grant select, insert, delete on public.plan_saves to authenticated;
