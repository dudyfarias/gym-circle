"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { useGymCircleServices } from "@gym-circle/core/hooks";
import { completeSocialSignIn } from "./socialAuth";

/**
 * Listens for the OAuth deep-link callback (com.gymcircle.app://auth-callback)
 * that the system browser redirects to after Apple/Google sign-in, and hands
 * it to completeSocialSignIn to establish the Supabase session.
 *
 * Mounted at all times (logged in or out) — the callback arrives while the
 * user is still on the auth screen. Renders nothing. On web `@capacitor/app`
 * has no native events, so this is inert there.
 */
export function SocialAuthDeepLinkController() {
  const services = useGymCircleServices();

  useEffect(() => {
    let cancelled = false;
    let remove: (() => void) | undefined;

    void (async () => {
      try {
        const handle = await App.addListener("appUrlOpen", (event) => {
          void completeSocialSignIn(services.client, event.url).catch(() => {
            // Failures surface via the auth screen on the next attempt;
            // never let a callback error crash the app.
          });
        });
        if (cancelled) {
          void handle.remove();
        } else {
          remove = () => {
            void handle.remove();
          };
        }
      } catch {
        // @capacitor/app unavailable (plain web) — nothing to listen for.
      }
    })();

    return () => {
      cancelled = true;
      remove?.();
    };
  }, [services]);

  return null;
}
