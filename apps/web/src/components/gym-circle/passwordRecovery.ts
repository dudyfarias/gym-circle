"use client";

export type PasswordRecoveryUrl = {
  accessToken: string | null;
  code: string | null;
  error: string | null;
  hasRecoveryHint: boolean;
  refreshToken: string | null;
  tokenHash: string | null;
  type: string | null;
};

function clean(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function parsePasswordRecoveryUrl(value: string): PasswordRecoveryUrl {
  const url = new URL(value, "https://gym-circle-rust.vercel.app");
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const hashParams = new URLSearchParams(hash);

  const type = clean(url.searchParams.get("type")) ?? clean(hashParams.get("type"));
  const code = clean(url.searchParams.get("code")) ?? clean(hashParams.get("code"));
  const tokenHash =
    clean(url.searchParams.get("token_hash")) ?? clean(hashParams.get("token_hash"));
  const accessToken =
    clean(hashParams.get("access_token")) ?? clean(url.searchParams.get("access_token"));
  const refreshToken =
    clean(hashParams.get("refresh_token")) ?? clean(url.searchParams.get("refresh_token"));
  const error =
    clean(url.searchParams.get("error_description")) ??
    clean(hashParams.get("error_description")) ??
    clean(url.searchParams.get("error")) ??
    clean(hashParams.get("error"));

  return {
    accessToken,
    code,
    error,
    hasRecoveryHint:
      type === "recovery" ||
      Boolean(code || tokenHash || accessToken || refreshToken),
    refreshToken,
    tokenHash,
    type,
  };
}

export function getPasswordRecoveryErrorMessage(error: unknown) {
  const fallback =
    "Não conseguimos validar o link de recuperação. Peça um novo email e tente novamente.";
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const message = raw.trim();

  if (!message || message.startsWith("{") || message.startsWith("[")) return fallback;
  if (/expired|invalid|otp|token|code verifier|pkce/i.test(message)) {
    return "Esse link expirou ou já foi usado. Peça um novo email para alterar sua senha.";
  }
  if (/auth session missing|not authenticated|session/i.test(message)) {
    return "Abra esta tela pelo link enviado no email para confirmar a recuperação.";
  }
  if (/network|fetch|failed/i.test(message)) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }

  return message;
}
