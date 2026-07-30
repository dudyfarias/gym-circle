# Exercise Catalog Enrichment Roadmap

Data: 2026-07-15
Status: roadmap editorial e técnico; nenhuma migration ou alteração do catálogo nesta entrega.

## 1. Resumo executivo

O catálogo é a fonte de verdade para registro, histórico, progressão, personal,
importação, inventário de academias e futura inteligência. O código já contém o
Exercise Picker v2 e uma migration de inteligência do catálogo, mas a aplicação
em produção e a revisão editorial dos 94 exercícios precisam ser reconciliadas
antes de tratar os metadados como confiáveis.

Regra central: um exercício tem exatamente um grupo muscular principal; grupos
secundários nunca competem com o principal no ranking.

## 2. Estado atual verificável no repositório

- catálogo com 94 exercícios conforme auditorias existentes;
- migration `20260714174109_workout_catalog_intelligence.sql` versionada;
- Exercise Picker v2 implementado e commitado;
- default de carga inferido no treino ativo;
- status editorial e metadados avançados preparados em código/migration;
- aplicação remota da migration ainda precisa ser confirmada na reconciliação;
- conteúdo completo de aliases, instruções, erros, variações e mídia ainda não foi
  revisado para todos os exercícios.

## 3. Contrato editorial obrigatório

Cada exercício aprovado deve possuir:

- `name_pt` e `name_en`;
- `aliases_pt[]` e `aliases_en[]` curados;
- `primary_muscle_group_id` único;
- `secondary_muscle_group_ids[]` sem duplicar o principal;
- `primary_equipment_id`;
- `compatible_equipment_ids[]`;
- `movement_pattern`;
- `exercise_type`: compound, isolation, cardio, mobility ou conditioning;
- `difficulty`;
- `default_load_type`;
- `default_target_kind`;
- defaults de reps/duração/distância e descanso, quando aplicáveis;
- instruções e erros comuns em português;
- variações e substituições tipadas;
- `review_status`, reviewer e timestamp.

Status editoriais:

- `draft`: incompleto e invisível para inteligência;
- `needs_review`: preenchido, aguardando revisão profissional;
- `approved`: utilizável em picker, importação e regras;
- `deprecated`: preservado em históricos, não oferecido para novos treinos.

## 4. Exercise e Equipment são entidades distintas

```text
Equipment
  -> compatible exercises

Exercise
  -> required equipment
  -> optional equipment
  -> compatible machines
  -> variations
  -> substitutions
  -> movement pattern
  -> primary/secondary muscles
```

Uma polia alta permite puxada, tríceps, face pull e pullover. O scanner deve
identificar a máquina/equipamento e então consultar exercícios compatíveis; não
transformar cada máquina em um exercício único.

## 5. Qualidade da taxonomia

### Regras automáticas

- exatamente um músculo principal;
- principal ausente nos secundários;
- `bodyweight` não exige `weight_kg`;
- `assisted` só em movimentos compatíveis;
- exercícios de tempo não usam reps como registro principal;
- corrida/caminhada/bike usam duração/distância;
- equipamento principal pertence aos compatíveis;
- exercício aprovado tem nomes, movimento, tipo de carga e tipo de registro;
- substituições não apontam para si nem formam ciclos inválidos;
- deprecated nunca aparece como sugestão nova.

### Revisão humana

Cada item passa por editor + profissional revisor. Alterações relevantes geram
versão e audit log; atividades antigas continuam apontando para snapshots e IDs
históricos.

## 6. Ranking do picker

Score determinístico inicial:

- músculo principal selecionado: +100;
- match textual exato/alias: +40;
- equipamento filtrado: +30;
- favorito: +20;
- usado recentemente: +15;
- músculo secundário: +10;
- desempate alfabético/priority score: +5.

Quando há filtro muscular, renderizar:

1. `Foco principal`;
2. `Também trabalha`.

O score precisa de testes de invariantes: nenhum resultado secundário pode ficar
antes de um principal compatível apenas por recência ou favorito.

## 7. Conteúdo demonstrativo

Ordem segura:

1. instruções textuais curadas;
2. passos de execução;
3. erros comuns;
4. thumbnails e ilustrações próprias;
5. vídeos próprios ou licenciados;
6. animações e variações revisadas.

Não copiar vídeos, thumbnails, descrições ou assets de concorrentes. Cada mídia
precisa de origem, licença, autor, revisão, versão e política de remoção.

## 8. Plano de revisão dos 94 exercícios

Trabalhar em lotes de 15–20, começando pelos mais usados:

1. peito e tríceps;
2. costas e bíceps;
3. quadríceps e glúteos;
4. posteriores e panturrilha;
5. ombros, core e calistenia;
6. cardio, mobilidade e itens restantes.

Para cada lote:

- exportar inventário atual;
- revisar taxonomia;
- executar validações automáticas;
- revisão profissional;
- aplicar em preview;
- smoke no picker e em treino antigo;
- aprovar para produção com changelog.

## 9. Métricas de qualidade

- % aprovado;
- % com aliases PT/EN;
- % com instruções e erros comuns;
- % com equipamento validado;
- taxa de busca sem resultado;
- tempo até adicionar exercício;
- taxa de correção manual em importações;
- exercícios mais substituídos;
- denúncias/erros por mil seleções.

Não otimizar recomendação por clique antes de a taxonomia estar correta.

## 10. Roadmap

### Sprint C0 — Reconciliation & QA

Confirmar migration remota, regenerar types em entrega isolada, remover casts
decorrentes do schema antigo e validar compatibilidade de atividades existentes.

### Sprint C1 — Editorial core

Regras automáticas, painel/export de revisão, audit log e primeiro lote aprovado.

### Sprint C2 — 94 exercícios

Completar os seis lotes com revisão profissional e changelog.

### Sprint C3 — Equipment graph

Entidades de equipamento/máquina, compatibilidade, variações e substituições.

### Sprint C4 — Conteúdo próprio

Instruções completas, erros comuns e thumbnails/ilustrações licenciadas.

### Sprint C5 — Intelligence-ready

Somente exercícios `approved` entram em importação automática, scanner e geração
de rascunhos. Nada de ML nesta fase.

## 11. Critérios de conclusão

- 94/94 têm músculo principal único;
- carga e target kind padrão são coerentes;
- equipamentos são entidades separadas;
- picker mantém primários antes de secundários;
- conteúdo aprovado possui autoria/licença;
- exercícios antigos continuam abrindo;
- nenhuma activity perde referência;
- schema remoto, migrations e types estão reconciliados.

## 12. Próxima ação

Executar Sprint C0 e gerar um relatório tabular dos 94 exercícios. Responsáveis:
Produto Fitness + profissional revisor + Engenharia de Dados/Frontend.
