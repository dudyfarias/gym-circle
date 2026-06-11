# Gym Circle — Features: Inventário + Oportunidades

> Read-only, 11/jun/2026.

## Inventário de features existentes

| Feature | Estado | Onde | O que falta / nota |
|---------|--------|------|--------------------|
| Feed (carrossel, likes, mute, distância) | **Completa** | screens/HomeScreen + SocialPostCard | Virtualização (escala); empty state de rede pequena |
| Stories (criar via post, viewer, likes, mute, participantes) | Completa, **sem polish** | StoryViewer + StoriesService | Bug B3 (setState-in-effect); continuidade entre autores a re-validar |
| Chat (1:1, grupo, delete-for-me, vídeo) | **Completa** | ChatScreen + RPCs atômicas | Polling → realtime por conversa (escala); consolidar RPC delete duplicada |
| Comentários (replies, likes, swipe-delete, negrito menções) | **Completa** (Sprint 12) | CommentsBottomSheet | Verificar `_parentCommentId` órfão (B7) |
| Perfil + EditProfile | Completa | ProfileScreen/EditProfileSheet | — |
| MyCircle (rings, calendário c/ fotos, níveis, recap, desafios) | **Completa** | MyCircleSheet + nativo | Badge "+N" no dia com 2+ posts |
| Badges/Medalhas/Troféus/Relíquias (28 estáticos + secretos) | **Completa e premium** | achievements.ts + Hall 3D (Sprint 15) | Paridade Swift (drift B10) |
| Monthly Challenges (4 kinds + secretos + push) | **Parcial** | monthlyChallenges.ts | 2 goal kinds não implementados (B4); recompute só no boot; junho seedado — **falta seed de JULHO** (processo mensal manual!) |
| Hall da Fama overlay (web) | Completa (Sprint 15/15.5) | AchievementsSheet | Réplica nativa pendente (próximo build) |
| Onboarding contextual (hints por tela) | Completa (7C) | ContextualHint | Cobrir telas novas (Hall, composer multi) |
| Sugestões de amizade | Completa | get_user_suggestions | Algoritmo simples; "pessoas que talvez você conheça" v2 |
| Follow system (privado, aceite, follow-back) | Completa | follows + RLS | — |
| Notificações in-app (bell social) | Completa | NotificationsSheet | — |
| Push (APNs + web push + triggers) | **Completa (foundation)** | send-push + tokens | Sem preferências por tipo; sem quiet hours |
| Check-ins + Academias (busca, localização) | **Funcional, uso baixo** | CheckInScreen/GymSearchSheet | Decisão de produto: fundir com post ou aposentar |
| Recap mensal compartilhável | Completa, **escondida** | MonthlyRecapSheet | Promover (push dia 1 do mês) |
| Streak restore | Completa | use_streak_restore | Comunicar existência |
| Analytics (triggers SQL) | Foundation | private.analytics_* | Sem dashboard de leitura |
| Admin | Parcial (página admin p/ user dudy) | openAdmin | Moderação de reports não tem UI |
| PWA Android | Completa (manifest+SW+splash) | public/ | — |
| SwiftUI foundation | Parcial (14 telas espelho) | ios-native | Ver swiftui-native-audit |
| Workout builder ("Meu Treino") | **Inexistente** | — | Oportunidade v2.0 |
| Deep links | **Inexistente** | — | v1.2 |
| HealthKit | Inexistente (roadmap doc existe — Sprint 5.6) | docs | v2.0 |

## Novas features sugeridas (priorizadas)

### Curto prazo (v1.1.x — próximas semanas)
| Feature | Por quê | Impacto | Esforço | Risco |
|---------|--------|---------|---------|-------|
| **Seed automático de desafios mensais** (gerador + checklist dia 25) | Julho está a 19 dias e sem seed os desafios SOMEM | Alto (retenção) | Baixo | Nenhum |
| Recompute de desafio pós-publish | Gamificação reage na hora | Alto | Baixo | Regressão de progress (fazer com guard B5) |
| Badge "+N" no calendário | Mata o "post sumiu" | Alto confiança | Baixo | — |
| Push de recap no dia 1 ("Seu mês fechou 💪") | Growth/retorno | Alto | Baixo (infra pronta) | Tom de notificação |

### Médio prazo (v1.2)
| Feature | Por quê | Impacto | Esforço | Dependências |
|---------|--------|---------|---------|--------------|
| **Universal links** (post/perfil/convite) | Compartilhar = aquisição | Alto | Médio | AASA + Associated Domains + rotas |
| Ranking semanal do Circle (entre amigos) | Competição leve = retenção | Alto | Médio | user_stats_live |
| Shareable Circle card (story do IG com rings) | Growth orgânico | Alto | Médio | Canvas já existe (recap) |
| Preferências de push por tipo | Higiene anti-uninstall | Médio | Baixo-médio | — |
| Moderação mínima (UI de reports + ação) | Obrigação de loja em escala | Médio | Médio | reports table pronta |

### Longo prazo (v2.0)
| Feature | Por quê | Impacto | Esforço |
|---------|--------|---------|---------|
| Meu Treino / workout builder (fichas, séries) | Vira utilidade diária além do social | Muito alto | Alto |
| HealthKit (anéis reais, passos, treino automático) | Diferencial iOS + dados ricos | Alto | Alto |
| App SwiftUI standalone (fases: MyCircle → Profile → Feed) | Performance/feel nativos | Alto | Muito alto |
| Android nativo (ou manter PWA turbinada) | Alcance | Alto | Muito alto |
| Admin/Analytics dashboard (web interno) | Operação com 10k+ users | Médio | Médio |
| Apple Maps nas academias (já há lat/lng) | Polimento | Baixo-médio | Baixo |
