"use client";

import { MessageCircle, Search, Send } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { AchievementBadge, StreakBadge } from "../design-system";
import type { EnrichedUser } from "../social/types";
import { TopBar } from "../TopBar";

type ChatScreenProps = {
  currentUser: EnrichedUser;
  suggestedUsers: EnrichedUser[];
  onSelectUser?: (userId: string) => void;
};

export function ChatScreen({
  currentUser,
  suggestedUsers,
  onSelectUser,
}: ChatScreenProps) {
  const people = suggestedUsers.slice(0, 8);

  return (
    <section className="gc-screen-enter min-h-screen px-5 pb-6">
      <TopBar eyebrow="Circle" title="Chat" />

      <div className="gc-glass-strong mt-5 rounded-[32px] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[28px] font-black leading-none">
              Conversas fitness
            </p>
            <p className="mt-2 text-[14px] font-bold leading-5 text-white/52">
              Chame quem treina perto de você e mantenha o circle vivo.
            </p>
          </div>
          <div className="grid size-14 shrink-0 place-items-center rounded-[22px] bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]">
            <MessageCircle size={24} strokeWidth={2.5} />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/28 px-4">
          <Search size={16} className="text-white/42" />
          <input
            className="h-12 flex-1 bg-transparent text-[14px] font-bold text-white outline-none placeholder:text-white/28"
            placeholder="Buscar pessoa ou academia"
            type="search"
          />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {people.length > 0 ? (
          people.map((person) => (
            <button
              className="gc-ios-sheet gc-pressable flex w-full items-center justify-between gap-3 rounded-[24px] p-4 text-left"
              key={person.id}
              onClick={() => onSelectUser?.(person.id)}
              type="button"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  accent={person.accent}
                  name={person.name}
                  src={person.avatarUrl ?? undefined}
                />
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-[15px] font-black">{person.name}</p>
                    <StreakBadge
                      isLit={person.streakLitToday}
                      size="xs"
                      streak={person.currentStreak}
                    />
                  </div>
                  <p className="truncate text-[12px] font-bold text-white/44">
                    {person.gyms[0] ?? person.goal ?? "Gym Circle"}
                  </p>
                </div>
              </div>
              <AchievementBadge icon={<Send size={13} />} label="Abrir" tone="blue" />
            </button>
          ))
        ) : (
          <div className="gc-ios-sheet rounded-[24px] p-5 text-center">
            <p className="text-[16px] font-black">Seu chat está pronto</p>
            <p className="mt-2 text-[13px] font-bold text-white/48">
              Quando o circle crescer, suas conversas aparecem aqui.
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-[12px] font-bold text-white/38">
        <StreakBadge
          isLit={currentUser.streakLitToday}
          size="xs"
          streak={currentUser.currentStreak}
        />
        Chat com reputação fitness pública.
      </div>
    </section>
  );
}
