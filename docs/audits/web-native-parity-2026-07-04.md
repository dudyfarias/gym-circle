# Auditoria de paridade Web ↔ Nativo — Gym Circle

_2026-07-04 · base: `main` @ Fase 2 GPS + overlay de detalhes_

Comparação feature-a-feature entre o app **web** (`apps/web/src/components/gym-circle`)
e o app **nativo SwiftUI** (`ios-native/GymCircleNative/Sources/GymCircleNativeFoundation`).
Legenda: ✅ paridade · ⚠️ parcial · ❌ só num lado.

## Resumo

O nativo está muito próximo de 100%. Os gaps materiais restantes são **stories
(criar/likes/mutes)**, o **overlay de detalhes do treino nos posts promovidos**
(hoje só nas entradas de atividade), e alguns polimentos de perfil/onboarding.
Nada bloqueia o cutover; são incrementos.

## Áreas

### 1. Feed — post
| Item | Web | Nativo | Nota |
|---|---|---|---|
| Card, carrossel + dots, curtir otimista | ✅ | ✅ | |
| Comentários (sheet, reply, like, delete) | ✅ | ✅ | Sprint 20.3b |
| Likes overlay | ✅ | ✅ | |
| Menu do post (silenciar/denunciar/apagar/editar) | ✅ | ✅ | `FeedPostCard` menu |
| Participantes / marcações + aceite | ✅ | ✅ | |
| Vídeo (player) | ✅ | ✅ | |
| Compartilhar | ✅ | ✅ | |
| Sugestões inline "pra seguir" | ✅ | ✅ | após 2º post |

### 2. Check-ins no feed
| Item | Web | Nativo | Nota |
|---|---|---|---|
| Card de check-in | ✅ | ✅ | `FeedCheckinCard` |
| "Adicionar fotos" → promove a post | ✅ | ✅ | via EditPostSheet (nativo) |
| Editar check-in | ✅ | ✅ | |

### 3. Entradas de atividade / treino (rastreio)
| Item | Web | Nativo | Nota |
|---|---|---|---|
| FeedActivityCard (stats, badge) | ✅ | ✅ | |
| Rota / mini-mapa | ✅ (exibe) | ✅ (grava+exibe) | web timer-only por decisão |
| Ritmo / distância / elevação no card | ✅ | ✅ | Fase 2 |
| "Adicionar fotos" → promove a post | ✅ | ✅ | source_activity_id |
| **Overlay de detalhes (Apple Atividades)** | ✅ | ✅ | tocar nos stats da entrada |
| **Overlay em POST promovido (com foto)** | ❌ | ❌ | **GAP** — precisa join `posts→activities` no `get_home_feed` |

### 4. Stories
| Item | Web | Nativo | Nota |
|---|---|---|---|
| Tray | ✅ | ✅ | |
| Viewer | ✅ | ✅ | Sprint 20.5 |
| Criar story | ✅ | ⚠️ | via composer (destino story); sem editor dedicado |
| Likes / mutes / participantes de story | ✅ | ⚠️ | **GAP parcial** — likes/mutes de story menos completos no nativo |

### 5. Composer
| Item | Web | Nativo | Nota |
|---|---|---|---|
| Fotos/vídeo múltiplos (até 10) | ✅ | ✅ | |
| Tags de treino (presets + livre) | ✅ | ✅ | |
| Academia / gym picker | ✅ | ✅ | |
| Marcar amigos | ✅ | ✅ | |
| Destinos feed/story | ✅ | ✅ | |
| Check-in sem mídia | ✅ | ✅ | |
| Registrar treino retroativo | ✅ | ✅ | workoutDate |
| activityContext (treino → entrada/post) | ✅ | ✅ | Slice 2 |

### 6. Rastreio de treino
| Item | Web | Nativo | Nota |
|---|---|---|---|
| Iniciar treino + seletor de tipo | ✅ | ✅ | |
| Cronômetro + timer de descanso | ✅ | ✅ | |
| HealthKit (FC/kcal + escrita) | ❌ (n/a) | ✅ | web não acessa Saúde |
| GPS / rota (outdoor) | ❌ (n/a) | ✅ | Fase 2 |
| Importar do Apple Saúde | ❌ (n/a) | ✅ | hub + tela de iniciar |
| Botão importar na tela de iniciar | — | ✅ | adicionado hoje |

### 7. Perfil (próprio + terceiros)
| Item | Web | Nativo | Nota |
|---|---|---|---|
| Grid de posts | ✅ | ✅ | |
| Calendário mini-fotos | ✅ | ✅ | |
| Editar perfil | ✅ | ✅ | EditProfileSheet |
| Follow/unfollow + follow-back | ✅ | ✅ | |
| Privacidade (perfil privado) | ✅ | ✅ | canSeeDetails |
| Bio / counts | ✅ | ✅ | |

### 8. MyCircle
| Item | Web | Nativo | Nota |
|---|---|---|---|
| Streak + badge destaque | ✅ | ✅ | |
| Competição / ranking (escopo+período) | ✅ | ⚠️ | **GAP parcial** — ranking web (Sprint 19); nativo mostra menos |
| Recap mensal | ✅ | ✅ | |

### 9. Hall da Fama / conquistas
| Item | Web | Nativo | Nota |
|---|---|---|---|
| Hall / detalhe / featured | ✅ | ✅ | |
| Celebração (confetti) | ✅ | ✅ | |
| Desafios mensais | ✅ | ✅ | |
| Recolor de raridade (paleta clássica) | ✅ | ⚠️ | **GAP** — recolor foi só web (Sprint 19); nativo usa palette antigo + GLBs a regenerar |

### 10–15. Chat, busca, notificações, push, onboarding, config
| Item | Web | Nativo | Nota |
|---|---|---|---|
| Chat / DMs | ✅ | ✅ | Sprint 20.6 |
| Busca de pessoas | ✅ | ✅ | |
| Notificações (sheet + tap→post/perfil) | ✅ | ✅ | |
| Push notifications | ✅ | ⚠️ | pipeline em finalização (WIP Codex) |
| Onboarding / hints contextuais | ✅ | ⚠️ | **GAP parcial** — hints de primeira-visita menos completos |
| Config / ajustes | ✅ | ✅ | SettingsSheet nativo |

## Plano priorizado

### P0 — fecham gaps visíveis de conteúdo
1. **Overlay de detalhes em posts promovidos**: `get_home_feed` LEFT JOIN
   `activities` on `source_activity_id` → expor distance/pace/hr/elev/route no
   `FeedPost`; tornar o header/stats do post com treino tocável (web + nativo).
2. **Recolor de raridade nativo** + regen dos GLBs 3D no novo palette (passe 21b).

### P1 — completar features existentes
3. **Stories**: paridade de likes/mutes/participantes no nativo; avaliar editor
   de story dedicado.
4. **Competição/ranking nativo**: portar a UI de escopo (amigos/geral) +
   período (semana/mês/ano) que já existe no web.
5. **Push nativo**: fechar o pipeline (após o WIP do Codex estabilizar).

### P2 — polimento
6. Hints contextuais de primeira-visita no nativo (paridade Sprint 7C.3).
7. Sweep de micro-strings/haptics faltantes.

## Notas
- Métricas de treino (distance/moving/elevation/route/started/ended) já estão na
  tabela `activities` e expostas em `get_home_activities`; o gap P0.1 é só
  espelhar isso no feed de posts.
- Web é **timer-only** para rastreio por decisão de produto (precisão fica no
  app); isso NÃO conta como gap.
