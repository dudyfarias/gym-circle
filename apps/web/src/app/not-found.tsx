import Link from "next/link";

/**
 * Página 404 estilizada. Apple Review checka deep links; abrir uma URL
 * inválida não pode resultar em tela branca ou erro genérico do Next.
 */
export default function NotFound() {
  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-md rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-6 text-center">
        <p className="text-[64px] font-black leading-none text-[var(--gc-brand)]">
          404
        </p>
        <h1 className="mt-3 text-[22px] font-black">Página não encontrada</h1>
        <p className="mt-3 text-[14px] font-bold text-white/72">
          Esse link não tá mais aqui — ou nunca esteve. Vamos voltar pra rua
          principal.
        </p>
        <Link
          className="gc-pressable mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-[var(--gc-brand)] px-6 text-[14px] font-black text-black"
          href="/"
        >
          Ir pro feed
        </Link>
      </div>
    </main>
  );
}
