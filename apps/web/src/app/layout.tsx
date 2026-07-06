import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SupabaseClientProvider } from "@/lib/supabase/SupabaseClientProvider";
import { readSupabaseEnv } from "@/lib/supabase/env";
// Sprint 4.1: boot-time side effects (orientation lock, futuro i18n init).
import { AppBootEffects } from "@/components/gym-circle/AppBootEffects";
// Sprint 4.7 hotfix: provider de i18n no root (resolve bug de re-render
// inconsistente em troca de idioma).
import { I18nClientProvider } from "@/i18n";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  metadataBase: new URL("https://gym-circle-rust.vercel.app"),
  title: "Gym Circle",
  description: "Rede social fitness mobile-first com streaks de treino.",
  manifest: "/manifest.webmanifest",
  applicationName: "Gym Circle",
  appleWebApp: {
    capable: true,
    title: "Gym Circle",
    statusBarStyle: "black-translucent",
    startupImage: [
      { url: "/splash/splash-1170x2532.png", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/splash-1290x2796.png", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/splash-1284x2778.png", media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/splash-1125x2436.png", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/splash-828x1792.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" },
    ],
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" },
    ],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const env = readSupabaseEnv();

  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full bg-black text-white">
        <I18nClientProvider>
          <AppBootEffects />
          {env ? (
            <SupabaseClientProvider env={env}>{children}</SupabaseClientProvider>
          ) : (
            children
          )}
        </I18nClientProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
