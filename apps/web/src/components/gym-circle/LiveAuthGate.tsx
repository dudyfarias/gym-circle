"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@gym-circle/core/hooks";
import { getAuthErrorMessage, getAuthRedirectTo } from "./authRedirect";
import { BrandMark } from "./design-system";

type AuthMode = "sign-in" | "sign-up" | "forgot-password";

function cleanUsername(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_.]/g, "");
}

export function LiveAuthGate() {
  const { t } = useTranslation();
  const { resetPassword, signIn, signUp } = useAuth();
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
        await resetPassword(email, getAuthRedirectTo("/reset-password"));
        setSuccess(t("auth.feedback.resetSent"));
      } else {
        const cleanedUsername = cleanUsername(username);
        if (cleanedUsername.length < 3) {
          throw new Error(t("auth.errors.usernameTooShort"));
        }
        const data = await signUp({ email, password, username: cleanedUsername });
        setSuccess(
          data.session
            ? t("auth.feedback.signupSession")
            : t("auth.feedback.signupConfirm"),
        );
      }
    } catch (err) {
      setError(getAuthErrorMessage(err, t("auth.errors.generic")));
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
            {mode === "sign-in"
              ? t("auth.title.signIn")
              : mode === "forgot-password"
                ? t("auth.title.forgotPassword")
                : t("auth.title.signUp")}
          </h1>
          <p className="mt-1 text-[13px] font-bold text-white/52">
            {mode === "sign-in"
              ? t("auth.subtitle.signIn")
              : mode === "forgot-password"
                ? t("auth.subtitle.forgotPassword")
                : t("auth.subtitle.signUp")}
          </p>

          <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
            <input
              aria-label={mode === "sign-in" ? t("auth.field.emailOrUsernameAriaLabel") : t("auth.field.emailAriaLabel")}
              autoCapitalize="none"
              autoComplete={mode === "sign-in" ? "username" : "email"}
              className="h-12 w-full rounded-full border border-white/[0.08] bg-black/40 px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
              enterKeyHint="next"
              inputMode={mode === "sign-in" ? "text" : "email"}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={mode === "sign-in" ? t("auth.field.emailOrUsername") : t("auth.field.email")}
              spellCheck={false}
              type={mode === "sign-in" ? "text" : "email"}
              value={email}
            />
            {mode === "sign-up" ? (
              <input
                aria-label={t("auth.field.passwordAriaLabel")}
                autoComplete="new-password"
                className="h-12 w-full rounded-full border border-white/[0.08] bg-black/40 px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
                enterKeyHint="next"
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.field.password")}
                type="password"
                value={password}
              />
            ) : null}
            {mode === "sign-up" ? (
              <input
                aria-label={t("auth.field.usernameAriaLabel")}
                autoCapitalize="none"
                autoComplete="username"
                className="h-12 w-full rounded-full border border-white/[0.08] bg-black/40 px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
                enterKeyHint="go"
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("auth.field.username")}
                spellCheck={false}
                value={username}
              />
            ) : null}
            {mode === "sign-in" ? (
              <input
                aria-label={t("auth.field.passwordAriaLabel")}
                autoComplete="current-password"
                className="h-12 w-full rounded-full border border-white/[0.08] bg-black/40 px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
                enterKeyHint="go"
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.field.password")}
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
                ? t("auth.cta.submitting")
                : mode === "sign-in"
                  ? t("auth.cta.signIn")
                  : mode === "forgot-password"
                    ? t("auth.cta.forgotPassword")
                    : t("auth.cta.signUp")}
            </button>
          </form>

          <div className="mt-4 space-y-3 text-center">
            {mode === "sign-in" ? (
              <button
                className="w-full text-[12px] font-bold text-white/52 underline-offset-4 hover:underline"
                onClick={() => switchMode("forgot-password")}
                type="button"
              >
                {t("auth.toggle.forgotPassword")}
              </button>
            ) : null}
            <button
              className="w-full text-[12px] font-bold text-white/52 underline-offset-4 hover:underline"
              onClick={() => switchMode(mode === "sign-up" ? "sign-in" : "sign-up")}
              type="button"
            >
              {mode === "sign-up" ? t("auth.toggle.haveAccount") : t("auth.toggle.noAccount")}
            </button>
            {mode === "forgot-password" ? (
              <button
                className="w-full text-[12px] font-bold text-white/52 underline-offset-4 hover:underline"
                onClick={() => switchMode("sign-in")}
                type="button"
              >
                {t("auth.toggle.backToSignIn")}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
