"use client";

import { Browser } from "@capacitor/browser";
import type { GymCircleClient } from "@gym-circle/core/services";
import { getAuthRedirectTo } from "./authRedirect";

/**
 * Social (Apple / Google) OAuth for the Capacitor app.
 *
 * Why this is not just `signInWithOAuth`: Apple and Google both BLOCK their
 * OAuth pages inside an embedded WebView (WKWebView = the Capacitor shell).
 * The full-page redirect that works in Safari/Chrome fails inside the app.
 *
 * Native flow: ask Supabase for the authorize URL (`skipBrowserRedirect`),
 * open it in the system browser (SFSafariViewController via @capacitor/browser
 * — a real browser, not the embedded WebView, so Apple/Google allow it), then
 * finish the sign-in when the provider redirects back to our deep link.
 *
 * Web flow: unchanged — a normal full-page redirect.
 */

const NATIVE_AUTH_REDIRECT = "com.gymcircle.app://auth-callback";

export type SocialProvider = "apple" | "google";

function isNativeCapacitor(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (
    window as {
      Capacitor?: {
        isNativePlatform?: () => boolean;
        getPlatform?: () => string;
      };
    }
  ).Capacitor;
  return (
    cap?.isNativePlatform?.() ??
    (typeof cap?.getPlatform === "function" && cap.getPlatform() !== "web")
  );
}

/** Begins an OAuth sign-in. On web it redirects the page; on native it opens
 *  the system browser and resolves once the browser is open — the deep-link
 *  callback (completeSocialSignIn) actually establishes the session. */
export async function startSocialSignIn(
  client: GymCircleClient,
  provider: SocialProvider,
): Promise<void> {
  if (!isNativeCapacitor()) {
    const { error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: getAuthRedirectTo() },
    });
    if (error) throw error;
    return;
  }

  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo: NATIVE_AUTH_REDIRECT, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) {
    throw new Error("OAuth não retornou URL de autorização.");
  }
  await Browser.open({ url: data.url });
}

export type AuthCallbackResult =
  | { kind: "code"; code: string }
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "error"; message: string }
  | { kind: "ignore" };

/** Pure parser for the OAuth deep-link callback URL. Decides how the session
 *  should be established. Kept pure (no plugin/network calls) so it is unit
 *  tested directly — see socialAuth.test.ts. */
export function parseAuthCallbackUrl(url: string): AuthCallbackResult {
  if (!url.includes("auth-callback")) return { kind: "ignore" };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: "ignore" };
  }

  const oauthError =
    parsed.searchParams.get("error_description") ??
    parsed.searchParams.get("error");
  if (oauthError) return { kind: "error", message: oauthError };

  // PKCE flow (Supabase default): ?code=<authcode>
  const code = parsed.searchParams.get("code");
  if (code) return { kind: "code", code };

  // Implicit flow fallback: tokens in the URL fragment.
  const params = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    return { kind: "tokens", accessToken, refreshToken };
  }

  return { kind: "ignore" };
}

/** Completes a native OAuth sign-in from the deep-link callback URL.
 *  Returns true when `callbackUrl` was an auth callback this handled. */
export async function completeSocialSignIn(
  client: GymCircleClient,
  callbackUrl: string,
): Promise<boolean> {
  const result = parseAuthCallbackUrl(callbackUrl);
  if (result.kind === "ignore") return false;

  await Browser.close().catch(() => {
    // Browser may already be closed — non-fatal.
  });

  if (result.kind === "error") {
    throw new Error(result.message);
  }

  if (result.kind === "code") {
    const { error } = await client.auth.exchangeCodeForSession(result.code);
    if (error) throw error;
    return true;
  }

  const { error } = await client.auth.setSession({
    access_token: result.accessToken,
    refresh_token: result.refreshToken,
  });
  if (error) throw error;
  return true;
}
