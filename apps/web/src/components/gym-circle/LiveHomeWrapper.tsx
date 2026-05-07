"use client";

import { useCallback } from "react";
import { useAuth, useGymCircleServices } from "@gym-circle/core/hooks";
import { GymCirclePreview } from "./GymCirclePreview";
import { LiveAuthGate } from "./LiveAuthGate";
import { useSupabaseSocial } from "./social/useSupabaseSocial";

export function LiveHomeWrapper() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-black text-white">
        <p className="text-[14px] font-bold text-white/60">Carregando sessão...</p>
      </main>
    );
  }

  if (!user) {
    return <LiveAuthGate />;
  }

  return <AuthenticatedShell userId={user.id} />;
}

function AuthenticatedShell({ userId }: { userId: string }) {
  const services = useGymCircleServices();
  const social = useSupabaseSocial(userId);

  const uploadTo = useCallback(
    async (bucket: "posts" | "avatars" | "stories", file: File) => {
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

  return (
    <GymCirclePreview
      onUploadAvatar={onUploadAvatar}
      onUploadImage={onUploadImage}
      social={social}
    />
  );
}
