"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@gym-circle/core/hooks";
import { BrandMark } from "./design-system";

export function LiveAuthGate() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [betaAccepted, setBetaAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "sign-in") {
        await signIn(email, password);
      } else {
        if (!betaAccepted) {
          throw new Error("Você precisa aceitar participar do teste beta.");
        }
        await signUp({ email, password, username: username || undefined });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-black px-6 pb-6 pt-[calc(var(--gc-safe-top)+24px)] text-white">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex justify-center">
          <BrandMark showWordmark size={64} />
        </div>
        <div className="rounded-[32px] border border-white/[0.08] bg-white/[0.03] p-6 shadow-[0_28px_72px_rgba(0,0,0,0.56)]">
          <h1 className="text-[24px] font-black">
            {mode === "sign-in" ? "Entrar" : "Criar conta"}
          </h1>
          <p className="mt-1 text-[13px] font-bold text-white/52">
            {mode === "sign-in"
              ? "Entre com sua conta do Gym Circle."
              : "Crie uma conta beta. Um perfil será criado automaticamente."}
          </p>

          <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
            <input
              autoComplete={mode === "sign-in" ? "username" : "email"}
              className="h-12 w-full rounded-full border border-white/[0.08] bg-black/40 px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
              onChange={(e) => setEmail(e.target.value)}
              placeholder={mode === "sign-in" ? "email ou username" : "email"}
              type={mode === "sign-in" ? "text" : "email"}
              value={email}
            />
            <input
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              className="h-12 w-full rounded-full border border-white/[0.08] bg-black/40 px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="senha"
              type="password"
              value={password}
            />
            {mode === "sign-up" ? (
              <input
                autoComplete="username"
                className="h-12 w-full rounded-full border border-white/[0.08] bg-black/40 px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username (opcional, gerado se vazio)"
                value={username}
              />
            ) : null}
            {mode === "sign-up" ? (
              <label className="flex items-start gap-3 rounded-[18px] border border-white/[0.08] bg-white/[0.035] p-3 text-left">
                <input
                  checked={betaAccepted}
                  className="mt-1 size-4 accent-[var(--gc-brand)]"
                  onChange={(event) => setBetaAccepted(event.target.checked)}
                  type="checkbox"
                />
                <span className="text-[12px] font-bold leading-5 text-white/58">
                  Eu aceito participar de um teste beta do Gym Circle e entendo que erros podem acontecer.
                  {" "}
                  <Link className="text-[var(--gc-brand)]" href="/terms" target="_blank">
                    Termos
                  </Link>
                  {" · "}
                  <Link className="text-[var(--gc-brand)]" href="/privacy" target="_blank">
                    Privacidade
                  </Link>
                </span>
              </label>
            ) : null}
            {error ? (
              <p className="rounded-[16px] border border-[var(--gc-pink)]/30 bg-[var(--gc-pink)]/10 p-3 text-[12px] font-bold text-[var(--gc-pink)]">
                {error}
              </p>
            ) : null}
            <button
              className="gc-pressable mt-2 flex h-12 w-full items-center justify-center rounded-full bg-[var(--gc-brand)] text-[14px] font-black text-black disabled:opacity-50"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Aguarde..." : mode === "sign-in" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <button
            className="mt-4 w-full text-center text-[12px] font-bold text-white/52 underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
            type="button"
          >
            {mode === "sign-in" ? "Não tenho conta" : "Já tenho conta"}
          </button>
        </div>
      </div>
    </main>
  );
}
