# Processo mensal — Desafios do Gym Circle

> Criado na Sprint 16 (11/jun/2026) depois que julho quase ficou sem desafios.
> Sem este processo, no dia 1 do mês os desafios SOMEM do MyCircle e do Hall.

## Checklist (todo dia 25 do mês)

1. **Gerar o esqueleto**: `node scripts/generate-monthly-challenges.mjs YYYY-MM`
2. **Editar a migration gerada**: temas brasileiros do mês (datas culturais,
   esporte, estação), títulos PT+EN, descrições com personalidade.
3. **Regras fixas** (o gerador valida a 1ª; revise as demais):
   - Goal kinds implementados (Sprint 17 liberou os 2 últimos):
     `workouts_in_month`, `workout_type_specific`, `group_workouts`,
     `distinct_types`, `streak_in_month` (sequência consecutiva no mês) e
     `perfect_month` (seed deve definir goal_target = nº de dias do mês).
   - 4 desafios: easy (público) / medium (secreto) / hard (público) / legendary (secreto).
   - `workout_type_specific`: o matching é fuzzy (sem acento, case-insensitive,
     `includes`) e considera TODAS as tags do post. Tipos fora dos chips
     (futebol, tênis…) são alcançáveis via "Outro" — ok pra secretos.
   - `trophy_id` único: `trophy:<slug>-<período>`.
   - Datas: dia 1 → último dia do mês.
4. **Commit** da migration no main (não aplica nada sozinho).
5. **Aplicar em produção** — SÓ com OK explícito do Eduardo
   (`supabase db push` ou MCP apply_migration). A migration é idempotente
   (guard por period_key): re-aplicar não duplica nem apaga progresso.
6. **Smoke** no dia 1: abrir MyCircle → desafios novos visíveis; secretos como "???".

## Histórico

| Período | Migration | Tema | Aplicada em prod |
|---------|-----------|------|------------------|
| 2026-06 | `20260603160400` + replace `20260603160800` | Festa Junina / Roland Garros / Brasileirão / pré-LA 2028 | ✅ 03/jun |
| 2026-07 | `20260611120000` | Copa do Mundo 2026 (final 19/jul) / férias / inverno | ✅ 11/jun (OK do Eduardo) |

## Automação futura (anotado, não feito)

Edge Function agendada (cron) que gera o rollover automaticamente — fica para
quando houver mais de um administrador. Por ora o processo manual + gerador é
suficiente e mantém o controle editorial dos temas.
