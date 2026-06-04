import { MockHomeWrapper } from "@/components/gym-circle/MockHomeWrapper";

export const metadata = {
  title: "Gym Circle — Demo visual",
  description: "Versão de demonstração com dados estáticos. Sem login.",
};

// Sprint 8.2 hotfix: MockHomeWrapper consome useGymCircleServices() que
// precisa de <SupabaseProvider> runtime. Sem force-dynamic, Next.js tenta
// pré-renderizar a página estaticamente no build de produção e falha com
// "useGymCircleServices precisa de <SupabaseProvider>".
export const dynamic = "force-dynamic";

export default function DemoPage() {
  return <MockHomeWrapper />;
}
