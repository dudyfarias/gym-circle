-- Sprint 7C.1 — Contextual Motion Onboarding foundation.
--
-- Persiste quais hints contextuais o user já viu (e quando), pra que o
-- mesmo hint não reapareça em outro device. Estrutura:
--
--   { "hintId": "2026-06-03T15:30:00.000Z", ... }
--
-- Cada chave é o id do hint (ex: "myCircle-firstVisit", "profile-addBio"),
-- valor é o timestamp ISO de quando foi dispensado. Time é guardado pra
-- analytics futura ("quanto tempo entre signup e primeiro hint dismiss?").
--
-- Sem migration nova: usa a coluna JSONB free-form, sem schema rígido.
-- Frontend faz merge incremental via jsonb_set ou rewrite total.
--
-- Mirrors o pattern da Sprint 5.5a (monthly_recap_covers JSONB).

alter table public.profiles
  add column if not exists contextual_hints_seen jsonb not null default '{}'::jsonb;

comment on column public.profiles.contextual_hints_seen is
  'Hints contextuais já dispensados pelo user. Shape: { "hintId": "ISO8601", ... }. Sprint 7C.1 — Contextual Motion Onboarding. localStorage é a fonte primária; este JSONB é o sync cross-device best-effort.';
