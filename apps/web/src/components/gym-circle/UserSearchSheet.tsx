"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, UserCheck, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { StreakBadge } from "./design-system";
import type { EnrichedUser } from "./social/types";

type UserSearchSheetProps = {
  open: boolean;
  onClose: () => void;
  users: EnrichedUser[];
  currentUserId: string;
  onToggleFollow: (userId: string) => void | Promise<void>;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function UserSearchSheet({
  open,
  onClose,
  users,
  currentUserId,
  onToggleFollow,
}: UserSearchSheetProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => {
        setQuery("");
        inputRef.current?.focus();
      }, 60);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const results = useMemo(() => {
    const filtered = users.filter((u) => u.id !== currentUserId);
    const currentUser = users.find((u) => u.id === currentUserId);
    const isAdmin = currentUser?.username.toLowerCase() === "dudy";
    const q = normalize(query.trim().replace(/^@/, ""));
    if (!q) {
      return isAdmin
        ? [...filtered]
            .sort((a, b) => b.currentStreak - a.currentStreak)
            .slice(0, 60)
        : [];
    }
    return filtered
      .map((u) => {
        const username = normalize(u.username);
        const score =
          (username === q ? 140 : 0) +
          (username.startsWith(q) ? 90 : 0) +
          (username.includes(q) ? 45 : 0);
        return { user: u, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.user)
      .slice(0, 30);
  }, [users, query, currentUserId]);

  if (!open) return null;

  return (
    <div className="gc-safe-overlay absolute inset-0 z-50 bg-black/94 backdrop-blur-2xl">
      <div className="relative mx-auto flex h-full max-h-[840px] min-h-[620px] flex-col overflow-hidden rounded-[36px] border border-white/[0.08] bg-[#0a0b0c] shadow-[0_28px_72px_rgba(0,0,0,0.7)]">
        <header className="flex items-center gap-3 border-b border-white/[0.06] p-4">
          <div className="flex flex-1 items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.04] px-4">
            <Search size={18} className="text-white/52" strokeWidth={2.4} />
            <input
              className="h-12 flex-1 bg-transparent text-[15px] font-bold text-white outline-none placeholder:text-white/32"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar @username"
              ref={inputRef}
              type="search"
              value={query}
            />
            {query ? (
              <button
                aria-label="Limpar"
                className="gc-pressable text-white/52"
                onClick={() => setQuery("")}
                type="button"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
          <button
            aria-label="Fechar busca"
            className="gc-pressable grid size-12 place-items-center rounded-full bg-white/[0.06] text-white"
            onClick={onClose}
            type="button"
          >
            <X size={19} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {results.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <p className="text-[16px] font-black text-white/72">
                  {query ? "Ninguém encontrado" : "Digite um @username"}
                </p>
                <p className="mt-2 text-[13px] font-bold text-white/44">
                  {query
                    ? `Nenhum match pra "${query}". Confira o username.`
                    : users.find((u) => u.id === currentUserId)?.username.toLowerCase() === "dudy"
                      ? "Como admin, você vê todos os perfis cadastrados."
                      : "Para encontrar alguém, você precisa saber o @username."}
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {results.map((user) => (
                <li
                  className="gc-ios-sheet flex items-center gap-3 rounded-[20px] p-3"
                  key={user.id}
                >
                  <Avatar
                    accent={user.accent}
                    name={user.name}
                    src={user.avatarUrl ?? undefined}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-[15px] font-black">{user.name}</p>
                      <StreakBadge
                        isLit={user.streakLitToday}
                        size="xs"
                        streak={user.currentStreak}
                      />
                    </div>
                    <p className="truncate text-[12px] font-bold text-white/52">
                      @{user.username} · {user.goal || user.bio?.slice(0, 40) || "—"}
                    </p>
                  </div>
                  <button
                    aria-label={user.isFollowing ? `Seguindo ${user.name}` : `Seguir ${user.name}`}
                    className={[
                      "gc-pressable grid size-11 shrink-0 place-items-center rounded-full",
                      user.isFollowing
                        ? "bg-white text-black"
                        : "bg-[var(--gc-brand)] text-black",
                    ].join(" ")}
                    onClick={() => onToggleFollow(user.id)}
                    title={user.isFollowing ? "Seguindo" : "Seguir"}
                    type="button"
                  >
                    {user.isFollowing ? <UserCheck size={18} /> : <UserPlus size={18} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
