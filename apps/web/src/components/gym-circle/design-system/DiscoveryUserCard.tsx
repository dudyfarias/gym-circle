import { Plus, UserCheck } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { EnrichedUser } from "../social/types";
import { StreakBadge } from "./StreakBadge";

type DiscoveryUserCardProps = {
  user: EnrichedUser;
  sharedGymCount: number;
  onToggleFollow: (userId: string) => void;
};

export function DiscoveryUserCard({
  user,
  sharedGymCount,
  onToggleFollow,
}: DiscoveryUserCardProps) {
  return (
    <div className="gc-ios-sheet gc-pressable min-w-[220px] rounded-[28px] p-4">
      <div className="flex items-start justify-between gap-4">
        <Avatar accent={user.accent} name={user.name} />
        <button
          aria-label={user.isFollowing ? `Seguindo ${user.name}` : `Seguir ${user.name}`}
          className={[
            "gc-pressable grid size-10 place-items-center rounded-full",
            user.isFollowing
              ? "bg-white text-black"
              : "bg-[var(--gc-brand)] text-black shadow-[0_0_22px_rgba(92,232,255,0.22)]",
          ].join(" ")}
          onClick={() => onToggleFollow(user.id)}
          title={user.isFollowing ? "Seguindo" : "Seguir"}
          type="button"
        >
          {user.isFollowing ? <UserCheck size={17} /> : <Plus size={18} />}
        </button>
      </div>
      <p className="mt-4 truncate text-[16px] font-black">{user.name}</p>
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
