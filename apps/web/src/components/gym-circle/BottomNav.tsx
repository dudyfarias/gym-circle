"use client";

import {
  Camera,
  CircleUserRound,
  House,
  MapPin,
  MessageCircle,
} from "lucide-react";
import { BottomTabBar } from "./design-system";

export type ScreenKey = "feed" | "chat" | "post" | "checkin" | "profile";

type BottomNavProps = {
  active: ScreenKey;
  hidden?: boolean;
  onChange: (screen: ScreenKey) => void;
  unreadMessages?: number;
};

const baseNavItems = [
  { key: "feed", label: "Home", icon: House },
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "post", label: "Câmera", icon: Camera },
  { key: "checkin", label: "Localização", icon: MapPin },
  { key: "profile", label: "Perfil", icon: CircleUserRound },
] satisfies Array<{
  key: ScreenKey;
  label: string;
  icon: typeof House;
}>;

export function BottomNav({
  active,
  hidden = false,
  onChange,
  unreadMessages = 0,
}: BottomNavProps) {
  const navItems = baseNavItems.map((item) =>
    item.key === "chat" ? { ...item, badge: unreadMessages } : item,
  );
  return (
    <BottomTabBar active={active} hidden={hidden} items={navItems} onChange={onChange} />
  );
}
