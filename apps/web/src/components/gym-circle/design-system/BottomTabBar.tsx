"use client";

import type { LucideIcon } from "lucide-react";

export type BottomTabItem<Key extends string> = {
  key: Key;
  label: string;
  icon: LucideIcon;
};

type BottomTabBarProps<Key extends string> = {
  active: Key;
  items: Array<BottomTabItem<Key>>;
  onChange: (key: Key) => void;
};

export function BottomTabBar<Key extends string>({
  active,
  items,
  onChange,
}: BottomTabBarProps<Key>) {
  return (
    <nav className="sticky bottom-0 z-30 px-3 pb-4 pt-2">
      <div className="gc-ios-tabbar grid rounded-full p-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;

          return (
            <button
              aria-label={item.label}
              className={[
                "gc-pressable flex h-12 items-center justify-center rounded-full",
                isActive
                  ? "bg-[var(--gc-brand)] text-black shadow-[0_0_24px_rgba(92,232,255,0.28)]"
                  : "text-white/56",
              ].join(" ")}
              key={item.key}
              onClick={() => onChange(item.key)}
              title={item.label}
              type="button"
            >
              <Icon
                size={20}
                strokeWidth={2.55}
                style={{ animation: isActive ? "gc-tab-settle 260ms var(--gc-ease-snap) both" : undefined }}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
