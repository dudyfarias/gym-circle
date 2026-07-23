# Running Workout Data Model — 2026-07-23

## Resumo executivo

A Sprint B adota um modelo híbrido:

- `workout_plans` continua sendo a identidade comum de um treino salvo;
- `workout_plans.exercises` permanece intacto como contrato de musculação;
- os metadados genéricos ficam em `workout_plans`;
- blocos estruturados de corrida ficam normalizados em
  `workout_plan_steps`;
- `activities` e os snapshots atuais não são alterados nesta sprint.

Isso evita dois modelos concorrentes de treino salvo, mas também evita encaixar
intervalos, pace e recuperação no JSONB de exercícios de força.

## Auditoria do modelo atual

Em produção, antes desta migration, `workout_plans` possui:

- `id`;
- `user_id`;
- `name`;
- `exercises jsonb`;
- `created_at`;
- `updated_at`;
- `plan_version`;
- `is_favorite`.

`exercises` guarda a prescrição de força e é consumido por
`useWorkoutPlans`, `WorkoutPlansFab` e pelo início de musculação. Activities
podem guardar `workout_plan_id`, nome, exercícios e versão como snapshot. A
exclusão do plano não apaga o snapshot histórico já salvo na activity.

O fluxo atual de OCR também produz exercícios de força. Reutilizá-lo diretamente
para corrida criaria um segundo formato implícito dentro de `exercises`.

## Alternativas consideradas

### Apenas JSONB em workout_plans

Tem escrita simples, mas dificulta RLS granular, ordenação segura, validação,
analytics de blocos, edição parcial e futura execução guiada.

### Tabela running_workout_plans separada

Isola o esporte, mas duplica identidade, favoritos, ownership, versionamento e
futuros relacionamentos com templates e assignments.

### Modelo híbrido escolhido

`workout_plans` recebe os campos aditivos:

- `sport_type`;
- `level`;
- `goal`;
- `description`;
- `estimated_duration_s`;
- `estimated_distance_m`;
- `source`;
- `source_metadata`;
- `structure_revision`.

Planos existentes recebem `sport_type = strength`; não há backfill de
`exercises` nem mudança no seu conteúdo.

## workout_plan_steps

Cada linha representa um bloco ordenado:

- identidade e ordem: `id`, `workout_plan_id`, `position`;
- prescrição: `step_type`, `title`, `instructions`, `repetitions`,
  `repetitions_min`, `repetitions_max`;
- alvo exato: `target_basis`, `distance_m`, `duration_s`;
- alvo em faixa: `distance_min_m`, `distance_max_m`, `duration_min_s`,
  `duration_max_s`;
- intensidade: `pace_min_s_per_km`, `pace_max_s_per_km`,
  `heart_rate_zone`, `target_effort`;
- recuperação: `recovery_type`, `recovery_duration_s`,
  `recovery_distance_m`;
- extensão controlada: `metadata`;
- auditoria: `created_at`, `updated_at`.

Unidades canônicas:

- distância em metros;
- duração em segundos;
- pace em segundos por quilômetro;
- zona cardíaca inteira de 1 a 5;
- esforço de 1 a 10.

`(workout_plan_id, position)` é único e diferível, permitindo reordenar todos
os blocos em uma operação atômica sem posições temporárias inválidas.

## Validação

O domínio TypeScript e o banco validam:

- plano não vazio;
- título obrigatório;
- repetições maiores ou iguais a 1;
- ranges completos, positivos e ordenados;
- valor escolhido de repetições dentro do range preservado;
- alvo exato e range da mesma unidade não coexistem;
- distâncias, durações e pace positivos;
- faixa de pace em ordem canônica;
- zona de 1 a 5;
- esforço de 1 a 10;
- recuperação somente entre repetições;
- alvo aberto apenas para blocos `free` e `drill`;
- metadata sempre como objeto;
- posições únicas.

O editor normaliza posições, espaços, valores opcionais e pace invertido antes
de persistir. Valores derivados são apresentados como aproximação.

Ranges preservam prescrições como `3–5 min`, `3 × 30–40 s` e `3–4
exercícios`. A estimativa guarda mínimo, máximo e um valor central apenas para
ordenação/resumo; a UI mostra a faixa para não criar falsa precisão.

## RLS, grants e RPCs

`workout_plan_steps` tem RLS owner-only, sem leitura pública. Authenticated
recebe apenas `SELECT` direto; escritas são atômicas por:

- `save_running_workout_plan`;
- `duplicate_running_workout_plan`;
- `reorder_running_workout_plan_steps`.

Todas as RPCs:

- obtêm o owner de `auth.uid()`;
- não recebem autoria do client;
- usam `SECURITY DEFINER` com `search_path = ''`;
- usam nomes qualificados;
- revogam execução de `public` e `anon`;
- retornam erro quando o plano não pertence ao usuário.

Um trigger impede que o client autenticado forje diretamente `sport_type`,
`source`, estimates ou revisão estrutural. O CRUD legado de nome, exercícios e
favorito da musculação permanece disponível.

## Compatibilidade

- nenhum campo existente é removido;
- `exercises` permanece com o mesmo default e significado;
- planos de força continuam consultados pelo fluxo existente;
- a nova lista filtra `sport_type = run`;
- activities e seus snapshots não mudam;
- feed, GPS e importação atual não são alterados;
- a migration não foi aplicada nesta sprint.

## Migration

Arquivo:

`supabase/migrations/20260723191546_running_workout_data_model.sql`

É aditiva, mas depende das migrations já publicadas que criaram
`workout_plans`, `plan_version`, `is_favorite`, schema `private` e o trigger de
versionamento. Precisa de um release gate separado com reconciliação do
histórico remoto antes de ser aplicada.
