#!/usr/bin/env node
/**
 * Gerador de migration de desafios mensais.
 *
 * Uso:
 *   node scripts/generate-monthly-challenges.mjs 2026-08
 *
 * Gera supabase/migrations/<timestamp>_seed_monthly_challenges_<período>.sql
 * com o ESQUELETO dos 4 desafios (easy/medium/hard/legendary) no padrão
 * idempotente (guard por period_key — re-aplicar não duplica nem apaga
 * progresso). Edite títulos/descrições/temas antes de aplicar.
 *
 * Regras de segurança embutidas:
 *   - Só goal kinds IMPLEMENTADOS no recompute (monthlyChallenges.ts):
 *     workouts_in_month, workout_type_specific, group_workouts,
 *     distinct_types. streak_in_month/perfect_month são REJEITADOS
 *     até serem implementados (bug B4 do bug-audit).
 *   - Aplicação em produção é manual e exige OK explícito do Eduardo.
 *
 * Processo completo: docs/monthly-challenges-process.md
 */

import { writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const IMPLEMENTED_GOAL_KINDS = new Set([
  "workouts_in_month",
  "workout_type_specific",
  "group_workouts",
  "distinct_types",
  // Sprint 17 (B4) — implementados no recompute; liberados no gerador.
  "streak_in_month",
  "perfect_month",
  // Desafio Popstar — N mídias num único post (carrossel).
  "media_count_in_post",
]);

const period = process.argv[2];
if (!period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
  console.error("Uso: node scripts/generate-monthly-challenges.mjs YYYY-MM");
  process.exit(1);
}

const [year, month] = period.split("-").map(Number);
const lastDay = new Date(year, month, 0).getDate();
const startDate = `${period}-01`;
const endDate = `${period}-${String(lastDay).padStart(2, "0")}`;

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(repoRoot, "supabase", "migrations");

// Evita seed duplicado pro mesmo período
const dup = readdirSync(migrationsDir).find((f) =>
  f.includes(`seed_monthly_challenges_${period.replace("-", "_")}`) ||
  f.includes(`seed_monthly_challenges_${period}`),
);
if (dup) {
  console.error(`Já existe migration de seed pra ${period}: ${dup}`);
  process.exit(1);
}

// Esqueleto — EDITAR títulos/descrições/temas antes de aplicar.
const challenges = [
  {
    slug: "easy-placeholder",
    title_pt: "EDITAR — desafio fácil",
    title_en: "EDIT — easy challenge",
    description_pt: `Treine 8 dias em ${period}.`,
    description_en: `Train 8 days in ${period}.`,
    difficulty: "easy",
    rarity: "common",
    goal_kind: "workouts_in_month",
    goal_target: 8,
    is_secret: false,
    goal_config: "{}",
  },
  {
    slug: "medium-placeholder",
    title_pt: "EDITAR — desafio médio (secreto)",
    title_en: "EDIT — medium challenge (secret)",
    description_pt: "Publique 3 treinos de TIPO.",
    description_en: "Post 3 TYPE workouts.",
    difficulty: "medium",
    rarity: "uncommon",
    goal_kind: "workout_type_specific",
    goal_target: 3,
    is_secret: true,
    goal_config: '{"workout_type": "EDITAR"}',
  },
  {
    slug: "hard-placeholder",
    title_pt: "EDITAR — desafio difícil",
    title_en: "EDIT — hard challenge",
    description_pt: "Treine com amigos 4 vezes.",
    description_en: "Work out with friends 4 times.",
    difficulty: "hard",
    rarity: "epic",
    goal_kind: "group_workouts",
    goal_target: 4,
    is_secret: false,
    goal_config: "{}",
  },
  {
    slug: "legendary-placeholder",
    title_pt: "EDITAR — desafio lendário (secreto)",
    title_en: "EDIT — legendary challenge (secret)",
    description_pt: "Varie em 5 modalidades diferentes.",
    description_en: "Vary across 5 different workout types.",
    difficulty: "legendary",
    rarity: "legendary",
    goal_kind: "distinct_types",
    goal_target: 5,
    is_secret: true,
    goal_config: "{}",
  },
];

for (const c of challenges) {
  if (!IMPLEMENTED_GOAL_KINDS.has(c.goal_kind)) {
    console.error(
      `goal_kind "${c.goal_kind}" NÃO está implementado no recompute ` +
        "(monthlyChallenges.ts) — desafio ficaria travado em 0 pra sempre.",
    );
    process.exit(1);
  }
}

const esc = (s) => s.replaceAll("'", "''");
const values = challenges
  .map(
    (c) => `    (
      '${period}',
      '${esc(c.title_pt)}',
      '${esc(c.title_en)}',
      '${esc(c.description_pt)}',
      '${esc(c.description_en)}',
      '${c.difficulty}',
      '${c.rarity}',
      '${c.goal_kind}',
      ${c.goal_target},
      '${startDate}',
      '${endDate}',
      'trophy:${c.slug}-${period}',
      ${c.is_secret},
      '${c.goal_config}'::jsonb
    )`,
  )
  .join(",\n");

const now = new Date();
const ts =
  now.toISOString().slice(0, 10).replaceAll("-", "") +
  String(now.getHours()).padStart(2, "0") +
  String(now.getMinutes()).padStart(2, "0") +
  "00";
const filename = `${ts}_seed_monthly_challenges_${period.replace("-", "_")}.sql`;

const sql = `-- Seed dos 4 desafios de ${period} (gerado por scripts/generate-monthly-challenges.mjs).
-- EDITE títulos/descrições/temas antes de aplicar. Processo:
-- docs/monthly-challenges-process.md. Aplicação em produção SÓ com OK explícito.
--
-- Idempotente: guard por period_key — re-aplicar não duplica nem apaga progresso.

do $$
begin
  if exists (
    select 1 from public.monthly_challenges where period_key = '${period}'
  ) then
    raise notice 'Desafios de ${period} já existem — seed ignorado.';
    return;
  end if;

  insert into public.monthly_challenges (
    period_key, title_pt, title_en, description_pt, description_en,
    difficulty, rarity, goal_kind, goal_target, start_date, end_date, trophy_id,
    is_secret, goal_config
  ) values
${values};
end $$;
`;

const outPath = join(migrationsDir, filename);
if (existsSync(outPath)) {
  console.error(`Arquivo já existe: ${filename}`);
  process.exit(1);
}
writeFileSync(outPath, sql);
console.log(`Migration gerada: supabase/migrations/${filename}`);
console.log("Próximos passos: editar temas → revisar → aplicar com OK do Eduardo.");
