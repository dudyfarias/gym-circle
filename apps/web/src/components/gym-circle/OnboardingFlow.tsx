"use client";

import Image from "next/image";
import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronRight,
  FileCheck2,
  Flame,
  MapPin,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { useGymCircleServices } from "@gym-circle/core/hooks";
import type { GymRow } from "@gym-circle/core";
import { Avatar } from "@/components/ui/Avatar";
import { BrandMark, StreakBadge } from "./design-system";
import type { CreateWorkoutPostInput, SocialBundle } from "./social/types";

type OnboardingFlowProps = {
  social: SocialBundle;
  onUploadImage?: (file: File) => Promise<string>;
};

const fitnessGoals = [
  "Ganhar consistência",
  "Hipertrofia",
  "Emagrecimento",
  "Performance",
  "Saúde e energia",
  "Voltar à rotina",
];

function getStep(social: SocialBundle) {
  const user = social.currentUser;
  const hasLegal = Boolean(user.alphaTermsAcceptedAt && user.privacyPolicyAcceptedAt);
  const hasProfile = Boolean(user.name && user.username && user.goal);
  const hasGym = user.gyms.length > 0;
  const followsSomeone = user.followingCount > 0 || social.suggestedUsers.length === 0;
  const hasFirstPost = social.feedPosts.some((post) => post.userId === user.id);

  if (!hasLegal) return 0;
  if (!hasProfile) return 1;
  if (!hasGym) return 2;
  if (!followsSomeone) return 3;
  if (!hasFirstPost) return 4;
  return 5;
}

export function needsOnboarding(social: SocialBundle) {
  return !social.currentUser.onboardingCompletedAt || getStep(social) < 5;
}

export function OnboardingFlow({ social, onUploadImage }: OnboardingFlowProps) {
  const services = useGymCircleServices();
  const [step, setStep] = useState(() => getStep(social));
  const [gyms, setGyms] = useState<GymRow[]>([]);
  const [displayName, setDisplayName] = useState(social.currentUser.name === "—" ? "" : social.currentUser.name);
  const [username, setUsername] = useState(social.currentUser.username === "—" ? "" : social.currentUser.username);
  const [goal, setGoal] = useState(social.currentUser.goal);
  const [selectedGymId, setSelectedGymId] = useState("");
  const [newGymName, setNewGymName] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [postMediaType, setPostMediaType] = useState<"image" | "video">("image");
  const [postCaption, setPostCaption] = useState("Primeiro treino no Gym Circle.");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    services.gyms.list(30)
      .then(setGyms)
      .catch(() => setGyms([]));
  }, [services.gyms]);

  async function run(action: () => Promise<void>, onSuccess?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await social.refresh?.();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível continuar.");
    } finally {
      setBusy(false);
    }
  }

  async function acceptLegal() {
    await run(async () => {
      await services.onboarding.acceptAlphaLegal();
      await services.analytics.track(social.currentUser.id, "signup_completed", {
        accepted_alpha: true,
      }).catch(() => undefined);
    }, () => setStep(1));
  }

  async function saveProfile() {
    await run(async () => {
      const cleanedUsername = username.trim().toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_.]/g, "");
      if (displayName.trim().length < 2) throw new Error("Coloque seu nome.");
      if (cleanedUsername.length < 3) throw new Error("Username precisa ter pelo menos 3 caracteres.");
      if (!goal.trim()) throw new Error("Escolha um objetivo fitness.");
      await services.profiles.update(social.currentUser.id, {
        display_name: displayName.trim(),
        username: cleanedUsername,
        fitness_goal: goal.trim(),
      });
    }, () => setStep(2));
  }

  async function saveGym() {
    await run(async () => {
      let gymId = selectedGymId;
      if (!gymId) {
        if (newGymName.trim().length < 2) throw new Error("Escolha ou cadastre uma academia.");
        const gym = await services.gyms.create({ name: newGymName.trim() });
        gymId = gym.id;
      }
      await services.gyms.addUserGym(social.currentUser.id, gymId, true).catch(async (err) => {
        if ((err as { code?: string }).code !== "23505") throw err;
      });
      await services.profiles.update(social.currentUser.id, { main_gym_id: gymId });
    }, () => setStep(3));
  }

  async function followSelected(userId: string) {
    await run(async () => {
      await social.actions.toggleFollow(userId);
    });
  }

  async function handleFirstPostFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        throw new Error("Escolha uma foto ou vídeo do treino.");
      }
      const url = onUploadImage ? await onUploadImage(file) : URL.createObjectURL(file);
      setPostMediaType(file.type.startsWith("video/") ? "video" : "image");
      setPostUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload falhou.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function publishFirstPost() {
    await run(async () => {
      if (!postUrl) throw new Error("Adicione a foto ou vídeo do primeiro treino.");
      const input: CreateWorkoutPostInput = {
        caption: postCaption,
        imageUrl: postUrl,
        mediaType: postMediaType,
        workoutType: null,
        gymId: null,
        destinations: { feed: true, story: true },
      };
      await social.actions.publishWorkout(input);
    }, () => setStep(5));
  }

  async function finish() {
    await run(async () => {
      await social.actions.completeOnboarding?.();
    });
  }

  const progress = useMemo(() => Math.min(100, ((step + 1) / 6) * 100), [step]);

  return (
    <main className="min-h-[100dvh] bg-black px-5 pb-8 pt-[calc(var(--gc-safe-top)+18px)] text-white">
      <div className="mx-auto flex min-h-[calc(100dvh-var(--gc-safe-top)-2rem)] max-w-[480px] flex-col">
        <header className="flex items-center justify-between">
          <BrandMark showWordmark size={42} />
          <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[12px] font-black text-white/62">
            Alpha fechada
          </div>
        </header>

        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#8CFBFF,#30D5FF,#0066FF)] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-7 flex-1">
          {step === 0 ? (
            <OnboardingCard
              eyebrow="Segurança"
              icon={<FileCheck2 size={22} />}
              title="Antes de entrar"
              detail="Você está participando de uma alpha fechada. Podem acontecer erros, e vamos usar dados de uso para melhorar o app."
            >
              <div className="space-y-2 text-[13px] font-bold text-white/58">
                <a className="block rounded-[18px] bg-white/[0.05] px-4 py-3 text-white" href="/terms" rel="noopener noreferrer" target="_blank">
                  Termos de uso
                </a>
                <a className="block rounded-[18px] bg-white/[0.05] px-4 py-3 text-white" href="/privacy" rel="noopener noreferrer" target="_blank">
                  Política de privacidade
                </a>
              </div>
              <PrimaryButton busy={busy} label="Aceitar e continuar" onClick={acceptLegal} />
            </OnboardingCard>
          ) : null}

          {step === 1 ? (
            <OnboardingCard
              eyebrow="Perfil"
              icon={<Sparkles size={22} />}
              title="Seu currículo fitness"
              detail="O perfil é público por padrão e mostra sua consistência para o circle."
            >
              <input
                className="h-13 w-full rounded-[22px] border border-white/[0.08] bg-white/[0.055] px-4 text-[15px] font-bold outline-none placeholder:text-white/30"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Nome"
                value={displayName}
              />
              <input
                className="mt-3 h-13 w-full rounded-[22px] border border-white/[0.08] bg-white/[0.055] px-4 text-[15px] font-bold outline-none placeholder:text-white/30"
                onChange={(event) => setUsername(event.target.value)}
                placeholder="@username"
                value={username}
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                {fitnessGoals.map((item) => (
                  <button
                    className={[
                      "gc-pressable min-h-12 rounded-[18px] border px-3 text-left text-[12px] font-black",
                      goal === item
                        ? "border-[var(--gc-brand)]/40 bg-[var(--gc-brand)]/12 text-white"
                        : "border-white/[0.08] bg-white/[0.04] text-white/56",
                    ].join(" ")}
                    key={item}
                    onClick={() => setGoal(item)}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
              <PrimaryButton busy={busy} label="Salvar perfil" onClick={saveProfile} />
            </OnboardingCard>
          ) : null}

          {step === 2 ? (
            <OnboardingCard
              eyebrow="Academia"
              icon={<MapPin size={22} />}
              title="Onde você treina?"
              detail="Isso ajuda o Gym Circle a sugerir pessoas perto de você."
            >
              {gyms.length > 0 ? (
                <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                  {gyms.map((gym) => (
                    <button
                      className={[
                        "gc-pressable flex w-full items-center justify-between rounded-[20px] border p-3 text-left",
                        selectedGymId === gym.id
                          ? "border-[var(--gc-brand)]/40 bg-[var(--gc-brand)]/12"
                          : "border-white/[0.08] bg-white/[0.04]",
                      ].join(" ")}
                      key={gym.id}
                      onClick={() => {
                        setSelectedGymId(gym.id);
                        setNewGymName("");
                      }}
                      type="button"
                    >
                      <span>
                        <span className="block text-[14px] font-black">{gym.name}</span>
                        <span className="text-[12px] font-bold text-white/42">
                          {[gym.city, gym.state].filter(Boolean).join(", ") || "Local"}
                        </span>
                      </span>
                      {selectedGymId === gym.id ? <Check size={17} /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
              <input
                className="mt-3 h-13 w-full rounded-[22px] border border-white/[0.08] bg-white/[0.055] px-4 text-[15px] font-bold outline-none placeholder:text-white/30"
                onChange={(event) => {
                  setNewGymName(event.target.value);
                  setSelectedGymId("");
                }}
                placeholder="Cadastrar academia ou local"
                value={newGymName}
              />
              <PrimaryButton busy={busy} label="Definir academia" onClick={saveGym} />
            </OnboardingCard>
          ) : null}

          {step === 3 ? (
            <OnboardingCard
              eyebrow="Circle"
              icon={<UserPlus size={22} />}
              title="Siga algumas pessoas"
              detail="Seu feed fica vivo quando você acompanha gente da comunidade."
            >
              <div className="space-y-2">
                {social.suggestedUsers.slice(0, 5).map((user) => (
                  <div className="flex items-center justify-between rounded-[22px] bg-white/[0.045] p-3" key={user.id}>
                    <div className="flex items-center gap-3">
                      <Avatar accent={user.accent} name={user.name} src={user.avatarUrl ?? undefined} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] font-black">{user.name}</p>
                          <StreakBadge isLit={user.streakLitToday} size="xs" streak={user.currentStreak} />
                        </div>
                        <p className="text-[12px] font-bold text-white/42">@{user.username}</p>
                      </div>
                    </div>
                    <button
                      className="gc-pressable rounded-full bg-[var(--gc-brand)] px-4 py-2 text-[12px] font-black text-black"
                      disabled={busy}
                      onClick={() => followSelected(user.id)}
                      type="button"
                    >
                      {user.followStatus === "accepted" ? "Seguindo" : "Seguir"}
                    </button>
                  </div>
                ))}
              </div>
              <PrimaryButton busy={busy} label="Continuar" onClick={async () => setStep(4)} />
            </OnboardingCard>
          ) : null}

          {step === 4 ? (
            <OnboardingCard
              eyebrow="Primeiro treino"
              icon={<Camera size={22} />}
              title="Acenda seu badge"
              detail="Poste seu primeiro treino com foto ou vídeo. Feed + story em menos de 10 segundos."
            >
              <button
                className="gc-pressable relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-[30px] border border-white/[0.08] bg-white/[0.04]"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                {postUrl && postMediaType === "video" ? (
                  <video className="h-full w-full object-cover" muted playsInline src={postUrl} />
                ) : postUrl ? (
                  <Image alt="Primeiro treino" className="object-cover" fill sizes="420px" src={postUrl} />
                ) : (
                  <div className="text-center">
                    <div className="mx-auto grid size-16 place-items-center rounded-[24px] bg-[var(--gc-brand)] text-black">
                      <Camera size={25} />
                    </div>
                    <p className="mt-4 text-[15px] font-black">Adicionar foto ou vídeo</p>
                  </div>
                )}
                <input
                  accept="image/*,video/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFirstPostFile}
                  ref={fileInputRef}
                  type="file"
                />
              </button>
              <textarea
                className="mt-3 min-h-20 w-full rounded-[22px] border border-white/[0.08] bg-white/[0.055] px-4 py-3 text-[15px] font-bold outline-none placeholder:text-white/30"
                onChange={(event) => setPostCaption(event.target.value)}
                placeholder="Legenda"
                value={postCaption}
              />
              <PrimaryButton busy={busy} label="Postar primeiro treino" onClick={publishFirstPost} />
            </OnboardingCard>
          ) : null}

          {step >= 5 ? (
            <OnboardingCard
              eyebrow="Pronto"
              icon={<Flame size={22} />}
              title="Seu Gym Circle está vivo"
              detail="Agora o loop principal é simples: abrir, ver o feed, postar, acender o badge e voltar amanhã."
            >
              <PrimaryButton busy={busy} label="Entrar no app" onClick={finish} />
            </OnboardingCard>
          ) : null}
        </div>

        {error ? (
          <p className="mt-4 rounded-[18px] border border-[var(--gc-pink)]/30 bg-[var(--gc-pink)]/10 p-3 text-[12px] font-bold text-[var(--gc-pink)]">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}

type OnboardingCardProps = {
  eyebrow: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
  children: React.ReactNode;
};

function OnboardingCard({ eyebrow, icon, title, detail, children }: OnboardingCardProps) {
  return (
    <section className="gc-screen-enter rounded-[34px] border border-white/[0.08] bg-[#0b0c0d] p-5 shadow-[0_28px_72px_rgba(0,0,0,0.58)]">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid size-12 place-items-center rounded-[20px] bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]">
          {icon}
        </div>
        <div>
          <p className="text-[12px] font-black uppercase text-white/42">{eyebrow}</p>
          <h1 className="text-[30px] font-black leading-tight">{title}</h1>
        </div>
      </div>
      <p className="mb-5 text-[14px] font-bold leading-5 text-white/56">{detail}</p>
      {children}
    </section>
  );
}

function PrimaryButton({
  busy,
  label,
  onClick,
}: {
  busy: boolean;
  label: string;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      className="gc-pressable mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[15px] font-black text-black shadow-[0_0_28px_rgba(92,232,255,0.24)] disabled:opacity-50"
      disabled={busy}
      onClick={onClick}
      type="button"
    >
      {busy ? "Aguarde..." : label}
      {!busy ? <ChevronRight size={18} strokeWidth={2.8} /> : null}
    </button>
  );
}
