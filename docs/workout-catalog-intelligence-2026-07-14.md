# Workout Catalog Intelligence & Exercise Picker v2

Data da revisão: 14 de julho de 2026.

## Resumo

O catálogo atual tem 94 exercícios: 92 aprovados e 2 contribuições da
comunidade. A revisão read-only confirmou que todos têm exatamente um grupo
muscular principal, nenhum repete o grupo principal como secundário e todos os
itens aprovados têm equipamento. As lacunas estruturais estavam em outro ponto:
94/94 não tinham dificuldade e 94/94 usavam o próprio slug como
`movement_pattern`.

Esta sprint mantém os campos legados e adiciona uma camada compatível para:

- relevância por músculo primário e secundário;
- equipamento canônico e compatibilidades;
- tipo de exercício e carga padrão;
- dificuldade, descanso, alvo e prioridade editorial;
- equipamentos/máquinas e relações exercício-exercício normalizadas;
- favoritos privados e recentes derivados do histórico real;
- gate editorial separado do status legado.

A migration foi criada localmente, não aplicada em produção.

## Decisões de arquitetura

### Músculos e ranking

O picker separa os resultados em `Foco principal` e `Também trabalha`. Uma
correspondência secundária nunca entra na mesma lista ordenável da primária.
Dentro de cada seção, o score considera busca, equipamento, favorito, recência
e prioridade editorial.

Pesos atuais:

- músculo principal: +100;
- busca: +40 a +48;
- equipamento selecionado: +30;
- favorito: +20;
- recente: +15;
- músculo secundário: +10;
- prioridade editorial: +0 a +10;
- alfabético: desempate.

### Compatibilidade

`equipment`, `aliases`, `status` e `parent_exercise_id` continuam existindo.
Os novos campos são aditivos e o frontend tem fallback para o schema anterior
durante a ordem migration -> deploy.

### Equipamentos e Scanner

`workout_equipment_catalog` representa equipamento, máquina, estação ou
acessório. A relação N:N
`workout_exercise_equipment_compatibility` permite que uma máquina seja
compatível com vários exercícios, sem guardar uma lista invertida dentro da
máquina.

### Variações e substituições

`workout_exercise_relations` suporta `variation`, `substitution`,
`alternative`, `home_version` e `gym_version`. O vínculo legado de
`parent_exercise_id` é copiado como relação de variação, sem ser removido.

### Revisão editorial

O novo `review_status` usa:

- `draft`;
- `needs_review`;
- `approved`;
- `deprecated`.

Os 92 itens legados aprovados recebem `approved`. As duas contribuições da
comunidade permanecem `needs_review`. Futuras rotinas de IA e Scanner só podem
consumir `review_status = 'approved'`.

## Revisão dos 94 exercícios

A revisão preservou o grupo muscular primário e os grupos secundários já
válidos e preencheu, para todo o catálogo, os seguintes campos:

- equipamento principal e equipamentos compatíveis canônicos;
- padrão de movimento semântico;
- tipo composto, isolado, mobilidade ou aquecimento;
- carga externa, peso corporal, assistida ou não informada;
- dificuldade;
- prioridade;
- descanso, RPE e tipo de registro padrão;
- versão editorial `catalog-v2-2026-07-14`.

Os 52 itens aprovados que ainda não têm instruções próprias continuam
identificados como lacuna editorial. A estrutura de `execution_steps` foi
criada, mas esta sprint não inventa instruções nem importa conteúdo de terceiros.

## Exercise Picker v2

Mudanças:

- chips musculares menores e seleção centralizada automaticamente;
- fades laterais para indicar scroll horizontal;
- busca instantânea;
- filtros rápidos `Todos`, `Recentes` e `Favoritos`;
- equipamentos e filtros avançados dentro de bottom sheet;
- cards compactos com nome, descrição curta, equipamento principal e botão `+`;
- toque no card abre detalhes; `+` adiciona imediatamente;
- seção opcional `Usados recentemente`;
- seções separadas `Foco principal` e `Também trabalha`.

Os recentes são derivados das `activities` do próprio usuário. Favoritos usam
uma tabela privada com RLS por `user_id`, funcionando entre dispositivos.

## Fora de escopo

- Machine Learning;
- Scanner ativo;
- recomendação automática;
- vídeos;
- importação;
- preenchimento editorial de instruções inexistentes.

## Aplicação segura futura

1. Revisar a migration local e executar em branch/preview do Supabase.
2. Validar que os 94 itens recebem metadados e que os 2 comunitários continuam
   `needs_review`.
3. Aplicar a migration em produção somente com aprovação.
4. Publicar o frontend depois da migration.
5. Fazer QA autenticado no iPhone: busca, filtros, favorito, recente, detalhe e
   adição direta.
