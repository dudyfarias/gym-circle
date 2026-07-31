# Android Foundation — 2026-07-30

Status: fundação local implementada e APK debug validado em emulador. Não
publicado e ainda não apto para Google Play.

## 1. Objetivo e escopo

Esta entrega transforma o diretório Android gerado pelo Capacitor em uma base
reproduzível e explicita quais capacidades do Gym Circle podem ser oferecidas
com segurança no Android.

Entraram no escopo:

- build Gradle com SDK Android 36;
- instalação e smoke do APK debug;
- identidade visual, splash e barras do sistema;
- orientação portrait;
- permissões foreground de localização;
- segurança básica de backup, arquivos compartilhados e credenciais;
- gate de capacidades iOS/Android/web;
- matriz de paridade e release gate.

Não entraram:

- Firebase/FCM e push Android end-to-end;
- serviço nativo de GPS em background;
- Health Connect;
- App Links e recuperação de OAuth por deep link;
- assinatura de release e publicação na Play Console;
- alterações no app SwiftUI paralelo.

## 2. Ambiente validado

| Item | Valor |
|---|---|
| Host | macOS arm64 |
| JDK | JetBrains Runtime 21 do Android Studio |
| Android SDK | `~/Library/Android/sdk` |
| compile/target SDK | 36 |
| min SDK | 24 |
| Android Gradle Plugin | 8.13 |
| Gradle | 8.14.3 |
| Emulador | Pixel 9 Pro, API 36, Google APIs, arm64-v8a |
| Application ID | `com.gymcircle.app` |
| Versão | `1.5` (`versionCode` 12) |

Comando reproduzível:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
cd android
./gradlew :app:assembleDebug
```

Artefato validado:

```text
android/app/build/outputs/apk/debug/app-debug.apk
SHA-256 68cdd360420dc20720800ba47efa909e1fba2015c23f365da0798ee9a6bdddb6
```

O `bundleRelease` também concluiu e gerou um AAB estrutural de 6,8 MB
(`SHA-256 e17f50a5c555276e66a93de739f9ad333caeb73220c92ce8b6cf2b66eb3cdb32`).
Ele está **sem assinatura** e serve apenas como evidência de compilação; não
deve ser enviado à Play Console.

## 3. Correções aplicadas

### Projeto Android

- removidos arquivos duplicados com sufixo ` 2` que quebravam o resource
  merger;
- `allowBackup=false`;
- FileProvider limitado a arquivos externos pertencentes ao app;
- keystores, `google-services.json` e configurações locais ignorados pelo Git;
- permissões `ACCESS_COARSE_LOCATION` e `ACCESS_FINE_LOCATION`;
- orientação portrait no manifest e plugin Screen Orientation sincronizado;
- integração do botão Voltar do Android com a pilha de sheets, overlays e
  navegação interna do app, evitando encerrar a `MainActivity` ao fechar uma
  busca;
- versão Android alinhada ao binário iOS atual;
- ícone e splash do Gym Circle;
- tema e system bars pretos.

### Gate de capacidades

Foi criada uma fonte de verdade por plataforma:

| Capacidade | iOS | Android atual | Web |
|---|---:|---:|---:|
| Importar Apple Saúde | sim | não | não |
| GPS foreground | sim | experimental | navegador |
| GPS com tela bloqueada | sim | não | não |
| Push nativo | sim | desativado até FCM | não |
| Musculação | sim | sim | sim |
| Modalidades por duração | sim | sim | sim |

No Android, a interface não anuncia importação do Apple Saúde e não apresenta o
toggle de push enquanto FCM e o sender Android não estiverem configurados
juntos. O flag `NEXT_PUBLIC_ANDROID_PUSH_ENABLED=true` só deve ser ativado
depois do teste end-to-end.

O hook de capacidades começa como web durante SSR e resolve a plataforma depois
da hidratação. Isso evita divergência de HTML no iOS e Android.

## 4. Evidências do smoke

- APK instalado por `adb install -r`;
- `MainActivity` abriu em cold start;
- tela de login carregou a URL de produção;
- Camera, Filesystem, Haptics, Keyboard, PushNotifications,
  ScreenOrientation, SplashScreen e StatusBar foram registrados;
- nenhuma `FATAL EXCEPTION` do app;
- portrait permaneceu em `ROTATION_0` após solicitação externa de landscape;
- barras e fundo do app permaneceram pretos;
- splash e identidade do Gym Circle renderizaram;
- teste unitário do gate: 8 testes aprovados;
- TypeScript do app web: aprovado.

O smoke autenticado com a conta de teste cobriu:

- login e restauração da sessão após atualização do APK;
- feed e stories;
- perfil próprio, foto/My Circle e edição de perfil;
- mensagens e hub de criação;
- catálogo de 30 modalidades e busca local por `tenis`;
- início e descarte de Tênis como atividade apenas por duração, sem GPS;
- início de Musculação com plano salvo e renderização das séries;
- aba Places com permissão ainda não concedida e fallback funcional;
- busca de academia com teclado aberto;
- ausência de freeze/refetch storm nos fluxos exercitados;
- ausência de `FATAL EXCEPTION`.

O botão Voltar revelou uma regressão real: após esconder o teclado, um segundo
toque encerrava o app em vez de fechar a busca de academia. A correção agora
possui uma pilha central de handlers e 3 testes unitários. Como o shell Capacitor
carrega a URL de produção, o teste visual exato dessa alteração depende de
publicar o frontend ou de um build local dedicado; não foi publicado nesta
entrega.

O WebView também reportou avisos não fatais de `deviceorientation` bloqueado pela
Permissions Policy da URL remota. Eles não causaram crash, mas devem ser
eliminados ou limitados antes do baseline final de performance.

## 5. Paridade e riscos conhecidos

### Disponível para um primeiro teste interno

- autenticação e navegação web;
- feed, perfis, comentários e mensagens;
- musculação e planos existentes;
- câmera/seleção de mídia, sujeitos a QA autenticado;
- Places via interface web;
- modalidades baseadas em duração;
- GPS foreground como experimental.

### Bloqueadores do release Google Play

1. **Push:** não há `google-services.json`, registro FCM nem envio Android no
   backend. O plugin sozinho não entrega notificações.
2. **Outdoor em background:** `WorkoutLocationBridge` é iOS-only. O fallback
   `navigator.geolocation` não garante rota com tela bloqueada.
3. **Health:** não há Health Connect. Apple Saúde deve permanecer oculto.
4. **Deep links:** existe apenas o intent de launcher. App Links, OAuth callback
   e recuperação de senha precisam de contrato e teste.
5. **Release:** falta keystore segura fora do repositório, configuração de
   signing e AAB assinado.
6. **QA restante:** câmera/fotos/vídeos, permissão de localização concedida,
   foreground GPS, pausa/retomada/finalização, botão Voltar corrigido e aparelho
   físico ainda precisam de smoke. O usuário deve decidir a concessão da
   permissão de localização no teste.

## 6. Release gate recomendado

### Android P1.1 — Core compatibility

- smoke autenticado com duas contas;
- feed, perfil, comentários, mensagens, fotos e vídeos;
- criar/concluir musculação e modalidade por duração;
- teclado, safe areas, sheets, back gesture e rotação;
- foreground GPS com permissão concedida/negada;
- baseline de memória e frames no feed.

### Android P1.2 — Native services

- criar app Firebase Android para `com.gymcircle.app`;
- FCM token, persistência, sender e eventos end-to-end;
- serviço de localização foreground/background com notificação persistente;
- política de privacidade e disclosure da Play Store;
- App Links;
- Health Connect em sprint isolada.

### Android P1.3 — Internal release

- keystore em secret manager;
- signing via variáveis/arquivo local não versionado;
- `bundleRelease`;
- Play Integrity e Data Safety revisados;
- upload no Internal Testing;
- instalação limpa e upgrade;
- smoke em pelo menos um Pixel e um Samsung físico.

## 7. Critério de conclusão da fundação

A fundação permanece em `QA`: projeto, APK e AAB compilam; o app instala, abre e
os fluxos centrais autenticados exercitados funcionam em API 36. Ela só vira
`DONE` após o smoke da correção do botão Voltar, mídia, localização/GPS e um
aparelho físico. Android push/GPS em background e Google Play continuam
entregas separadas.
