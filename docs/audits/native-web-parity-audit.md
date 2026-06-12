# Auditoria de Paridade — Web ↔ Nativo SwiftUI

> 11/jun/2026 (main @ `89c2ae1`). Objetivo declarado pelo Eduardo: **nativo
> 100% igual ao web em funcionalidades, UI e UX**. Este doc é o mapa de
> navegação das fases 20.1→20.7 — atualizar a cada fase concluída.
>
> Legenda: ✅ paridade | 🟡 parcial (existe com gaps) | ❌ inexistente no nativo

## Paridade estimada hoje: ~35%

A web tem 6 telas de tab + **22 sheets/overlays**; o nativo tem 14 telas
(1.311 linhas nas 5 principais vs ~6.000+ no web) com 2 tabs placeholder.

## Estrutura de navegação

| Web (5 tabs) | Nativo (5 tabs) | Status |
|---|---|---|
| Feed | Home (FeedView) | 🟡 |
| Post (composer) | Criar — **placeholder** "fica para a próxima sprint" | ❌ |
| Check-in | — (nativo tem tab Circle no lugar) | ❌ (decisão de produto pendente: check-in pode ser aposentado — ver ux-product-audit) |
| Chat | Chat — **placeholder** "fase futura" | ❌ |
| Profile | Perfil | 🟡 |
| MyCircle (sheet) | Circle (tab) | 🟡 — divergência de navegação ACEITA (tab nativa é melhor UX) |

## Matriz por área

### Feed (web FeedScreen + SocialPostCard ↔ FeedView 120 linhas)
| Feature | Web | Nativo | Fase |
|---|---|---|---|
| Lista de posts + autor/streak | ✅ | ✅ (via get_home_feed? verificar RPC usada) | — |
| Contadores like/comment | ✅ | ✅ (só display) | — |
| **Curtir (ação)** | ✅ | ✅ (20.3a — otimista + rollback) | — |
| **Comentários (sheet + replies + likes + swipe-delete)** | ✅ | ✅ (20.3b) | — |
| **Carrossel multi-mídia + dots** | ✅ | ✅ (20.3a — dots abaixo; vídeo = poster+play até 20.3b) | — |
| Mute de autor/post, report, menu | ✅ | ❌ | 20.3 |
| Distância do viewer | ✅ | ❌ | 20.3 |
| Participantes (grupo) + aceite | ✅ | ❌ | 20.3 |
| Likes overlay (quem curtiu) | ✅ | ❌ | 20.3 |
| Stories tray no topo | ✅ | 🟡 (StoriesViews 112 linhas — viewer básico) | 20.5 |
| Paginação infinita | ✅ | ✅ (20.3a — cursor no penúltimo post) | — |
| Pull-to-refresh | ✅ | ✅ (20.3a) | — |

### Stories (StoryViewer 714 linhas ↔ StoriesViews 112)
| Feature | Web | Nativo | Fase |
|---|---|---|---|
| Viewer com progress bar / pause | ✅ | 🟡 | 20.5 |
| Like, reply (DM), share, mute, report | ✅ | ❌ | 20.5 |
| Continuidade entre autores | ✅ | ❌ | 20.5 |
| Criação (story junto do post) | ✅ | ❌ (depende do composer) | 20.4 |
| Ring viewed/unviewed no avatar | ✅ | ✅ (9.8.3/10.1) | — |

### Composer (PostScreen 1.012 linhas ↔ placeholder)
| Feature | Web | Nativo | Fase |
|---|---|---|---|
| Câmera single / galeria multi (até 10) | ✅ | 🟡 (20.4a — galeria multi OK; câmera/vídeo 20.4b) | 20.4b |
| Upload + thumbnail/poster | ✅ | ✅ (20.4a — feed 1600px + thumb 720px; poster de vídeo 20.4b) | — |
| Tags de treino (até 5, chips + Outro) | ✅ | ✅ (20.4a) | — |
| Localização (busca + academias) | ✅ | ❌ | 20.4 |
| Marcação de participantes | ✅ | ❌ | 20.4 |
| Editar post (mídia/legenda/tipo) | ✅ | ❌ | 20.4 |

### MyCircle (MyCircleSheet 725 ↔ MyCircleView 622 — a área mais madura)
| Feature | Web | Nativo | Fase |
|---|---|---|---|
| Header + rings + streak badge + levels | ✅ | ✅ | — |
| Calendário ← → + mini-fotos + tap abre post | ✅ | ✅ (fix vídeo dbaa3d1 já portado) | — |
| **Conquistas em destaque (15.5: row + botão Hall)** | ✅ | ❌ (ainda badgeHighlight 5.9) | **20.1 — NESTE COMMIT** |
| Desafios do mês (+ secretos) | ✅ | ✅ (read-only por design) | — |
| Recap CTA + período + capa | ✅ | ✅ | — |
| Competição placeholder | ✅ | ✅ (paridade do placeholder 😄) | 19 nos dois |
| Privacy lock (terceiros) | ✅ | ✅ | — |
| First-visit hint | ✅ | ✅ | — |

### Hall da Fama (AchievementsSheet pós-Sprint 15 ↔ AchievementsView 309)
| Feature | Web | Nativo | Fase |
|---|---|---|---|
| **Alcançável na UI** | ✅ | ❌ **órfão — NENHUMA tela apresenta o AchievementsView** | **20.1 — NESTE COMMIT (via botão da row)** |
| Layout Apple Awards (hero próximo + destaque + grid categorias + vista 3-col) | ✅ (Sprint 15) | ❌ (layout antigo de tabs) | 20.1 |
| Artefatos 3D (badge/medal/trophy/relic, 7 tones, float) | ✅ | ❌ (BadgeIcon 2D) | 20.1 (spike de abordagem) |
| Detail com raridade global/"você é o primeiro" | ✅ | ✅ (8.5/9.7.3) | — |
| Celebration overlay + confetti | ✅ | ✅ (8.7/9.8.1) | — |
| Multi-tags na contagem de tipos | ✅ | ✅ (20.0) | — |

### Profile (ProfileScreen ↔ ProfileView 148)
| Feature | Web | Nativo | Fase |
|---|---|---|---|
| Header + stats + grid de posts | ✅ | ✅ | — |
| Featured achievements row | ✅ (15.5: 3D + botão Hall) | 🟡 (8.12.1: 2D, sem botão) | 20.1 |
| Tap no post do grid abre detail completo | ✅ | ❓ verificar | 20.2 |
| Edit profile (todos os campos) | ✅ | ✅ (9.9.2) | — |
| **Settings (idioma, privacidade, suspender/apagar conta, legal)** | ✅ | ❌ | 20.2 |
| Followers/Following overlay | ✅ | ✅ (9.5.4/FollowList) | — |
| OtherProfile + follow/aceite + privacy | ✅ | ✅ (8.13.6/9.8.4) | — |
| Avatar upload | ✅ | ✅ (9.2) | — |

### Áreas inteiras sem nativo
| Área | Web | Fase |
|---|---|---|
| Chat (1:1, grupo, vídeo, delete-for-me, busca) | ChatScreen 1.336 linhas | 20.6 |
| Notificações (sheet + CTAs + routing) | NotificationsSheet 944 | 20.7 |
| Check-in + GymSearch | CheckInScreen 896 + GymSearchSheet 836 | decisão de produto (17/19) |
| Busca/descoberta de pessoas + sugestões | search + get_user_suggestions | 20.3 |
| Onboarding contextual (hints 7C) | ContextualHint | 20.2+ (transversal) |
| PWA-only (push web, install) | — | n/a |

## UI/UX — diferenças de sistema (avaliar caso a caso)
- Web usa sheets empilhados z-index; nativo usa sheets/fullScreenCover do
  SwiftUI — manter o COMPORTAMENTO igual, não a implementação.
- Haptics: web simula; nativo tem UIImpactFeedbackGenerator real — nativo
  pode ser MELHOR (paridade "para cima" é aceitável).
- Fontes/espessuras: web usa fonte black/uppercase tracking; conferir
  GymCircleTheme a cada tela portada (tokens já existem — Sprint 9.6.3).

## Ordem de fechamento (atualiza o plano mestre)
1. **20.1** MyCircle row 15.5 + Hall alcançável (HOJE) → Hall layout Apple → artefatos 3D (spike) → ProfileView migra pra row compartilhada.
2. **20.2** Settings nativas + post detail do grid + hints.
3. **20.3** Feed completo (ações, carrossel, comentários, paginação) + busca.
4. **20.4** Composer (maior bloco).
5. **20.5** Stories completo. **20.6** Chat. **20.7** Notificações + push + deep links.

> Pré-requisito transversal (do plano mestre): mover regras de gamificação
> pra server-side antes do cutover — evita re-divergência durante a transição.
