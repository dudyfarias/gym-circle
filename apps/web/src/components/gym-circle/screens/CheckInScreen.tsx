"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Camera, Check, Clock, Loader2, MapPin, Search, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { GymSearchSheet, type PlaceCandidate } from "../GymSearchSheet";
import type {
  EnrichedPost,
  EnrichedUser,
  GymLocationOption,
  GymUser,
} from "../social/types";
import { TopBar } from "../TopBar";

type CheckInScreenProps = {
  currentUser: EnrichedUser;
  /** Catálogo de gyms do banco — usado pra mostrar academias do user. */
  gyms: GymLocationOption[];
  /** Posts do feed pra derivar "quem treinou aqui hoje" + mini grid. */
  posts: EnrichedPost[];
  /** Lookup de users pra enriquecer cards de pessoas (avatar, name, etc). */
  users: Record<string, GymUser>;
  onCheckIn: (gymName: string) => void | Promise<void>;
  onSelectUser?: (userId: string) => void;
  /** Cataloga novo lugar via Maps. Sem isso, search fica desabilitada. */
  onCatalogPlace?: (place: PlaceCandidate) => Promise<GymLocationOption>;
};

function formatPostTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function isTodayInSP(iso: string): boolean {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const that = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
  return today === that;
}

/**
 * Check-in vira "lugar vivo": após selecionar a academia (via search),
 * o usuário vê quem postou de lá hoje + posts recentes do local + CTA
 * pra confirmar presença. Empty state direciona pra busca.
 */
export function CheckInScreen({
  currentUser,
  gyms,
  posts,
  users,
  onCheckIn,
  onSelectUser,
  onCatalogPlace,
}: CheckInScreenProps) {
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [localGyms, setLocalGyms] = useState<GymLocationOption[]>([]);
  const [cataloging, setCataloging] = useState(false);
  const [checkinPending, setCheckinPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Mescla gyms do banco + catalogadas nessa sessão pelo search
  const allGyms = useMemo<GymLocationOption[]>(() => {
    const merged = new Map<string, GymLocationOption>();
    for (const gym of gyms) merged.set(gym.id, gym);
    for (const gym of localGyms) merged.set(gym.id, gym);
    return Array.from(merged.values());
  }, [gyms, localGyms]);

  const selectedGym = useMemo(
    () => allGyms.find((gym) => gym.id === selectedGymId) ?? null,
    [allGyms, selectedGymId],
  );

  // Pré-listar academias que o user já tem cadastradas (currentUser.gyms é só nomes)
  const myGyms = useMemo(() => {
    const myNames = new Set(currentUser.gyms.map((name) => name.toLowerCase()));
    return allGyms.filter((gym) => myNames.has(gym.name.toLowerCase()));
  }, [allGyms, currentUser.gyms]);

  // Posts deste gym (todos) + posts deste gym hoje (pra "treinando aqui hoje")
  const gymPosts = useMemo(() => {
    if (!selectedGym) return [] as EnrichedPost[];
    return posts.filter((post) => post.gymId === selectedGym.id);
  }, [posts, selectedGym]);

  const trainingHereToday = useMemo(() => {
    if (gymPosts.length === 0) return [] as Array<{ user: GymUser; post: EnrichedPost }>;
    const seen = new Set<string>();
    const out: Array<{ user: GymUser; post: EnrichedPost }> = [];
    // Sort posts by createdAt desc, take 1 per user (most recent today's post)
    const sortedToday = [...gymPosts]
      .filter((post) => isTodayInSP(post.createdAt))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    for (const post of sortedToday) {
      if (seen.has(post.userId)) continue;
      const userInfo = users[post.userId];
      if (!userInfo) continue;
      seen.add(post.userId);
      out.push({ user: userInfo, post });
      if (out.length >= 8) break;
    }
    return out;
  }, [gymPosts, users]);

  // Mini grid: posts recentes (últimos 9), inclusive os de hoje
  const recentPosts = useMemo(() => {
    return [...gymPosts]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 9);
  }, [gymPosts]);

  async function handleCatalogPlace(place: PlaceCandidate) {
    if (!onCatalogPlace || cataloging) return;
    setCataloging(true);
    try {
      const cataloged = await onCatalogPlace(place);
      setLocalGyms((current) =>
        current.some((gym) => gym.id === cataloged.id)
          ? current
          : [...current, cataloged],
      );
      setSelectedGymId(cataloged.id);
      setSearchOpen(false);
    } finally {
      setCataloging(false);
    }
  }

  async function handleCheckIn() {
    if (!selectedGym || checkinPending) return;
    setCheckinPending(true);
    setFeedback(null);
    try {
      await onCheckIn(selectedGym.name);
      setFeedback(`Check-in confirmado em ${selectedGym.name}`);
    } finally {
      setCheckinPending(false);
    }
  }

  return (
    <section className="gc-screen-enter min-h-screen px-5 pb-6">
      <TopBar
        eyebrow="Check-in"
        title={selectedGym ? selectedGym.name : "Check-in"}
      />

      {selectedGym ? (
        <>
          {/* Header da academia selecionada */}
          <div className="mt-5 flex items-start gap-3 rounded-[20px] border border-white/[0.08] bg-white/[0.03] p-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]">
              <MapPin size={20} strokeWidth={2.4} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-black text-white">
                {selectedGym.name}
              </p>
              {selectedGym.city || selectedGym.address ? (
                <p className="mt-0.5 truncate text-[12px] font-bold text-white/52">
                  {[selectedGym.address, selectedGym.city]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
            <button
              aria-label="Trocar de lugar"
              className="gc-pressable grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/72"
              onClick={() => setSelectedGymId(null)}
              type="button"
            >
              <X size={15} strokeWidth={2.4} />
            </button>
          </div>

          {/* CTA primário: confirmar check-in */}
          <button
            className="gc-pressable mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[15px] font-black text-black shadow-[0_0_24px_rgba(92,232,255,0.32)] disabled:opacity-50 disabled:shadow-none"
            disabled={checkinPending}
            onClick={() => void handleCheckIn()}
            type="button"
          >
            {checkinPending ? (
              <Loader2 className="animate-spin" size={17} strokeWidth={2.6} />
            ) : (
              <Check size={18} strokeWidth={2.8} />
            )}
            {checkinPending ? "Confirmando..." : "Estou treinando aqui"}
          </button>
          {feedback ? (
            <p className="mt-2 text-center text-[12px] font-bold text-[var(--gc-brand)]">
              {feedback}
            </p>
          ) : null}

          {/* Treinando aqui hoje */}
          {trainingHereToday.length > 0 ? (
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-black text-white">
                  Treinando aqui hoje
                </h3>
                <span className="text-[11px] font-bold text-white/42">
                  {trainingHereToday.length}{" "}
                  {trainingHereToday.length === 1 ? "pessoa" : "pessoas"}
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {trainingHereToday.map(({ user, post }) => (
                  <li key={user.id}>
                    <button
                      className="gc-pressable flex w-full items-center gap-3 rounded-[16px] bg-white/[0.04] p-3 text-left"
                      onClick={() => onSelectUser?.(user.id)}
                      type="button"
                    >
                      <Avatar
                        accent={user.accent}
                        name={user.name}
                        size="sm"
                        src={user.avatarUrl ?? undefined}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-black text-white">
                          {user.name}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-white/52">
                          <Clock size={10} strokeWidth={2.6} />
                          {formatPostTime(post.createdAt)}
                          {post.workoutType ? ` · ${post.workoutType}` : ""}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-6 rounded-[16px] border border-white/[0.06] bg-white/[0.02] p-4 text-center">
              <p className="text-[12px] font-bold text-white/52">
                Nenhum post daqui hoje. Seja o primeiro a publicar.
              </p>
            </div>
          )}

          {/* Mini grid de posts recentes do lugar */}
          {recentPosts.length > 0 ? (
            <div className="mt-6">
              <h3 className="mb-3 text-[15px] font-black text-white">
                Posts recentes do lugar
              </h3>
              <div className="-mx-5 grid grid-cols-3 gap-[2px]">
                {recentPosts.map((post) => (
                  <CheckInPostThumb
                    key={post.id}
                    onSelectUser={onSelectUser}
                    post={post}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {/* Empty state — convida pra buscar */}
          <div className="mt-5 rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-6 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]">
              <MapPin size={24} strokeWidth={2.2} />
            </span>
            <h2 className="mt-3 text-[18px] font-black text-white">
              Onde você tá treinando?
            </h2>
            <p className="mx-auto mt-1 max-w-[280px] text-[13px] font-bold text-white/52">
              Marque o lugar pra ver quem mais tá aqui e fazer check-in.
            </p>
            <button
              className="gc-pressable mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[14px] font-black text-black shadow-[0_0_22px_rgba(92,232,255,0.28)] disabled:opacity-60"
              disabled={!onCatalogPlace}
              onClick={() => setSearchOpen(true)}
              type="button"
            >
              <Search size={16} strokeWidth={2.6} />
              Buscar academia ou lugar
            </button>
          </div>

          {/* Suas academias — atalho pra gyms já cadastrados */}
          {myGyms.length > 0 ? (
            <div className="mt-6">
              <h3 className="mb-3 text-[13px] font-black uppercase tracking-wide text-white/42">
                Suas academias
              </h3>
              <ul className="space-y-2">
                {myGyms.map((gym) => (
                  <li key={gym.id}>
                    <button
                      className="gc-pressable flex w-full items-center gap-3 rounded-[16px] bg-white/[0.04] p-3 text-left"
                      onClick={() => setSelectedGymId(gym.id)}
                      type="button"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/72">
                        <MapPin size={15} strokeWidth={2.2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-black text-white">
                          {gym.name}
                        </p>
                        {gym.city ? (
                          <p className="mt-0.5 truncate text-[11px] font-bold text-white/52">
                            {gym.city}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}

      <GymSearchSheet
        onClose={() => setSearchOpen(false)}
        onSelect={handleCatalogPlace}
        open={searchOpen}
      />
    </section>
  );
}

function CheckInPostThumb({
  post,
  onSelectUser,
}: {
  post: EnrichedPost;
  onSelectUser?: (userId: string) => void;
}) {
  return (
    <button
      aria-label={`Post de ${post.workoutType ?? "treino"}`}
      className="gc-pressable relative aspect-square overflow-hidden bg-zinc-950"
      onClick={() => onSelectUser?.(post.userId)}
      type="button"
    >
      {post.mediaType === "video" ? (
        <video
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
          src={post.imageUrl}
        />
      ) : (
        <Image
          alt={post.workoutType || "Treino"}
          className="object-cover"
          fill
          sizes="(max-width: 480px) 33vw, 160px"
          src={post.imageUrl}
        />
      )}
      <span className="pointer-events-none absolute bottom-1 right-1 rounded-full bg-black/64 px-1.5 py-0.5 text-[9px] font-black text-white backdrop-blur-md">
        <Camera className="inline" size={9} strokeWidth={2.6} />
      </span>
    </button>
  );
}
