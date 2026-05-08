import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Configuração do wrapper nativo iOS/Android do Gym Circle.
 *
 * Estratégia: webview aponta direto para o deploy do Vercel
 * (https://gym-circle-rust.vercel.app). Atualizar o app web atualiza
 * automaticamente os clientes iOS/Android — não precisa nova release
 * de loja para mudanças visuais ou de feature, apenas para mudanças
 * que dependam de plugins nativos (camera, push, geo, etc.) ou de
 * permissions novas no Info.plist / AndroidManifest.xml.
 *
 * Bundle ID = appId é IMUTÁVEL após publicação. com.dudyfarias.gymcircle
 * usa o GitHub username como autoridade reverse-DNS (não exige domínio).
 */
const config: CapacitorConfig = {
  appId: "com.dudyfarias.gymcircle",
  appName: "Gym Circle",
  // webDir é o fallback offline. Como usamos server.url, ele só importa se
  // o usuário ficar sem internet — então apontamos para um build estático
  // mínimo dentro de apps/web/public que já tem os ícones e manifest.
  webDir: "apps/web/public",
  server: {
    url: "https://gym-circle-rust.vercel.app",
    cleartext: false,
    // Apenas hosts confiáveis: Vercel próprio + Supabase (storage de mídia).
    allowNavigation: [
      "*.vercel.app",
      "*.supabase.co",
      "qajjpjmybmqqwflytcpr.supabase.co",
    ],
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#000000",
    // Permite upload de fotos/vídeos da câmera ou galeria.
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
      launchAutoHide: false,
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
