"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, useGymCircleClient } from "@gym-circle/core/hooks";
import { BrandMark } from "@/components/gym-circle/design-system";
import {
  getPasswordRecoveryErrorMessage,
  parsePasswordRecoveryUrl,
} from "@/components/gym-circle/passwordRecovery";

export default function ResetPasswordPage() {
  const client = useGymCircleClient();
  const { loading, session, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingRecovery, setCheckingRecovery] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (session) {
      setError(null);
      setSessionReady(true);
      setCheckingRecovery(false);
    }
  }, [session]);

  useEffect(() => {
    let cancelled = false;

    async function restoreRecoverySession() {
      setCheckingRecovery(true);
      setError(null);

      const recoveryUrl = parsePasswordRecoveryUrl(window.location.href);
      if (recoveryUrl.error) {
        setError(getPasswordRecoveryErrorMessage(recoveryUrl.error));
        setCheckingRecovery(false);
        return;
      }

      try {
        const existing = await client.auth.getSession();
        if (existing.error) throw existing.error;
        if (existing.data.session) {
          if (!cancelled) {
            setError(null);
            setSessionReady(true);
            setCheckingRecovery(false);
            if (recoveryUrl.hasRecoveryHint) {
              window.history.replaceState(null, "", window.location.pathname);
            }
          }
          return;
        }

        if (recoveryUrl.code) {
          const { error: exchangeError } = await client.auth.exchangeCodeForSession(
            recoveryUrl.code,
          );
          if (exchangeError) throw exchangeError;
        } else if (recoveryUrl.tokenHash && recoveryUrl.type === "recovery") {
          const { error: verifyError } = await client.auth.verifyOtp({
            token_hash: recoveryUrl.tokenHash,
            type: "recovery",
          });
          if (verifyError) throw verifyError;
        } else if (recoveryUrl.accessToken && recoveryUrl.refreshToken) {
          const { error: sessionError } = await client.auth.setSession({
            access_token: recoveryUrl.accessToken,
            refresh_token: recoveryUrl.refreshToken,
          });
          if (sessionError) throw sessionError;
        } else if (!loading && !session) {
          throw new Error("Auth session missing");
        }

        const restored = await client.auth.getSession();
        if (restored.error) throw restored.error;
        if (!restored.data.session) throw new Error("Auth session missing");

        if (!cancelled) {
          setError(null);
          setSessionReady(true);
          setCheckingRecovery(false);
          if (recoveryUrl.hasRecoveryHint) {
            window.history.replaceState(null, "", window.location.pathname);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(getPasswordRecoveryErrorMessage(err));
          setSessionReady(false);
          setCheckingRecovery(false);
        }
      }
    }

    restoreRecoverySession();

    const { data: subscription } = client.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY" || nextSession) {
        setError(null);
        setSessionReady(true);
        setCheckingRecovery(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [client, loading, session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!sessionReady) {
      setError("Abra esta tela pelo link enviado no email para confirmar a recuperação.");
      return;
    }

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
      setError(getPasswordRecoveryErrorMessage(err));
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
          ) : checkingRecovery ? (
            <div className="mt-5 rounded-[20px] border border-white/[0.08] bg-white/[0.04] p-4">
              <p className="text-[14px] font-black text-white">
                Validando link de recuperação...
              </p>
              <p className="mt-2 text-[12px] font-bold leading-5 text-white/48">
                Estamos confirmando sua sessão antes de liberar a troca de senha.
              </p>
            </div>
          ) : !sessionReady ? (
            <div className="mt-5 rounded-[20px] border border-[var(--gc-pink)]/30 bg-[var(--gc-pink)]/10 p-4">
              <p className="text-[13px] font-bold leading-5 text-[var(--gc-pink)]">
                {error ??
                  "Não foi possível validar este link. Peça um novo email de recuperação."}
              </p>
              <Link
                className="gc-pressable mt-4 flex h-12 w-full items-center justify-center rounded-full bg-white text-[14px] font-black text-black"
                href="/"
              >
                Voltar para o login
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
