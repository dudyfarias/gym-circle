"use client";

import type { LucideIcon } from "lucide-react";

export type BottomTabItem<Key extends string> = {
  key: Key;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

type BottomTabBarProps<Key extends string> = {
  active: Key;
  hidden?: boolean;
  items: Array<BottomTabItem<Key>>;
  onChange: (key: Key) => void;
};

export function BottomTabBar<Key extends string>({
  active,
  hidden = false,
  items,
  onChange,
}: BottomTabBarProps<Key>) {
  return (
    <nav
      className={[
        "z-30 px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 will-change-transform",
        hidden ? "pointer-events-none translate-y-full opacity-0" : "translate-y-0 opacity-100",
      ].join(" ")}
      style={{
        // Inline pra garantir que a transição rode (arbitrary-value Tailwind 4
        // com var() pode falhar em compilar a classe). Removido `shrink-0`
        // porque o BottomNav agora é wrapped num container absolute em
        // GymCirclePreview — não é mais flex item.
        transition:
          "transform 320ms var(--gc-ease-ios), opacity 320ms var(--gc-ease-ios)",
      }}
    >
      <div className="gc-ios-tabbar grid rounded-full p-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;

          return (
            <button
              aria-label={item.label}
              className={[
                "gc-pressable relative flex h-12 items-center justify-center rounded-full",
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
              {item.badge ? (
                <span className="absolute right-2 top-1 grid min-w-5 place-items-center rounded-full bg-[var(--gc-pink)] px-1.5 py-0.5 text-[10px] font-black leading-none text-white shadow-[0_0_18px_rgba(255,45,85,0.38)]">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
