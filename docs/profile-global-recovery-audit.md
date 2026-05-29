# Gym Circle Global Profile Recovery Audit

Data: 2026-05-20
Projeto Supabase: `qajjpjmybmqqwflytcpr`
Modo: investigação global read-only. Nenhum dado de produção foi alterado.

## Resumo Executivo

Foi aberto um incidente crítico de possível perda/sobrescrita de campos de perfil para todos os usuários.

O banco atual não possui `profiles.updated_at`, `profile_change_history` ou qualquer tabela de auditoria de alterações em `profiles`. Por isso, o estado atual sozinho não permite saber exatamente quais campos existiam antes e foram sobrescritos.

O Supabase CLI confirmou:

- Projeto remoto correto: `qajjpjmybmqqwflytcpr`
- Backups físicos disponíveis.
- PITR: `false`
- WAL-G/physical backup: `true`

Conclusão operacional:

- Não é seguro aplicar qualquer recuperação automática agora.
- Para saber "quantos tinham bio antes", "quantos tinham instagram antes", etc., precisamos restaurar/exportar um backup físico anterior ao bug em ambiente separado.
- O script seguro foi preparado em `supabase/admin/recover_profiles_from_snapshot.sql`, mas não foi aplicado.
- O script depende de uma staging table `private.profile_recovery_snapshot` preenchida com dados de um backup confiável.
- O restore isolado do backup físico ainda não foi executado porque as ferramentas disponíveis não expõem uma restauração de backup físico para uma branch/ambiente separado. O CLI mostra `branches create --with-data`, mas isso clona o estado atual, não um backup antigo. O CLI também mostra `backups restore`, mas o projeto está com `pitr_enabled: false` e esse caminho não deve ser usado contra produção.

## Backups Disponíveis

`npx supabase backups list --project-ref qajjpjmybmqqwflytcpr --output json`

Backups físicos encontrados:

| Backup ID | Inserted At UTC | Status |
| --- | --- | --- |
| `726595745` | `2026-05-20T11:38:42.143Z` | `COMPLETED` |
| `720230454` | `2026-05-19T11:38:23.157Z` | `COMPLETED` |
| `713852372` | `2026-05-18T11:37:48.494Z` | `COMPLETED` |
| `707582004` | `2026-05-17T11:37:02.144Z` | `COMPLETED` |
| `700767397` | `2026-05-16T11:40:12.374Z` | `COMPLETED` |
| `695196493` | `2026-05-15T11:39:40.630Z` | `COMPLETED` |
| `688932924` | `2026-05-14T11:39:36.267Z` | `COMPLETED` |
| `683452638` | `2026-05-13T16:18:56.834Z` | `COMPLETED` |
| `682743034` | `2026-05-13T11:33:46.358Z` | `COMPLETED` |

PITR está desativado (`pitr_enabled: false`), então `supabase backups restore --timestamp` não deve ser usado contra produção.

Snapshot candidato inicial:

- `2026-05-19T11:38:23.157Z`, se o incidente de sobrescrita ocorreu depois disso.

Se esse snapshot já estiver afetado, testar snapshots anteriores em ordem:

1. `2026-05-18T11:37:48.494Z`
2. `2026-05-17T11:37:02.144Z`
3. `2026-05-16T11:40:12.374Z`
4. `2026-05-15T11:39:40.630Z`
5. `2026-05-14T11:39:36.267Z`
6. `2026-05-13T16:18:56.834Z`

Importante: restaurar backup físico no projeto atual pode ser destrutivo. A restauração/comparação deve acontecer em ambiente separado ou com suporte/dashboard da Supabase.

## Estado Atual dos Perfis

Escopo da contagem: `profiles.account_status = 'active'` e `deleted_at is null`.

Total de perfis ativos atuais: `22`

| Campo | Preenchidos agora | Vazios agora |
| --- | ---: | ---: |
| `bio` | 2 | 20 |
| `instagram_username` | 3 | 19 |
| `birth_date` | 3 | 19 |
| `sports` | 3 | 19 |
| `preferred_training_times` | 3 | 19 |
| `main_gym_id` | 7 | 15 |
| `fitness_goal` | 8 | 14 |
| `avatar_url` | 8 | 14 |

Sinais auxiliares atuais:

- Perfis com `main_gym_id` vazio mas `user_gyms.is_main = true`: `0`
- Perfis com `avatar_url` vazio mas objetos em `storage.avatars/{user_id}/...`: `0`
- Perfis com `main_gym_id` vazio mas posts existentes: `5`
- Perfis com `sports` vazio mas posts existentes: `9`
- Perfis vazios em todos os opcionais auditados (`bio`, `instagram`, `birth_date`, `sports`, `preferred_training_times`): `17`

Esses números mostram o tamanho do risco atual, mas não provam perda histórica sem comparar com backup.

## O Que Falta Para Contagem "Antes"

Ainda não foi possível responder com segurança:

- quantos tinham `bio` antes
- quantos tinham `instagram_username` antes
- quantos tinham `birth_date` antes
- quantos tinham `sports` antes
- quantos tinham `preferred_training_times` antes
- quantos foram sobrescritos por `null` ou `[]`

Motivo: o banco atual não guarda histórico de alterações de `profiles`. Esses números dependem da comparação entre `public.profiles` atual e um `public.profiles` de snapshot anterior ao bug.

## Amostra de Perfis Com Campos Vazios Hoje

Amostra ordenada por atividade social/posts:

| Username | Posts | User Gyms | Campos vazios relevantes |
| --- | ---: | ---: | --- |
| `johnny` | 15 | 1 | bio, instagram, birth_date, sports, preferred_times |
| `dudy` | 11 | 3 | bio, instagram, birth_date, sports, preferred_times |
| `fialinho` | 10 | 3 | instagram |
| `namarcussi` | 5 | 1 | bio, instagram, birth_date, sports, preferred_times, main_gym |
| `natircastro` | 4 | 0 | bio, main_gym |
| `roberto574` | 2 | 0 | bio, instagram, birth_date, sports, preferred_times, main_gym |
| `nathalia` | 2 | 0 | bio, birth_date, sports, preferred_times, main_gym |
| `lallanews` | 2 | 0 | bio, sports, main_gym, avatar |
| `dedgou` | 1 | 1 | bio, instagram, birth_date, sports, preferred_times, avatar |
| `thiba` | 1 | 1 | bio, instagram, birth_date, sports, preferred_times |
| `haj` | 1 | 1 | bio, instagram, birth_date, sports, preferred_times, avatar |

Essa amostra não significa que todos perderam dados; significa que hoje esses campos estão vazios e são candidatos a comparação com snapshot.

## Staging Table de Recuperação

Arquivo preparado:

- `supabase/admin/recover_profiles_from_snapshot.sql`

Esse arquivo cria a staging table:

- `private.profile_recovery_snapshot`

Campos:

- `user_id`
- `profile_id`
- `old_bio`
- `old_instagram_username`
- `old_birth_date`
- `old_sports`
- `old_preferred_training_times`
- `old_main_gym_id`
- `old_fitness_goal`
- `old_avatar_url`
- `snapshot_at`
- `imported_at`

Nada foi criado no banco remoto ainda.

## SQL Seguro de Recuperação

Arquivo preparado:

- `supabase/admin/recover_profiles_from_snapshot.sql`

Regras do SQL:

- Só preenche campos atuais vazios/null/`[]`.
- Só usa valores antigos não vazios do snapshot.
- Não sobrescreve campos já preenchidos novamente pelo usuário.
- Não altera `username`.
- Não altera `display_name`.
- Só restaura `avatar_url` se o atual estiver `null`.
- Só restaura `main_gym_id` se o atual estiver `null`.
- Não mexe em `auth.users`.
- Não mexe em posts, stories, follows, chat ou storage.
- Cria preview antes de qualquer update.
- O update é bloqueado por guard e exige `set local app.profile_recovery_approved = 'yes';`.

Preview incluído no SQL:

- Total de usuários impactados.
- Contagem por campo que seria restaurado.
- Total de campos que seriam restaurados.
- Preview campo-a-campo com `current_value`, `snapshot_value` e `will_restore`.
- Amostra de 20 usuários com `proposed_changes`.
- Lista de profile ids divergentes entre snapshot e atual.

## Bloqueio Atual Para Execução

Não foi possível executar a etapa "restaurar backup em ambiente isolado" com segurança usando apenas as ferramentas disponíveis nesta sessão.

Motivo:

- `npx supabase backups list` confirma backups físicos.
- `pitr_enabled` está `false`.
- `npx supabase backups restore` é orientado a PITR por timestamp.
- `npx supabase branches create --with-data` cria branch com dados atuais, não com um backup físico antigo.
- Restaurar backup físico diretamente no projeto atual poderia afetar produção e está fora das regras do incidente.

Próxima ação necessária fora desta sessão:

1. Usar o Dashboard/Suporte Supabase para restaurar o backup `2026-05-19T11:38:23.157Z` em um projeto/ambiente isolado, ou obter dump/export seguro da tabela `public.profiles` desse backup.
2. Exportar as colunas necessárias de `public.profiles`.
3. Importar o resultado em `private.profile_recovery_snapshot`.
4. Rodar previews do SQL.
5. Aprovar manualmente antes do update guardado.

## Workflow Seguro Recomendado

1. Criar ambiente separado para restaurar o backup físico candidato.
2. Restaurar o backup `2026-05-19T11:38:23.157Z`.
3. Exportar `public.profiles` do backup no formato indicado no SQL.
4. Importar em produção apenas na staging table `private.profile_recovery_snapshot`.
5. Rodar apenas os previews.
6. Validar contagens e amostras manualmente.
7. Se o snapshot já estiver afetado, repetir com backup anterior.
8. Quando houver snapshot confiável, aprovar manualmente o update guardado.
9. Depois da recuperação, aplicar hardening.

## Hardening Pós-Recuperação

Não aplicado agora por regra do incidente.

Itens recomendados depois da recuperação:

- `profiles.updated_at`
- `private.profile_change_history` com before/after
- trigger de auditoria para `profiles`
- update de perfil com dirty fields only
- manter `ProfilePreview` separado de `FullProfile`
- testes contra contaminação de cache/preview
- serializers que preservam `undefined` como "não alterar" e `null` apenas como limpeza intencional
- alerta/admin report para queda brusca de campos preenchidos em `profiles`

## Validações Executadas

Comandos locais executados após criar os relatórios/scripts:

- `npm run lint`
- `npm run build`
- `npm test -- --run`
- `npx cap sync ios`
- `git diff --check`

Todos passaram.

## Decisão Atual

Não aplicar recuperação ainda.

Motivo: sem comparar com snapshot antigo, qualquer recuperação de campos como `bio`, `instagram_username`, `birth_date`, `sports` e `preferred_training_times` seria inferência, não recuperação confiável.
