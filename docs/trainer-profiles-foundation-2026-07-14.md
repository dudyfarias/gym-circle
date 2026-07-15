# Trainer Profiles Foundation — 2026-07-14

## 1. Resumo executivo

Esta sprint cria a base do perfil profissional de personal trainer sem introduzir vínculo personal–aluno, atribuição de treinos, marketplace ou IA.

A arquitetura escolhida mantém `profiles` como identidade social e usa uma tabela 1:1 separada para os dados profissionais. O número de registro não faz parte da tabela pública: ele fica em uma solicitação de verificação acessível somente pelo próprio usuário e pelo backend de revisão.

Nenhuma migration foi aplicada em produção e nenhum deploy foi realizado nesta sprint.

## 2. Estado atual auditado

### `profiles`

Antes desta sprint, a tabela possui:

- identidade: `user_id`, `username`, `display_name`, `avatar_url`, `bio`;
- fitness: `fitness_goal`, `main_gym_id`, `preferred_training_times`, `sports`;
- social: `instagram_username`, `is_private`;
- onboarding e legal;
- status de conta, suspensão e exclusão;
- preferências de perfil, recap e conquistas.

Não existiam `account_type`, `professional_status` ou tabelas relacionadas a trainer.

### Fluxos existentes

- perfil próprio: `ProfileScreen` + `ProfileIdentity`;
- perfil de outra pessoa: `ProfileSheet` + `ProfileIdentity`;
- edição social: `EditProfileSheet`;
- privacidade e conta: `AccountSettingsSheet`;
- orquestração: `GymCirclePreview`;
- RLS de `profiles`: leitura condicionada por conta ativa e bloqueios; edição somente pelo dono;
- posts de conta privada são protegidos por `private.can_view_profile_posts`.

### Riscos de regressão considerados

- criar uma nova consulta que dispare em loop no perfil;
- confundir “Personal Trainer” com “Verificado”;
- expor registro profissional por uma leitura pública;
- permitir autoaprovação alterando uma coluna pelo client;
- fazer perfil privado vazar a seção profissional;
- tornar o formulário grande parte do bundle inicial;
- interferir nos overlays e bottom navigation.

Mitigações: dependências primitivas no carregamento, cache/dedupe de 60 segundos, formulário carregado dinamicamente, RLS baseada na privacidade existente e separação física dos dados sensíveis.

## 3. Arquitetura escolhida

### `profiles.account_type`

Campo aditivo:

```text
regular | trainer
```

Todo usuário existente permanece `regular` pelo default. A criação de `trainer_profiles` marca a conta como `trainer` por trigger. O tipo não concede verificação nem autoridade administrativa e não remove as funções sociais normais.

Não foi criado `professional_status` em `profiles`, pois ele duplicaria `trainer_profiles.verification_status` e poderia ficar inconsistente.

### `trainer_profiles`

Tabela 1:1 vinculada a `profiles.user_id`:

- `user_id`;
- `professional_name`;
- `headline`;
- `professional_bio`;
- `specialties`;
- `service_modes`;
- `city`, `state`;
- `online_service`, `in_person_service` gerados;
- `years_experience`;
- `accepts_new_clients`;
- `contact_cta_enabled`;
- `profile_visibility`;
- `verification_status`;
- timestamps.

Os arrays aceitam somente valores do catálogo fechado. A UI limita especialidades a cinco; a constraint do banco permite até nove para evolução futura.

### `trainer_verification_requests`

Tabela separada e owner-only:

- número e região do registro;
- status da solicitação;
- timestamps de submissão/revisão;
- reviewer e motivo de rejeição.

Não há upload de documento nesta versão. Não há `document_path`, bucket ou arquivo sensível.

## 4. Fluxo “Tornar-se personal”

A entrada fica em Configurações e abre um formulário em seis etapas:

1. introdução e diferenciação entre perfil trainer e perfil verificado;
2. nome, headline e bio profissional;
3. especialidades;
4. atendimento, localização, experiência e disponibilidade;
5. registro profissional opcional;
6. revisão, contato e visibilidade.

Sem número de registro, o perfil fica `unverified`. Informar número + região cria uma solicitação `pending`; isso não concede o selo automaticamente.

## 5. Perfil público e perfil próprio

Quando há um `trainer_profile` visível, `ProfileScreen` e `ProfileSheet` exibem:

- badge “Personal Trainer”;
- badge “Verificado” somente para `verified`;
- nome profissional e headline;
- especialidades;
- atendimento e localização;
- disponibilidade para novos alunos;
- bio profissional.

O perfil próprio também mostra o estado da análise e um atalho discreto para edição. A ação de mensagem existente continua sendo o único CTA funcional para outro usuário nesta sprint.

Não são mostrados placeholders de “Meus alunos”, “Contratar” ou “Enviar treino”, evitando botões sem função.

## 6. Status de verificação

Estados:

- `unverified`: perfil criado sem análise aprovada;
- `pending`: registro enviado e aguardando revisão;
- `verified`: aprovado por workflow administrativo;
- `rejected`: precisa de correção e novo envio;
- `suspended`: oculto publicamente.

O client nunca envia `verification_status` no payload de perfil. Triggers rejeitam tentativas diretas de inserir ou alterar status. A solicitação também bloqueia alterações em `status`, `reviewed_by`, `reviewed_at` e `rejection_reason` feitas por usuário autenticado.

Um trigger interno sincroniza o resultado da revisão com o perfil profissional. A aprovação real deverá ocorrer via backend/service role seguro.

## 7. RLS e privacidade

### `trainer_profiles`

- o dono sempre pode ler seu próprio perfil;
- leitura externa exige `profile_visibility = public`;
- status `suspended` não é público;
- a política usa `private.can_view_profile_posts`, herdando conta ativa, bloqueios, conta privada e follow aprovado;
- insert/update somente para `auth.uid() = user_id`;
- o status de verificação é protegido adicionalmente por trigger.

### `trainer_verification_requests`

- sem acesso para `anon`;
- usuário autenticado cria/lê apenas as próprias;
- somente a solicitação `pending` pode ter número/região corrigidos pelo dono;
- campos administrativos não podem ser alterados pelo client;
- service role continua reservado ao backend.

O número completo nunca é retornado junto do perfil profissional público. Na UI do próprio profissional, quando já verificado, aparece apenas uma versão mascarada.

## 8. UI e componentes

Componentes reutilizáveis:

- `TrainerBadge`;
- `TrainerVerificationBadge`;
- `TrainerProfileSection`;
- `TrainerProfileForm`;
- helpers de persistência/cache em `trainerProfile.ts`.

Direção visual: card escuro com acento ciano do Gym Circle, especialidades compactas e linguagem de confiança sem aparência de marketplace.

Estados cobertos:

- inexistente/regular: nenhuma seção pública;
- unverified;
- pending;
- verified;
- rejected;
- suspended (somente dono; oculto dos demais);
- erro de carregamento/salvamento;
- perfil privado e bloqueio via RLS.

## 9. Fora de escopo

- vínculo personal–aluno;
- convites;
- painel de alunos;
- envio/atribuição de treinos;
- contratação e pagamentos;
- marketplace “Encontrar personal”;
- upload de documentos;
- notificações de revisão;
- IA e scanner;
- Android, SwiftUI, HealthKit e Strava.

## 10. Busca e descoberta futura

Foram preparados índices para:

- status de verificação;
- aceita novos alunos;
- estado/cidade;
- especialidades via GIN.

Nenhuma tela de descoberta ou RPC de busca foi criada agora. Antes de um marketplace, será necessário definir moderação, ordenação, paginação e regras de visibilidade mais detalhadas.

## 11. Validação e rollout seguro

Antes de aplicar a migration:

1. revisar SQL e RLS em branch Supabase;
2. testar regular, unverified, pending, verified, rejected e suspended;
3. tentar autoaprovação pelo client e confirmar rejeição;
4. testar dois usuários, conta privada, follow, bloqueio e logout/login;
5. validar ProfileScreen, ProfileSheet, mensagem e bottom nav no iPhone;
6. somente depois aplicar a migration aditiva;
7. publicar o frontend após a migration estar pronta, evitando erro de tabela inexistente.

## 12. Próxima sprint recomendada

**Trainer–Client Relationship Foundation**:

- convite e aceite explícito;
- `trainer_client_relationships`;
- permissões granulares;
- revogação pelo aluno;
- RLS baseada em vínculo ativo;
- notificação interna do convite;
- nenhuma atribuição de treino ainda.

Prompt recomendado:

> Implemente a Sprint Trainer–Client Relationship Foundation usando `trainer_profiles` como pré-requisito. Crie vínculo pending/active/declined/revoked, aceite explícito do aluno, permissões mínimas, revogação e RLS. Não implemente atribuição de treino, IA, cobrança ou dashboard avançado. Use branch Supabase para testar e não aplique em produção sem aprovação.
