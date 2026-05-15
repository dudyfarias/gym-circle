"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, useGymCircleServices } from "@gym-circle/core/hooks";
import { BrandMark } from "./design-system";
import { GymCirclePreview } from "./GymCirclePreview";
import { LiveAuthGate } from "./LiveAuthGate";
import { NativeBootController } from "./NativeBootController";
import { PwaController } from "./PwaController";
import { SocialAuthDeepLinkController } from "./SocialAuthDeepLinkController";
import { useSupabaseSocial } from "./social/useSupabaseSocial";

export function LiveHomeWrapper() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      console.info("[GymCircleBoot] auth restored", {
        hasUser: Boolean(user),
      });
    }
  }, [loading, user]);

  if (loading) {
    return (
      <>
        <NativeBootController />
        <SocialAuthDeepLinkController />
        <main className="grid min-h-screen place-items-center bg-black text-white">
          <p className="text-[14px] font-bold text-white/60">Carregando sessão...</p>
        </main>
        <PwaController />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <NativeBootController />
        <SocialAuthDeepLinkController />
        <LiveAuthGate />
        <PwaController />
      </>
    );
  }

  return (
    <>
      <NativeBootController />
      <AuthenticatedShell userId={user.id} />
    </>
  );
}

function AuthenticatedShell({ userId }: { userId: string }) {
  const services = useGymCircleServices();
  const social = useSupabaseSocial(userId);

  const uploadTo = useCallback(
    async (bucket: "posts" | "avatars" | "stories" | "chat-media", file: File) => {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await services.client.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: "3600",
          contentType: file.type || `image/${ext}`,
        });
      if (error) throw error;
      const { data } = services.client.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    },
    [services, userId],
  );

  const onUploadImage = useCallback(
    (file: File) => uploadTo("posts", file),
    [uploadTo],
  );
  const onUploadAvatar = useCallback(
    (file: File) => uploadTo("avatars", file),
    [uploadTo],
  );
  const onUploadChatImage = useCallback(
    (file: File) => uploadTo("chat-media", file),
    [uploadTo],
  );

  if (social.loading && social.feedPosts.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center bg-black text-white">
        <p className="text-[14px] font-bold text-white/60">Carregando feed...</p>
      </main>
    );
  }

  if (social.error) {
    return (
      <main className="grid min-h-screen place-items-center bg-black px-6 text-center text-white">
        <div>
          <p className="text-[16px] font-black text-[var(--gc-pink)]">Erro</p>
          <p className="mt-2 text-[13px] font-bold text-white/60">{social.error.message}</p>
        </div>
      </main>
    );
  }

  if (social.currentUser.accountStatus === "suspended") {
    return (
      <>
        <SuspendedAccountScreen
          onSendReactivationEmail={social.actions.sendReactivationEmail}
          onSignOut={social.actions.signOut}
        />
        <PwaController userId={userId} />
      </>
    );
  }

  return (
    <>
      <GymCirclePreview
        onUploadAvatar={onUploadAvatar}
        onUploadChatImage={onUploadChatImage}
        onUploadImage={onUploadImage}
        social={social}
      />
      <PwaController userId={userId} />
    </>
  );
}

function SuspendedAccountScreen({
  onSendReactivationEmail,
  onSignOut,
}: {
  onSendReactivationEmail?: () => Promise<void>;
  onSignOut?: () => Promise<void>;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoRequestedRef = useRef(false);

  const sendEmail = useCallback(async () => {
    if (!onSendReactivationEmail || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSendReactivationEmail();
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível enviar o email de reativação.",
      );
    } finally {
      setSending(false);
    }
  }, [onSendReactivationEmail, sending]);

  useEffect(() => {
    if (!autoRequestedRef.current && !sent && !sending && onSendReactivationEmail) {
      autoRequestedRef.current = true;
      void sendEmail();
    }
  }, [onSendReactivationEmail, sendEmail, sending, sent]);

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-black px-6 py-[calc(var(--gc-safe-top)+32px)] text-center text-white">
      <div className="w-full max-w-[360px]">
        <div className="mx-auto grid size-20 place-items-center rounded-[26px] border border-white/[0.08] bg-white/[0.04] shadow-[0_0_48px_rgba(48,213,255,0.14)]">
          <BrandMark size={48} />
        </div>
        <p className="mt-7 text-[22px] font-black leading-tight text-white">
          Sua conta está suspensa temporariamente
        </p>
        <p className="mt-3 text-[13px] font-bold leading-5 text-white/58">
          Seu perfil está oculto até a reativação. {sent ? "Enviamos um link seguro para seu email." : "Vamos enviar um link seguro para seu email."}
        </p>
        {error ? (
          <p className="mt-4 rounded-[18px] border border-[var(--gc-pink)]/20 bg-[var(--gc-pink)]/10 px-4 py-3 text-[12px] font-bold text-[var(--gc-pink)]">
            {error}
          </p>
        ) : null}
        <div className="mt-6 grid gap-3">
          <button
            className="gc-pressable h-12 rounded-full bg-[var(--gc-brand)] px-5 text-[14px] font-black text-black disabled:opacity-60"
            disabled={sending || !onSendReactivationEmail}
            onClick={() => void sendEmail()}
            type="button"
          >
            {sending ? "Enviando..." : sent ? "Reenviar email" : "Enviar email de reativação"}
          </button>
          <button
            className="gc-pressable h-12 rounded-full bg-white/[0.06] px-5 text-[14px] font-black text-white"
            onClick={() => void onSignOut?.()}
            type="button"
          >
            Sair
          </button>
        </div>
      </div>
    </main>
  );
}
