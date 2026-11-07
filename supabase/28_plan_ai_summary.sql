-- ====================================================================
-- WHATSPLAN — 28_plan_ai_summary.sql
-- Resumen del plan hecho con IA (Groq, /api/groq-description?mode=plan):
-- se guarda en el plan para no volver a generarlo. ai_summary_sig es la
-- "firma" (lugares + horario + nombre): si el plan cambia, se regenera.
-- Para cobrarlo después: profiles.is_pro + PLAN_SUMMARY_PAID_ONLY=1 en Vercel.
-- Se puede correr más de una vez.
-- ====================================================================

alter table public.activities add column if not exists ai_summary     text;
alter table public.activities add column if not exists ai_summary_sig text;
alter table public.activities add column if not exists ai_summary_at  timestamptz;

alter table public.profiles add column if not exists is_pro boolean not null default false;
