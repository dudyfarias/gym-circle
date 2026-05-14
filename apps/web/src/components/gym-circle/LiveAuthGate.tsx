"use client";

import { useState } from "react";
import { useAuth } from "@gym-circle/core/hooks";
import { Apple } from "lucide-react";
import { BrandMark } from "./design-system";

type AuthMode = "sign-in" | "sign-up" | "forgot-password";

function cleanUsername(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_.]/g, "");
}

export function LiveAuthGate() {
  const { resetPassword, signIn, signInWithProvider, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function switchMode(next: AuthMode) {
    setMode(next);
    setError(null);
    setSuccess(null);
    setPassword("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      if (mode === "sign-in") {
        await signIn(email, password);
      } else if (mode === "forgot-password") {
        const redirectTo =
          typeof window === "undefined"
            ? undefined
            : `${window.location.origin}/reset-password`;
        await resetPassword(email, redirectTo);
        setSuccess("Enviamos um email para alterar sua senha. Abra o link para confirmar.");
      } else {
        const cleanedUsername = cleanUsername(username);
        if (cleanedUsername.length < 3) {
          throw new Error("Username precisa ter pelo menos 3 caracteres.");
        }
        const data = await signUp({ email, password, username: cleanedUsername });
        setSuccess(
          data.session
            ? "Conta criada. Entrando no feed..."
            : "Conta criada. Se o app não abrir agora, confirme seu email.",
        );
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSocialSignIn(provider: "google" | "apple") {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const redirectTo =
        typeof window === "undefined" ? undefined : window.location.origin;
      await signInWithProvider(provider, redirectTo);
    } catch (err) {
      setError((err as Error).message);
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
            {mode === "sign-in"
              ? "Entrar"
              : mode === "forgot-password"
                ? "Recuperar senha"
                : "Criar conta"}
          </h1>
          <p className="mt-1 text-[13px] font-bold text-white/52">
            {mode === "sign-in"
              ? "Entre e vá direto para o feed."
              : mode === "forgot-password"
                ? "Digite seu email cadastrado para receber o link de alteração."
                : "Cadastro rápido: email, senha e username. O resto fica para depois."}
          </p>

          {mode !== "forgot-password" ? (
            <div className="mt-5 grid gap-2">
              <button
                className="gc-pressable flex h-12 w-full items-center justify-center gap-2 rounded-full border border-white/[0.1] bg-white text-[13px] font-black text-black disabled:opacity-50"
                disabled={submitting}
                onClick={() => handleSocialSignIn("apple")}
                type="button"
              >
                <Apple size={17} fill="currentColor" />
                Continuar com Apple
              </button>
              <button
                className="gc-pressable flex h-12 w-full items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.055] text-[13px] font-black text-white disabled:opacity-50"
                disabled={submitting}
                onClick={() => handleSocialSignIn("google")}
                type="button"
              >
                <span className="grid size-5 place-items-center rounded-full bg-white text-[12px] font-black text-black">
                  G
                </span>
                Continuar com Google
              </button>
              <div className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-white/[0.08]" />
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/30">
                  ou
                </span>
                <span className="h-px flex-1 bg-white/[0.08]" />
              </div>
            </div>
          ) : null}

          <form className={mode === "forgot-password" ? "mt-5 space-y-3" : "space-y-3"} onSubmit={handleSubmit}>
            <input
              autoComplete={mode === "sign-in" ? "username" : "email"}
              className="h-12 w-full rounded-full border border-white/[0.08] bg-black/40 px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
              onChange={(e) => setEmail(e.target.value)}
              placeholder={mode === "sign-in" ? "email ou username" : "email"}
              type={mode === "sign-in" ? "text" : "email"}
              value={email}
            />
            {mode === "sign-up" ? (
              <input
                autoComplete="new-password"
                className="h-12 w-full rounded-full border border-white/[0.08] bg-black/40 px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="senha"
                type="password"
                value={password}
              />
            ) : null}
            {mode === "sign-up" ? (
              <input
                autoComplete="username"
                className="h-12 w-full rounded-full border border-white/[0.08] bg-black/40 px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                value={username}
              />
            ) : null}
            {mode === "sign-in" ? (
              <input
                autoComplete="current-password"
                className="h-12 w-full rounded-full border border-white/[0.08] bg-black/40 px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="senha"
                type="password"
                value={password}
              />
            ) : null}
            {error ? (
              <p className="rounded-[16px] border border-[var(--gc-pink)]/30 bg-[var(--gc-pink)]/10 p-3 text-[12px] font-bold text-[var(--gc-pink)]">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="rounded-[16px] border border-[var(--gc-brand)]/30 bg-[var(--gc-brand)]/10 p-3 text-[12px] font-bold text-[var(--gc-brand)]">
                {success}
              </p>
            ) : null}
            <button
              className="gc-pressable mt-2 flex h-12 w-full items-center justify-center rounded-full bg-[var(--gc-brand)] text-[14px] font-black text-black disabled:opacity-50"
              disabled={submitting}
              type="submit"
            >
              {submitting
                ? "Aguarde..."
                : mode === "sign-in"
                  ? "Entrar"
                  : mode === "forgot-password"
                    ? "Enviar email"
                    : "Criar conta"}
            </button>
          </form>

          <div className="mt-4 space-y-3 text-center">
            {mode === "sign-in" ? (
              <button
                className="w-full text-[12px] font-bold text-white/52 underline-offset-4 hover:underline"
                onClick={() => switchMode("forgot-password")}
                type="button"
              >
                Esqueci minha senha
              </button>
            ) : null}
            <button
              className="w-full text-[12px] font-bold text-white/52 underline-offset-4 hover:underline"
              onClick={() => switchMode(mode === "sign-up" ? "sign-in" : "sign-up")}
              type="button"
            >
              {mode === "sign-up" ? "Já tenho conta" : "Não tenho conta"}
            </button>
            {mode === "forgot-password" ? (
              <button
                className="w-full text-[12px] font-bold text-white/52 underline-offset-4 hover:underline"
                onClick={() => switchMode("sign-in")}
                type="button"
              >
                Voltar para entrar
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
