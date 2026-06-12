import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Configuração do wrapper nativo iOS/Android do Gym Circle.
 *
 * Estratégia de produção: WebView aponta para o deploy estável da Vercel.
 * Isso mantém o app nativo leve e permite atualizar UI/fluxos sociais sem uma
 * nova revisão da App Store. Mudanças de plugins, permissões, ícones, splash
 * ou bundle id ainda exigem novo build nativo.
 *
 * Bundle ID = appId é IMUTÁVEL após publicação. A FASE 2 oficial usa
 * com.gymcircle.app para App Store Connect / TestFlight.
 */
const config: CapacitorConfig = {
  appId: "com.gymcircle.app",
  appName: "Gym Circle",
  // Fallback local simples: em produção o app carrega server.url, mas o
  // Capacitor exige um webDir válido para copy/sync e para erro offline.
  webDir: "native-fallback",
  server: {
    url: "https://gym-circle-rust.vercel.app",
    cleartext: false,
    // Apenas hosts confiáveis: produção/preview DESTE projeto + Supabase
    // do projeto + auth externa. Sprint 16.5 — removidos os wildcards
    // *.vercel.app e *.supabase.co: qualquer site vercel.app podia abrir
    // DENTRO do shell (phishing com cara de app).
    allowNavigation: [
      "gym-circle-rust.vercel.app",
      "gym-circle-git-main-dudycappia-4508s-projects.vercel.app",
      "gym-circle-dudycappia-4508s-projects.vercel.app",
      "qajjpjmybmqqwflytcpr.supabase.co",
      "accounts.google.com",
      "appleid.apple.com",
    ],
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#000000",
    // Mantemos false porque o app usa Vercel + Supabase + links externos de auth.
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    backgroundColor: "#000000",
    // Trava o WebView no domínio confiável; impede que abrir um link
    // externo num post substitua a janela do app.
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // Fallback nativo: se o bundle web/auth/hydration travar no iOS,
      // o splash ainda some sozinho. O app chama SplashScreen.hide() antes disso.
      launchShowDuration: 4200,
      launchAutoHide: true,
      backgroundColor: "#000000",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#000000",
      overlaysWebView: false,
    },
    Keyboard: {
      resize: "native",
      style: "DARK",
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    // Sprint 4.1: trava em portrait. Combinação:
    //   - iOS: redundante com Info.plist UISupportedInterfaceOrientations
    //     (esse é o autoritativo no native), mas o plugin garante que o
    //     WebView interno não tente CSS rotation.
    //   - Android: AUTORITATIVO — não tem Info.plist equivalente.
    //   - Web/PWA: usa Screen Orientation API quando suportada.
    ScreenOrientation: {
      // No iOS, esse default é aplicado mas a UISupportedInterfaceOrientations
      // sobrescreve. No Android, esse é o lock real.
    },
  },
};

export default config;
