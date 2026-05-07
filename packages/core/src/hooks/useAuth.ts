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
    services.auth.getSession().then((session) => {
      if (!mountedRef.current) return;
      setState({ session, user: session?.user ?? null, loading: false });
    }).catch(() => {
      if (!mountedRef.current) return;
      setState({ session: null, user: null, loading: false });
    });

    const { data: sub } = services.auth.onAuthStateChange(async (_event, session) => {
      if (!mountedRef.current) return;
      setState({ session, user: session?.user ?? null, loading: false });
    });

    return () => {
      mountedRef.current = false;
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

  const signOut = useCallback(() => services.auth.signOut(), [services]);

  return { ...state, signIn, signUp, signOut };
}
