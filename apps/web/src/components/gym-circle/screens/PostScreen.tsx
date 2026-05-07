"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Camera, Check, Dumbbell, MapPin, Sparkles, Timer, Upload } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { AchievementBadge, StreakBadge } from "../design-system";
import { workoutImagePool } from "../social/mock-data";
import type { CreateWorkoutPostInput, EnrichedUser } from "../social/types";
import { TopBar } from "../TopBar";

type PostScreenProps = {
  currentUser: EnrichedUser;
  onPublish: (input: CreateWorkoutPostInput) => void;
  onUploadImage?: (file: File) => Promise<string>;
};

const workoutTypes = ["Push day", "Leg day", "Full body", "Cardio"];
const gyms = [
  { id: "gym-pulse", name: "Pulse Club Recife" },
  { id: "gym-wellness", name: "Wellness Lab" },
  { id: "gym-flow", name: "Studio Flow" },
];

export function PostScreen({ currentUser, onPublish, onUploadImage }: PostScreenProps) {
  const [caption, setCaption] = useState("Treino concluido. Push day pesado, mas no controle.");
  const [workoutType, setWorkoutType] = useState(workoutTypes[0]);
  const [gym, setGym] = useState(gyms[0]);
  const [imageUrl, setImageUrl] = useState(workoutImagePool[0]);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !onUploadImage) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await onUploadImage(file);
      setImageUrl(url);
    } catch (err) {
      setUploadError((err as Error).message ?? "falha no upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function publishWorkout() {
    if (publishing) return;
    setPublishing(true);
    try {
      await onPublish({
        caption,
        workoutType,
        gymId: gym.id,
        gymName: gym.name,
        imageUrl,
      });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <section className="gc-screen-enter min-h-screen px-5 pb-6">
      <TopBar eyebrow="Post de treino" title="Publicar" />

      <GlassCard elevated className="mt-5 overflow-hidden">
        <div className="relative aspect-[4/5]">
          <Image
            alt="Post de treino com imagem obrigatória"
            className="object-cover"
            fill
            sizes="(max-width: 480px) 100vw, 480px"
            src={imageUrl}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/8 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex flex-wrap gap-2">
              <AchievementBadge
                icon={<Camera size={15} className="text-[var(--gc-brand)]" />}
                label="Foto obrigatoria"
                tone="brand"
              />
              <AchievementBadge
                icon={<Timer size={15} />}
                label="Post em menos de 10s"
                tone="blue"
              />
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="mt-4 p-4">
        <textarea
          className="min-h-24 w-full resize-none bg-transparent text-[17px] font-semibold leading-6 text-white outline-none placeholder:text-white/28"
          onChange={(event) => setCaption(event.target.value)}
          placeholder="Como foi o treino?"
          value={caption}
        />
        <div className="gc-scrollbar -mx-1 mt-1 flex gap-2 overflow-x-auto px-1 pb-2">
          {onUploadImage ? (
            <>
              <button
                aria-label="Enviar foto do dispositivo"
                className="gc-pressable relative grid size-16 shrink-0 place-items-center rounded-[20px] border border-white/[0.16] bg-white/[0.06] text-white/72 disabled:opacity-50"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <Upload size={18} strokeWidth={2.4} />
                <input
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  type="file"
                />
              </button>
            </>
          ) : null}
          {workoutImagePool.map((image) => (
            <button
              aria-label="Selecionar foto do treino"
              className={[
                "relative size-16 shrink-0 overflow-hidden rounded-[20px] border",
                image === imageUrl ? "border-[var(--gc-brand)]" : "border-white/[0.08]",
              ].join(" ")}
              key={image}
              onClick={() => setImageUrl(image)}
              type="button"
            >
              <Image
                alt="Foto de treino"
                className="object-cover"
                fill
                sizes="64px"
                src={image}
              />
            </button>
          ))}
        </div>
        {uploadError ? (
          <p className="mt-2 text-[12px] font-bold text-[var(--gc-pink)]">
            Upload falhou: {uploadError}
          </p>
        ) : null}
        {uploading ? (
          <p className="mt-2 text-[12px] font-bold text-white/52">Enviando foto...</p>
        ) : null}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-[20px] bg-white/[0.055] p-3">
            <Dumbbell className="mb-3 text-[var(--gc-blue)]" size={18} />
            <p className="text-[12px] font-bold text-white/42">Treino</p>
            <select
              className="mt-1 w-full bg-transparent text-[15px] font-extrabold text-white outline-none"
              onChange={(event) => setWorkoutType(event.target.value)}
              value={workoutType}
            >
              {workoutTypes.map((type) => (
                <option className="bg-black" key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-[20px] bg-white/[0.055] p-3">
            <MapPin className="mb-3 text-[var(--gc-consistency-mid)]" size={18} />
            <p className="text-[12px] font-bold text-white/42">Local</p>
            <select
              className="mt-1 w-full bg-transparent text-[15px] font-extrabold text-white outline-none"
              onChange={(event) =>
                setGym(gyms.find((item) => item.id === event.target.value) ?? gyms[0])
              }
              value={gym.id}
            >
              {gyms.map((item) => (
                <option className="bg-black" key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </GlassCard>

      <button
        className="gc-pressable mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[15px] font-black text-black shadow-[0_0_28px_rgba(92,232,255,0.26)]"
        onClick={publishWorkout}
        type="button"
      >
        <Check size={19} strokeWidth={2.8} />
        Publicar treino
      </button>

      <div className="mt-4 flex items-center justify-center gap-2 text-[12px] font-bold text-white/40">
        <Sparkles size={14} className="text-[var(--gc-consistency-daily)]" />
        <StreakBadge
          isLit={currentUser.streakLitToday}
          size="xs"
          streak={currentUser.currentStreak}
        />
        {currentUser.streakLitToday ? "Seu badge ja esta aceso." : "Poste para acender hoje."}
      </div>
    </section>
  );
}
