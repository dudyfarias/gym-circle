# Punch-list de fidelidade — nativo 100% igual ao web (design/UI/UX)

> Decisão do Eduardo (12/jun/2026): paridade TOTAL, inclusive navegação.
> Este doc é o contrato de design. A matriz de features vive em
> native-web-parity-audit.md; aqui é só UI/UX.

## ✅ Concluído

- [x] **Navegação = BottomNav web**: Início · Conversas (badge unread) ·
      Postar · Mapa (check-in) · Perfil. MyCircle virou sheet pelo anel
      de streak no topo do feed.
- [x] **#1 Tipografia black/uppercase**: `GCText.Style.sectionLabel`
      (11px heavy UPPERCASE tracking 0.8, cor terciária 52%) criado +
      token `tertiaryText`. Field labels seguem `.headline` (igual aos
      campos bold do web); section dividers usam o estilo novo.
- [x] **#2 Glass tab bar**: `.toolbarBackground(.ultraThinMaterial)`.
- [x] **#3 i18n EN**: helper `Loc.swift` (PT/EN inline) + sweep COMPLETO
      das telas novas — Feed, Composer, Chat, Check-in, Notificações,
      Hall, Settings, Likes, PeopleSearch, Comments, Stories, tabs.
      ~140 strings, ambos idiomas.
- [x] **#4 Raio dos cards**: GCCard 24 (rounded-3xl) + MediaView 22 —
      já batiam com o web.
- [x] **#6 Skeletons**: `GCSkeleton` (shimmer) + `GCFeedSkeleton` no
      load do feed (substitui o spinner).
- [x] **#8 Empty states**: copy 1:1 com o web (feed.empty.*,
      comments.empty.* conferidos no pt-BR.json e en.json).
- [x] **#9 Haptics**: auditado — impactLight (like/story/reply),
      success (publish/comment/check-in/mute), error (falhas),
      selection (tags/membros/gym). Distribuição equivalente ao web.
- [x] **#10 Stories tray**: ring gradiente angular brand→deep.

## Decisões de plataforma (deliberadas, não são gap)

- **#5 Chrome direcional**: o web esconde header/footer por direção de
  scroll. No iOS a navigation bar colapsa por plataforma; esconder a
  tab bar por scroll é anti-padrão da Apple. MANTÉM comportamento iOS
  (paridade "pra cima"). Sheets vs pages, back-gesture e large titles
  também seguem o padrão iOS quando ele é superior.
- **#7 Animações**: delays 0/80/160ms (detail) e confetti (celebration)
  já têm paridade desde 9.8.1/9.8.2. Float dos artefatos entra com os
  GLB 3D (passe 21b).

## Follow-up cosmético (não bloqueante)

- Aplicar `sectionLabel` em mais cabeçalhos onde o web usa uppercase
  (hoje só onde já era uppercase). Field labels em `.headline` são
  aceitáveis e legíveis.
- Skeletons dedicados pra chat e notificações (hoje GCLoadingView).

## Como validar

Simulador + web mobile (conta applereview), tela a tela. Trocar o
idioma do iPhone pra EN valida o #3 de uma vez.
