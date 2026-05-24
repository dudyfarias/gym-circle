import { Clock3, Lock, Plus, UserCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/ui/Avatar";
import type { EnrichedUser } from "../social/types";
import { StreakBadge } from "./StreakBadge";

type DiscoveryUserCardProps = {
  user: EnrichedUser;
  onToggleFollow: (userId: string) => void;
  onSelectUser?: (userId: string) => void;
};

/**
 * Sprint 4.4: refatorado pra retornar i18n KEY (não string). O componente
 * resolve com `t()` mantendo o array reativo a mudanças de idioma. Goal
 * do user fica raw porque é texto de input livre — não pode ser
 * traduzido. Quando há goal, retornamos `{ raw: goal }`.
 *
 * Decisões intencionais preservadas:
 * - Nunca menciona academia (feed precisa parecer rede social).
 * - Não inventa dados — só usa sinais reais do EnrichedUser.
 * - Prioridade do mais social pro mais neutro (primeiro match wins).
 */
type SuggestionContext = { key?: string; raw?: string };

function getSuggestionContext(user: EnrichedUser): SuggestionContext {
  if (user.followStatus === "accepted") return { key: "discovery.context.alreadyFollowing" };
  if (user.streakLitToday) return { key: "discovery.context.trainedToday" };
  if (user.currentStreak >= 14) return { key: "discovery.context.trainsHard" };
  if (user.currentStreak >= 7) return { key: "discovery.context.trainsOften" };
  if (user.longestStreak >= 30) return { key: "discovery.context.consistentStreak" };
  if (user.workoutsThisMonth >= 12) return { key: "discovery.context.trainsWeekly" };
  if (user.sports?.includes("Corrida")) return { key: "discovery.context.alsoRuns" };
  if (user.sports?.includes("Musculação")) return { key: "discovery.context.trainsMuscles" };
  if (user.goal && user.goal.trim().length > 0) return { raw: user.goal };
  return { key: "discovery.context.suggestedForYou" };
}

type FollowIconState = {
  Icon: typeof UserCheck;
  ariaKey: "discovery.actions.following" | "discovery.actions.requestSent" | "discovery.actions.requestFollow" | "discovery.actions.follow";
  titleKey: "common.following" | "common.followRequested" | "common.requestFollow" | "common.follow";
  classes: string;
};

function followIconState(user: EnrichedUser): FollowIconState {
  switch (user.followStatus) {
    case "accepted":
      return {
        Icon: UserCheck,
        ariaKey: "discovery.actions.following",
        titleKey: "common.following",
        classes: "bg-white text-black",
      };
    case "pending":
      return {
        Icon: Clock3,
        ariaKey: "discovery.actions.requestSent",
        titleKey: "common.followRequested",
        classes: "border border-white/[0.16] bg-white/[0.05] text-white/72",
      };
    case "none":
    default:
      return user.isPrivate
        ? {
            Icon: Lock,
            ariaKey: "discovery.actions.requestFollow",
            titleKey: "common.requestFollow",
            classes:
              "bg-[var(--gc-brand)] text-black shadow-[0_0_22px_rgba(92,232,255,0.22)]",
          }
        : {
            Icon: Plus,
            ariaKey: "discovery.actions.follow",
            titleKey: "common.follow",
            classes:
              "bg-[var(--gc-brand)] text-black shadow-[0_0_22px_rgba(92,232,255,0.22)]",
          };
  }
}

export function DiscoveryUserCard({
  user,
  onToggleFollow,
  onSelectUser,
}: DiscoveryUserCardProps) {
  const { t, i18n } = useTranslation();
  const cta = followIconState(user);
  const ctx = getSuggestionContext(user);
  const context = ctx.raw ?? (ctx.key ? t(ctx.key) : "");
  return (
    <div className="gc-ios-sheet gc-pressable min-w-[220px] rounded-[28px] p-4">
      <div className="flex items-start justify-between gap-4">
        <button
          aria-label={t("discovery.actions.openProfile", { name: user.name })}
          className="gc-pressable shrink-0"
          onClick={() => onSelectUser?.(user.id)}
          type="button"
        >
          <Avatar
            accent={user.accent}
            name={user.name}
            src={user.avatarUrl ?? undefined}
          />
        </button>
        <button
          aria-label={t(cta.ariaKey, { name: user.name })}
          className={["gc-pressable grid size-11 place-items-center rounded-full", cta.classes].join(" ")}
          onClick={() => onToggleFollow(user.id)}
          title={t(cta.titleKey)}
          type="button"
        >
          <cta.Icon size={17} />
        </button>
      </div>
      <button
        className="gc-pressable mt-4 block max-w-full truncate text-left text-[16px] font-black"
        onClick={() => onSelectUser?.(user.id)}
        type="button"
      >
        {user.name}
      </button>
      <p className="mt-1 truncate text-[12px] font-bold text-white/44">
        {context}
      </p>
      <div className="mt-4 flex items-center justify-between gap-2">
        <StreakBadge
          best={user.longestStreak}
          isLit={user.streakLitToday}
          showLevel
          size="sm"
          streak={user.currentStreak}
        />
        <span className="text-[12px] font-black text-white/36">
          {user.followersCount.toLocaleString(i18n.language)}
        </span>
      </div>
    </div>
  );
}
