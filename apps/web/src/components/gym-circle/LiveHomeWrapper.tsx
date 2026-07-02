"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, useGymCircleServices } from "@gym-circle/core/hooks";
import { BrandMark } from "./design-system";
import { GymCirclePreview } from "./GymCirclePreview";
import { LiveAuthGate } from "./LiveAuthGate";
import { NativeBootController } from "./NativeBootController";
import { NativePushController } from "./NativePushController";
import { useTranslation } from "react-i18next";
import { PwaController } from "./PwaController";
import { markPerf, measurePerf } from "./performance";
import { useSupabaseSocial } from "./social/useSupabaseSocial";

// Sprint 2.4: qualidade priorizada (revert Sprint 1 agressivo).
// 1920 cobre Retina iPhone Pro Max sem upscaling. Quality 0.88 mantém
// arquivos sob ~400KB médio mas com sensação premium em zoom.
const POST_IMAGE_MAX_EDGE = 1920;
const POST_IMAGE_QUALITY = 0.88;
const POST_THUMBNAIL_MAX_EDGE = 640;
const POST_THUMBNAIL_QUALITY = 0.82;
const POSTER_QUALITY = 0.88;
// Blur placeholder: 10x10px é o sweet spot — base64 ~500 bytes,
// renderiza como "watercolor" suave que casa com qualquer foto.
const BLUR_PLACEHOLDER_EDGE = 10;
const BLUR_PLACEHOLDER_QUALITY = 0.5;

type UploadedWorkoutMedia = {
  imageUrl: string;
  thumbnailUrl?: string | null;
  posterUrl?: string | null;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  mediaDurationSeconds?: number | null;
  blurDataUrl?: string | null;
};

type PreparedImageFile = {
  file: File;
  width: number | null;
  height: number | null;
};

function isResizableImage(file: File) {
  return (
    typeof window !== "undefined" &&
    file.type.startsWith("image/") &&
    file.type !== "image/gif" &&
    file.type !== "image/svg+xml"
  );
}

async function loadImageFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Não foi possível preparar a imagem."));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Sprint 2.4: gera blur placeholder base64 (~500 bytes) pra usar como
 * `placeholder="blur"` no `next/image` ou `background-image` em
 * `PinchZoomImage`/`StoryViewer`. Elimina o flash preto antes do
 * decode da mídia HQ.
 *
 * Funciona a partir de um `HTMLImageElement` (foto carregada) OU um
 * `<canvas>` já desenhado (caso poster de vídeo — reusa o frame).
 *
 * Retorna `null` em erro — blurDataUrl é best-effort, não bloqueia
 * upload se falhar.
 */
async function generateBlurDataUrl(
  source: HTMLImageElement | HTMLCanvasElement,
): Promise<string | null> {
  if (typeof document === "undefined") return null;
  try {
    const naturalW =
      source instanceof HTMLCanvasElement ? source.width : source.naturalWidth;
    const naturalH =
      source instanceof HTMLCanvasElement
        ? source.height
        : source.naturalHeight;
    if (!naturalW || !naturalH) return null;

    const ratio = naturalW / naturalH;
    const w =
      ratio >= 1
        ? BLUR_PLACEHOLDER_EDGE
        : Math.max(2, Math.round(BLUR_PLACEHOLDER_EDGE * ratio));
    const h =
      ratio >= 1
        ? Math.max(2, Math.round(BLUR_PLACEHOLDER_EDGE / ratio))
        : BLUR_PLACEHOLDER_EDGE;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // `imageSmoothingQuality: "high"` deixa a redução suave em vez de
    // pixelizada — importante pro blur ficar bonito ao ser scale-up.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", BLUR_PLACEHOLDER_QUALITY);
  } catch {
    return null;
  }
}

async function imageFileVariant(
  file: File,
  maxEdge: number,
  quality: number,
  suffix: string,
): Promise<PreparedImageFile> {
  if (!isResizableImage(file)) {
    return { file, width: null, height: null };
  }

  try {
    const image = await loadImageFile(file);
    const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
    if (!longestEdge) return { file, width: null, height: null };

    const ratio = Math.min(1, maxEdge / longestEdge);
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    if (ratio === 1 && suffix !== "thumb") {
      return { file, width: image.naturalWidth, height: image.naturalHeight };
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return { file, width: image.naturalWidth, height: image.naturalHeight };
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });
    if (!blob) return { file, width: image.naturalWidth, height: image.naturalHeight };

    const baseName = file.name.replace(/\.[^.]+$/, "") || "gym-circle-post";
    return {
      file: new File([blob], `${baseName}-${suffix}.jpg`, {
        lastModified: file.lastModified,
        type: "image/jpeg",
      }),
      width,
      height,
    };
  } catch {
    return { file, width: null, height: null };
  }
}

async function createVideoPoster(file: File): Promise<(PreparedImageFile & { duration: number | null; blurDataUrl: string | null }) | null> {
  if (typeof window === "undefined" || !file.type.startsWith("video/")) return null;
  const url = URL.createObjectURL(file);
  let video: HTMLVideoElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  try {
    video = document.createElement("video");
    const activeVideo = video;
    activeVideo.muted = true;
    activeVideo.playsInline = true;
    activeVideo.preload = "metadata";
    activeVideo.src = url;

    await new Promise<void>((resolve, reject) => {
      activeVideo.onloadedmetadata = () => resolve();
      activeVideo.onerror = () => reject(new Error("Não foi possível gerar preview do vídeo."));
    });

    const duration = Number.isFinite(activeVideo.duration) ? activeVideo.duration : null;
    const width = activeVideo.videoWidth || null;
    const height = activeVideo.videoHeight || null;
    if (!width || !height) return null;

    const seekTo = duration ? Math.min(0.18, Math.max(0.01, duration - 0.01)) : 0.01;
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      activeVideo.onseeked = done;
      window.setTimeout(done, 900);
      try {
        activeVideo.currentTime = seekTo;
      } catch {
        resolve();
      }
    });

    const ratio = Math.min(1, POST_THUMBNAIL_MAX_EDGE / Math.max(width, height));
    canvas = document.createElement("canvas");
    const posterCanvas = canvas;
    posterCanvas.width = Math.max(1, Math.round(width * ratio));
    posterCanvas.height = Math.max(1, Math.round(height * ratio));
    const context = posterCanvas.getContext("2d");
    if (!context) return null;
    context.drawImage(activeVideo, 0, 0, posterCanvas.width, posterCanvas.height);
    const blob = await new Promise<Blob | null>((resolve) => {
      // Sprint 2.4: poster ganha quality HQ (0.88 vs 0.76 antigo). Frame
      // de vídeo precisa de detalhe pra não parecer pixelado quando o
      // user ver no feed antes do play.
      posterCanvas.toBlob(resolve, "image/jpeg", POSTER_QUALITY);
    });
    if (!blob) return null;

    // Sprint 2.4: também gera blur placeholder do poster — reusa o frame
    // já desenhado na canvas. Custo zero adicional.
    const posterBlur = await generateBlurDataUrl(posterCanvas);

    const baseName = file.name.replace(/\.[^.]+$/, "") || "gym-circle-video";
    return {
      file: new File([blob], `${baseName}-poster.jpg`, {
        lastModified: file.lastModified,
        type: "image/jpeg",
      }),
      width,
      height,
      duration,
      blurDataUrl: posterBlur,
    };
  } catch {
    return null;
  } finally {
    // Libera decoder e backing store antes do próximo item. Confiar só no GC
    // mantém dezenas de MB vivos no WKWebView.
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
    }
    URL.revokeObjectURL(url);
  }
}

export function LiveHomeWrapper() {
  const { user, loading } = useAuth();
  const bootMarkedRef = useRef(false);

  useEffect(() => {
    if (bootMarkedRef.current) return;
    bootMarkedRef.current = true;
    markPerf("app_boot_start");
    markPerf("auth_restore_start");
  }, []);

  useEffect(() => {
    if (!loading) {
      measurePerf("auth_restore_ms", "auth_restore_start", "auth_restore_end");
      if (process.env.NEXT_PUBLIC_PERF_DEBUG === "true") {
        console.info("[GymCircleBoot] auth restored", {
          hasUser: Boolean(user),
        });
      }
    }
  }, [loading, user]);

  if (loading) {
    return (
      <>
        <NativeBootController />
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
  const { t } = useTranslation();

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
    async (file: File): Promise<UploadedWorkoutMedia> => {
      markPerf("image_upload_start");
      try {
        if (file.type.startsWith("image/")) {
          markPerf("thumbnail_generation_start");
          // Sequencial por arquivo: evita manter dois decodes + dois canvas
          // grandes ao mesmo tempo no iPhone.
          const feedFile = await imageFileVariant(
            file,
            POST_IMAGE_MAX_EDGE,
            POST_IMAGE_QUALITY,
            "feed",
          );
          const thumbnail = await imageFileVariant(
            file,
            POST_THUMBNAIL_MAX_EDGE,
            POST_THUMBNAIL_QUALITY,
            "thumb",
          );
          measurePerf(
            "thumbnail_generation_ms",
            "thumbnail_generation_start",
            "thumbnail_generation_end",
          );
          // Sprint 2.4: gera blur placeholder no client durante o
          // upload. Custo: 1 canvas 10x10px + toDataURL JPEG. Resultado
          // ~500 bytes que vai pro `blur_data_url` no banco e elimina o
          // flash preto no feed/stories quando o post aparecer.
          markPerf("blur_generation_start");
          const blurImage = await loadImageFile(file).catch(() => null);
          const blurDataUrl = blurImage
            ? await generateBlurDataUrl(blurImage)
            : null;
          measurePerf(
            "blur_generation_ms",
            "blur_generation_start",
            "blur_generation_end",
          );
          const [imageUrl, thumbnailUrl] = await Promise.all([
            uploadTo("posts", feedFile.file),
            uploadTo("posts", thumbnail.file),
          ]);
          return {
            imageUrl,
            thumbnailUrl,
            blurDataUrl,
            mediaWidth: feedFile.width ?? thumbnail.width ?? null,
            mediaHeight: feedFile.height ?? thumbnail.height ?? null,
          };
        }

        const poster = await createVideoPoster(file);
        const [imageUrl, posterUrl] = await Promise.all([
          uploadTo("posts", file),
          poster ? uploadTo("posts", poster.file) : Promise.resolve(null),
        ]);
        return {
          imageUrl,
          posterUrl,
          // Sprint 2.4: vídeo herda blur do frame do poster (já
          // gerado em `createVideoPoster`). Resolve flash preto também
          // pra posts de vídeo no feed antes do `<video>` carregar
          // metadata.
          blurDataUrl: poster?.blurDataUrl ?? null,
          mediaWidth: poster?.width ?? null,
          mediaHeight: poster?.height ?? null,
          mediaDurationSeconds: poster?.duration ?? null,
        };
      } finally {
        measurePerf("image_upload_ms", "image_upload_start", "image_upload_end");
      }
    },
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

  if (social.error && social.feedPosts.length === 0 && !social.loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-black px-6 text-center text-white">
        <div className="flex max-w-[300px] flex-col items-center">
          <p className="text-[16px] font-black text-white">{t("feed.error.title")}</p>
          <p className="mt-2 text-[13px] font-bold text-white/60">{t("feed.error.body")}</p>
          {/* Antes era beco sem saída (só a mensagem); agora dá pra re-tentar
              sem precisar recarregar a página. */}
          <button
            className="gc-pressable mt-5 h-12 rounded-full bg-[var(--gc-brand)] px-6 text-[14px] font-black text-black"
            onClick={() => void social.refresh()}
            type="button"
          >
            {t("common.retry")}
          </button>
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
      <NativePushController userId={userId} />
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
