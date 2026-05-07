"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useAuth } from "@gym-circle/core/hooks";
import { BrandMark } from "@/components/gym-circle/design-system";

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(password);
      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
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
          <h1 className="text-[24px] font-black">Alterar senha</h1>
          <p className="mt-1 text-[13px] font-bold text-white/52">
            Crie uma nova senha para confirmar a recuperação da conta.
          </p>

          {success ? (
            <div className="mt-5 rounded-[20px] border border-[var(--gc-brand)]/30 bg-[var(--gc-brand)]/10 p-4">
              <p className="text-[14px] font-black text-[var(--gc-brand)]">
                Senha alterada com sucesso.
              </p>
              <Link
                className="gc-pressable mt-4 flex h-12 w-full items-center justify-center rounded-full bg-[var(--gc-brand)] text-[14px] font-black text-black"
                href="/"
              >
                Entrar no Gym Circle
              </Link>
            </div>
          ) : (
            <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
              <input
                autoComplete="new-password"
                className="h-12 w-full rounded-full border border-white/[0.08] bg-black/40 px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="nova senha"
                type="password"
                value={password}
              />
              <input
                autoComplete="new-password"
                className="h-12 w-full rounded-full border border-white/[0.08] bg-black/40 px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="confirmar nova senha"
                type="password"
                value={confirmPassword}
              />
              {error ? (
                <p className="rounded-[16px] border border-[var(--gc-pink)]/30 bg-[var(--gc-pink)]/10 p-3 text-[12px] font-bold text-[var(--gc-pink)]">
                  {error}
                </p>
              ) : null}
              <button
                className="gc-pressable flex h-12 w-full items-center justify-center rounded-full bg-[var(--gc-brand)] text-[14px] font-black text-black disabled:opacity-50"
                disabled={submitting}
                type="submit"
              >
                {submitting ? "Alterando..." : "Confirmar nova senha"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
