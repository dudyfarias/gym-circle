# Sprint 20.8 — Cutover: o app da loja VIRA o nativo

> O update do `com.gymcircle.app` substitui o shell Capacitor pelo
> standalone SwiftUI. **Sem app novo na loja** — bundle id é o mesmo,
> review normal de update. Este doc é o checklist; a execução (archive +
> submissão) é do Eduardo, como nos builds anteriores.

## Pré-condições (estado em 12/jun/2026)

- [x] Paridade funcional: 20.0–20.7a + completion pass P0-P2 + fase 21
      (Hall Apple-style 2D) — matriz em docs/audits/native-web-parity-audit.md
- [x] Entitlements preparados (push, associated domains, HealthKit) em
      Support/GymCircleNative.entitlements
- [x] Rotas web /post/* e /u/* existem (alvos do AASA)
- [ ] Smoke completo no iPhone físico com o `.dev` (ciclo: login →
      stories → feed → publicar c/ câmera+vídeo+academia+marcação →
      comentar → chat c/ foto e grupo → check-in → notificações → Hall)
- [ ] Troféus 3D (fase 21b) — NÃO bloqueia o cutover (Hall 2D no ar)

## Decisões que só o Eduardo pode tomar

1. **Sessão**: o shell guarda a sessão no WebView (localStorage); o
   nativo usa Keychain. No update os usuários **logam de novo** (1x).
   Alternativa (migrar lendo WKWebsiteDataStore) custa ~1 sprint — a
   recomendação com a base atual é aceitar o re-login.
2. **Versão de marketing**: recomendação **2.0.0** (é o salto pro
   nativo; release notes prontas no template do build 7).
3. **Janela**: cutover só depois de 1 ciclo de TestFlight do standalone
   com o bundle `.dev` validado no aparelho.

## Passos técnicos (em ordem)

1. ✅ **Apple Developer** (15/jun): no App ID `com.gymcircle.app`,
   habilitadas Push Notifications, Associated Domains e HealthKit
   (Eduardo). Provisioning regenerado/automático.
2. ✅ **project.yml** (15/jun): versão `2.0.0`/build `1` + bundle id flipado
   `com.gymcircle.native.dev` → `com.gymcircle.app` (e `.tests`) +
   `xcodegen generate`. Build + 50/50 testes verdes no simulador.
   `CODE_SIGNING_ALLOWED: NO` mantido (sim/CI); o signing/team do archive é
   no Xcode/Xcode Cloud (não vai no repo, regra do CLAUDE.md).
3. ✅ **Ícones/splash** (15/jun): asset catalog do shell copiado pra
   `Resources/Assets.xcassets` + registrado no project.yml; actool compila
   `--app-icon AppIcon` (antes subia em branco).
4. **APNs**: o trigger SQL (Sprint 10.7) e a Edge Function já mandam
   push pros tokens de device_push_tokens — o nativo registra na mesma
   tabela (platform ios). Validar 1 push end-to-end no TestFlight.
5. **Archive + upload**: Xcode Cloud (mesmo fluxo do build 7) apontando
   pro scheme GymCircleNative.
6. **TestFlight interno** → smoke do checklist acima no aparelho.
7. **Submissão**: release notes 2.0 (PT/EN), screenshots novos se a UI
   divergir visivelmente dos atuais, responder review se necessário
   (conta applereview segue válida).
8. **Pós-aprovação**: o repositório mantém o shell (ios/App) por 1
   versão como rollback; remoção definitiva + aposentadoria do deploy
   OTA na 20.9.

## Riscos

| Risco | Mitigação |
|---|---|
| Re-login surpreende usuários | Release notes explicando ("app 2.0, entre de novo") + push avisando |
| Push para de chegar pra quem não atualizou | Tokens antigos do shell continuam na tabela — Edge Function manda pros dois |
| Review pega feature regredida vs web | Matriz de paridade é o contrato; pendências conhecidas estão documentadas |
| Rollback | Shell preservado no repo; re-submeter build antigo se necessário |
