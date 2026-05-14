"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useGymCircleServices } from "@gym-circle/core/hooks";
import { BrandMark } from "@/components/gym-circle/design-system";

export default function ReactivateAccountPage() {
  return (
    <Suspense fallback={<ReactivateShell status="Validando link..." />}>
      <ReactivateAccountClient />
    </Suspense>
  );
}

function ReactivateAccountClient() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const { loading, user } = useAuth();
  const services = useGymCircleServices();
  const [status, setStatus] = useState("Validando link...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!token || !user) return;

    let cancelled = false;
    services.safety
      .reactivateAccount(token)
      .then(() => {
        if (cancelled) return;
        setStatus("Conta reativada. Abrindo o Gym Circle...");
        window.setTimeout(() => router.replace("/"), 900);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível reativar sua conta.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [loading, router, services.safety, token, user]);

  const derivedError = !loading && !token ? "Link de reativação inválido." : error;
  const derivedStatus =
    !loading && token && !user
      ? "Entre pelo link enviado no email para concluir a reativação."
      : status;

  return <ReactivateShell error={derivedError} status={derivedStatus} />;
}

function ReactivateShell({
  error,
  status,
}: {
  error?: string | null;
  status: string;
}) {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-black px-6 py-[calc(var(--gc-safe-top)+32px)] text-center text-white">
      <div className="w-full max-w-[340px]">
        <div className="mx-auto grid size-20 place-items-center rounded-[26px] border border-white/[0.08] bg-white/[0.04] shadow-[0_0_48px_rgba(48,213,255,0.14)]">
          <BrandMark size={48} />
        </div>
        <p className="mt-7 text-[22px] font-black leading-tight text-white">
          Reativação de conta
        </p>
        <p className="mt-3 text-[13px] font-bold leading-5 text-white/58">
          {status}
        </p>
        {error ? (
          <p className="mt-4 rounded-[18px] border border-[var(--gc-pink)]/20 bg-[var(--gc-pink)]/10 px-4 py-3 text-[12px] font-bold text-[var(--gc-pink)]">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
