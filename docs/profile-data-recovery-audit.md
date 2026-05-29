# Gym Circle Profile Data Recovery Audit

Data: 2026-05-20
Projeto Supabase: `qajjpjmybmqqwflytcpr`
Modo: investigação read-only. Nenhum `update`, `delete`, `drop` ou correção de dados foi aplicado.

## Resumo Executivo

O usuário afetado identificado é o perfil `dudy`, ligado ao `auth.users.id` `08ff7442-709c-4086-8da8-1cb4c9a258cd`.

Resultado principal:

- Não foi encontrado perfil duplicado para `dudy`.
- Não foi encontrado `profile` órfão.
- Não foi encontrado `auth.users` sem `profile`.
- Posts, stories, follows, mensagens, check-ins, user_gyms, activity days e streak seguem ligados ao mesmo `user_id` correto.
- A academia principal atual (`main_gym_id`) ainda está atrelada ao perfil e também aparece em `user_gyms`, posts e stories.
- Campos diretos atualmente vazios em `profiles`, como `bio`, `instagram_username`, `birth_date`, `sports` e `preferred_training_times`, não apareceram em outra tabela pública nem em metadata de auth com confiança suficiente para recuperação automática.

Conclusão:

O problema de exibição/persistência foi corrigido no código em `a5c256d fix: preserve full profile data`, mas valores que foram sobrescritos por `null`/array vazio anteriormente não têm fonte histórica confiável dentro das tabelas atuais. Para recuperar esses campos exatamente como eram antes, seria necessário consultar backup/PITR do Supabase, se disponível, ou preencher manualmente a partir de memória do usuário.

## Usuário Atual

Auth user:

- `auth.users.id`: `08ff7442-709c-4086-8da8-1cb4c9a258cd`
- `auth.users.email`: `dudy.cappia@gmail.com`
- `auth.users.created_at`: `2026-05-07 14:01:10.995989+00`
- `auth.users.last_sign_in_at`: `2026-05-20 18:02:44.766526+00`
- Provider: `email`

Profile atual:

- `profiles.id`: `38402375-74e3-4199-b64e-379a2ac0ed0d`
- `profiles.user_id`: `08ff7442-709c-4086-8da8-1cb4c9a258cd`
- `username`: `dudy`
- `display_name`: `Dudy`
- `avatar_url`: preenchido
- `bio`: `null`
- `fitness_goal`: `Ficar parecendo um monstro horrivel`
- `main_gym_id`: `ebef2920-21d1-4262-ba9a-96af155996ce`
- `preferred_training_times`: `[]`
- `is_private`: `false`
- `instagram_username`: `null`
- `birth_date`: `null`
- `sports`: `[]`
- `profile_created_at`: `2026-05-07 14:01:10.995654+00`
- `account_status`: `active`
- `deleted_at`: `null`

Observação: a tabela `profiles` não possui coluna `updated_at`, então não dá para saber pelo próprio registro quando cada campo foi sobrescrito.

## Duplicados e Órfãos

Validações globais:

- `profiles_without_auth`: `0`
- `auth_without_profile`: `0`
- `duplicate_profiles_per_user`: `0`
- `duplicate_usernames`: `0`

Busca específica por candidatos similares:

- Busca por username/display name/email contendo `dudy`: retornou apenas o perfil atual `dudy` e a conta separada `applereview`, que é a conta de revisão da Apple.
- Busca por mesmo `avatar_url` do perfil atual: retornou apenas `dudy`.
- Busca por `created_at` aproximado entre `2026-05-07 13:30:00+00` e `2026-05-07 14:30:00+00`: retornou apenas `dudy`.

Conclusão: não há evidência de que os dados antigos estejam em outro `profiles` duplicado.

## Relações Históricas do Usuário

Todas as relações abaixo continuam apontando para `08ff7442-709c-4086-8da8-1cb4c9a258cd`.

Contagens:

- `profiles`: 1
- `posts`: 11
- `stories`: 7
- `user_gyms`: 3
- `checkins`: 2
- `user_activity_days`: 22
- `streak_restore_events`: 2
- `streak_restored_days`: 1
- `followers_in`: 13
- `following_out`: 20
- `notifications_received`: 53
- `notifications_actor`: 127
- `conversation_participants`: 7
- `direct_messages_sent`: 24
- `direct_messages_received`: 21
- `post_participants_tagged`: 2
- `story_participants_tagged`: 2

Conclusão: posts/stories/follows/chat/streak não parecem ter sido reatrelados para outro usuário.

## Academias e Localização

`user_gyms` ligados ao usuário:

1. `Saint Thomas`
   - `gym_id`: `ebef2920-21d1-4262-ba9a-96af155996ce`
   - `is_main`: `true`
   - `preferred_days`: `[]`
   - `preferred_times`: `[]`
   - `address`: `null`
   - `city`: `null`
   - `state`: `null`
   - latitude/longitude: ausentes

2. `Paraty`
   - `is_main`: `false`
   - cidade/estado: `Paraty`, `Rio de Janeiro`
   - latitude/longitude: presentes

3. `Bluefit`
   - `is_main`: `false`
   - cidade/estado: `São Paulo`, `São Paulo`
   - latitude/longitude: presentes

O `profiles.main_gym_id` atual aponta para `Saint Thomas`, que também é a academia `is_main = true` em `user_gyms` e aparece na maioria dos posts/stories.

Conclusão: `main_gym_id` não está perdido. O que pode parecer vazio na UI é a localização/cidade da academia principal, porque o registro `Saint Thomas` não tem `city`, `address`, `state`, latitude nem longitude.

## Posts e Stories

Posts:

- Existem 11 posts do usuário.
- Posts recentes apontam para `Saint Thomas`.
- Há um post de corrida com `location_source = current`.
- Posts antigos sem `thumbnail_url`/`poster_url` continuam existindo; isso é esperado para mídia criada antes da Sprint D.

Stories:

- Existem 7 stories do usuário.
- Stories recentes apontam para `Saint Thomas`.
- Stories antigos sem `thumbnail_url`/`poster_url` continuam existindo; isso é esperado para mídia criada antes da Sprint D.

Conclusão: conteúdo histórico do feed/stories segue no usuário correto.

## Streak e Stats

`user_stats` atual:

- `current_streak`: 2
- `best_streak`: 5
- `last_active_date`: `2026-05-19`
- `workouts_this_month`: 8
- `active_days_this_year`: 8
- `badge_is_active_today`: false
- `streak_restores_available`: 2
- `last_streak_restore_used_at`: `2026-05-14T12:02:51.825888+00:00`

`user_stats_live` retorna os mesmos dados principais de streak, mas alguns campos de restaurador aparecem como `null` na view. Isso já existia fora do escopo de recuperação de perfil e deve ser revisado separadamente se a UI depender da view para restauradores.

## Campos Editáveis: Atual vs Fonte Antiga

| Campo | Valor Atual | Fonte antiga encontrada | Confiança | Recomendação |
| --- | --- | --- | --- | --- |
| `username` | `dudy` | auth metadata `username = Dudy` | Alta | Manter atual |
| `display_name` | `Dudy` | auth metadata/identity confirma Dudy | Alta | Manter atual |
| `avatar_url` | preenchido | storage tem 4 avatares históricos do mesmo usuário | Média | Manter atual; restaurar avatar antigo só com escolha manual |
| `bio` | `null` | nenhuma fonte histórica encontrada | Baixa | Não recuperar automaticamente |
| `fitness_goal` | preenchido | apenas o valor atual no profile | Média | Manter atual |
| `main_gym_id` | `Saint Thomas` | user_gyms/posts/stories confirmam | Alta | Manter atual |
| `preferred_training_times` | `[]` | user_gyms também `[]` | Baixa | Não recuperar automaticamente |
| `is_private` | `false` | nenhuma fonte antiga divergente | Média | Manter atual |
| `instagram_username` | `null` | nenhuma fonte histórica encontrada | Baixa | Não recuperar automaticamente |
| `birth_date` | `null` | nenhuma fonte histórica encontrada | Baixa | Não recuperar automaticamente |
| `sports` | `[]` | nenhuma fonte histórica do usuário encontrada | Baixa | Não recuperar automaticamente |

## Storage de Avatar

Foram encontrados 4 objetos em `storage.objects` no bucket `avatars` dentro da pasta do usuário:

- `2026-05-07 14:26:23+00`
- `2026-05-07 18:35:31+00`
- `2026-05-07 18:36:03+00`
- `2026-05-07 19:24:01+00` atual

Esses objetos permitem restaurar um avatar antigo se o usuário escolher qual arquivo quer usar. Não há evidência suficiente para trocar automaticamente.

## Causa Provável

A causa técnica do sumiço visual/persistência inconsistente era o estado local aceitando `ProfilePreview` como se fosse `FullProfile`:

- Feed/stories/search/suggestions retornam projections reduzidas.
- Essas rows parciais eram convertidas em `ProfileRow` com defaults (`bio = null`, `sports = []`, etc.).
- O merge antigo substituía a row completa pela row parcial.
- Ao abrir edição a partir desse estado parcial, a UI podia mandar `null`/`[]` e salvar por cima.

Correção já feita em `a5c256d fix: preserve full profile data`:

- `mergeProfileRows` preserva `FullProfile` quando entra `ProfilePreview`.
- Preview parcial não apaga `bio`, `main_gym_id`, `instagram_username`, `birth_date`, `sports`, `preferred_training_times` e outros campos completos.
- `profileService.update` remove `undefined` antes do update.
- Salvar perfil atualiza a UI com a row completa retornada pelo Supabase.
- `mainGymId` é preservado no usuário enriquecido para a edição.

## SQL Seguro Proposto

Nenhum SQL de recuperação deve ser aplicado automaticamente neste momento.

Como `main_gym_id` já está correto, não há update necessário.

Se, no futuro, algum usuário tiver `profiles.main_gym_id = null` mas `user_gyms.is_main = true`, a recuperação segura e não destrutiva seria:

```sql
-- PROPOSTA. NAO APLICAR EM MASSA SEM REVISAR O USUARIO.
update public.profiles p
set main_gym_id = ug.gym_id
from public.user_gyms ug
where p.user_id = 'USER_ID_AQUI'::uuid
  and ug.user_id = p.user_id
  and ug.is_main = true
  and p.main_gym_id is null;
```

Para campos como `bio`, `instagram_username`, `birth_date`, `sports` e `preferred_training_times`, não existe fonte histórica confiável no banco atual. A recuperação automática desses campos não é recomendada.

## Próximos Passos Recomendados

1. Confirmar manualmente quais campos antigos estavam preenchidos no perfil `dudy`.
2. Se houver backup/PITR disponível no Supabase, consultar snapshot anterior ao update que sobrescreveu os campos.
3. Caso não haja backup, preencher os campos manualmente pela UI agora que o bug de FullProfile foi corrigido.
4. Adicionar uma tabela de auditoria futura para `profiles`, registrando `before`/`after` de campos editáveis sensíveis.
5. Adicionar coluna `updated_at` em `profiles` numa migration futura para facilitar investigações.
6. Revisar `user_stats_live` vs `user_stats` para restauradores de streak, pois a view retorna alguns campos de restaurador como `null`.

## Validação do Código Atual

Testes adicionados/cobertos pela correção:

- Preview parcial não sobrescreve `FullProfile`.
- Campos `null` de preview não apagam campos completos.
- Full profile update pode limpar campo intencionalmente.
- `profileService.update` remove `undefined`.
- Update parcial preserva campos não alterados.
- `main_gym_id` é preservado no estado enriquecido.

Validações já executadas após a correção:

- `npm run lint`
- `npm run build`
- `npm test -- --run`
- `npx cap sync ios`
- `git diff --check`
