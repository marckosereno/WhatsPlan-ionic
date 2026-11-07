-- ====================================================================
-- WHATSPLAN — 30_rename_plan.sql
-- Cambiar el nombre del plan (solo quien organiza, plan activo).
-- 3 a 60 caracteres. Avisa a los que van. Se puede correr varias veces.
-- ====================================================================
create or replace function public.rename_plan(p_activity uuid, p_title text)
returns public.activities
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a public.activities; t text := left(regexp_replace(trim(coalesce(p_title, '')), '\s+', ' ', 'g'), 60);
begin
  if char_length(t) < 3 then raise exception 'El nombre es muy corto'; end if;
  update public.activities set title = t
   where id = p_activity and creator_id = me and status = 'active' returning * into a;
  if not found then raise exception 'Solo quien organiza puede cambiar el nombre'; end if;
  begin
    insert into public.notifications (user_id, type, title, body, activity_id)
    select u, 'plan_update', '✏️ El plan cambió de nombre', 'Ahora se llama ' || a.title, a.id
    from unnest(a.participants) u where u <> me;
  exception when others then raise warning '[rename_plan] aviso: %', sqlerrm; end;
  return a;
end; $$;
grant execute on function public.rename_plan(uuid, text) to authenticated;
