# Build 7 (TestFlight) — Checklist · Sprint 18

> Passo 2 do plano iPhone (11/jun/2026). Marketing version permanece
> **1.1.0**; build **7** (bump via `node scripts/bump-version.mjs --build`).
> Pipeline: Xcode Cloud (`ci_scripts/ci_post_clone.sh`: npm ci → build web →
> cap sync ios) → TestFlight.

## O que este build entrega (represado desde o build 6)

| Item | Commit | Área |
|------|--------|------|
| Splash nativa com logo novo (duplo-C) | sprint splash | Shell |
| Câmera: mídia capturada via filesystem (plugin novo) | `43e800e` | Shell/plugin |
| Calendário nativo: vídeo sem thumbnail não quebra a célula | `dbaa3d1` | GymCircleNative* |
| Multi-tags na contagem de tipos (paridade Hall) | `89c2ae1` | GymCircleNative* |
| Row "Conquistas em destaque" 15.5 + Hall alcançável no MyCircle nativo | `44ae442` | GymCircleNative* |

> \* Os itens GymCircleNative chegam no app via o plugin bridge (MyCircle
> nativo) — embarcados no mesmo archive do shell.

## Pré-archive (feito em 11–12/jun)

- [x] `Package.resolved` com `ion-ios-filesystem 1.1.2` pinado (`d368d52`) — era o erro do Xcode Cloud
- [x] `npx cap sync ios` limpo (7 plugins, zero mutação)
- [x] Build do shell em simulador VERDE (validação local pré-archive)
- [x] Bump build 6 → 7 (`scripts/bump-version.mjs --build`)
- [ ] **Eduardo**: disparar o workflow no Xcode Cloud (ou archive local) — confirmar que o signing troca `aps-environment` pra `production` no archive (push tem que chegar no TestFlight)

## Release notes (What's New — TestFlight)

**PT-BR:**
> • Carrossel: agora dá zoom com dois dedos em qualquer foto
> • Hall da Fama no MyCircle: suas conquistas em destaque com acesso direto ao hall
> • Calendário mais confiável: todos os seus treinos aparecem, incluindo posts com vídeo
> • Câmera e galeria mais rápidas e estáveis
> • Visual: novo logo na abertura + correção de imagens piscando

**EN:**
> • Carousel: pinch to zoom on any photo
> • Hall of Fame in MyCircle: featured achievements with direct hall access
> • More reliable calendar: every workout shows up, including video posts
> • Faster, more stable camera and gallery
> • Visual: new launch logo + fix for flashing images

## Smoke no iPhone real (pós-instalação do build 7)

### Regressões das correções recentes
- [ ] Feed: scroll sem flash preto nas imagens
- [ ] Carrossel: 1 dedo desliza · 2 dedos dá zoom · soltar volta suave
- [ ] Post único: pinch-zoom segue funcionando (thumb→HD sem flash)
- [ ] Câmera: tirar foto → preview → publicar (fluxo filesystem novo)
- [ ] Galeria: multi-select até 10 → carrossel publica
- [ ] Calendário (MyCircle): maio com fotos; 08/05 (vídeo) = célula sólida CLICÁVEL
- [ ] Desafios: progresso bate com a web (grupo a dois conta; tags múltiplas contam)

### Pendências antigas de stories (known-issues 30/mai — NUNCA re-validadas)
- [ ] **Viewed state**: ver story → fechar app → reabrir → ring NÃO volta azul
- [ ] **Continuidade**: stories avançam entre AUTORES sem fechar o viewer

### Novidades nativas deste build
- [ ] Splash: logo novo (duplo-C) na abertura
- [ ] MyCircle nativo: seção "Conquistas em destaque" (até 3 cards) no lugar do badge único
- [ ] Botão pill cinza → abre o **Hall da Fama nativo** (primeira vez alcançável!)
- [ ] Tap num card → detail com raridade; tap dentro do hall → detail aninhado
- [ ] Hall: contagem de tipos distintos IGUAL à web (Musculação == musculacao)

### Push
- [ ] Receber 1 push (like/comment de outra conta) com o app fechado

## Se algo falhar
Anotar tela + passo e me mandar — fix web chega via deploy (sem novo build);
fix Swift entra no build 8.
