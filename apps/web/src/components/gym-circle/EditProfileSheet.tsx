"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera, Check, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { EnrichedUser, ProfileEditInput } from "./social/types";

type EditProfileSheetProps = {
  open: boolean;
  currentUser: EnrichedUser;
  onClose: () => void;
  onSave: (input: ProfileEditInput) => Promise<void>;
  onUploadAvatar?: (file: File) => Promise<string>;
};

export function EditProfileSheet({
  open,
  currentUser,
  onClose,
  onSave,
  onUploadAvatar,
}: EditProfileSheetProps) {
  const [displayName, setDisplayName] = useState(currentUser.name);
  const [username, setUsername] = useState(currentUser.username);
  const [bio, setBio] = useState(currentUser.bio ?? "");
  const [fitnessGoal, setFitnessGoal] = useState(currentUser.goal ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setDisplayName(currentUser.name);
      setUsername(currentUser.username);
      setBio(currentUser.bio ?? "");
      setFitnessGoal(currentUser.goal ?? "");
      setAvatarUrl(null);
      setError(null);
    }
  }, [open, currentUser]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onUploadAvatar) return;
    setUploading(true);
    setError(null);
    try {
      const url = await onUploadAvatar(file);
      setAvatarUrl(url);
    } catch (err) {
      setError((err as Error).message ?? "falha no upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const cleanedUsername = username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, "");
      if (cleanedUsername.length < 3) {
        throw new Error("username precisa ter pelo menos 3 caracteres válidos");
      }
      await onSave({
        displayName: displayName.trim(),
        username: cleanedUsername,
        bio: bio.trim() || null,
        fitnessGoal: fitnessGoal.trim() || null,
        ...(avatarUrl ? { avatarUrl } : {}),
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 bg-black/94 px-4 py-4 backdrop-blur-2xl">
      <div className="relative mx-auto flex h-full max-h-[840px] min-h-[620px] flex-col overflow-hidden rounded-[36px] border border-white/[0.08] bg-[#0a0b0c] shadow-[0_28px_72px_rgba(0,0,0,0.7)]">
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] p-4">
          <p className="text-[17px] font-black">Editar perfil</p>
          <button
            aria-label="Fechar"
            className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.06] text-white"
            onClick={onClose}
            type="button"
          >
            <X size={19} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              {avatarUrl ? (
                <div className="relative size-20 overflow-hidden rounded-full">
                  <Image alt="Avatar" className="object-cover" fill sizes="80px" src={avatarUrl} />
                </div>
              ) : (
                <Avatar accent={currentUser.accent} name={currentUser.name} size="lg" />
              )}
              {onUploadAvatar ? (
                <button
                  aria-label="Trocar avatar"
                  className="gc-pressable absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full bg-[var(--gc-brand)] text-black shadow-[0_0_22px_rgba(92,232,255,0.3)] disabled:opacity-50"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  type="button"
                >
                  <Camera size={15} strokeWidth={2.6} />
                  <input
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                    ref={fileRef}
                    type="file"
                  />
                </button>
              ) : null}
            </div>
            <div className="text-[12px] font-bold text-white/52">
              {uploading ? "Enviando avatar..." : "Toque na câmera para trocar a foto."}
            </div>
          </div>

          <FormField label="Nome">
            <input
              className="h-12 w-full rounded-[16px] border border-white/[0.08] bg-black/40 px-4 text-[15px] font-bold text-white outline-none"
              maxLength={60}
              onChange={(e) => setDisplayName(e.target.value)}
              value={displayName}
            />
          </FormField>

          <FormField label="Username (@)" hint="só letras, números, _ e .">
            <div className="flex h-12 items-center rounded-[16px] border border-white/[0.08] bg-black/40 px-4">
              <span className="text-[15px] font-bold text-white/42">@</span>
              <input
                className="h-full flex-1 bg-transparent text-[15px] font-bold text-white outline-none"
                maxLength={32}
                onChange={(e) => setUsername(e.target.value)}
                value={username}
              />
            </div>
          </FormField>

          <FormField label="Bio">
            <textarea
              className="min-h-20 w-full resize-none rounded-[16px] border border-white/[0.08] bg-black/40 px-4 py-3 text-[15px] font-semibold text-white outline-none"
              maxLength={200}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Sobre você"
              value={bio}
            />
          </FormField>

          <FormField label="Foco">
            <input
              className="h-12 w-full rounded-[16px] border border-white/[0.08] bg-black/40 px-4 text-[15px] font-bold text-white outline-none"
              maxLength={60}
              onChange={(e) => setFitnessGoal(e.target.value)}
              placeholder="Ex: Hipertrofia, Corrida 10K, Consistência"
              value={fitnessGoal}
            />
          </FormField>

          {error ? (
            <p className="rounded-[16px] border border-[var(--gc-pink)]/30 bg-[var(--gc-pink)]/10 p-3 text-[12px] font-bold text-[var(--gc-pink)]">
              {error}
            </p>
          ) : null}
        </div>

        <div className="border-t border-white/[0.06] p-4">
          <button
            className="gc-pressable flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[14px] font-black text-black disabled:opacity-50"
            disabled={saving || uploading}
            onClick={handleSave}
            type="button"
          >
            <Check size={17} strokeWidth={2.8} />
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-[12px] font-black uppercase text-white/52">
        {label}
        {hint ? <span className="text-[10px] font-bold normal-case text-white/32">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}
