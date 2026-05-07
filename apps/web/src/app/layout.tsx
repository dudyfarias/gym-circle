import type { Metadata } from "next";
import "./globals.css";
import { SupabaseClientProvider } from "@/lib/supabase/SupabaseClientProvider";
import { readSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Gym Circle",
  description: "Rede social fitness mobile-first com streaks de treino.",
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
        {env ? (
          <SupabaseClientProvider env={env}>{children}</SupabaseClientProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
