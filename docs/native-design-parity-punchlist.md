# Punch-list de fidelidade — nativo 100% igual ao web (design/UI/UX)

> Decisão do Eduardo (12/jun/2026): paridade TOTAL, inclusive navegação.
> Este doc é o contrato de design — riscar item a item. A matriz de
> features vive em native-web-parity-audit.md; aqui é só UI/UX.

## ✅ Feito neste passe

- [x] **Navegação = BottomNav web**: Início · Conversas (badge unread) ·
      Postar · Mapa (check-in) · Perfil — mesma ordem, mesmos conceitos.
      MyCircle saiu de tab e virou SHEET aberta pelo anel de streak no
      topo do feed (gesto idêntico ao web). Revoga a "divergência aceita"
      da auditoria de 11/jun.
- [x] **Tokens exatos**: cyan = --gc-brand #8af7ff (era #8CFBFF);
      card #111111, elevated #1c1c1e, separator 6%, secondary #a1a1aa,
      pink #ff2d55 — todos batem com globals.css.
- [x] Hall da Fama = layout Apple Awards da Sprint 15 (2D; GLB → 21b).

## 🔲 Próximos passes (em ordem de percepção do usuário)

1. **Tipografia black/uppercase**: o web usa títulos `font-black` e
   section labels `text-[11px] font-heavy uppercase tracking-[0.8]`.
   GCText.Style precisa de um caso `sectionLabel` aplicado em TODAS as
   seções (MyCircle já faz; Feed/Chat/Composer/Check-in não).
2. **Glass tab bar**: web usa tab bar flutuante com backdrop blur
   (--gc-glass). SwiftUI: `.toolbarBackground(.ultraThinMaterial, for: .tabBar)`
   + tint. Hoje a tab bar é o default opaco.
3. **i18n EN**: telas novas (Chat, Check-in, Notificações, Hall, Settings,
   Composer, sheets) têm strings PT hardcoded — web é PT/EN via i18next.
   Sweep via L10n (mesmo padrão da Sprint 8.11.5/9.9.1).
4. **Raio dos cards**: web usa rounded-3xl (24px) nos cards de post e
   22px nas mídias; conferir GCCard e MediaView contra o web (hoje 22).
5. **Chrome direcional**: web esconde header ao rolar pra baixo e footer
   ao rolar pra cima. iOS nativo: navigation bar já colapsa (platform
   behavior); tab bar usar `.toolbar(.hidden, for: .tabBar)` condicionado
   a scroll é anti-padrão iOS — DECISÃO: manter comportamento de
   plataforma (paridade "pra cima", como anotado na auditoria de UX).
6. **Skeletons**: web tem FeedSkeleton/shimmer; nativo usa GCLoadingView.
   Portar shimmer pros loads de feed/chat/notificações.
7. **Animações-chave**: web tem delays 0/80/160ms no detail (nativo já
   tem — 9.8.2), confetti celebration (nativo tem — 9.8.1), float dos
   artefatos (entra com os GLB na 21b).
8. **Empty states ilustrados**: conferir copy 1:1 com os do web
   (alguns nativos têm copy aproximada).
9. **Haptics map**: web simula; nativo já usa UIImpactFeedback nos
   pontos principais — auditar 1:1 os triggers (like, publish, accept).
10. **Stories tray**: ring gradiente do web (brand→deep) vs stroke
    sólido nativo; portar gradiente angular.

## Como validar

Lado a lado: simulador + web mobile (mesma conta applereview), tela a
tela, com o checklist acima. Divergência de PLATAFORMA (sheet vs page,
back gesture, large title) é aceitável quando o padrão iOS é superior —
tudo o mais segue o web.
