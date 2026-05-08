import {
  CalendarDays,
  Check,
  CheckCircle2,
  Dumbbell,
  LogOut,
  MapPin,
  Pencil,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import {
  AchievementBadge,
  LatestPostPreview,
  MonthlyRecapCard,
  ProfileHeader,
  StatsWidget,
  StreakBadge,
} from "../design-system";
import type { MonthlyRecap } from "../social/monthlyRecap";
import { calculateProfileCompletion } from "../social/profile";
import { formatWorkoutDate, getAllStreakLevels, getStreakLevel } from "../social/streak";
import type { EnrichedPost, EnrichedUser } from "../social/types";
import { TopBar } from "../TopBar";

type ProfileScreenProps = {
  currentUser: EnrichedUser;
  posts: EnrichedPost[];
  monthDays: Array<{
    day: number;
    dateKey: string;
    trained: boolean;
  }>;
  nearbyUsers: EnrichedUser[];
  onToggleFollow: (userId: string) => void | Promise<void>;
  onEditProfile?: () => void;
  onSignOut?: () => void | Promise<void>;
  onSelectUser?: (userId: string) => void;
  onOpenAdmin?: () => void;
  onRequestAccountDeletion?: () => void | Promise<void>;
  hasStory?: boolean;
  storyViewed?: boolean;
  onOpenStory?: () => void;
  monthlyRecap: MonthlyRecap;
  onOpenMonthlyRecap?: () => void;
};

export function ProfileScreen({
  currentUser,
  posts,
  monthDays,
  nearbyUsers,
  onToggleFollow,
  onEditProfile,
  onSignOut,
  onSelectUser,
  onOpenAdmin,
  onRequestAccountDeletion,
  hasStory,
  storyViewed,
  onOpenStory,
  monthlyRecap,
  onOpenMonthlyRecap,
}: ProfileScreenProps) {
  const latestPost = posts[0];
  const currentLevel = getStreakLevel(currentUser.currentStreak);
  const profileCompletion = calculateProfileCompletion(currentUser);

  return (
    <section className="gc-screen-enter min-h-screen px-5 pb-6">
      <TopBar eyebrow="Gym Circle" title="Perfil" />

      {(onEditProfile || onSignOut) ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {onEditProfile ? (
            <button
              className="gc-pressable flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-4 text-[13px] font-black text-white"
              onClick={onEditProfile}
              type="button"
            >
              <Pencil size={15} strokeWidth={2.6} />
              Editar perfil
            </button>
          ) : null}
          {onSignOut ? (
            <button
              aria-label="Sair"
              className="gc-pressable grid size-11 place-items-center rounded-full border border-white/[0.1] bg-white/[0.04] text-white/72"
              onClick={onSignOut}
              type="button"
            >
              <LogOut size={16} strokeWidth={2.6} />
            </button>
          ) : null}
          {onOpenAdmin ? (
            <button
              className="gc-pressable flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--gc-brand)]/20 bg-[var(--gc-brand)]/10 px-4 text-[13px] font-black text-[var(--gc-brand)]"
              onClick={onOpenAdmin}
              type="button"
            >
              <ShieldCheck size={15} strokeWidth={2.6} />
              Admin
            </button>
          ) : null}
        </div>
      ) : null}

      {onEditProfile && profileCompletion.percentage < 100 ? (
        <section className="mt-4 rounded-[24px] border border-white/[0.08] bg-white/[0.045] p-4 shadow-[0_18px_54px_rgba(0,0,0,0.26)] backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-[var(--gc-brand)]" />
                <p className="text-[12px] font-black uppercase text-white/42">
                  Perfil social
                </p>
              </div>
              <p className="mt-1 text-[16px] font-black">
                {profileCompletion.percentage}% completo
              </p>
              <p className="mt-1 text-[12px] font-bold text-white/46">
                Próximo: {profileCompletion.missing[0]?.label ?? "primeiro post"}
              </p>
            </div>
            <button
              className="gc-pressable h-10 rounded-full bg-[var(--gc-brand)] px-4 text-[12px] font-black text-black"
              onClick={onEditProfile}
              type="button"
            >
              Completar
            </button>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#8CFBFF,#30D5FF,#0066FF)]"
              style={{ width: `${profileCompletion.percentage}%` }}
            />
          </div>
        </section>
      ) : null}

      <div className="mt-5">
        <ProfileHeader
          hasStory={hasStory}
          onOpenStory={onOpenStory}
          postsCount={posts.length}
          storyViewed={storyViewed}
          user={currentUser}
        />
      </div>

      <div className="mt-4">
        <LatestPostPreview post={latestPost} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatsWidget
          tone="blue"
          detail="Histórico"
          icon={<Trophy size={18} />}
          label="Maior"
          value={`${currentUser.longestStreak}d`}
        />
        <StatsWidget
          tone="brand"
          detail={monthlyRecap.shortMonthLabel}
          icon={<CalendarDays size={18} />}
          label="Treinos"
          value={String(currentUser.workoutsThisMonth)}
        />
        <StatsWidget
          tone="brand"
          detail="Com foto"
          icon={<Dumbbell size={18} />}
          label="Dias ativos"
          value={String(currentUser.activeDaysCount)}
        />
        <StatsWidget
          tone="blue"
          detail="Locais"
          icon={<MapPin size={18} />}
          label="Check-ins"
          value={String(currentUser.checkInsCount)}
        />
      </div>

      <div className="mt-4">
        <MonthlyRecapCard recap={monthlyRecap} onOpen={onOpenMonthlyRecap} />
      </div>

      <div className="gc-ios-sheet mt-4 rounded-[24px] p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[17px] font-extrabold">Consistência</h3>
            <p className="mt-1 text-[12px] font-bold text-white/42">
              Último treino: {formatWorkoutDate(currentUser.lastWorkoutDate)}
            </p>
          </div>
          <AchievementBadge label={currentLevel.label} tone="brand" />
        </div>
        <div className="grid grid-cols-7 gap-2">
          {monthDays.map((item) => (
            <div
              className={[
                "grid aspect-square place-items-center rounded-full text-[12px] font-extrabold transition-transform duration-200",
                item.trained
                  ? "bg-[radial-gradient(circle_at_35%_25%,var(--gc-consistency-daily),var(--gc-consistency-month)_52%,var(--gc-consistency-year))] text-black shadow-[0_0_18px_rgba(48,213,255,0.32)]"
                  : "bg-white/[0.055] text-white/34",
              ].join(" ")}
              key={item.day}
            >
              {item.trained ? <Check size={14} strokeWidth={3} /> : item.day}
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {getAllStreakLevels().map((level) => (
            <div
              className={[
                "rounded-[18px] border px-3 py-2",
                level.id === currentLevel.id
                  ? "border-[var(--gc-consistency-month)]/28 bg-[var(--gc-consistency-quiet)]"
                  : "border-white/[0.07] bg-white/[0.04]",
              ].join(" ")}
              key={level.id}
            >
              <p className="text-[12px] font-black">{level.label}</p>
              <p className="mt-0.5 text-[11px] font-bold text-white/38">
                {level.minDays}+ dias
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <h3 className="mb-3 text-[17px] font-extrabold">Mesmo círculo</h3>
        <div className="space-y-3">
          {nearbyUsers.slice(0, 4).map((person) => (
            <div
              className="gc-ios-sheet flex items-center justify-between rounded-[24px] p-4"
              key={person.id}
            >
              <button
                className="gc-pressable flex flex-1 items-center gap-3 text-left"
                onClick={() => onSelectUser?.(person.id)}
                type="button"
              >
                <Avatar
                  accent={person.accent}
                  name={person.name}
                  src={person.avatarUrl ?? undefined}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[15px] font-bold">{person.name}</p>
                    <StreakBadge
                      isLit={person.streakLitToday}
                      size="xs"
                      streak={person.currentStreak}
                    />
                  </div>
                  <p className="text-[12px] font-semibold text-white/44">
                    {person.goal}
                  </p>
                </div>
              </button>
              <button
                className="gc-pressable"
                onClick={() => onToggleFollow(person.id)}
                type="button"
              >
                <AchievementBadge
                  icon={person.followStatus === "accepted" ? <CheckCircle2 size={13} /> : undefined}
                  label={
                    person.followStatus === "accepted"
                      ? "Seguindo"
                      : person.followStatus === "pending"
                        ? "Pendente"
                        : person.isPrivate
                          ? "Solicitar"
                          : "Seguir"
                  }
                  tone={
                    person.followStatus === "accepted"
                      ? "brand"
                      : person.followStatus === "pending"
                        ? "energy"
                        : "blue"
                  }
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {onRequestAccountDeletion ? (
        <button
          className="gc-pressable mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--gc-pink)]/24 bg-[var(--gc-pink)]/8 text-[13px] font-black text-[var(--gc-pink)]"
          onClick={onRequestAccountDeletion}
          type="button"
        >
          <Trash2 size={15} strokeWidth={2.6} />
          Excluir conta
        </button>
      ) : null}
    </section>
  );
}
