import { LiveGymCirclePreview } from "@/components/gym-circle/LiveGymCirclePreview";
import { readSupabaseEnv } from "@/lib/supabase/env";
import Link from "next/link";

export default function Home() {
  const env = readSupabaseEnv();

  if (!env) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        <div className="mx-auto max-w-md rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-6">
          <h1 className="text-[24px] font-black">Supabase não configurado</h1>
          <p className="mt-3 text-[14px] font-bold text-white/72">
            Defina <code className="rounded bg-white/[0.08] px-1">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
            <code className="rounded bg-white/[0.08] px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> no ambiente.
          </p>
          <p className="mt-4 text-[13px] font-bold text-white/52">
            Enquanto isso, veja a <Link className="text-[var(--gc-brand)] underline-offset-4 hover:underline" href="/demo">demo visual</Link>.
          </p>
        </div>
      </main>
    );
  }

  return <LiveGymCirclePreview />;
}
