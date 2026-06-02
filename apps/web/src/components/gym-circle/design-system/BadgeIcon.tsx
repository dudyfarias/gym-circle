import {
  Calendar,
  Compass,
  Flame,
  Moon,
  Shield,
  Share2,
  Shuffle,
  Sunrise,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { BadgeIconKey } from "../social/gamification";

/**
 * Sprint 5.3 — Rich badges + secret support.
 *
 * Mapping de `BadgeIconKey` → ícone Lucide + tinta de fundo única.
 * Cada badge ganha identidade visual distinta no MyCircleSheet
 * (em vez do Trophy genérico antigo pra todas) e no BadgesSheet (Fase 5.4).
 *
 * Manter chaves sync com `social/gamification.ts` `BadgeIconKey`.
 */
type IconMeta = {
  Icon: LucideIcon;
  /** Cor de tinta de fundo + texto. Usa CSS vars pra respeitar tokens. */
  tint: string;
};

const ICON_MAP: Record<BadgeIconKey, IconMeta> = {
  trophy: { Icon: Trophy, tint: "bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]" },
  flame: {
    Icon: Flame,
    tint: "bg-[var(--gc-consistency-month)]/16 text-[var(--gc-consistency-month)]",
  },
  calendar: {
    Icon: Calendar,
    tint: "bg-[var(--gc-blue)]/14 text-[var(--gc-blue)]",
  },
  users: { Icon: Users, tint: "bg-[#A78BFA]/16 text-[#A78BFA]" },
  share: { Icon: Share2, tint: "bg-[#34D399]/16 text-[#34D399]" },
  shield: { Icon: Shield, tint: "bg-[#FBBF24]/16 text-[#FBBF24]" },
  sunrise: { Icon: Sunrise, tint: "bg-[#FB923C]/16 text-[#FB923C]" },
  moon: { Icon: Moon, tint: "bg-[#818CF8]/16 text-[#818CF8]" },
  shuffle: { Icon: Shuffle, tint: "bg-[#F472B6]/16 text-[#F472B6]" },
  compass: { Icon: Compass, tint: "bg-[#22D3EE]/16 text-[#22D3EE]" },
};

type BadgeIconProps = {
  iconKey: BadgeIconKey;
  size?: number;
  strokeWidth?: number;
  /**
   * `earned: false` renderiza dim (cinza escuro). Pra secret-not-earned
   * o caller pode optar por NÃO renderizar BadgeIcon (usa cadeado em vez).
   */
  earned?: boolean;
  /** Classe extra pro container (opcional). */
  className?: string;
};

/**
 * Renderiza um chip quadrado com ícone tematizado por iconKey. Quando
 * `earned: false`, cai pra estado dim (cinza). Componente puro/burro —
 * caller decide tamanho e posicionamento.
 */
export function BadgeIcon({
  iconKey,
  size = 20,
  strokeWidth = 2.2,
  earned = true,
  className = "",
}: BadgeIconProps) {
  const meta = ICON_MAP[iconKey];
  const Icon = meta.Icon;
  const tintClass = earned ? meta.tint : "bg-white/[0.04] text-white/26";
  return (
    <span
      aria-hidden="true"
      className={[
        "grid place-items-center rounded-[14px] aspect-square",
        tintClass,
        className,
      ].join(" ")}
    >
      <Icon
        fill={earned && (iconKey === "trophy" || iconKey === "flame") ? "currentColor" : "none"}
        size={size}
        strokeWidth={strokeWidth}
      />
    </span>
  );
}
