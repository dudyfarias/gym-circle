"use client";

import Image from "next/image";
import type { ChangeEvent } from "react";
import { useMemo, useRef, useState } from "react";
import {
  BookImage,
  Camera,
  Check,
  Dumbbell,
  Link2,
  LocateFixed,
  MapPin,
  Sparkles,
  Timer,
  Upload,
  Video,
  Zap,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { AchievementBadge, StreakBadge } from "../design-system";
import type {
  CreateWorkoutPostInput,
  EnrichedUser,
  PostLocationSource,
  PostMediaType,
} from "../social/types";
import { TopBar } from "../TopBar";

type PostScreenProps = {
  currentUser: EnrichedUser;
  onPublish: (input: CreateWorkoutPostInput) => void | Promise<void>;
  onUploadImage?: (file: File) => Promise<string>;
};

const workoutTypes = [
  { label: "Sem tipo", value: "" },
  { label: "Musculação", value: "Musculação" },
  { label: "Corrida", value: "Corrida" },
  { label: "Bike", value: "Bike" },
  { label: "Funcional", value: "Funcional" },
  { label: "Cardio", value: "Cardio" },
  { label: "Mobilidade", value: "Mobilidade" },
  { label: "Outro", value: "Outro" },
];

const locationOptions: Array<{ label: string; value: PostLocationSource }> = [
  { label: "Sem localização", value: "none" },
  { label: "Academia no Maps", value: "gym" },
  { label: "Minha localização", value: "current" },
  { label: "Outro local", value: "custom" },
];

type Coordinates = {
  latitude: number;
  longitude: number;
};

function getMediaType(file: File): PostMediaType {
  return file.type.startsWith("video/") ? "video" : "image";
}

function buildGoogleMapsUrl(query: string) {
  const params = new URLSearchParams({ api: "1", query });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Algo saiu errado. Tente de novo.";
}

export function PostScreen({ currentUser, onPublish, onUploadImage }: PostScreenProps) {
  const [caption, setCaption] = useState("");
  const [workoutType, setWorkoutType] = useState("");
  const [customWorkoutType, setCustomWorkoutType] = useState("");
  const [locationMode, setLocationMode] = useState<PostLocationSource>("none");
  const [locationName, setLocationName] = useState("");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [mediaType, setMediaType] = useState<PostMediaType>("image");
  const [uploading, setUploading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  // Destino default: feed + story (mais social-first; usuário pode desligar antes de publicar)
  const [postToFeed, setPostToFeed] = useState(true);
  const [postToStory, setPostToStory] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resolvedWorkoutType = useMemo(() => {
    if (workoutType === "Outro") {
      return customWorkoutType.trim() || null;
    }
    return workoutType.trim() || null;
  }, [customWorkoutType, workoutType]);

  const resolvedLocation = useMemo(() => {
    if (locationMode === "none") {
      return {
        source: "none" as const,
        name: null,
        latitude: null,
        longitude: null,
        googleMapsUrl: null,
      };
    }

    if (locationMode === "current" && coordinates) {
      const query = `${coordinates.latitude},${coordinates.longitude}`;
      return {
        source: "current" as const,
        name: locationName.trim() || "Local atual",
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        googleMapsUrl: buildGoogleMapsUrl(query),
      };
    }

    const trimmedName = locationName.trim();
    if (!trimmedName) {
      return {
        source: "none" as const,
        name: null,
        latitude: null,
        longitude: null,
        googleMapsUrl: null,
      };
    }

    return {
      source: locationMode,
      name: trimmedName,
      latitude: null,
      longitude: null,
      googleMapsUrl: buildGoogleMapsUrl(trimmedName),
    };
  }, [coordinates, locationMode, locationName]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setUploadError("Escolha uma foto ou vídeo.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setPublishError(null);
    setMediaType(getMediaType(file));

    try {
      const url = onUploadImage ? await onUploadImage(file) : URL.createObjectURL(file);
      setImageUrl(url);
    } catch (err) {
      setUploadError(getErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleLocationModeChange(next: PostLocationSource) {
    setLocationMode(next);
    setLocationError(null);
    if (next === "none") {
      setLocationName("");
      setCoordinates(null);
    }
    if (next !== "current") {
      setCoordinates(null);
    }
  }

  async function useCurrentLocation() {
    setLocationMode("current");
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Seu navegador não liberou localização.");
      return;
    }

    setLocating(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 30000,
          timeout: 9000,
        });
      });
      setCoordinates({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setLocationName("Local atual");
    } catch (err) {
      setLocationError(getErrorMessage(err));
    } finally {
      setLocating(false);
    }
  }

  async function publishWorkout() {
    if (publishing) return;

    if (!imageUrl.trim()) {
      setPublishError("Escolha uma foto ou vídeo para publicar.");
      return;
    }

    if (!postToFeed && !postToStory) {
      setPublishError("Escolha pelo menos um destino: feed ou story.");
      return;
    }

    setPublishing(true);
    setPublishError(null);
    try {
      await onPublish({
        caption,
        workoutType: resolvedWorkoutType,
        gymId: null,
        gymName: resolvedLocation.name ?? "",
        imageUrl,
        mediaType,
        locationSource: resolvedLocation.source,
        locationName: resolvedLocation.name,
        locationLatitude: resolvedLocation.latitude,
        locationLongitude: resolvedLocation.longitude,
        locationGoogleMapsUrl: resolvedLocation.googleMapsUrl,
        destinations: { feed: postToFeed, story: postToStory },
      });
    } catch (err) {
      setPublishError(getErrorMessage(err));
    } finally {
      setPublishing(false);
    }
  }

  const hasDestination = postToFeed || postToStory;
  const canPublish =
    imageUrl.trim().length > 0 && hasDestination && !uploading && !publishing;

  const publishLabel = useMemo(() => {
    if (publishing) return "Publicando...";
    if (postToFeed && postToStory) return "Publicar no feed + story";
    if (postToFeed) return "Publicar no feed";
    if (postToStory) return "Publicar story";
    return "Escolha um destino";
  }, [postToFeed, postToStory, publishing]);

  return (
    <section className="gc-screen-enter min-h-screen px-5 pb-6">
      <TopBar eyebrow="Post de treino" title="Publicar" />

      <GlassCard elevated className="mt-5 overflow-hidden">
        <div className="relative aspect-[4/5] bg-[#050607]">
          {imageUrl ? (
            mediaType === "video" ? (
              <video
                className="h-full w-full object-cover"
                controls
                playsInline
                preload="metadata"
                src={imageUrl}
              />
            ) : (
              <Image
                alt="Mídia do treino"
                className="object-cover"
                fill
                sizes="(max-width: 480px) 100vw, 480px"
                src={imageUrl}
              />
            )
          ) : (
            <div className="flex h-full flex-col justify-between p-6">
              <div className="flex items-center justify-between">
                <div className="grid size-14 place-items-center rounded-[22px] bg-[var(--gc-brand)]/14 text-[var(--gc-brand)] shadow-[0_0_30px_rgba(92,232,255,0.16)]">
                  <Camera size={24} strokeWidth={2.4} />
                </div>
                <AchievementBadge
                  icon={<Sparkles size={14} />}
                  label="Streak social"
                  tone="blue"
                />
              </div>
              <div>
                <p className="max-w-[280px] text-[30px] font-black leading-[1.02] text-white">
                  Fez seu treino hoje?
                </p>
                <p className="mt-3 max-w-[300px] text-[15px] font-bold leading-5 text-white/58">
                  Poste uma foto ou vídeo para motivar os outros e mostrar seu streak.
                </p>
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/86 via-black/8 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex flex-wrap gap-2">
              <AchievementBadge
                icon={mediaType === "video" ? <Video size={15} /> : <Camera size={15} />}
                label="Foto ou vídeo obrigatório"
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
        <button
          className="gc-pressable flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white/[0.08] text-[14px] font-black text-white disabled:opacity-55"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          <Upload size={18} strokeWidth={2.5} />
          {uploading ? "Enviando mídia..." : imageUrl ? "Trocar mídia" : "Escolher foto ou vídeo"}
        </button>
        <input
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileChange}
          ref={fileInputRef}
          type="file"
        />
        {uploadError ? (
          <p className="mt-2 text-[12px] font-bold text-[var(--gc-pink)]">
            Upload falhou: {uploadError}
          </p>
        ) : null}

        <textarea
          className="mt-4 min-h-24 w-full resize-none bg-transparent text-[17px] font-semibold leading-6 text-white outline-none placeholder:text-white/28"
          onChange={(event) => setCaption(event.target.value)}
          placeholder="Como foi o treino?"
          value={caption}
        />

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-[20px] bg-white/[0.055] p-3">
            <Dumbbell className="mb-3 text-[var(--gc-blue)]" size={18} />
            <p className="text-[12px] font-bold text-white/42">Tipo opcional</p>
            <select
              className="mt-1 w-full bg-transparent text-[15px] font-extrabold text-white outline-none"
              onChange={(event) => setWorkoutType(event.target.value)}
              value={workoutType}
            >
              {workoutTypes.map((type) => (
                <option className="bg-black" key={type.value || "none"} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-[20px] bg-white/[0.055] p-3">
            <MapPin className="mb-3 text-[var(--gc-consistency-mid)]" size={18} />
            <p className="text-[12px] font-bold text-white/42">Local opcional</p>
            <select
              className="mt-1 w-full bg-transparent text-[15px] font-extrabold text-white outline-none"
              onChange={(event) =>
                handleLocationModeChange(event.target.value as PostLocationSource)
              }
              value={locationMode}
            >
              {locationOptions.map((option) => (
                <option className="bg-black" key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {workoutType === "Outro" ? (
          <input
            className="mt-3 h-12 w-full rounded-[18px] border border-white/[0.08] bg-white/[0.055] px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/30"
            onChange={(event) => setCustomWorkoutType(event.target.value)}
            placeholder="Nome do treino"
            value={customWorkoutType}
          />
        ) : null}

        {locationMode === "gym" || locationMode === "custom" ? (
          <div className="mt-3 rounded-[22px] border border-white/[0.08] bg-white/[0.045] p-3">
            <div className="flex items-center gap-2">
              <Link2 size={15} className="text-[var(--gc-brand)]" />
              <p className="text-[12px] font-black text-white/50">
                Vinculado por busca no Google Maps
              </p>
            </div>
            <input
              className="mt-2 h-11 w-full rounded-[16px] bg-black/28 px-3 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
              onChange={(event) => setLocationName(event.target.value)}
              placeholder={
                locationMode === "gym"
                  ? "Nome da academia ou box"
                  : "Praia, parque, prédio..."
              }
              value={locationName}
            />
            {resolvedLocation.googleMapsUrl ? (
              <a
                className="mt-2 inline-flex text-[12px] font-black text-[var(--gc-brand)]"
                href={resolvedLocation.googleMapsUrl}
                rel="noreferrer"
                target="_blank"
              >
                Abrir no Google Maps
              </a>
            ) : null}
          </div>
        ) : null}

        {locationMode === "current" ? (
          <div className="mt-3 rounded-[22px] border border-white/[0.08] bg-white/[0.045] p-3">
            <button
              className="gc-pressable flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white/[0.08] text-[13px] font-black text-white disabled:opacity-50"
              disabled={locating}
              onClick={useCurrentLocation}
              type="button"
            >
              <LocateFixed size={16} />
              {locating ? "Localizando..." : coordinates ? "Atualizar localização" : "Usar localização atual"}
            </button>
            {coordinates ? (
              <div className="mt-2 flex items-center justify-between gap-2 text-[12px] font-bold text-white/50">
                <span>
                  {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}
                </span>
                {resolvedLocation.googleMapsUrl ? (
                  <a
                    className="shrink-0 font-black text-[var(--gc-brand)]"
                    href={resolvedLocation.googleMapsUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Maps
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {locationError ? (
          <p className="mt-2 text-[12px] font-bold text-[var(--gc-pink)]">
            Localização: {locationError}
          </p>
        ) : null}
      </GlassCard>

      <div className="mt-4">
        <p className="mb-2 text-[12px] font-black uppercase text-white/52">
          Onde postar
        </p>
        <div className="grid grid-cols-2 gap-2">
          <DestinationPill
            active={postToFeed}
            description="Aparece no feed dos seus seguidores"
            icon={<BookImage size={18} strokeWidth={2.4} />}
            label="Feed"
            onToggle={() => setPostToFeed((value) => !value)}
          />
          <DestinationPill
            active={postToStory}
            description="Some em 24h, mas acende o badge"
            icon={<Zap size={18} strokeWidth={2.4} />}
            label="Story"
            onToggle={() => setPostToStory((value) => !value)}
          />
        </div>
        {!hasDestination ? (
          <p className="mt-2 text-[12px] font-bold text-[var(--gc-pink)]">
            Escolha pelo menos um: feed ou story.
          </p>
        ) : null}
      </div>

      <button
        className="gc-pressable mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[15px] font-black text-black shadow-[0_0_28px_rgba(92,232,255,0.26)] disabled:opacity-45"
        disabled={!canPublish}
        onClick={publishWorkout}
        type="button"
      >
        <Check size={19} strokeWidth={2.8} />
        {publishLabel}
      </button>

      {publishError ? (
        <p className="mt-3 text-center text-[12px] font-bold text-[var(--gc-pink)]">
          {publishError}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-center gap-2 text-[12px] font-bold text-white/40">
        <Sparkles size={14} className="text-[var(--gc-consistency-daily)]" />
        <StreakBadge
          isLit={currentUser.streakLitToday}
          size="xs"
          streak={currentUser.currentStreak}
        />
        {currentUser.streakLitToday ? "Seu badge já está aceso." : "Poste para acender hoje."}
      </div>
    </section>
  );
}

type DestinationPillProps = {
  active: boolean;
  description: string;
  icon: React.ReactNode;
  label: string;
  onToggle: () => void;
};

function DestinationPill({
  active,
  description,
  icon,
  label,
  onToggle,
}: DestinationPillProps) {
  return (
    <button
      aria-label={`${active ? "Desativar" : "Ativar"} destino ${label}`}
      aria-pressed={active}
      className={[
        "gc-pressable flex flex-col items-start gap-1 rounded-[20px] border p-3 text-left transition-colors",
        active
          ? "border-[var(--gc-brand)]/35 bg-[var(--gc-brand)]/10 text-white shadow-[0_0_22px_rgba(92,232,255,0.16)]"
          : "border-white/[0.08] bg-white/[0.04] text-white/72",
      ].join(" ")}
      onClick={onToggle}
      type="button"
    >
      <span className="flex w-full items-center justify-between">
        <span className={["flex items-center gap-2 text-[14px] font-black", active ? "text-white" : "text-white/72"].join(" ")}>
          {icon}
          {label}
        </span>
        <span
          className={[
            "grid size-5 place-items-center rounded-full border",
            active
              ? "border-[var(--gc-brand)] bg-[var(--gc-brand)] text-black"
              : "border-white/22 bg-transparent",
          ].join(" ")}
        >
          {active ? <Check size={12} strokeWidth={3.4} /> : null}
        </span>
      </span>
      <span className={["text-[11px] font-bold leading-snug", active ? "text-white/60" : "text-white/40"].join(" ")}>
        {description}
      </span>
    </button>
  );
}
