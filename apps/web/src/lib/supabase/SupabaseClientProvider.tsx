"use client";

import { useMemo, type ReactNode } from "react";
import { SupabaseProvider } from "@gym-circle/core/hooks";
import { getBrowserClient } from "./client";
import type { SupabaseEnv } from "./env";

type Props = {
  env: SupabaseEnv;
  children: ReactNode;
};

export function SupabaseClientProvider({ env, children }: Props) {
  const client = useMemo(() => getBrowserClient(env), [env]);
  return <SupabaseProvider client={client}>{children}</SupabaseProvider>;
}
