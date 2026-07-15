# Trainer Workspace Foundation — Sprint 1.5A

Data: 15 de julho de 2026
Status: implementação local; migration não aplicada e frontend não publicado.

## 1. Resumo executivo

Esta sprint cria o tenant profissional do Gym Circle sem antecipar vínculo com aluno, permissões de dados, templates, assignments, dashboard, IA ou notificações.

O `Trainer Workspace` organiza a identidade operacional de um personal ou equipe. Ele não se torna dono de `workout_plans`, `activities`, posts, PRs ou qualquer dado futuro do aluno. O perfil profissional continua em `trainer_profiles`; o workspace é uma camada privada separada.

A implementação segue o adendo canônico `trainer-ecosystem-governance-2026-07-14.md`. As diferenças intencionais do MVP são:

- os papéis expostos nesta fase são `owner`, `trainer`, `assistant` e `viewer`; um papel administrativo separado fica para a evolução de assessorias;
- convites e alteração de papel não são expostos nesta sprint;
- a UI permite criar `individual`, `advisory` ou `studio`; `gym_partner` fica reservado no schema;
- há no máximo um workspace não arquivado por owner no MVP.

## 2. Auditoria da base reutilizada

### Reutilizado

- `profiles.user_id`, `account_type`, `account_status` e lifecycle de conta;
- `trainer_profiles` como pré-requisito profissional 1:1;
- `trainer_verification_requests` permanece independente;
- `ProfileScreen`, `TrainerProfileSection` e `GymCirclePreview` como pontos de entrada;
- `useGymCircleServices` e o Supabase client autenticado;
- padrão existente de cache/dedupe para evitar refetch loops no perfil;
- schema privado `private` para helper de RLS não exposto no Data API.

### Necessário nesta sprint

- duas tabelas aditivas;
- uma RPC atômica de criação;
- helper privado de membership para evitar RLS recursiva;
- RLS, grants mínimos, constraints e índices;
- onboarding e gerenciamento mínimo do workspace;
- integração no perfil próprio do personal.

### Riscos controlados

- **acesso cruzado:** toda leitura exige ownership ou membership ativa;
- **autoelevação:** não há grant de insert/update/delete em memberships;
- **owner falsificado:** a RPC deriva owner exclusivamente de `auth.uid()`;
- **owner sem membership:** RPC cria ambos na mesma transação;
- **request storm no perfil:** leitura tem cache, dedupe e efeitos com dependências primitivas;
- **frontend antes do banco:** rollout deve aplicar a migration revisada antes de publicar a UI;
- **dados do aluno:** nenhuma policy, FK ou RPC toca `activities` ou `workout_plans`.

## 3. Schema

### `trainer_workspaces`

- `id`;
- `owner_user_id`;
- `name`;
- `slug` opcional e reservado;
- `workspace_type`: `individual`, `studio`, `advisory`, `gym_partner`;
- `status`: `active`, `suspended`, `archived`;
- `city`, `state`, `logo_url`, `description`;
- timestamps.

O índice parcial `trainer_workspaces_one_owned_active_idx` limita o owner a um workspace não arquivado. Participar como membro de outros workspaces continua possível.

### `trainer_workspace_members`

- `id`;
- `workspace_id`;
- `user_id`;
- `role`: `owner`, `trainer`, `assistant`, `viewer`;
- `status`: `invited`, `active`, `suspended`, `removed`;
- `invited_by`, `joined_at`;
- timestamps;
- unicidade por `(workspace_id, user_id)`;
- no máximo um owner ativo por workspace.

Nesta sprint somente a membership `owner/active` é criada. Os demais estados e papéis deixam o contrato pronto sem abrir mutations prematuras.

## 4. Papéis

| Papel | Sprint 1.5A | Futuro |
|---|---|---|
| Owner | lê e edita dados básicos do workspace | gerencia membros, alunos e ativos profissionais |
| Trainer | leitura do workspace quando membership ativa | templates e assignments conforme capabilities |
| Assistant | leitura do workspace quando membership ativa | organização sem acesso implícito a dados do aluno |
| Viewer | somente leitura | consulta operacional limitada |

Nenhum papel desta tabela concede acesso a aluno. `account_type = trainer` também nunca é autorização suficiente por si só.

## 5. RPC de criação

`public.create_trainer_workspace(p_name text, p_workspace_type text default 'individual')`

Comportamento:

1. exige sessão autenticada;
2. deriva `owner_user_id` de `auth.uid()`;
3. valida `profiles.account_type = trainer`, conta ativa e não excluída;
4. exige `trainer_profile` não suspenso;
5. valida nome e tipo permitidos no MVP;
6. recusa segundo workspace não arquivado do mesmo owner;
7. cria workspace e membership owner na mesma transação;
8. retorna o workspace criado.

A função é `security definer`, tem `search_path = ''`, usa nomes totalmente qualificados e concede `EXECUTE` somente a `authenticated`. O grant é intencional: trata-se de uma operação per-user estreita, sem IDs de owner vindos do client.

## 6. RLS e grants

### Workspace

- SELECT: owner ou membro ativo;
- UPDATE: owner de workspace ativo;
- column grant limita update a `name`, `description`, `city`, `state` e `logo_url`;
- sem insert/delete direto para authenticated;
- `owner_user_id`, `workspace_type` e `status` não podem ser alterados pelo client;
- anon não possui acesso.

### Membership

- SELECT: a própria linha ou membro ativo do workspace;
- sem insert/update/delete direto para authenticated;
- anon não possui acesso;
- remoção futura será soft remove por RPC, para revogar acesso imediatamente e preservar auditoria.

O helper `private.is_active_trainer_workspace_member(workspace_id)` evita policy recursiva e usa a identidade autenticada atual. Ele não aceita um `user_id` fornecido pelo client.

## 7. Fluxo de criação e UI

1. O usuário conclui o perfil profissional.
2. O perfil próprio mostra “Criar espaço profissional”.
3. O personal escolhe nome e tipo: Individual, Assessoria ou Estúdio.
4. A RPC cria workspace e owner membership.
5. A mesma sheet passa ao modo de gerenciamento.
6. O owner pode editar nome, descrição, cidade e estado.
7. A seção de membros mostra a membership atual e informa que convites virão depois.

Componentes:

- `TrainerWorkspaceSheet`: carregamento e mutations;
- `TrainerWorkspaceOnboarding`: criação;
- `TrainerWorkspaceSettings`: edição básica e estados;
- `TrainerWorkspaceMembersSection`: lista read-only;
- `trainerWorkspace.ts`: contrato, cache, dedupe, validação e persistência.

O perfil público não recebe nome do workspace nem lista de membros.

## 8. Estados

- sem workspace: onboarding;
- carregando: spinner sem bloquear o restante do app;
- erro: feedback local com retry ao reabrir;
- ativo/owner: edição básica habilitada;
- suspenso ou arquivado: leitura, sem mutation;
- trainer/assistant/viewer: leitura, sem mutation;
- removed: deixa de satisfazer membership ativa e perde leitura do workspace;
- regular ou trainer sem `trainer_profile`: RPC recusa criação.

## 9. Limitações e fora de escopo

- relacionamento personal–aluno e consentimento;
- “Meus Alunos”;
- permissões de dados do aluno;
- convites e gestão funcional de membros;
- templates, assignments e versionamento;
- dashboard e métricas;
- IA e `ai_training_consents`;
- notificações;
- workspace público, marketplace ou slug navegável;
- transferência de ownership, exclusão e reativação de workspace;
- Android, SwiftUI, HealthKit e Strava.

## 10. Migration e rollout

Arquivo: `supabase/migrations/20260715132533_trainer_workspace_foundation.sql`.

A migration é aditiva e não atualiza dados existentes. Ela não cria workspaces em massa. Antes de produção:

1. aplicar `20260714193000_trainer_profiles_foundation.sql` em branch/teste, caso ainda esteja pendente;
2. aplicar a Workspace Foundation na mesma branch;
3. testar RLS com regular, trainer sem profile, owner, membro ativo, membro removido e usuário externo;
4. confirmar que RPC não aceita owner fornecido e não cria duplicado concorrente;
5. rodar advisors de segurança/performance;
6. só então aplicar as migrations em produção;
7. publicar o frontend depois do schema estar disponível.

Nenhuma migration foi aplicada e nenhum deploy foi feito nesta sprint.

## 11. Próxima sprint — Relationship & Consent

A Sprint 1.5B deve criar:

- `trainer_relationships` com múltiplos personais por escopo;
- aceite, recusa, encerramento e revogação;
- permissões de dados controladas pelo aluno em tabela própria;
- preferências de notificação separadas;
- `ai_training_consents` separado por finalidade e política;
- audit log append-only;
- bloqueio encerrando acesso;
- ainda sem SELECT direto em `activities`.

Prompt recomendado:

> Implemente a Sprint 1.5B Relationship & Consent sobre Trainer Workspace. Crie convite e aceite explícito, múltiplos personais por escopo, permissões controladas pelo aluno, revogação imediata, preferências de notificação separadas e consentimento de IA separado. Não implemente assignments, templates, dashboard ou SELECT do personal em activities. Teste tudo em branch Supabase e não aplique em produção sem aprovação.
