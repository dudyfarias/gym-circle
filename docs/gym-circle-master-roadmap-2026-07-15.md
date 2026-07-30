# Gym Circle Master Roadmap

Data-base: 2026-07-30
Status: documento canônico de priorização. Atualizar semanalmente e após cada release.

## 1. Direção estratégica

O Gym Circle evolui em quatro camadas:

1. rede social + registro confiável;
2. plataforma de treino e progresso;
3. ecossistema de profissionais e lugares;
4. inteligência supervisionada por dados e profissionais.

Nenhuma camada posterior pode contornar os gates de estabilidade, proveniência,
consentimento e qualidade do catálogo.

## 2. Status atual resumido

- perfil: correções de loops de challenges/achievements publicadas; falta smoke
  autenticado e contagem de requests após ciclos completos de navegação;
- outdoor: pipeline GPS e Activity Detail v2 implementados; falta novo build
  TestFlight e QA físico com tela bloqueada;
- push: APNs e todos os eventos de notificação foram validados em produção;
- HealthKit: import read-only implementado no target Capacitor e purpose strings
  corrigidas; depende de novo binário e QA;
- treino: Quick Wins, semântica de sets, load types, catálogo/picker e progresso
  têm base implementada; types foram regenerados do remoto e o hardening de
  índices/policy foi reconciliado com a versão aplicada;
- trainer: profiles/workspaces estão versionados, mas migrations não foram
  aplicadas e a UI permanece desativada por feature flag;
- Android: fora do ciclo atual e não pode ser tratado como compatível sem QA.

## 3. Gates de estabilidade (Fase A)

Só avançar Features C–G para rollout amplo quando:

- nenhuma request storm em profile/challenges/achievements;
- caminhada, corrida e bike persistem rota/distância em background;
- horário, elapsed e moving time são coerentes;
- push de mensagem, curtida, comentário e reminder passa end-to-end;
- migrations local/remoto reconciliadas sem SQL destrutivo;
- types gerados do schema remoto e casts temporários auditados;
- build TestFlight passa smoke em iPhone pequeno e grande;
- performance Supabase tem baseline p50/p95 e alertas.

## 4. Roadmap operacional

Legenda: `DONE` = implementado e validado no nível indicado; `QA` = código pronto,
faltando evidência física/remota; `PLANNED` = desenho/backlog; `BLOCKED` = depende
de gate anterior. Owner é papel responsável, não pessoa nominal.

| # | Entrega | Status | Prioridade | Dependências | Owner | Risco | Próxima ação | Critério de conclusão | Plataformas |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | Freeze/refetch loops | QA | P0 | nenhuma | Web + Backend | alto | smoke autenticado e contar requests | sem storm e navegação responsiva por 10 min | Web, Supabase |
| 2 | GPS e detalhe outdoor | QA | P0 | novo build | iOS + Web | alto | TestFlight e caminhada 500m bloqueado | rota, distância, ritmo e horário corretos | iOS, Web, Supabase |
| 3 | QA iPhone | PLANNED | P0 | 1–2 | QA Mobile | alto | matriz small/large/background/offline | checklist com evidências e activity IDs | iOS |
| 4 | Push completo | DONE | P0 | concluído | iOS + Backend | baixo | monitorar falhas de entrega | todos os eventos validados em produção | iOS, Supabase |
| 5 | Performance | PLANNED | P0 | observabilidade | Backend | alto | baseline p50/p95 e top queries | orçamento e alertas definidos | Supabase, Web |
| 6 | Migrations e database types | DONE | P0 | concluído | Backend | baixo | monitorar drift em cada release | histórico alinhado, types gerados, build verde | Supabase, Web |
| 7 | Apple Watch foundation | QA | P1 | HealthKit/TestFlight | iOS | alto | validar import real | workout e rota importados sem duplicar | iOS, Supabase |
| 8 | Android Foundation | PLANNED | P1 | fase A | Android | alto | auditoria Capacitor | build interno e core flows | Android |
| 9 | Android compatibilidade | BLOCKED | P1 | 8 | Android + QA | alto | matriz de features | paridade declarada e bugs P0 zerados | Android |
| 10 | Push/GPS Android | BLOCKED | P1 | 8–9 | Android + Backend | alto | spike nativo | background e FCM end-to-end | Android, Supabase |
| 11 | Google Play interno | BLOCKED | P1 | 8–10 | Release | médio | track interno | instalação, login e smoke aprovados | Android |
| 12 | Places Intelligence | IN PROGRESS | P1 | comparar segundo provider + revisar 87 casos uncertain + licença/quota | Product + Backend | alto | repetir subset de 10 e ampliar Apple para 40 casos balanceados | cobertura/relevância/p50/p95 comparáveis e ADR `Accepted` | Backend, iOS, Android |
| 13 | Apple/Google Maps | BLOCKED | P1 | 12 | Mobile + Backend | alto | POC comparativo | custo/cobertura/termos aprovados | iOS, Android, Backend |
| 14 | Catálogo de locais | BLOCKED | P1 | 12–13 | Backend | alto | schema canônico/RLS | base própria com proveniência | Supabase, Backend |
| 15 | Catálogo de exercícios | QA | P1 | 6 | Product Fitness | alto | revisar 94 itens | 94 aprovados e auditáveis | Supabase, Web |
| 16 | Exercise Picker v2 | QA | P1 | 15 | Web + QA | médio | smoke mobile/autenticado | primários antes de secundários | Web, iOS shell |
| 17 | Inventário de equipamentos | BLOCKED | P1 | 14–15 | Product + Backend | alto | modelar equipment graph | equipamentos e compatibilidade aprovados | Supabase, Web |
| 18 | Histórico por exercício | PLANNED | P1 | 6,15 | Web + Backend | médio | query/RPC e estados vazios | histórico confiável sem carga zero | Supabase, Web |
| 19 | Carga anterior | PLANNED | P1 | 18 | Web | médio | UX de autofill | preencher sem sobrescrever intenção | Web, iOS shell |
| 20 | Detalhe/evolução do treino | PLANNED | P1 | 6 | Web + Backend | médio | consumir RPC existente | uso, média, volume e conclusão | Supabase, Web |
| 21 | PRs | QA | P1 | 6,15 | Backend + Web | alto | validar dados reais | PR ignora carga zero e aparece uma vez | Supabase, Web |
| 22 | Gráficos | BLOCKED | P2 | 18,20–21 | Data + Web | médio | definir métricas | dados suficientes e estados vazios | Web, Supabase |
| 23 | Sugestões de carga | BLOCKED | P2 | 18,21–22 | Product Fitness | alto | regras explicáveis | sugestão editável e sem agressividade | Backend, Web |
| 24 | Refatoração multiprofissional | PLANNED | P1 | 6 | Product + Backend | alto | consolidar arquitetura | escopos profissionais definidos | Supabase, Web |
| 25 | Profiles e Workspaces | PLANNED | P1 | 6,24 | Backend + Web | alto | preview das migrations | RLS e feature flag validados | Supabase, Web |
| 26 | Relationship & Consent | BLOCKED | P1 | 25 | Privacy + Backend | crítico | threat model/RLS | revogação imediata e consentimento granular | Supabase, Web |
| 27 | Meus clientes | BLOCKED | P2 | 26 | Web | alto | UX e queries autorizadas | sem acesso direto às activities completas | Web, Supabase |
| 28 | Templates e assignments | BLOCKED | P2 | 26–27 | Backend + Web | alto | versões imutáveis | aceite do aluno e snapshots | Supabase, Web |
| 29 | Dashboard profissional | BLOCKED | P2 | 28 | Data + Web | alto | métricas agregadas | só dados autorizados e auditáveis | Web, Supabase |
| 30 | HealthKit | QA | P1 | build/QA | iOS | alto | importar treino real | read-only, dedupe e source corretos | iOS, Supabase |
| 31 | Apple Watch sync completo | BLOCKED | P2 | 7,30 | iOS | alto | desenho de sync | rota/métricas e conflitos resolvidos | iOS, Supabase |
| 32 | Strava | BLOCKED | P2 | 6,30 | Backend | alto | OAuth/import ADR | consentimento, dedupe e revogação | Backend, Supabase |
| 33 | Health Connect | BLOCKED | P2 | Android | Android | alto | spike oficial | import idempotente | Android, Supabase |
| 34 | Samsung Health | BLOCKED | P3 | 33 | Android | médio | avaliar API/parceria | decisão documentada | Android |
| 35 | Garmin/provedores | BLOCKED | P3 | 32–33 | Partnerships | médio | priorizar por demanda | integração contratual e observável | Backend |
| 36 | Treino sugerido | PLANNED | P2 | 15,18,20 | Product Fitness | alto | V1 determinística | explica motivo e permite ignorar | Backend, Web |
| 37 | IA supervisionada | BLOCKED | P3 | 26,28–29,36 | AI + Privacy | crítico | consent/schema/eval | rascunho com human-in-loop | Backend, Supabase |
| 38 | Scanner de máquinas | BLOCKED | P3 | 14–17 | Vision + Mobile | alto | dataset/eval | identifica equipamento, não inventa exercício | iOS, Android, Backend |
| 39 | Treino por equipamento | BLOCKED | P3 | 17,36,38 | Product Fitness | alto | regras de compatibilidade | só catálogo approved e equipamento disponível | Backend, Web |
| 40 | Ajuste adaptativo | BLOCKED | P3 | 21–23,36–37 | AI + Product | crítico | protocolo de segurança | editável, explicável e monitorado | Backend, Supabase |

## 5. Sequência de execução

### Fase A — Estabilidade

Itens 1–6. Trabalho em andamento. O release gate imediato é GPS/HealthKit em novo
TestFlight, seguido de push e performance.

### Fase B — Plataformas

Itens 7–11. Não iniciar Android profundo antes do gate de estabilidade, para não
duplicar bugs e contratos inconsistentes.

### Fase C — Dados essenciais

Itens 12–17. Places P0 pode rodar em paralelo como pesquisa; migrations e UI só
depois do benchmark e da reconciliação.

### Fase D — Treino e progresso

Itens 18–23. Histórico e dados confiáveis vêm antes dos gráficos e sugestões.

### Fase E — Profissionais

Itens 24–29. Workspace -> consentimento -> clientes -> assignment -> dashboard.

### Fase F — Integrações

Itens 30–35. Toda importação precisa de proveniência, dedupe e revogação.

### Fase G — Inteligência

Itens 36–40. Começa determinística; IA gera rascunhos, nunca prescrição médica.

## 6. Próximas duas sprints

### Sprint imediata — Outdoor Release Gate

Escopo:

- archive/TestFlight com build number novo;
- caminhada, corrida e bike em iPhone físico;
- background, tela bloqueada, pausa e retomada;
- conferir `route`, `distance_m`, `elapsed_s`, `moving_s` e detalhe;
- importar um treino real do Apple Saúde;
- registrar activity IDs e screenshots.

Critério: zero bug P0/P1 e dados coerentes em produção.

### Sprint paralela curta — Places Provider Audit

Somente pesquisa e POC isolada: 150 locais, cobertura, custo, latência, termos e
ADR. Nenhuma ingestão permanente nem migration.

## 7. Governança do roadmap

- Atualização semanal pelo PM.
- Cada linha tem um owner nominal ao entrar em sprint.
- Status só vira `DONE` com evidência e critério de conclusão.
- Mudança de provider, schema ou consentimento exige ADR.
- Custo externo e performance entram no release review.
- Feature flag obrigatória quando frontend depende de migration ainda não aplicada.
- QA físico é obrigatório para GPS, push, HealthKit e Android.

## 8. Documentos relacionados

- [Places & Maps Intelligence](./places-maps-intelligence-roadmap-2026-07-15.md)
- [Exercise Catalog Enrichment](./exercise-catalog-enrichment-roadmap-2026-07-15.md)
- [Competitive Landscape](./competitive-landscape-roadmap-2026-07-15.md)
- [Outdoor Tracking & Activity Detail v2](./outdoor-workout-tracking-activity-detail-v2-2026-07-15.md)
- [Workout Catalog Intelligence](./workout-catalog-intelligence-2026-07-14.md)
- [Workout Data/Product Roadmap](./workout-data-product-roadmap-2026-07-10.md)
- [Trainer Ecosystem Governance](./trainer-ecosystem-governance-2026-07-14.md)

## 9. Próxima ação executiva

1. gerar o novo TestFlight e concluir o Outdoor Release Gate;
2. rodar a auditoria Places P0 em paralelo;
3. reconciliar migrations e regenerar Supabase types em PR isolado;
4. só então decidir o próximo bloco de implementação.

## 10. Sports Catalog Foundation — atualização 2026-07-23

Status: implementação local concluída; migration, QA físico e publicação
pendentes.

Prioridade: base do bloco de treino e progresso, antes de corrida guiada,
templates multiprofissionais e recomendação inteligente.

Dependências:

- revisão/aplicação da migration de tipos de atividade e favoritos;
- QA de regressão em musculação, corrida, caminhada e bike;
- regeneração isolada dos tipos Supabase depois da migration aprovada.

Próxima ação: executar o release gate descrito em
`docs/sports-catalog-foundation.md`.

Critério de conclusão: 30 modalidades pesquisáveis, favoritos isolados por RLS,
personalização por histórico, quatro fluxos legados aprovados em iPhone e
nenhuma regressão em feed, post, check-in ou importação.

## 11. Atualização do gate P0 — 2026-07-30

Concluído no código e no remoto:

- `database.types.ts` regenerado diretamente do projeto de produção;
- policy de `post_activities` e sete índices de FK confirmados no Supabase;
- advisor de performance sem `WARN` ou `ERROR`;
- quatro desafios editoriais de agosto de 2026 confirmados no remoto;
- rastreadores web, Capacitor e SwiftUI passaram a aceitar batches plausíveis
  entregues com atraso pelo Core Location, preservando a distância com a tela
  bloqueada;
- sessões recentes do plugin Capacitor podem retomar após recriação do processo;
- o mapa de rota deixou de ocupar um segundo bloco quando o post já possui
  foto ou vídeo; a tag da atividade continua abrindo o detalhe com o mapa.

Ainda depende de aparelho e não pode ser declarado concluído por automação:

- caminhada de ao menos 500 m com a tela bloqueada;
- pausa, deslocamento, retomada e validação de que o salto foi ignorado;
- smoke de corrida guiada por duração e distância;
- matriz de iPhone pequeno/grande, background e retomada;
- novo Archive/TestFlight contendo o plugin corrigido.

Os avisos de segurança do advisor sobre RPCs `SECURITY DEFINER` foram
inspecionados. As RPCs autenticadas são endpoints intencionais e usam
`auth.uid()` e `search_path` fixo, exceto a consulta agregada e sem dados
pessoais de raridade global. Revogar sua execução indiscriminadamente quebraria
conta, ranking, treino e streak. O acompanhamento permanece no release review.
