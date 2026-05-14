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
    // Apenas hosts confiáveis: produção/preview Vercel + Supabase storage/auth.
    allowNavigation: [
      "gym-circle-rust.vercel.app",
      "*.vercel.app",
      "*.supabase.co",
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
  },
};

export default config;
