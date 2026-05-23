"use client";

import {
  Camera,
  CircleUserRound,
  House,
  MapPin,
  MessageCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { BottomTabBar } from "./design-system";

export type ScreenKey = "feed" | "chat" | "post" | "checkin" | "profile";

type BottomNavProps = {
  active: ScreenKey;
  hidden?: boolean;
  onChange: (screen: ScreenKey) => void;
  unreadMessages?: number;
};

const baseNavItems = [
  { key: "feed", labelKey: "tabs.home", icon: House },
  { key: "chat", labelKey: "tabs.chat", icon: MessageCircle },
  { key: "post", labelKey: "tabs.post", icon: Camera },
  { key: "checkin", labelKey: "tabs.map", icon: MapPin },
  { key: "profile", labelKey: "tabs.profile", icon: CircleUserRound },
] satisfies Array<{
  key: ScreenKey;
  labelKey: string;
  icon: typeof House;
}>;

export function BottomNav({
  active,
  hidden = false,
  onChange,
  unreadMessages = 0,
}: BottomNavProps) {
  // Sprint 4.4 i18n: labels resolvidos via t() em runtime — re-renderiza
  // automaticamente quando o user troca idioma no Settings.
  const { t } = useTranslation();
  const navItems = baseNavItems.map((item) => {
    const base = { ...item, label: t(item.labelKey) };
    return item.key === "chat" ? { ...base, badge: unreadMessages } : base;
  });
  return (
    <BottomTabBar active={active} hidden={hidden} items={navItems} onChange={onChange} />
  );
}
