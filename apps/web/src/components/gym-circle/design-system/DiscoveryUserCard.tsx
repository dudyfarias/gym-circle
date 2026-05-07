import { Clock3, Lock, Plus, UserCheck } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { EnrichedUser } from "../social/types";
import { StreakBadge } from "./StreakBadge";

type DiscoveryUserCardProps = {
  user: EnrichedUser;
  sharedGymCount: number;
  onToggleFollow: (userId: string) => void;
  onSelectUser?: (userId: string) => void;
};

function followIconState(user: EnrichedUser) {
  switch (user.followStatus) {
    case "accepted":
      return {
        Icon: UserCheck,
        title: "Seguindo",
        ariaLabel: `Seguindo ${user.name}`,
        classes: "bg-white text-black",
      };
    case "pending":
      return {
        Icon: Clock3,
        title: "Solicitação enviada",
        ariaLabel: `Solicitação enviada para ${user.name}`,
        classes: "border border-white/[0.16] bg-white/[0.05] text-white/72",
      };
    case "none":
    default:
      return user.isPrivate
        ? {
            Icon: Lock,
            title: "Solicitar para seguir",
            ariaLabel: `Solicitar para seguir ${user.name}`,
            classes:
              "bg-[var(--gc-brand)] text-black shadow-[0_0_22px_rgba(92,232,255,0.22)]",
          }
        : {
            Icon: Plus,
            title: "Seguir",
            ariaLabel: `Seguir ${user.name}`,
            classes:
              "bg-[var(--gc-brand)] text-black shadow-[0_0_22px_rgba(92,232,255,0.22)]",
          };
  }
}

export function DiscoveryUserCard({
  user,
  sharedGymCount,
  onToggleFollow,
  onSelectUser,
}: DiscoveryUserCardProps) {
  const cta = followIconState(user);
  return (
    <div className="gc-ios-sheet gc-pressable min-w-[220px] rounded-[28px] p-4">
      <div className="flex items-start justify-between gap-4">
        <button
          aria-label={`Ver perfil de ${user.name}`}
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
          aria-label={cta.ariaLabel}
          className={["gc-pressable grid size-10 place-items-center rounded-full", cta.classes].join(" ")}
          onClick={() => onToggleFollow(user.id)}
          title={cta.title}
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
        {sharedGymCount > 0 ? `${sharedGymCount} academia em comum` : user.goal}
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
          {user.followersCount.toLocaleString("pt-BR")}
        </span>
      </div>
    </div>
  );
}
