# Sprint D1 — Running Coach Library (design spec)

- **Data:** 2026-07-24
- **Status:** Proposed — design aprovado no brainstorm; plano de implementação pendente. Nenhum código, migration ou deploy até o plano de implementação e aprovação.
- **Autor do design:** brainstorm Eduardo × Claude.

## 1. Objetivo e escopo

Entregar a fundação da biblioteca oficial de corrida do Gym Circle, de forma
que qualquer usuário abra o app e comece a treinar sem precisar montar um
treino. A D1 valida o modelo com **5 planos-farol** antes de encher o catálogo
(D2).

**A D1 entrega:**

1. Schema de **programa multi-semana** (semanas → sessões → blocos), *owner-aware*
   desde o início (oficial / assessoria / importado).
2. **Facetas**: nível, objetivo, tempo disponível, dias por semana.
3. **5 planos-farol** (2 sessões avulsas + 3 programas), com alvos por **esforço**
   (RPE) + tempo — nunca pace absoluto. Seedados com `is_published = false` até
   revisão humana.
4. **Biblioteca (browse)** com filtro por faceta e detalhe do programa.
5. **Timeline endurecida** contra a variedade real (intervalado, fartlek,
   recovery), como identidade visual do produto.

**Fora de escopo (sprints futuras):** encher o catálogo (D2); importador OCR/PDF
(E); coach adaptativo por regras (F) e IA (G); Apple Watch (H); assessorias —
atribuição aluno↔treinador (I); comunidade de corrida (J). A D1 apenas **deixa a
costura pronta** para E e I (ver §8), sem construí-las.

## 2. Decisões de design (as bifurcações resolvidas)

| # | Decisão | Escolha | Racional curto |
|---|---|---|---|
| Q1 | Ownership do conteúdo oficial | Templates globais app-owned, separados de plano pessoal | Conteúdo oficial != plano privado; atualizar a biblioteca é 1 escrita |
| Q2 | Programa ↔ sessão | Camada fina + sessões-template reutilizáveis | Reusa `workout_plan_steps` (Sprint B) e a engine guiada (Sprint C) sem mudança |
| Q3 | Progresso do usuário | Tabela de **enrollment** + conclusão ligada à `activity` | Padrão limpo; streak/feed/PRs/desafios entram de graça |
| Q4 | Cadência | **Híbrido**: ordem flexível + sugestão de espaçamento não-obrigatória | Tolera vida real; zero engine de reagendamento |
| — | Fonte de verdade do conteúdo | Eu rascunho a estrutura; **você revisa** antes de publicar | Não publicar programa auto-escrito como "oficial" sem sign-off humano |
| — | Programas ativos | **Um programa ativo por vez** | Mata ambiguidade de "qual é a próxima sessão?" |
| — | Origem (futureproofing) | `owner_user_id` + `origin` + `visibility` no schema | Assessoria (I) e importado (E) entram pelo mesmo caminho sem cirurgia |

## 3. Modelo de dados

6 tabelas novas, aditivas. Metade é **conteúdo** (leitura ampla, escrita
`service_role`), metade é **estado do usuário** (RLS dono-só). Reusa o vocab de
`level`/`goal` e a forma de `workout_plan_steps` já existentes na Sprint B.

### 3.1 Conteúdo (owner-aware; oficial na D1)

**`running_program`** — o programa e suas facetas.

- `id uuid pk`, `slug text unique`, `title text`, `description text`
- **owner-aware:** `owner_user_id uuid null` (null = oficial; treinador = assessoria;
  usuário = importado), `origin text` (`official` | `professional` | `imported` |
  `ai`), `visibility text` (`public` | `assigned` | `private`)
- **facetas:** `level` (`starting`|`beginner`|`intermediate`|`advanced`),
  `goal` (vocab estendido — ver §3.4), `weeks int`, `sessions_per_week int`
  (= "dias por semana"), `time_bucket int` (= "tempo disponível": 20/30/45/60/90),
  `suggested_spacing text` (dica híbrida, ex.: `rest_day_between`)
- `is_published bool default false`, `created_at`, `updated_at`

**`running_program_session`** — mapa **semana × ordem → sessão-template** (a
camada fina da Q2).

- `id uuid pk`, `program_id uuid fk -> running_program on delete cascade`
- `week_index int` (1-based), `order_in_week int`, `session_template_id uuid fk`
- `notes text null` (nota do dia, opcional)
- unique `(program_id, week_index, order_in_week)`

**`running_session_template`** — a sessão oficial reutilizável (metadata).

- `id uuid pk`, `slug text unique`, `title text`, `description text`
- owner-aware (mesmas 3 colunas de `running_program`)
- `estimated_duration_s int null`, `estimated_distance_m numeric null`,
  `primary_step_type text null`
- `is_published bool default false`

**`running_session_template_step`** — os blocos da sessão. **Espelho exato de
`public.workout_plan_steps`** (mesmas colunas e constraints): `position`,
`step_type` (warmup/easy/steady/recovery/interval/tempo/threshold/progression/
long_run/walk/cooldown/drill/hill/free), `title`, `instructions`, `repetitions`
(+min/max), `target_basis` (distance/duration/pace/heart_rate/effort/free),
`distance_*`, `duration_*`, `pace_*`, `heart_rate_zone` (1-5), `recovery_*`,
`target_effort` (1-10), `metadata jsonb`. FK → `running_session_template`.

> A igualdade de forma com `workout_plan_steps` é o que permite a engine rodar
> tanto uma sessão-template oficial quanto um `workout_plan` do usuário sem
> ramificar.

### 3.2 Estado do usuário (RLS dono-só)

**`running_program_enrollment`** — a inscrição do usuário num programa.

- `id uuid pk`, `user_id uuid`, `program_id uuid fk -> running_program`
- `status text` (`active` | `completed` | `abandoned`), `started_at`,
  `completed_at null`
- índice parcial garantindo **≤1 enrollment `active` por usuário** (a regra
  "um programa ativo por vez")

**`running_program_session_completion`** — liga cada sessão feita à `activity`.

- `id uuid pk`, `enrollment_id uuid fk -> running_program_enrollment on delete cascade`
- `program_session_id uuid fk -> running_program_session`
- `activity_id uuid fk -> activities` (a activity gerada pela execução guiada)
- `completed_at`
- unique `(enrollment_id, program_session_id)` (idempotência da conclusão)
- **"próxima sessão"** = a menor `(week_index, order_in_week)` do programa ainda
  sem linha de conclusão nesse enrollment.

### 3.3 RLS

- **Conteúdo** (`running_program`, `running_session_template` e filhas):
  `revoke all from anon`; `grant select to authenticated`;
  `using ( (origin = 'official' and is_published) or owner_user_id = auth.uid() )`.
  A cláusula `assigned` (aluno designado) é **extension point** deixado para a
  Sprint I; na D1 nenhuma linha usa `visibility = 'assigned'`.
  `running_program_session` e `running_session_template_step` **herdam a
  visibilidade do pai** via join (SELECT permitido sse o pai é visível), sem
  política própria de owner.
  Escrita: apenas `service_role` (seed via migration/admin) — o cliente não forja
  conteúdo oficial.
- **Estado** (`enrollment`, `completion`): RLS dono-só
  (`user_id = auth.uid()` direta ou via join no enrollment). Escrita apenas pelas
  RPCs `security definer` (§4).

### 3.4 Vocab de objetivo (sem mudança na D1)

- O vocab de `goal` já existente cobre os 5 planos-farol: `start_running`
  (Começar a correr), `first_5k` (Primeiro 5 km), `conditioning`/`general` (os
  demais). "Leve / intenso / regenerativo" é **intensidade da sessão** (via
  `target_effort`/`step_type`), nunca objetivo do programa.
- `weight_loss` e `recovery` como *objetivo* de programa ficam **adiados pra D2**
  (entram com o resto do catálogo, se necessário). A D1 **não muda constraint de
  vocab** — YAGNI, e evita tensão com "regenerativo = intensidade".

## 4. RPCs, segurança e migration

**Leitura (browse + detalhe):** leitura direta na tabela sob RLS (conteúdo
curado, não-sensível), igual ao catálogo de exercícios. Filtro por faceta no
cliente após um fetch (conjunto pequeno) → instantâneo.

**Escrita (sempre ownership-safe, `security definer` no schema `private`,
espelhando o padrão da Sprint B — `revoke` amplo + `grant execute` a
`authenticated`):**

- `enroll_in_running_program(p_program_id uuid) returns uuid` — cria enrollment
  `active` (falha se já houver um ativo), retorna `enrollment_id`.
- `complete_program_session(p_enrollment_id uuid, p_program_session_id uuid,
  p_activity_id uuid) returns void` — grava a conclusão; valida que o enrollment
  é do usuário, a `activity` é do usuário, e a sessão pertence ao programa do
  enrollment; se era a última sessão, marca o enrollment `completed`. Idempotente.
- `abandon_running_program(p_enrollment_id uuid) returns void` — marca
  `abandoned`, liberando o slot ativo.

**Migration:** aditiva. Cabeçalho `-- Prepared for review only. Do not apply
without a dedicated release gate.` (convenção da Sprint B). `if not exists` em
tudo; nenhuma operação destrutiva. **Não aplicar** como parte da implementação —
aplicação é um gate de release separado, com confirmação do Eduardo.

## 5. Integração com a engine guiada (zero mudança na engine)

A engine da Sprint C já executa uma sessão a partir de um **array normalizado de
blocos** + snapshot imutável (ver `docs/guided-running.md`). A D1 adiciona um
**adaptador fino** que projeta linhas de `running_session_template_step` no
**mesmo formato** de bloco que a engine consome. Fluxo:

1. Usuário abre o programa → "Continuar" → resolve a **próxima sessão** (§3.2).
2. Adaptador monta o array de blocos da sessão-template → "Começar treino guiado"
   cria o snapshot como hoje.
3. Ao encerrar, gera uma `activity` normal (como hoje).
4. O app chama `complete_program_session(enrollment, program_session, activity_id)`
   → progresso gravado + a activity alimenta streak/feed/PRs/desafios sozinha.

**Sessão avulsa (Primeira caminhada, Intervalado leve):** usa o **mesmo**
adaptador → snapshot → `activity`, mas **sem enrollment nem `completion`** — não
faz parte de um programa. Só programas têm progresso. O plano de implementação
deve construir **os dois caminhos deliberadamente** (avulsa: preview → engine →
activity; programa: enrollment → próxima sessão → engine → activity → completion).

## 6. Biblioteca (UI) + timeline

**Browse:** entra pela seção Corrida do catálogo. Reusa padrões de sheet/lista
(`RunningPlansSheet`). Cards por programa (título, badge de nível, objetivo,
`semanas × sessões/semana`, tempo, 1 linha de descrição). Barra de filtros por
faceta; empty state por combinação. Detalhe: estrutura **semana a semana**, CTA
"Começar programa"; se inscrito, progresso (semana/sessão, %) + "Continuar".

**Timeline endurecida** (identidade visual):

- Cada bloco = nó, **cor por `step_type`** (aquecimento verde, intervalado
  laranja, recovery azul, desaquecimento vermelho).
- **Colapsar repetições:** "6× 400 m" = 1 nó com contador + recovery entre elas.
- Label de duração/distância + esforço/zona por nó.
- Duas superfícies: preview (antes) e execução guiada (durante — já existe),
  destacando bloco atual + próximo.
- Opcional (polish, adiado): mini-timeline do programa mostrando sessões da
  semana como pontos.

## 7. Conteúdo — os 5 planos-farol

**Princípios (o que trava "inventar paces"):** alvo por **esforço (RPE 1-10) +
tempo**, não pace absoluto (`target_basis='effort'`, `pace_*` null); estruturas
de **domínio público** (run/walk, progressão gradual), nunca planilha
proprietária; **"voltar após lesão" cortado da v1**; **disclaimer** fixo
("conteúdo educativo, não substitui avaliação profissional; consulte um médico
antes de começar"); tudo seedado `is_published = false` até **revisão do Eduardo**.

| Plano-farol | Tipo | Estrutura |
|---|---|---|
| Primeira caminhada | Sessão | ~30 min esforço leve (RPE 3-4) |
| Intervalado leve | Sessão | aquecimento + 6× bloco leve + recovery + desaquecimento |
| Começar a correr | Programa ~4 sem | run/walk progressivo (caminhada → corrida) |
| Correr 30 minutos | Programa curto | constrói até 30 min contínuos |
| Primeiro 5 km | Programa ~6-8 sem | couch-to-5k por esforço |

2 sessões avulsas + 3 programas → exercita **os dois caminhos** do schema.

## 8. Futureproofing para E (importador) e I (assessorias)

As três origens têm a mesma forma (semanas → sessões → blocos). O owner-aware
(`owner_user_id` + `origin` + `visibility`) faz das mesmas tabelas o lar natural
de programas de personal e importados. A D1 **seeda só o oficial**; enrollment e
adaptador da engine já são **origin-agnósticos**.

**Explicitamente NÃO decidido na D1** (é spec de E/I): tabela de atribuição
aluno↔treinador; mapeamento OCR→programa; se sessões importadas/de personal
reusam `workout_plans` ou as novas tabelas. Extension points anotados.

## 9. Segurança (resumo)

- Conteúdo oficial: `revoke anon`; leitura só de publicado/próprio; escrita só
  `service_role`. Cliente não forja conteúdo.
- Estado: RLS dono-só; escrita só via RPC `security definer` validando ownership
  (enrollment, activity, pertinência da sessão).
- Migration aditiva, sem operação destrutiva, não auto-aplicada.
- Nenhum segredo, nenhum dado de produção alterado no design.

## 10. Testes

- **Lógica pura (vitest):** filtro por faceta; resolução da "próxima sessão";
  cálculo de % de progresso; colapso de repetições na timeline; adaptador
  session-template → bloco da engine.
- **RPC (SQL):** ownership de enroll/complete/abandon; idempotência da conclusão;
  regra "≤1 ativo"; RLS de leitura (oficial publicado vs próprio vs alheio).
- **Gate por fatia:** tsc + eslint + vitest + next build verdes.

## 11. Ordem de implementação (fatias, cada uma = gate verde)

1. **Schema + tipos:** migration aditiva (não aplicada) + tipos TS + mappers.
2. **Sessões + biblioteca + timeline:** session-templates, browse por faceta,
   timeline endurecida, e as **2 sessões-farol** (Primeira caminhada, Intervalado
   leve). Entrega valor no meio do caminho.
3. **Programa + enrollment:** `running_program`/`_session`/`enrollment`/
   `completion` + RPCs + adaptador da engine + os **3 programas-farol**.
4. **Conteúdo pendente de revisão:** tudo `is_published=false`; Eduardo revisa e
   publica.

## 12. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Correção fisiológica do conteúdo | Estruturas genéricas + esforço, não pace; `is_published=false` até revisão humana; disclaimer |
| Responsabilidade (lesão/clínico) | "Voltar após lesão" cortado da v1; disclaimer; sem prescrição clínica |
| Migration aplicada fora de ordem | Aditiva + `if not exists`; cabeçalho "do not apply without release gate" |
| Escopo (multi-semana é infra pesada) | Fatias shippáveis; 2 sessões antes do programa; só 5 planos na D1 |
| Paridade nativa | Web-first; nativo (SwiftUI) é sprint separada, fora da D1 |
