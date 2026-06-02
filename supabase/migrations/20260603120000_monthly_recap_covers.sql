-- Sprint 5.5 — Monthly Recap user-picked covers.
--
-- Profile JSONB column que armazena qual post o user escolheu como capa
-- do recap mensal de cada mês. Quando ausente para um mês específico,
-- o builder do recap cai pro auto-pick (primeiro post de imagem do mês).
--
-- Shape: { "YYYY-MM": "post_uuid", ... }
-- Exemplo: { "2026-05": "abc-123", "2026-04": "def-456" }
--
-- RLS: profiles já tem políticas que permitem update apenas do próprio
-- row. Sem mudança necessária.

alter table public.profiles
  add column if not exists monthly_recap_covers jsonb not null default '{}'::jsonb;

comment on column public.profiles.monthly_recap_covers is
  'User-picked cover post per monthly recap. Shape: { "YYYY-MM": "post_uuid", ... }. When key absent for a given month, recap builder falls back to auto-pick (first image post of the month).';
