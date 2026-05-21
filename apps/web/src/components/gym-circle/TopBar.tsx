"use client";

import type { ReactNode } from "react";
import { Bell, Search } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { BrandMark } from "./design-system";
import { useSearchSheet } from "./SearchSheetContext";

type TopBarProps = {
  eyebrow: string;
  title: string;
  extraAction?: ReactNode;
  hidden?: boolean;
};

export function TopBar({ eyebrow, title, extraAction, hidden = false }: TopBarProps) {
  const { openSearch, openNotifications, unreadNotifications } = useSearchSheet();

  return (
    <header
      className={[
        "sticky top-0 z-20 -mx-5 border-b border-white/[0.06] bg-black/72 px-5 pb-3 pt-[calc(var(--gc-safe-top)+20px)] backdrop-blur-2xl will-change-transform",
        hidden ? "pointer-events-none -translate-y-full opacity-0" : "translate-y-0 opacity-100",
      ].join(" ")}
      style={{
        // Inline style pra garantir que a transição apareça mesmo se o
        // arbitrary-value Tailwind 4 (`ease-[var(--gc-ease-ios)]`) não gerar
        // a classe corretamente. 320ms dá sensação de slide iOS confortável.
        transition:
          "transform 320ms var(--gc-ease-ios), opacity 320ms var(--gc-ease-ios)",
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark size={38} />
          <div className="min-w-0">
            <p className="text-[12px] font-bold uppercase text-white/42">{eyebrow}</p>
            <h1 className="truncate text-[28px] font-black leading-tight text-white">
              {title}
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <IconButton label="Buscar usuários" onClick={openSearch}>
            <Search size={19} strokeWidth={2.4} />
          </IconButton>
          <div className="relative">
            <IconButton label="Notificações" onClick={openNotifications}>
              <Bell size={19} strokeWidth={2.4} />
            </IconButton>
            {unreadNotifications > 0 ? (
              <span className="pointer-events-none absolute -right-0.5 -top-0.5 grid min-w-[20px] place-items-center rounded-full border-2 border-black bg-[var(--gc-pink)] px-1.5 text-[10px] font-black leading-tight text-white">
                {unreadNotifications > 99 ? "99+" : unreadNotifications}
              </span>
            ) : null}
          </div>
          {extraAction}
        </div>
      </div>
    </header>
  );
}
