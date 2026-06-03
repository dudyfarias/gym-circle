-- Sprint 7.5.1 — Achievements equipados pra mostrar como "Conquistas em
-- Destaque" no perfil (Section 13 do brief).
--
-- Shape: array de até 3 achievement_ids ordenado por prioridade do user.
-- Frontend valida que cada ID corresponde a achievement já ganho (cross-
-- ref com user_achievements). Default array vazio.
--
-- Aditivo, sem RLS extra — já coberta pelo policy existente da profiles.
-- Sigue padrão da Sprint 5.5a (monthly_recap_covers) e Sprint 7C.1
-- (contextual_hints_seen) — JSONB livre, key-agnóstico.

alter table public.profiles
  add column if not exists featured_achievements jsonb not null default '[]'::jsonb;

comment on column public.profiles.featured_achievements is
  'Sprint 7.5 — Array de até 3 achievement_ids equipados pra mostrar no perfil. Shape: ["relic:circle-master", "trophy:perfect-month", "medal:streak-7"]. Frontend valida que cada ID está em user_achievements do user.';
