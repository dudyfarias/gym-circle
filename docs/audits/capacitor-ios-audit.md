# Gym Circle — Auditoria Capacitor / iOS

> Read-only, 11/jun/2026. Fontes: `capacitor.config.ts`, `ios/App` (Info.plist, entitlements, pbxproj), `native-fallback/`.

## Configuração (capacitor.config.ts)

| Item | Valor | Avaliação |
|------|-------|-----------|
| `appId` | `com.gymcircle.app` | OK (imutável, documentado) |
| `server.url` | `https://gym-circle-rust.vercel.app` | Estratégia híbrida-remota correta pro estágio atual (fix sem rebuild) |
| `cleartext` | `false` | OK |
| `allowNavigation` | inclui `*.vercel.app` | **Estreitar** — wildcard deixa qualquer site vercel.app abrir dentro do shell (ver security-audit) |
| `limitsNavigationsToAppBoundDomains` | `false` | Aceito (auth externa); reavaliar no nativo |
| SplashScreen | `launchShowDuration: 4200`, autoHide true, `hide()` manual antes | OK como fallback; medir tempo real e reduzir teto se possível |
| Keyboard | `resize: "native"`, DARK | OK (relatos antigos de keyboard resolvidos) |
| StatusBar | DARK, sem overlay | OK |
| ScreenOrientation | portrait lock (iOS via Info.plist autoritativo) | OK |
| `webDir` | `native-fallback/` (1 index.html offline) | OK — esclarecido: não é app embarcado, é fallback de erro |

## Info.plist — permissões (todas com strings PT-BR de qualidade)

- Câmera, Galeria (read + add), Microfone, Localização when-in-use, Notificações ✓
- Nenhuma permissão sobrando (sem Bluetooth/Contacts/etc. não usados) ✓ — bom pra App Review.

## Entitlements

- `aps-environment: development` no arquivo commitado. Em archive de distribuição o signing troca pra `production` (push funcionou no TestFlight ⇒ pipeline atual ok). **Item de checklist**: confirmar a troca a cada novo Mac/certificado.
- **Sem Associated Domains** → **deep links universais NÃO configurados**. Hoje notificação abre o app e navega internamente; link `https://gym-circle...` compartilhado abre no Safari, não no app. Feature gap mapeado (ver feature-opportunities).

## Versionamento

- `package.json` 1.1.0 (root e web) ↔ `MARKETING_VERSION = 1.1.0`, `CURRENT_PROJECT_VERSION = 6` — **consistentes** ✓.
- Próximo release: bump pra 1.1.1/1.2.0 + build 7; recomendo script único de bump (hoje é manual em 3 lugares).

## `ios/App/App/config 2.xml`

Arquivo **não existe mais** no working tree (verificado). Era cópia acidental ("config 2") já removida. Nada a fazer; `git status` limpo confirma.

## Safe area / WebView

- `contentInset: "always"` + viewport-fit cover no web — relatos de safe area resolvidos nas sprints 4.x/9.6.
- `-webkit-text-size-adjust: 100%` aplicado (fix de font boosting documentado).
- fetch de `file://` bloqueado no WKWebView: já tratado via `Capacitor.convertFileSrc` + PHPicker direto (Sprints 12.3/13.x) — manter como conhecimento de plataforma.

## Push (Capacitor)

- `PushNotifications.presentationOptions: badge/sound/alert` ✓.
- Token APNs em `device_push_tokens` + edge function `send-push` + triggers SQL ✓ ponta-a-ponta implementado.

## Recomendações

1. Estreitar `allowNavigation` (tirar `*.vercel.app` genérico).
2. Adicionar Associated Domains + apple-app-site-association quando fizer deep links (v1.2 sugerida).
3. Script de bump de versão único (package.json x2 + pbxproj).
4. Documentar no checklist de release: validar `aps-environment` no archive.
