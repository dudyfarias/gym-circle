import { useCallback, useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useGymCircleServices } from "./SupabaseProvider";

export type UseAuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

export function useAuth() {
  const services = useGymCircleServices();
  const [state, setState] = useState<UseAuthState>({
    session: null,
    user: null,
    loading: true,
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (!mountedRef.current || settled) return;
      console.warn("[GymCircleBoot] auth restore timeout; continuing without blocking boot");
      setState((current) =>
        current.loading
          ? { session: null, user: null, loading: false }
          : current,
      );
    }, 3800);

    services.auth.getSession().then((session) => {
      settled = true;
      window.clearTimeout(timeout);
      if (!mountedRef.current) return;
      setState({ session, user: session?.user ?? null, loading: false });
    }).catch(() => {
      settled = true;
      window.clearTimeout(timeout);
      if (!mountedRef.current) return;
      setState({ session: null, user: null, loading: false });
    });

    const { data: sub } = services.auth.onAuthStateChange(async (_event, session) => {
      settled = true;
      window.clearTimeout(timeout);
      if (!mountedRef.current) return;
      setState({ session, user: session?.user ?? null, loading: false });
    });

    return () => {
      mountedRef.current = false;
      window.clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, [services]);

  const signIn = useCallback(
    (email: string, password: string) =>
      services.auth.signInWithPassword(email, password),
    [services],
  );

  const signUp = useCallback(
    (input: Parameters<typeof services.auth.signUp>[0]) => services.auth.signUp(input),
    [services],
  );

  const signInWithProvider = useCallback(
    (provider: Parameters<typeof services.auth.signInWithOAuth>[0], redirectTo?: string) =>
      services.auth.signInWithOAuth(provider, redirectTo),
    [services],
  );

  const resetPassword = useCallback(
    (email: string, redirectTo?: string) =>
      services.auth.resetPasswordForEmail(email, redirectTo),
    [services],
  );

  const updatePassword = useCallback(
    (password: string) => services.auth.updatePassword(password),
    [services],
  );

  const signOut = useCallback(() => services.auth.signOut(), [services]);

  return {
    ...state,
    resetPassword,
    signIn,
    signInWithProvider,
    signOut,
    signUp,
    updatePassword,
  };
}
