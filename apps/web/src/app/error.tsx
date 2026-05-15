"use client";

import { useEffect } from "react";

/**
 * Boundary de erro pra qualquer route segment dentro do app router.
 * Cobre crashes de cliente (renderização, useState updates, async com
 * uncaught throw) — Apple Review reclama de tela em branco, então
 * estilamos uma fallback visível com botão de retry.
 *
 * `reset` re-monta a árvore do segmento; suficiente pra erros transitórios
 * (race condition, fetch que voltou ruim).
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Em produção isso vira Sentry/whatever. Por enquanto console fora
    // do bundle de produção é suficiente — Sentry pode plugar aqui depois.
    if (process.env.NODE_ENV !== "production") {
      console.error("[gc-error-boundary]", error);
    }
  }, [error]);

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-md rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-6">
        <h1 className="text-[22px] font-black">Algo deu ruim</h1>
        <p className="mt-3 text-[14px] font-bold text-white/72">
          A gente registrou aqui e já tá olhando. Pode dar um retry — geralmente
          é só uma piada de internet.
        </p>
        {error.digest ? (
          <p className="mt-4 font-mono text-[11px] text-white/42">
            ref: {error.digest}
          </p>
        ) : null}
        {/* DIAGNÓSTICO TEMPORÁRIO — remover após capturar a rejeição Apple 2.1.
            Expõe o erro real pra reproduzir o crash WebKit-específico. */}
        <div className="mt-4 rounded-[16px] border border-[var(--gc-pink)]/30 bg-[var(--gc-pink)]/[0.08] p-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--gc-pink)]">
            Debug
          </p>
          <p className="mt-1 break-words font-mono text-[12px] font-bold text-white">
            {error.name}: {error.message || "(sem mensagem)"}
          </p>
          {error.stack ? (
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-snug text-white/52">
              {error.stack.slice(0, 1400)}
            </pre>
          ) : null}
        </div>
        <button
          className="gc-pressable mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-[var(--gc-brand)] px-6 text-[14px] font-black text-black"
          onClick={reset}
          type="button"
        >
          Tentar de novo
        </button>
      </div>
    </main>
  );
}
