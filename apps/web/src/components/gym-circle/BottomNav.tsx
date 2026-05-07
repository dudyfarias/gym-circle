"use client";

import {
  Camera,
  CircleUserRound,
  Flame,
  House,
  MapPin,
} from "lucide-react";
import { BottomTabBar } from "./design-system";

export type ScreenKey = "feed" | "profile" | "post" | "checkin" | "streak";

type BottomNavProps = {
  active: ScreenKey;
  onChange: (screen: ScreenKey) => void;
};

const navItems = [
  { key: "feed", label: "Home", icon: House },
  { key: "profile", label: "Perfil", icon: CircleUserRound },
  { key: "post", label: "Post", icon: Camera },
  { key: "checkin", label: "Check-in", icon: MapPin },
  { key: "streak", label: "Streak", icon: Flame },
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
