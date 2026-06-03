# Gym Circle Gamification V2

## Sistema Atual Encontrado

O app ja possuia um sistema simples de badges em `apps/web/src/components/gym-circle/social/gamification.ts`, derivado de dados ja carregados no hook social:

- `EnrichedUser`
- `EnrichedPost[]`
- `user_stats_live`
- `user_activity_days`
- contadores de posts, seguidores, streak e restauradores

As telas que ja consumiam gamificacao eram principalmente:

- perfil proprio
- `MyCircleSheet`
- consistencia/streak
- badges legados

## Regras Atuais

As regras antigas continuam compativeis:

- primeiro treino
- streak 3, 7, 14 e 30
- semana ativa
- mes ativo
- ano ativo
- social
- popular
- streak recuperado

Nenhum badge antigo foi apagado. Cada badge legado passou a ter um `legacyBadgeId` dentro da nova estrutura `AchievementV2`.

## Dados Reaproveitados

Foram reaproveitados:

- `profiles.created_at`
- `profiles.account_status`
- `profiles.deleted_at`
- `user_stats_live.current_streak`
- `user_stats_live.best_streak`
- `user_stats_live.workouts_this_month`
- `user_stats_live.active_days_this_year`
- `user_activity_days`
- `posts`
- `stories`
- `checkins`
- `follows`
- `post_comments`
- `post_participants`
- `streak_restore_events`

## Dados Novos Necessarios

Nao foram criadas tabelas novas nesta etapa. Foram adicionadas RPCs aditivas:

- `get_founder_status(p_user_ids uuid[])`
- `get_achievement_rarity_summary()`

Essas funcoes nao apagam dados, nao alteram tabelas e nao mudam regras sociais existentes.

Status remoto:

- `gamification_founder_status` aplicada no Supabase remoto.
- `gamification_ghost_rarity` aplicada no Supabase remoto em 2026-06-03 para incluir `Fantasma` na raridade global.

## Compatibilidade Retroativa

Todos os badges existentes continuam calculados por helpers puros. A nova camada `AchievementV2` apenas organiza os itens em:

- Badge
- Medalha
- Trofeu
- Reliquia
- Challenge

Posts, stories, perfis, SwiftUI, Capacitor e Supabase continuam consumindo os mesmos dados-base.

## Hierarquia Oficial

`AchievementV2` define:

- `category`: `badge | medal | trophy | relic | challenge`
- `rarity`: `common | uncommon | rare | epic | legendary`
- `visual`: arte 3D declarativa
- `progress`: progresso atual
- `rarityStats`: raridade global opcional
- `legacyBadgeId`: compatibilidade com badges antigos

## Visual 3D

O componente `AchievementArtifact3D` substitui a leitura visual de checklist por objetos premium:

- badges pequenos de vidro
- medalhas metalicas
- trofeus com destaque
- reliquias de cristal/obsidiana
- bloqueados com arte escurecida

O visual fica em CSS/React por enquanto, sem carregar assets pesados no boot.

## Reliquia Fundador

A reliquia `Fundador` e exclusiva dos 100 primeiros perfis ativos cadastrados.

Regra:

- ordenar `profiles` por `created_at asc, id asc`
- considerar apenas `account_status = active`
- excluir `deleted_at is not null`
- `founder_rank <= 100` ganha a reliquia

Em 2026-06-03, existem 26 perfis ativos no projeto, entao os usuarios ativos atuais entram na regra dos 100 primeiros.

## Raridade Global

Cada conquista pode mostrar a porcentagem de usuarios ativos que possuem o item.

Fonte:

- RPC `get_achievement_rarity_summary()`

Retorno:

- `achievement_id`
- `owners_count`
- `total_users`
- `owned_percent`

UI:

- exibe no detalhe da conquista
- mostra `0%` quando ninguem possui
- quando existe ao menos 1 dono e a porcentagem e menor que `0,01%`, exibe `0,01%`
- exemplo: `0,01% dos usuarios tem esta conquista`

Objetivo:

- transformar raridade em status social
- permitir reliquias extremamente raras
- manter leitura simples, estilo Apple Fitness Awards

## Desafios Mensais

`getMonthlyChallenges()` gera quatro desafios exclusivos do mes atual:

- facil
- medio
- dificil
- lendario

Cada desafio gera um trofeu mensal com id no formato:

- `trophy-YYYY-MM-easy`
- `trophy-YYYY-MM-medium`
- `trophy-YYYY-MM-hard`
- `trophy-YYYY-MM-legendary`

Regra de produto:

- desafios mensais nao voltam
- quem conquistou mantem para sempre
- quem perdeu nao recupera depois

Nesta etapa, a persistencia historica de desafios concluidos fica como proximo passo para backend dedicado.

## Badges Secretos

Foram modelados:

- `Coruja`: postou depois das 23h
- `Madrugador`: postou antes das 5h
- `Relampago`: 3 treinos no mesmo dia
- `Camaleao`: 3 modalidades diferentes na semana
- `Fantasma`: 30 dias ativos sem publicar nenhum story

Os bloqueados aparecem como conquista secreta.

## Tela de Detalhe da Conquista

Ao tocar em qualquer conquista no Hall da Fama, o app abre uma tela dedicada dentro do `MyCircleSheet`, inspirada nos Awards do Apple Fitness.

Estrutura implementada:

- botao voltar com safe area
- botao de compartilhar desativado/placeholder
- arte 3D grande como protagonista
- fundo dark premium com spotlight sutil
- nome, descricao e estado bloqueado/conquistado
- progresso atual
- data de conquista quando disponivel
- ultima conquista quando disponivel
- quantidade de vezes conquistada
- raridade nominal e raridade global
- bloco "Como desbloquear" para conquistas bloqueadas
- bloco especifico de desafios mensais com periodo, fim e recompensa
- animacao curta de entrada
- movimento leve/parallax da arte
- haptic leve via `simulateHaptic`

Conquistas conquistadas podem ser equipadas no perfil. O usuario pode escolher ate 3 conquistas em destaque; a preferencia fica em `localStorage` por usuario. Se o usuario nao escolher nada, o app usa a prioridade automatica:

1. Reliquias
2. Trofeus
3. Desafios
4. Medalhas
5. Badges

## Performance

Raridade global e Founder status entram no refresh secundario, nao no boot critico.

O app carrega:

- perfil/feed/stories primeiro
- founder/raridade em background
- contagem historica leve de stories em background
- detalhe completo quando o usuario abre o Hall da Fama

## Debitos Tecnicos Encontrados

- `first-comment` ja possui backend para raridade global, mas o helper client-side ainda nao recebe contagem historica de comentarios por usuario.
- desafios mensais ainda nao possuem tabela historica de premios concedidos.
- a arte 3D e CSS-based; assets 3D dedicados podem entrar depois.
- a raridade usa perfis ativos como denominador, nao todos os perfis historicos deletados/suspensos.
- conquistas equipadas usam cache local por enquanto; sincronizar em Supabase pode entrar quando existir tabela de preferencias de gamificacao.

## Funcionalidades Ainda Nao Migradas

- tela dedicada full-screen de conquistas fora do `MyCircleSheet`
- compartilhar conquista em post/story
- ranking por conquista
- historico mensal permanente de challenges
- sincronizacao cloud das conquistas equipadas

## Testes

Cobertura adicionada/atualizada:

- badges legados migrados para `AchievementV2`
- destaque prioriza reliquias/trofeus
- relíquia Fundador depende de `isFounder` vindo do backend
- raridade global e anexada a conquista
- desafios mensais exclusivos
- badges secretos por comportamento real de posts
- metadados usados na tela de detalhe
- storyCount real para `Primeiro story` e `Fantasma`
