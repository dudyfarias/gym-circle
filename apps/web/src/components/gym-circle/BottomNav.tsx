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
  onChange: (screen: ScreenKey) => void;
};

const navItems = [
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

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <BottomTabBar active={active} items={navItems} onChange={onChange} />
  );
}
