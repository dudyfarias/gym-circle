# Gym Circle — Auditoria UX / Produto

> Read-only, 11/jun/2026. Base: navegação pelo código das telas + histórico de feedbacks reais do dogfooding (Eduardo + amigos no TestFlight).

## Perguntas-chave

| Pergunta | Resposta hoje | Evidência/Nota |
|----------|--------------|----------------|
| O usuário entende o app em <60s? | **Parcial** | Onboarding contextual (7C) explica conforme usa — bom; mas a proposta "poste o treino → mantenha o Circle vivo" não tem um momento único de "aha" guiado no primeiro boot |
| Entende os 3 círculos (semana/mês/ano)? | **Parcial** | Hint de primeira visita no MyCircle existe (7C.3); fora dele, rings não têm legenda persistente |
| Sabe como postar? | Sim | CTA central óbvio; câmera=single, galeria=multi (padrão IG aprendido) |
| Sabe manter o Circle ativo? | **Parcial** | Streak/restaurador existem; falta um "o que conta como dia ativo?" em 1 frase na UI |
| O feed parece vivo? | **Risco em rede pequena** | Com poucos follows, feed seca rápido; sugestões de amizade existem mas não há conteúdo de fallback (ver oportunidades) |
| As conquistas geram desejo? | **Sim (forte)** | Hall estilo Apple Fitness com artefatos 3D (Sprint 15) é o destaque premium do app |
| O app parece premium? | Sim no visual; "quase" nas micro-interações | Haptics simulados, motion polish 7C.4; flicker de imagem (bug B3) derruba a percepção quando acontece |
| O app parece nativo? | Em geral sim | Keyboard nativo, safe areas ok; gestos de voltar em sheets profundos às vezes exigem o X |

## Fricções e telas confusas (priorizadas)

| # | Fricção | Impacto | Esforço | Sugestão |
|---|---------|---------|---------|----------|
| 1 | **Calendário: 1 foto por dia** sem indicar que há mais posts no dia | Usuário acha que "post sumiu" (relato real, 11/jun) | Baixo | Badge "+2" na célula com 2+ posts; tap abre o dia (mini-lista) |
| 2 | Desafios secretos aparecem como "???" sem explicar a mecânica | Curiosidade vira confusão | Baixo | Linha "Complete para revelar" no card secreto |
| 3 | Hall de terceiros com categoria Desafios vazia (B11) | Parece bug | Baixo | Empty-state "Desafios são pessoais" |
| 4 | Feed vazio de usuário novo | Primeira sessão morre | Médio | Estado vazio com 3 ações: seguir sugestões / postar primeiro treino / convidar amigo |
| 5 | Progresso de desafio só atualiza no boot (lazy recompute) | "Treinei e não andou" até reabrir | Médio | Recompute também ao publicar post (hook pós-publish) |
| 6 | Check-in vs Post: dois conceitos de "registrei treino" | Confusão conceitual | Médio | Decidir: fundir check-in no fluxo de post (check-in = post sem foto?) ou aposentar |
| 7 | Sem deep links | Compartilhar perfil/post abre Safari | Médio | Universal links (v1.2) |

## Features escondidas (existem mas o usuário não descobre)

- **Restaurador de streak** (só aparece na hora da perda) — ok por design, mas merece 1 linha no MyCircle.
- **Recap mensal compartilhável + escolher capa/período** — potente pra growth, enterrado em sub-CTA.
- **Tags múltiplas de treino (até 5)** — chips existem, mas o valor (conta pra conquistas/desafios) não é comunicado.
- **Equipar conquistas em destaque** (featured) — pouca gente sabe que dá pra escolher.
- **Calendário navegável por meses** (setas pequenas).

## Onboarding contextual — onde falta (além do 7C atual)

1. Hall da Fama (1ª visita): "Toque numa medalha para ver como desbloquear".
2. Composer (1ª vez): "Selecione várias fotos para criar um carrossel".
3. Desafios do mês (1ª visita): mecânica + quando reseta.
4. Feed vazio (acima).

## App Store readiness (visão produto)

- Metadados/screenshots/review notes existem (`STORE_METADATA.md`, Sprint 10.6/10.8 + conta demo applereview) ✓.
- v1.1 já submetida; próxima atualização deve destacar: carrossel, Hall 3D, replies em comentários.
- Risco de review: nenhum novo (permissões enxutas, suporte/privacy/terms ok).

## Priorizado impacto × esforço (top 8)

| Prioridade | Item | Impacto | Esforço |
|-----------|------|---------|---------|
| P0 | Fix flicker de imagem/stories (bug B3) — percepção premium | Alto | Baixo-médio |
| P0 | Badge "+N" no calendário (fricção 1) | Alto (confiança) | Baixo |
| P1 | Recompute de desafio pós-publish (fricção 5) | Alto (gamificação viva) | Baixo-médio |
| P1 | Empty states (feed/hall de terceiro/desafio secreto) | Médio-alto | Baixo |
| P1 | Tela "como funciona o Circle" 1x no onboarding (60s aha) | Alto | Médio |
| P2 | Recap compartilhável em destaque mensal (push no dia 1) | Alto growth | Médio |
| P2 | Decisão check-in vs post | Médio | Médio |
| P2 | Universal links | Médio | Médio |
