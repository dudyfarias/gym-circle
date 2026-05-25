"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera, Check, Lock, Unlock, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/ui/Avatar";
import {
  GymSearchSheet,
  type LocatedPlaceCandidate,
  type PlaceCandidate,
} from "./GymSearchSheet";
import {
  calculateAgeFromBirthDate,
  formatSportsInput,
  normalizeInstagramUsername,
  splitSportsInput,
} from "./social/profile";
import type { EnrichedUser, GymLocationOption, ProfileEditInput } from "./social/types";

type EditProfileSheetProps = {
  open: boolean;
  currentUser: EnrichedUser;
  onClose: () => void;
  onSave: (input: ProfileEditInput) => Promise<void>;
  onUploadAvatar?: (file: File) => Promise<string>;
  onCatalogPlace?: (place: LocatedPlaceCandidate) => Promise<GymLocationOption>;
  gyms?: GymLocationOption[];
};

// IDs em PT-BR são source-of-truth (persistidos no DB).
// O lookup abaixo só traduz o LABEL visual — IDs nunca mudam.
const preferredTimeOptions = ["Manhã", "Almoço", "Tarde", "Noite", "Madrugada"];
const TIME_ID_TO_KEY: Record<string, string> = {
  "Manhã": "morning",
  "Almoço": "lunch",
  "Tarde": "afternoon",
  "Noite": "evening",
  "Madrugada": "dawn",
};

function findMainGymId(user: EnrichedUser, gyms: GymLocationOption[]) {
  return user.mainGymId ?? gyms.find((gym) => user.gyms.includes(gym.name))?.id ?? "";
}

export function EditProfileSheet({
  open,
  currentUser,
  onClose,
  onSave,
  onUploadAvatar,
  onCatalogPlace,
  gyms = [],
}: EditProfileSheetProps) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState(currentUser.name);
  const [username, setUsername] = useState(currentUser.username);
  const [bio, setBio] = useState(currentUser.bio ?? "");
  const [fitnessGoal, setFitnessGoal] = useState(currentUser.goal ?? "");
  const [instagramUsername, setInstagramUsername] = useState(currentUser.instagramUsername ?? "");
  const [birthDate, setBirthDate] = useState(currentUser.birthDate ?? "");
  const [sportsInput, setSportsInput] = useState(formatSportsInput(currentUser.sports));
  const [mainGymId, setMainGymId] = useState(() => findMainGymId(currentUser, gyms));
  const [localGyms, setLocalGyms] = useState<GymLocationOption[]>([]);
  const [gymSearchOpen, setGymSearchOpen] = useState(false);
  const [gymSearchError, setGymSearchError] = useState<string | null>(null);
  const [preferredTimes, setPreferredTimes] = useState<string[]>(currentUser.preferredTimes);
  const [isPrivate, setIsPrivate] = useState(currentUser.isPrivate ?? false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentUser.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      setDisplayName(currentUser.name);
      setUsername(currentUser.username);
      setBio(currentUser.bio ?? "");
      setFitnessGoal(currentUser.goal ?? "");
      setInstagramUsername(currentUser.instagramUsername ?? "");
      setBirthDate(currentUser.birthDate ?? "");
      setSportsInput(formatSportsInput(currentUser.sports));
      setMainGymId(findMainGymId(currentUser, gyms));
      setLocalGyms([]);
      setGymSearchOpen(false);
      setGymSearchError(null);
      setPreferredTimes(currentUser.preferredTimes);
      setIsPrivate(currentUser.isPrivate ?? false);
      setAvatarUrl(currentUser.avatarUrl);
      setError(null);
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, currentUser, gyms]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onUploadAvatar) return;
    setUploading(true);
    setError(null);
    try {
      const url = await onUploadAvatar(file);
      setAvatarUrl(url);
    } catch (err) {
      setError((err as Error).message ?? t("editProfile.avatar.uploadFailed"));
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
        throw new Error(t("editProfile.fields.username.errorTooShort"));
      }
      await onSave({
        displayName: displayName.trim(),
        username: cleanedUsername,
        bio: bio.trim() || null,
        fitnessGoal: fitnessGoal.trim() || null,
        instagramUsername: normalizeInstagramUsername(instagramUsername),
        birthDate: birthDate || null,
        sports: splitSportsInput(sportsInput),
        mainGymId: mainGymId || null,
        preferredTimes,
        isPrivate,
        ...(avatarUrl !== currentUser.avatarUrl ? { avatarUrl } : {}),
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSelectGym(candidate: PlaceCandidate) {
    setGymSearchError(null);

    if (candidate.provider === "registered" && candidate.gymId) {
      setMainGymId(candidate.gymId);
      setGymSearchOpen(false);
      return;
    }

    if (!onCatalogPlace) {
      setGymSearchError(t("editProfile.fields.gym.errorCantCatalog"));
      return;
    }

    if (typeof candidate.latitude !== "number" || typeof candidate.longitude !== "number") {
      setGymSearchError(t("editProfile.fields.gym.errorLocationRequired"));
      return;
    }

    try {
      const gym = await onCatalogPlace({
        ...candidate,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
      });
      setLocalGyms((current) =>
        current.some((item) => item.id === gym.id) ? current : [...current, gym],
      );
      setMainGymId(gym.id);
      setGymSearchOpen(false);
    } catch (err) {
      setGymSearchError(
        err instanceof Error ? err.message : t("editProfile.fields.gym.errorCatalogFailed"),
      );
    }
  }

  function togglePreferredTime(time: string) {
    setPreferredTimes((current) =>
      current.includes(time)
        ? current.filter((item) => item !== time)
        : [...current, time],
    );
  }

  if (!open) return null;

  const calculatedAge = calculateAgeFromBirthDate(birthDate);
  const selectableGyms = [...gyms, ...localGyms].filter(
    (gym, index, list) => list.findIndex((item) => item.id === gym.id) === index,
  );
  const selectedGym = selectableGyms.find((gym) => gym.id === mainGymId) ?? null;

  return (
    <div className="gc-safe-overlay absolute inset-0 z-50 bg-black/94 backdrop-blur-2xl">
      <div className="relative mx-auto flex h-full max-h-[840px] min-h-[620px] flex-col overflow-hidden rounded-[36px] border border-white/[0.08] bg-[#0a0b0c] shadow-[0_28px_72px_rgba(0,0,0,0.7)]">
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] p-4">
          <p className="text-[17px] font-black">{t("editProfile.title")}</p>
          <button
            aria-label={t("editProfile.close")}
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
                  <Image alt={t("editProfile.avatar.alt")} className="object-cover" fill sizes="80px" src={avatarUrl} />
                </div>
              ) : (
                <Avatar
                  accent={currentUser.accent}
                  name={currentUser.name}
                  size="lg"
                  src={currentUser.avatarUrl ?? undefined}
                />
              )}
              {onUploadAvatar ? (
                <button
                  aria-label={t("editProfile.avatar.change")}
                  className="gc-pressable absolute -bottom-1 -right-1 grid size-11 place-items-center rounded-full bg-[var(--gc-brand)] text-black shadow-[0_0_22px_rgba(92,232,255,0.3)] disabled:opacity-50"
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
              {uploading ? t("editProfile.avatar.uploading") : t("editProfile.avatar.hint")}
            </div>
          </div>

          <FormField label={t("editProfile.fields.name.label")}>
            <input
              className="h-12 w-full rounded-[16px] border border-white/[0.08] bg-black/40 px-4 text-[15px] font-bold text-white outline-none"
              maxLength={60}
              onChange={(e) => setDisplayName(e.target.value)}
              value={displayName}
            />
          </FormField>

          <FormField label={t("editProfile.fields.username.label")} hint={t("editProfile.fields.username.hint")}>
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

          <FormField label={t("editProfile.fields.bio.label")}>
            <textarea
              className="min-h-20 w-full resize-none rounded-[16px] border border-white/[0.08] bg-black/40 px-4 py-3 text-[15px] font-semibold text-white outline-none"
              maxLength={200}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t("editProfile.fields.bio.placeholder")}
              value={bio}
            />
          </FormField>

          <FormField label={t("editProfile.fields.goal.label")}>
            <input
              className="h-12 w-full rounded-[16px] border border-white/[0.08] bg-black/40 px-4 text-[15px] font-bold text-white outline-none"
              maxLength={60}
              onChange={(e) => setFitnessGoal(e.target.value)}
              placeholder={t("editProfile.fields.goal.placeholder")}
              value={fitnessGoal}
            />
          </FormField>

          <FormField label={t("editProfile.fields.gym.label")} hint={t("editProfile.fields.gym.hint")}>
            <button
              className="gc-pressable flex min-h-12 w-full items-center justify-between gap-3 rounded-[16px] border border-white/[0.08] bg-black/40 px-4 py-3 text-left"
              onClick={() => {
                setGymSearchError(null);
                setGymSearchOpen(true);
              }}
              type="button"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-black text-white">
                  {selectedGym?.name ?? t("editProfile.fields.gym.choose")}
                </span>
                <span className="mt-0.5 block truncate text-[12px] font-bold text-white/42">
                  {selectedGym
                    ? [selectedGym.address, selectedGym.city, selectedGym.state]
                        .filter(Boolean)
                        .join(" · ") || t("editProfile.fields.gym.registered")
                    : t("editProfile.fields.gym.searchHint")}
                </span>
              </span>
              <span className="rounded-full bg-[var(--gc-brand)]/14 px-3 py-1 text-[11px] font-black text-[var(--gc-brand)]">
                {t("editProfile.fields.gym.searchCta")}
              </span>
            </button>
            {mainGymId ? (
              <button
                className="mt-2 text-[12px] font-bold text-white/42"
                onClick={() => setMainGymId("")}
                type="button"
              >
                {t("editProfile.fields.gym.remove")}
              </button>
            ) : null}
            {gymSearchError ? (
              <p className="mt-2 text-[12px] font-bold text-[var(--gc-pink)]">
                {gymSearchError}
              </p>
            ) : null}
          </FormField>

          <FormField label={t("editProfile.fields.preferredTimes.label")} hint={t("editProfile.fields.preferredTimes.hint")}>
            <div className="flex flex-wrap gap-2">
              {preferredTimeOptions.map((time) => {
                const active = preferredTimes.includes(time);
                const optionKey = TIME_ID_TO_KEY[time];
                const label = optionKey
                  ? t(`editProfile.fields.preferredTimes.options.${optionKey}`)
                  : time;
                return (
                  <button
                    aria-pressed={active}
                    className={[
                      "gc-pressable h-11 rounded-full border px-4 text-[12px] font-black transition-colors",
                      active
                        ? "border-[var(--gc-brand)]/35 bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]"
                        : "border-white/[0.08] bg-white/[0.04] text-white/56",
                    ].join(" ")}
                    key={time}
                    onClick={() => togglePreferredTime(time)}
                    type="button"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </FormField>

          <FormField label={t("editProfile.fields.instagram.label")}>
            <div className="flex h-12 items-center rounded-[16px] border border-white/[0.08] bg-black/40 px-4">
              <span className="text-[15px] font-bold text-white/42">@</span>
              <input
                className="h-full flex-1 bg-transparent text-[15px] font-bold text-white outline-none"
                maxLength={30}
                onChange={(e) => setInstagramUsername(e.target.value)}
                placeholder={t("editProfile.fields.instagram.placeholder")}
                value={instagramUsername}
              />
            </div>
          </FormField>

          <FormField
            hint={
              calculatedAge
                ? t("editProfile.fields.birthDate.ageHint", { age: calculatedAge })
                : t("editProfile.fields.birthDate.autoHint")
            }
            label={t("editProfile.fields.birthDate.label")}
          >
            <input
              className="h-12 w-full rounded-[16px] border border-white/[0.08] bg-black/40 px-4 text-[15px] font-bold text-white outline-none"
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setBirthDate(e.target.value)}
              type="date"
              value={birthDate}
            />
          </FormField>

          <FormField label={t("editProfile.fields.sports.label")} hint={t("editProfile.fields.sports.hint")}>
            <input
              className="h-12 w-full rounded-[16px] border border-white/[0.08] bg-black/40 px-4 text-[15px] font-bold text-white outline-none"
              maxLength={140}
              onChange={(e) => setSportsInput(e.target.value)}
              placeholder={t("editProfile.fields.sports.placeholder")}
              value={sportsInput}
            />
          </FormField>

          <button
            aria-pressed={isPrivate}
            className={[
              "gc-pressable flex w-full items-start gap-3 rounded-[20px] border p-4 text-left transition-colors",
              isPrivate
                ? "border-[var(--gc-brand)]/35 bg-[var(--gc-brand)]/10"
                : "border-white/[0.08] bg-white/[0.04]",
            ].join(" ")}
            onClick={() => setIsPrivate((value) => !value)}
            type="button"
          >
            <span
              className={[
                "grid size-10 place-items-center rounded-[14px]",
                isPrivate ? "bg-[var(--gc-brand)]/20 text-[var(--gc-brand)]" : "bg-white/[0.06] text-white/72",
              ].join(" ")}
            >
              {isPrivate ? <Lock size={18} strokeWidth={2.4} /> : <Unlock size={18} strokeWidth={2.4} />}
            </span>
            <span className="flex-1">
              <span className={["block text-[14px] font-black", isPrivate ? "text-white" : "text-white/82"].join(" ")}>
                {isPrivate ? t("editProfile.fields.privacy.private") : t("editProfile.fields.privacy.public")}
              </span>
              <span className="mt-0.5 block text-[12px] font-bold leading-snug text-white/52">
                {isPrivate
                  ? t("editProfile.fields.privacy.privateBody")
                  : t("editProfile.fields.privacy.publicBody")}
              </span>
            </span>
            <span
              className={[
                "mt-1 grid size-6 shrink-0 place-items-center rounded-full border",
                isPrivate
                  ? "border-[var(--gc-brand)] bg-[var(--gc-brand)] text-black"
                  : "border-white/22 bg-transparent",
              ].join(" ")}
            >
              {isPrivate ? <Check size={14} strokeWidth={3.2} /> : null}
            </span>
          </button>

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
            {saving ? t("editProfile.save.saving") : t("editProfile.save.submit")}
          </button>
        </div>
      </div>
      <GymSearchSheet
        onClose={() => setGymSearchOpen(false)}
        onSelect={handleSelectGym}
        open={gymSearchOpen}
        registeredGyms={selectableGyms}
        title={t("editProfile.fields.gym.choose")}
      />
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
